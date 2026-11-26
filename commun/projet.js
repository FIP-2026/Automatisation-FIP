/* =====================================================================
   PROJETS — projet de travail, liste des projets enregistrés, fichier projet, état des modules
   - Données du projet de travail : clés « fip.* » du navigateur (cahier, hypothèses C1/G1/Q1/NH, auvent A1,
     ancrages AN1, attaches AS1, rapport RC, identifications des modules, identification globale « fip.projet.ident »).
     Exclus : préférences d'affichage (fip.replie.*), transfert ponctuel fip.as1.pre, méta-données fip.projet.actif.
   - Liste des projets enregistrés (choix du projet de travail, à la manière d'un gestionnaire de projets) :
     base IndexedDB du navigateur « fip-etudes », magasin « projets » { id, nom, maj, cles }. Changer de projet
     enregistre d'abord le projet de travail dans la liste, puis charge l'autre.
   - Fichier projet (échange entre postes) : { format: "fip-projet", version, date, affaire, cles, maj }.
     L'export et l'import figent l'état « à jour » de chaque donnée (commun/suivi.js).
   Les données d'affaire restent sur le poste et le réseau FIP / SharePoint, jamais sur un dépôt public.
   ===================================================================== */
const PROJET = (() => {
  const EXCLUS = [/^fip\.replie\./, /^fip\.as1\.pre$/, /^fip\.projet\.(actif|suivi)$/];
  const META = "fip.projet.suivi", ACTIF = "fip.projet.actif";
  const cles = () => Object.keys(localStorage).filter((k) => /^fip\./.test(k) && !EXCLUS.some((r) => r.test(k))).sort();
  const LIB = { "fip.projet.ident": "Identification du projet", "fip.cahier": "Cahier de supportage", "fip.climat": "C1 – transfert vers S1", "fip.hyp.C": "C1 – charges climatiques et sismiques", "fip.hyp.G": "G1 – charges permanentes",
    "fip.hyp.Q": "Q1 – charges d'exploitation", "fip.hyp.gen": "NH – hypothèses générales et documents", "fip.a1": "A1 – données de l'auvent", "fip.a1.res": "A1 – résultats",
    "fip.rc": "RC – options du rapport", "fip.rc.as1": "AS1 – attaches du rapport", "fip.s1.ndc": "S1 – options de note", "fip.reactions": "S1 – réactions transmises",
    "fip.an1": "AN1 – platines et chevilles", "fip.an1.pre": "AN1 – efforts reçus", "fip.an1.retour": "AN1 – retour vers le module d'origine", "fip.s1.num": "S1 – affichage des numéros", "fip.a1.num": "A1 – affichage des numéros" };
  const lib = (k) => LIB[k] || (k.startsWith("fip.ident.") ? `Identification ${k.slice(10)}` : k);
  /* modules et données enregistrées (T1, H1, P1, P2 : calcul à la volée, rien d'enregistré) */
  const MODULES = [
    ["ID", "Identification du projet", ["fip.projet.ident"], "accueil.html"],
    ["C1", "Charges climatiques et sismiques", ["fip.hyp.C", "fip.climat"]], ["G1", "Charges permanentes", ["fip.hyp.G"]], ["Q1", "Charges d'exploitation", ["fip.hyp.Q"]],
    ["CS", "Cahier de supportage", ["fip.cahier"]], ["S1", "Supports standards", ["fip.s1.ndc", "fip.reactions"]],
    ["A1", "Toiture isolée (auvent)", ["fip.a1", "fip.a1.res", "fip.ident.A1"]], ["AS1", "Barres tendues", ["fip.ident.AS1", "fip.rc.as1"]],
    ["AN1", "Ancrages", ["fip.an1", "fip.ident.AN1", "fip.an1.pre", "fip.an1.retour"]],
    ["NH", "Note d'hypothèses", ["fip.hyp.gen"]], ["RC", "Rapport de calcul", ["fip.rc", "fip.ident.RC"]]];
  const ETATS = { vide: ["○", "Non renseigné", "#8a929c"], nouveau: ["●", "Renseigné, jamais exporté", "#b26a00"], modifie: ["▲", "Modifié depuis le dernier export", "#e30009"], ajour: ["✔", "À jour (identique au fichier exporté)", "#1d8a3a"] };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dateFr = (d) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const suivi = typeof SUIVI !== "undefined";
  const affaire = () => { if (suivi) return SUIVI.libelle(); try { const c = JSON.parse(localStorage.getItem("fip.cahier")), a = c && c.affaire; return a ? [a.num, a.intitule].filter(Boolean).join(" – ") : ""; } catch (e) { return ""; } };
  const nomCourant = () => affaire() || "Projet sans nom";
  const actif = () => { try { return JSON.parse(localStorage.getItem(ACTIF)) || null; } catch (e) { return null; } };
  const ecrireActif = (id) => { const s = JSON.stringify({ id }); if (localStorage.getItem(ACTIF) !== s) localStorage.setItem(ACTIF, s); };
  /* état agrégé d'un module : modifie > nouveau > ajour > vide ; date de dernière modification */
  function etatModule(K) {
    const E = K.map((k) => suivi ? SUIVI.etat(k) : { etat: localStorage.getItem(k) == null ? "vide" : "nouveau", maj: null });
    const ordre = ["modifie", "nouveau", "ajour", "vide"], e = ordre.find((x) => E.some((y) => y.etat === x)) || "vide";
    return { etat: e, maj: E.map((y) => y.maj).filter(Boolean).sort().pop() || null };
  }
  /* ---------- liste des projets (IndexedDB) ---------- */
  let dbP = null;
  const db = () => dbP || (dbP = new Promise((ok, ko) => { if (!window.indexedDB) return ko(new Error("IndexedDB indisponible"));
    const r = indexedDB.open("fip-etudes", 1); r.onupgradeneeded = () => r.result.createObjectStore("projets", { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }));
  const tx = async (mode, f) => { const d = await db(); return new Promise((ok, ko) => { const t = d.transaction("projets", mode), s = t.objectStore("projets"), r = f(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); }); };
  const liste = async () => ((await tx("readonly", (s) => s.getAll())) || []).sort((a, b) => String(b.maj).localeCompare(String(a.maj)));
  const lireP = (id) => tx("readonly", (s) => s.get(id));
  /* enregistre le projet de travail dans la liste (sans rien faire s'il est vide et sans identifiant) */
  async function sauverCourant() {
    const L = cles(); let a = actif();
    if (!a) { if (!L.length) return null; a = { id: uid() }; ecrireActif(a.id); }
    const m = suivi ? SUIVI.lireMeta() : {}, rec = { id: a.id, nom: nomCourant(), maj: Object.values(m.maj || {}).sort().pop() || new Date().toISOString(), cles: {} };
    L.forEach((k) => { rec.cles[k] = localStorage.getItem(k); }); const mv = localStorage.getItem(META); if (mv != null) rec.cles[META] = mv;
    await tx("readwrite", (s) => s.put(rec)); return rec;
  }
  const effacer = () => { [...cles(), META].forEach((k) => localStorage.removeItem(k)); };
  const poser = (C) => { Object.entries(C || {}).forEach(([k, v]) => { if (/^fip\./.test(k) && !/^fip\.projet\.actif$/.test(k) && v != null) (suivi ? SUIVI.set0 : Storage.prototype.setItem).call(localStorage, k, v); }); };
  async function ouvrir(id) {
    if (actif() && actif().id === id) return;
    try { await sauverCourant(); } catch (e) { if (!confirm("Le projet de travail n'a pas pu être enregistré dans la liste (" + e.message + "). Changer quand même ?")) return; }
    const r = await lireP(id); if (!r) { alert("Projet introuvable dans la liste."); return; }
    effacer(); poser(r.cles); ecrireActif(id); location.reload();
  }
  async function nouveau() {
    if (!confirm("Créer un nouveau projet ?\n\nLe projet de travail « " + nomCourant() + " » est enregistré dans la liste des projets ; vous pourrez le rouvrir avec la liste déroulante.")) return;
    try { await sauverCourant(); } catch (e) { if (!confirm("Enregistrement dans la liste impossible (" + e.message + ") : les données du projet de travail seront perdues si vous ne l'avez pas exporté. Continuer ?")) return; }
    effacer(); ecrireActif(uid()); location.reload();
  }
  async function supprimer(id) {
    const r = await lireP(id); if (!r) return;
    if (!confirm(`Supprimer définitivement le projet « ${r.nom} » de la liste de ce navigateur ?\n\nExportez-le d'abord si vous voulez le conserver.`)) return;
    await tx("readwrite", (s) => s.delete(id)); location.reload();
  }
  /* ---------- fichier projet ---------- */
  function exporter() {
    const L = cles(); if (!L.length) { alert("Aucune donnée d'affaire dans ce navigateur."); return; }
    const m = suivi ? SUIVI.lireMeta() : {};
    const o = { format: "fip-projet", version: typeof CALC_VERSION !== "undefined" ? CALC_VERSION : "", date: new Date().toISOString(), affaire: affaire(), cles: {}, maj: m.maj || {} };
    L.forEach((k) => { o.cles[k] = localStorage.getItem(k); });
    const nom = `Projet_${(o.affaire || "affaire").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60)}_${o.date.slice(0, 10)}.json`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = nom;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    if (suivi) SUIVI.figer(L); sauverCourant().catch(() => { });
    return nom;
  }
  function importer(apres) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = () => { const fi = inp.files[0]; if (!fi) return; const r = new FileReader();
      r.onload = async () => { let o; try { o = JSON.parse(r.result); } catch (e) { alert("Fichier illisible (JSON attendu)."); return; }
        if (!o || o.format !== "fip-projet" || !o.cles) { alert("Ce fichier n'est pas un fichier projet FIP Études."); return; }
        const K = Object.keys(o.cles).filter((k) => /^fip\./.test(k) && !EXCLUS.some((x) => x.test(k)));
        if (!confirm(`Ouvrir le projet « ${o.affaire || "sans nom"} » (${o.version || "?"}, enregistré le ${new Date(o.date).toLocaleString("fr-FR")}) comme projet de travail ?\n\nDonnées :\n` + K.map((k) => " • " + lib(k)).join("\n") +
          `\n\nLe projet de travail actuel « ${nomCourant()} » est d'abord enregistré dans la liste des projets.`)) return;
        try { await sauverCourant(); } catch (e) { if (!confirm("Enregistrement du projet de travail dans la liste impossible (" + e.message + ") : exportez-le d'abord si besoin. Continuer ?")) return; }
        try { effacer(); K.forEach((k) => { if (o.cles[k] != null) (suivi ? SUIVI.set0 : Storage.prototype.setItem).call(localStorage, k, o.cles[k]); }); }
        catch (e) { alert("Import impossible : " + e.message); return; }
        if (suivi) SUIVI.figer(K, o.maj || {}); ecrireActif(uid()); try { await sauverCourant(); } catch (e) { }
        alert(`Projet ouvert (${K.length} donnée(s)).`); if (apres) apres(); else location.reload(); };
      r.readAsText(fi); };
    inp.click();
  }
  /* ---------- affichage : sélecteur de projet, actions, état des modules ---------- */
  function etatHTML(base) {
    const m = suivi ? SUIVI.lireMeta() : {}, connus = new Set(MODULES.flatMap((x) => x[2]));
    const url = (code, u) => u ? base + u : (typeof CALC_APPS !== "undefined" ? (CALC_APPS.find((a) => a.code === code) || {}).url : "") ? base + CALC_APPS.find((a) => a.code === code).url : "";
    const ligne = (code, nom, K, u) => { const e = etatModule(K), [ic, txt, col] = ETATS[e.etat], h = url(code, u);
      return `<tr><td><span class="mono">${esc(code)}</span></td><td>${h ? `<a href="${esc(h)}">${esc(nom)}</a>` : esc(nom)}</td><td style="color:${col};font-weight:600;white-space:nowrap">${ic} ${txt}</td><td class="note" style="white-space:nowrap">${e.maj ? dateFr(e.maj) : "—"}</td></tr>`; };
    const autres = cles().filter((k) => !connus.has(k) && !/^fip\.(s1|a1)\.num$/.test(k));
    const nMod = MODULES.filter((x) => ["modifie", "nouveau"].includes(etatModule(x[2]).etat)).length;
    return `<div class="note" style="margin:6px 0 4px">${m.refDate ? `Dernier export / import du fichier projet : <b>${dateFr(m.refDate)}</b>` : "Fichier projet jamais exporté depuis ce navigateur"} · ${nMod ? `<b style="color:#e30009">${nMod} module(s) à exporter</b>` : "rien à exporter"}</div>
      <table class="etat-projet" style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="text-align:left">Code</th><th style="text-align:left">Module</th><th style="text-align:left">État</th><th style="text-align:left">Dernière modification</th></tr>
      ${MODULES.map(([c, n, K, u]) => ligne(c, n, K, u)).join("")}${autres.length ? ligne("··", "Autres données (" + autres.map(lib).join(", ") + ")", autres) : ""}</table>
      <div class="note" style="margin-top:4px">T1, H1, P1 et P2 calculent à la volée : rien n'est enregistré dans le projet. Un module « à jour » est identique au dernier fichier projet exporté ou importé.</div>`;
  }
  /* barre : PROJET.barre('idConteneur', base = '' (accueil) ou '../' (modules), opt.etat = id du conteneur de l'état des modules) */
  function barre(id, base = "", opt = {}) {
    const el = document.getElementById(id); if (!el) return;
    const a = actif(), L = cles();
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><b>Projet de travail</b>
        <select data-pj="sel" style="min-width:260px;max-width:100%" title="Projets enregistrés dans ce navigateur"><option value="">${esc(nomCourant())} (en cours)</option></select>
        <span style="flex:1"></span><button type="button" class="sec" data-pj="new">🗋 Nouveau projet</button><button type="button" data-pj="exp">⬇ Exporter le fichier projet</button><button type="button" class="sec" data-pj="imp">⬆ Ouvrir un fichier projet</button><button type="button" class="sec" data-pj="del" hidden>🗑 Supprimer de la liste</button></div>
      ${opt.etat ? "" : '<div data-pj="etat"></div>'}
      <div class="note" style="margin-top:4px">La liste déroulante donne les projets enregistrés dans ce navigateur : choisir un projet l'ouvre (le projet en cours est enregistré dans la liste). Pour échanger un projet entre postes (projeteur ↔ calculateur) : un seul fichier .json, à conserver sur le réseau FIP / SharePoint, jamais sur un dépôt public. Fermez les autres onglets FIP Études avant de changer de projet.</div>`;
    const zEtat = opt.etat ? document.getElementById(opt.etat) : el.querySelector('[data-pj="etat"]'), majEtat = () => { if (zEtat) zEtat.innerHTML = etatHTML(base); };
    majEtat(); barre.majEtat = majEtat;
    const sel = el.querySelector('[data-pj="sel"]'), del = el.querySelector('[data-pj="del"]');
    (async () => { try { await sauverCourant(); const P = await liste(), cur = actif();
        sel.innerHTML = P.map((p) => `<option value="${esc(p.id)}" ${cur && cur.id === p.id ? "selected" : ""}>${esc(p.nom)}${cur && cur.id === p.id ? " (en cours)" : ""} – ${dateFr(p.maj)}</option>`).join("") || `<option value="">${esc(nomCourant())} (en cours)</option>`;
        sel.onchange = () => { del.hidden = !sel.value || (actif() && actif().id === sel.value); if (sel.value && !(actif() && actif().id === sel.value)) { if (confirm(`Ouvrir le projet « ${sel.options[sel.selectedIndex].text.replace(/ – [^–]*$/, "")} » ?\n\nLe projet en cours est enregistré dans la liste.`)) ouvrir(sel.value); else { sel.value = (actif() || {}).id || ""; del.hidden = true; } } };
        sel.oncontextmenu = null; del.hidden = true;
        el.querySelector('[data-pj="del"]').onclick = () => supprimer(sel.value);
      } catch (e) { sel.disabled = true; sel.title = "Liste des projets indisponible dans ce navigateur (" + e.message + ") : utiliser le fichier projet."; } })();
    el.querySelector('[data-pj="exp"]').onclick = () => { exporter(); majEtat(); };
    el.querySelector('[data-pj="imp"]').onclick = () => importer();
    el.querySelector('[data-pj="new"]').onclick = () => nouveau();
  }
  /* ---------- identification globale du projet (accueil) ---------- */
  const CHAMPS = [["num", "N° d'affaire (projet)"], ["intitule", "Intitulé du projet"], ["client", "Client"], ["site", "Site"], ["phase", "Phase", ["APS", "APD", "PRO", "EXE"]],
    ["bonPour", "Bon pour (par défaut)", ["CONSULTATION", "APPROBATION", "INFORMATION", "EXÉCUTION"]], ["realise", "Auteur – réalisé (par défaut)"], ["controle", "Vérifié (par défaut)"], ["approuve", "Approuvé (par défaut)"]];
  function identification(id, apres) {
    const el = document.getElementById(id); if (!el || !suivi) return;
    const g = SUIVI.ident();
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px 10px">${CHAMPS.map(([k, l, L]) => `<div><label style="font-size:12px;color:#5f6670">${l}</label>${L ? `<select data-ig="${k}" style="width:100%"><option value=""></option>${L.map((v) => `<option ${g[k] === v ? "selected" : ""}>${v}</option>`).join("")}</select>` : `<input data-ig="${k}" value="${esc(g[k] || "")}" style="width:100%">`}</div>`).join("")}</div>
      <div data-ig-logo style="margin-top:6px"></div>
      <div class="note">Reprise dans tous les outils : n° d'affaire, intitulé, client, site, phase et logo sont communs à tous les modules (une modification faite dans un module revient ici) ; bon pour et auteurs servent de valeurs par défaut quand le champ du module est vide. N° de document, indice, date et repère restent propres à chaque document.</div>`;
    el.addEventListener("input", (e) => { const i = e.target.closest("[data-ig]"); if (!i) return; SUIVI.majIdent({ [i.dataset.ig]: i.value }, true); if (apres) apres(); });
    el.addEventListener("change", (e) => { const i = e.target.closest("select[data-ig]"); if (!i) return; SUIVI.majIdent({ [i.dataset.ig]: i.value }, true); if (apres) apres(); });
    if (typeof IDENT !== "undefined") IDENT.logoChamp(el.querySelector("[data-ig-logo]"), () => SUIVI.ident().logo || "", (l) => { SUIVI.majIdent({ logo: l }, true); if (apres) apres(); });
  }
  const majEtat = () => { if (barre.majEtat) barre.majEtat(); };
  return { exporter, importer, nouveau, ouvrir, supprimer, liste, sauverCourant, barre, majEtat, identification, etatHTML, etatModule, cles, lib, MODULES, ETATS };
})();
