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
  const EXCLUS = SUIVI.EXCLUS, META = SUIVI.META, ACTIF = SUIVI.ACTIF, MODULES = SUIVI.MODULES, cles = SUIVI.cles;
  const LIB = { "fip.projet.ident": "Identification du projet", "fip.cahier": "Cahier de supportage", "fip.climat": "C1 – données transmises à S1 et au cahier", "fip.hyp.C": "C1 – charges climatiques et sismiques", "fip.hyp.G": "G1 – charges permanentes",
    "fip.hyp.Q": "Q1 – charges d'exploitation", "fip.hyp.gen": "NH – hypothèses générales et documents", "fip.a1": "A1 – données de l'auvent", "fip.a1.res": "A1 – résultats",
    "fip.rc": "RC – options du rapport", "fip.rc.as1": "AS1 – attaches du rapport", "fip.s1.ndc": "S1 – options de note", "fip.reactions": "S1 – réactions transmises",
    "fip.an1": "AN1 – platines et chevilles", "fip.an1.pre": "AN1 – efforts reçus", "fip.an1.retour": "AN1 – résultats renvoyés aux modules", "fip.s1.num": "S1 – affichage des numéros", "fip.a1.num": "A1 – affichage des numéros" };
  const lib = (k) => LIB[k] || (k.startsWith("fip.ident.") ? `Identification ${k.slice(10)}` : k);
  const ETATS = { vide: ["○", "Non renseigné", "#8a929c"], modifie: ["▲", "Modifié, non enregistré", "#e30009"], enregistre: ["✔", "Enregistré", "#1d8a3a"] };
  const FICHIER = { jamais: ["●", "jamais exporté", "#b26a00"], aexporter: ["▲", "à exporter", "#b26a00"], ajour: ["✔", "à jour", "#1d8a3a"] };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dateFr = (d) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const affaire = () => SUIVI.libelle();
  const nomCourant = () => affaire() || "Projet sans nom";
  const actif = () => { try { return JSON.parse(localStorage.getItem(ACTIF)) || null; } catch (e) { return null; } };
  const ecrireActif = (id) => { const s = JSON.stringify({ id }); if (localStorage.getItem(ACTIF) !== s) SUIVI.set0.call(localStorage, ACTIF, s); };
  /* état agrégé d'un module : modifié > enregistré > vide ; fichier : à exporter > jamais > à jour ; dernière modification et auteur */
  function etatModule(K) {
    const m = SUIVI.lireMeta(), E = K.map((k) => SUIVI.etatCle(k, m));
    const e = ["modifie", "enregistre"].find((x) => E.some((y) => y.etat === x)) || "vide", fi = e === "vide" ? null : ["aexporter", "jamais", "ajour"].find((x) => E.some((y) => y.fichier === x)) || null;
    const der = E.filter((y) => y.maj).sort((a, b) => String(a.maj).localeCompare(String(b.maj))).pop();
    return { etat: e, fichier: fi, maj: der ? der.maj : null, par: der ? der.par : "" };
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
    const m = SUIVI.lireMeta(), rec = { id: a.id, nom: nomCourant(), maj: Object.values(m.maj || {}).sort().pop() || m.saveDate || new Date().toISOString(), cles: {} };
    L.forEach((k) => { rec.cles[k] = localStorage.getItem(k); }); const mv = localStorage.getItem(META); if (mv != null) rec.cles[META] = mv;
    await tx("readwrite", (s) => s.put(rec)); return rec;
  }
  const effacer = () => { [...cles(), META].forEach((k) => SUIVI.rem0.call(localStorage, k)); };   // changement de projet : écritures non datées
  const poser = (C) => { Object.entries(C || {}).forEach(([k, v]) => { if (/^fip\./.test(k) && k !== ACTIF && v != null) SUIVI.set0.call(localStorage, k, v); }); };
  async function ouvrir(id, apres) {
    if (actif() && actif().id === id) return;
    try { await sauverCourant(); } catch (e) { if (!confirm("Le projet de travail n'a pas pu être enregistré dans la liste (" + e.message + "). Changer quand même ?")) return; }
    const r = await lireP(id); if (!r) { alert("Projet introuvable dans la liste."); return; }
    effacer(); poser(r.cles); ecrireActif(id); if (apres) apres(); else location.reload();
  }
  async function nouveau() {
    if (!confirm("Créer un nouveau projet ?\n\nLe projet de travail « " + nomCourant() + " » est enregistré dans la liste des projets ; vous pourrez le rouvrir avec la liste déroulante.")) return;
    try { await sauverCourant(); } catch (e) { if (!confirm("Enregistrement dans la liste impossible (" + e.message + ") : les données du projet de travail seront perdues si vous ne l'avez pas exporté. Continuer ?")) return; }
    effacer(); ecrireActif(uid()); location.reload();
  }
  /* ---------- fichier projet ---------- */
  function exporter() {
    const L = cles(); if (!L.length) { alert("Aucune donnée d'affaire dans ce navigateur."); return; }
    if (SUIVI.aEnregistrer().length && confirm("Des modifications ne sont pas enregistrées. Les enregistrer avant l'export ?")) SUIVI.enregistrer();
    const m = SUIVI.lireMeta(), pid = (actif() || {}).id || uid(); ecrireActif(pid);
    const o = { format: "fip-projet", version: typeof CALC_VERSION !== "undefined" ? CALC_VERSION : "", date: new Date().toISOString(), affaire: affaire(), pid, par: SUIVI.user(), cles: {}, maj: m.maj || {}, auteurs: m.par || {}, journal: (m.journal || []).slice(-100) };
    L.forEach((k) => { o.cles[k] = localStorage.getItem(k); });
    const nom = `Projet_${(o.affaire || "affaire").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60)}_${o.date.slice(0, 10)}.json`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = nom;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    SUIVI.figer(L); SUIVI.journal({ a: "Export du fichier projet", txt: nom }); sauverCourant().catch(() => { });
    return nom;
  }
  /* fusion d'un fichier projet dans le projet de travail (même projet, pid) : comparaison à la référence commune (dernier échange)
     - donnée inchangée ici depuis l'échange → version du fichier ; inchangée dans le fichier → version locale ;
     - modifiée des deux côtés → CONFLIT : alerte par module, l'utilisateur choisit (fichier ou local). Renvoie le compte rendu. */
  /* décision pour un module : D = [{ hL, hF, hB }] (empreintes locale, du fichier, de la référence commune) */
  function decisionModule(D) { const diff = D.filter((x) => x.hL !== x.hF); if (!diff.length) return "identique";
    const loc = diff.some((x) => x.hL !== x.hB), fic = diff.some((x) => x.hF !== x.hB); return !loc ? "fichier" : !fic ? "local" : "conflit"; }
  function fusionner(o, K, choix) {
    const m = SUIVI.lireMeta(), E = SUIVI.empreinte, ref = m.ref || {}, pris = [], gardes = [], conflits = {}, G = {};
    const tous = [...new Set([...K, ...cles().filter((k) => !EXCLUS.some((x) => x.test(k)))])];
    tous.forEach((k) => { const L = localStorage.getItem(k), F = o.cles[k] ?? null, hL = L == null ? null : E(L), hF = F == null ? null : E(F), hB = ref[k] ?? null;
      if (hL === hF) return; const md = SUIVI.moduleDeCle(k) || k, g = G[md] || (G[md] = { K: [], D: [] }); g.K.push(k); g.D.push({ hL, hF, hB }); });
    Object.entries(G).forEach(([md, g]) => { const d = decisionModule(g.D); if (d === "fichier") pris.push(...g.K); else if (d === "local") gardes.push(...g.K); else if (d === "conflit") conflits[md] = g.K; });   // décision par module : toutes ses données du même côté
    const res = { pris: [], gardes: [...gardes], conflits: [] };
    Object.entries(conflits).forEach(([md, L]) => { const nm = (MODULES.find((x) => x[0] === md) || [md, lib(L[0])])[1];
      const loc = L.map((k) => (m.maj || {})[k]).filter(Boolean).sort().pop(), qui = L.map((k) => (m.par || {})[k]).filter(Boolean).pop();
      const fic = L.map((k) => (o.maj || {})[k]).filter(Boolean).sort().pop(), quiF = L.map((k) => (o.auteurs || {})[k]).filter(Boolean).pop();
      const prendre = choix ? choix(md, L) : confirm(`⚠ CONFLIT – ${md} ${nm}\n\nCe module a été modifié des deux côtés depuis le dernier échange :\n • ici : ${qui || "?"} le ${dateFr(loc) || "?"}\n • dans le fichier : ${quiF || o.par || "?"} le ${dateFr(fic) || dateFr(o.date)}\n\nOK = prendre la version du fichier (la vôtre est remplacée)\nAnnuler = garder votre version (à renvoyer à l'autre poste)`);
      res.conflits.push({ md, L, prendre }); (prendre ? res.pris : res.gardes).push(...L); });
    res.pris.push(...pris);
    res.pris.forEach((k) => { if (o.cles[k] == null) SUIVI.rem0.call(localStorage, k); else SUIVI.set0.call(localStorage, k, o.cles[k]); });
    const mm = SUIVI.lireMeta(); res.pris.forEach((k) => { if (o.maj && o.maj[k]) (mm.maj = mm.maj || {})[k] = o.maj[k]; if (o.auteurs && o.auteurs[k]) (mm.par = mm.par || {})[k] = o.auteurs[k]; }); SUIVI.ecrireMeta(mm);
    SUIVI.figer(K, null, o.cles);                                                    // nouvelle référence commune : le fichier
    res.conflits.forEach((c) => SUIVI.journal({ a: "Conflit résolu", m: c.md, txt: c.prendre ? "version du fichier retenue" : "version locale conservée" }));
    SUIVI.journal({ a: "Import du fichier projet", txt: `${res.pris.length} donnée(s) reprise(s), ${res.gardes.length} conservée(s)${res.conflits.length ? ", " + res.conflits.length + " conflit(s)" : ""}` });
    return res;
  }
  function importer(apres) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = () => { const fi = inp.files[0]; if (!fi) return; const r = new FileReader();
      r.onload = async () => { let o; try { o = JSON.parse(r.result); } catch (e) { alert("Fichier illisible (JSON attendu)."); return; }
        if (!o || o.format !== "fip-projet" || !o.cles) { alert("Ce fichier n'est pas un fichier projet FIP Études."); return; }
        const K = Object.keys(o.cles).filter((k) => /^fip\./.test(k) && !EXCLUS.some((x) => x.test(k)));
        let connu = null; try { connu = o.pid && (actif() && actif().id === o.pid ? "courant" : (await lireP(o.pid)) ? "liste" : null); } catch (e) { }
        if (connu) {                                                                // même projet : mise à jour avec détection des conflits
          if (!confirm(`Mettre à jour le projet « ${o.affaire || "sans nom"} » avec le fichier de ${o.par || "?"} (${new Date(o.date).toLocaleString("fr-FR")}) ?\n\nLes modules modifiés des deux côtés depuis le dernier échange vous seront signalés un par un.`)) return;
          if (connu === "liste") { try { await sauverCourant(); } catch (e) { } const rec = await lireP(o.pid); effacer(); poser(rec.cles); ecrireActif(o.pid); }
          const res = fusionner(o, K); try { await sauverCourant(); } catch (e) { }
          alert(`Projet mis à jour : ${res.pris.length} donnée(s) reprise(s) du fichier, ${res.gardes.length} conservée(s)${res.conflits.length ? `, ${res.conflits.length} conflit(s) (voir le journal du projet)` : ""}.`);
          if (apres) apres(); else location.reload(); return; }
        if (!confirm(`Ouvrir le projet « ${o.affaire || "sans nom"} » (${o.version || "?"}, enregistré le ${new Date(o.date).toLocaleString("fr-FR")}) comme projet de travail ?\n\nDonnées :\n` + K.map((k) => " • " + lib(k)).join("\n") +
          `\n\nLe projet de travail actuel « ${nomCourant()} » est d'abord enregistré dans la liste des projets.`)) return;
        try { await sauverCourant(); } catch (e) { if (!confirm("Enregistrement du projet de travail dans la liste impossible (" + e.message + ") : exportez-le d'abord si besoin. Continuer ?")) return; }
        try { effacer(); K.forEach((k) => { if (o.cles[k] != null) SUIVI.set0.call(localStorage, k, o.cles[k]); }); }
        catch (e) { alert("Import impossible : " + e.message); return; }
        SUIVI.figer(K, o.maj || {}, null, o.auteurs || {}); const mm = SUIVI.lireMeta(); mm.save = { ...(mm.ref || {}) }; mm.saveDate = new Date().toISOString(); mm.journal = [...(o.journal || [])]; SUIVI.ecrireMeta(mm);
        SUIVI.journal({ a: "Ouverture du fichier projet", txt: `fichier de ${o.par || "?"} du ${new Date(o.date).toLocaleString("fr-FR")}` });
        ecrireActif(o.pid || uid()); try { await sauverCourant(); } catch (e) { }
        alert(`Projet ouvert (${K.length} donnée(s)).`); if (apres) apres(); else location.reload(); };
      r.readAsText(fi); };
    inp.click();
  }
  /* ---------- affichage : état des modules, responsables, journal ---------- */
  function etatHTML(base) {
    const m = SUIVI.lireMeta(), connus = new Set(MODULES.flatMap((x) => x[2]));
    const ligne = (code, nom, K, u) => { const e = etatModule(K), [ic, txt, col] = ETATS[e.etat], F = e.fichier && FICHIER[e.fichier], h = u ? base + u : "";
      return `<tr><td><span class="mono">${esc(code)}</span></td><td>${h ? `<a href="${esc(h)}">${esc(nom)}</a>` : esc(nom)}</td><td style="color:${col};font-weight:600;white-space:nowrap">${ic} ${txt}</td>
        <td style="white-space:nowrap;${F ? `color:${F[2]}` : ""}">${F ? `${F[0]} ${F[1]}` : "—"}</td><td class="note" style="white-space:nowrap">${e.maj ? dateFr(e.maj) : "—"}</td><td style="white-space:nowrap">${e.par ? esc(e.par) : "—"}</td></tr>`; };
    const autres = cles().filter((k) => !connus.has(k) && !/^fip\.(s1|a1)\.num$/.test(k) && k !== "fip.an1.pre");
    const nE = MODULES.filter((x) => etatModule(x[2]).etat === "modifie").length, nX = MODULES.filter((x) => ["aexporter", "jamais"].includes(etatModule(x[2]).fichier)).length;
    const J = (m.journal || []).slice(-8).reverse();
    return `<div class="note" style="margin:6px 0 4px">${m.saveDate ? `Dernier enregistrement : <b>${dateFr(m.saveDate)}</b>` : "Projet jamais enregistré"} · ${nE ? `<b style="color:#e30009">${nE} module(s) modifié(s) non enregistré(s)</b>` : "tout est enregistré"} · ${m.refDate ? `dernier échange de fichier : ${dateFr(m.refDate)}` : "fichier projet jamais exporté"}${nX ? ` · <b style="color:#b26a00">${nX} module(s) à exporter</b>` : ""}</div>
      <table class="etat-projet" style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="text-align:left">Code</th><th style="text-align:left">Module</th><th style="text-align:left">État</th><th style="text-align:left">Fichier projet</th><th style="text-align:left">Dernière modification</th><th style="text-align:left" title="Utilisateur connecté qui a fait la dernière modification">Modifié par</th></tr>
      ${MODULES.map(([c, n, K, u]) => ligne(c, n, K, u)).join("")}${autres.length ? ligne("··", "Autres données (" + autres.map(lib).join(", ") + ")", autres) : ""}</table>
      <div class="note" style="margin-top:4px">T1, H1, P1 et P2 calculent à la volée : rien n'est enregistré. Un module est « renseigné » après une saisie ; « 💾 Enregistrer » (chaque page, Ctrl+S) valide les modifications. « Modifié par » : utilisateur connecté qui a fait la dernière modification du module (journal du projet ci-dessous).</div>
      ${J.length ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-weight:600;font-size:13px">Journal du projet (${(m.journal || []).length})</summary><table style="font-size:12px;width:100%">${J.map((j) => `<tr><td class="note" style="white-space:nowrap">${dateFr(j.d)}</td><td>${esc(j.u || "")}</td><td><b>${esc(j.a)}</b>${j.m ? " – " + esc(j.m) : ""}${j.txt ? ` <span class="note">${esc(j.txt)}</span>` : ""}</td></tr>`).join("")}</table></details>` : ""}`;
  }
  /* barre : PROJET.barre('idConteneur', base = '' (accueil) ou '../' (modules), opt.etat = id du conteneur de l'état des modules) */
  /* ---------- recherche dans la liste des projets ---------- */
  const sansAccent = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  /* texte de recherche d'un projet enregistré : nom + identification (n°, intitulé, client, site, phase) */
  const texteProjet = (p) => { let g = {}; try { g = JSON.parse((p.cles || {})["fip.projet.ident"] || "{}") || {}; } catch (e) { }
    return [p.nom, g.num, g.intitule, g.client, g.site, g.phase].filter(Boolean).join(" "); };
  /* filtre : tous les mots saisis doivent figurer (sans accents ni casse) ; P = projets, q = texte saisi */
  const filtrer = (P, q) => { const M = sansAccent(q).split(/\s+/).filter(Boolean); return M.length ? P.filter((p) => { const s = sansAccent(texteProjet(p)); return M.every((m) => s.includes(m)); }) : P.slice(); };
  /* suppression d'un projet de la liste ; le projet de travail supprimé laisse place à un projet vide */
  async function supprimerProjet(id) {
    const r = await lireP(id), cur = actif() && actif().id === id, nom = r ? r.nom : nomCourant();
    if (!confirm(`Supprimer définitivement le projet « ${nom} » de ce navigateur ?${cur ? "\n\nC'est le projet ouvert : ses données de travail sont effacées et un projet vide est ouvert." : ""}\n\nExportez-le d'abord (fichier projet) si vous voulez le conserver.`)) return false;
    await tx("readwrite", (s) => s.delete(id));
    if (cur) { effacer(); ecrireActif(uid()); }
    return true;
  }
  /* barre : PROJET.barre('idConteneur', base = '' (accueil) ou '../' (modules), opt.etat = id du conteneur de l'état des modules) */
  function barre(id, base = "", opt = {}) {
    const el = document.getElementById(id); if (!el) return;
    if (!document.getElementById("pjStyle")) { const st = document.createElement("style"); st.id = "pjStyle";
      st.textContent = `.pj-choix{position:relative;flex:1 1 340px;max-width:560px}.pj-choix input{width:100%;box-sizing:border-box}
        .pj-liste{position:absolute;z-index:40;left:0;right:0;top:100%;margin-top:2px;background:#fff;border:1px solid #cfd4db;border-radius:6px;box-shadow:0 8px 24px rgba(23,26,30,.14);max-height:340px;overflow:auto}
        .pj-ligne{display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid #eef0f3;cursor:pointer;font-size:13px}.pj-ligne:last-child{border-bottom:0}
        .pj-ligne.on,.pj-ligne:hover{background:#f1f5fb}.pj-ligne .t{flex:1;min-width:0}.pj-ligne .t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pj-ligne .t span{color:#5f6670;font-size:12px}.pj-ligne mark{background:#fff1a8;padding:0}.pj-ligne button{padding:2px 8px;font-size:12px}.pj-vide{padding:8px 10px;color:#5f6670;font-size:13px}`;
      document.head.appendChild(st); }
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><b>Projet de travail</b>
        <div class="pj-choix"><input data-pj="cherche" type="search" autocomplete="off" placeholder="🔎 ${esc(nomCourant())} (en cours) – rechercher : n°, intitulé, client, site…" title="Projets enregistrés dans ce navigateur : taper un mot clé pour filtrer, ↑ ↓ puis Entrée pour ouvrir"><div class="pj-liste" data-pj="liste" hidden></div></div>
        <span style="flex:1"></span><button type="button" class="sec" data-pj="new">🗋 Nouveau projet</button><button type="button" data-pj="exp">⬇ Exporter le fichier projet</button><button type="button" class="sec" data-pj="imp">⬆ Ouvrir un fichier projet</button></div>
      ${opt.etat ? "" : '<div data-pj="etat"></div>'}
      <div class="note" style="margin-top:4px">Projets enregistrés dans ce navigateur : cliquer dans le champ (ou taper un mot clé : n°, intitulé, client, site, phase) pour les lister, puis « Ouvrir » (le projet en cours est enregistré dans la liste) ou « 🗑 » pour supprimer. Pour échanger un projet entre postes (projeteur ↔ calculateur) : un seul fichier .json, à conserver sur le réseau FIP / SharePoint, jamais sur un dépôt public. Fermez les autres onglets FIP Études avant de changer de projet.</div>`;
    const zEtat = opt.etat ? document.getElementById(opt.etat) : el.querySelector('[data-pj="etat"]'), majEtat = () => { if (zEtat) zEtat.innerHTML = etatHTML(base); };
    majEtat(); barre.majEtat = majEtat;
    const inp = el.querySelector('[data-pj="cherche"]'), box = el.querySelector('[data-pj="liste"]');
    let P = [], vus = [], sel = -1;
    const marquer = (s, q) => { s = String(s ?? ""); const n = sansAccent(s), on = new Array(s.length).fill(false);   // surligne chaque mot saisi (sans accents)
      sansAccent(q).split(/\s+/).filter(Boolean).forEach((m) => { let i = n.indexOf(m); while (i >= 0) { for (let k = i; k < i + m.length; k++) on[k] = true; i = n.indexOf(m, i + m.length); } });
      let h = "", ouvert = false; for (let k = 0; k < s.length; k++) { if (on[k] !== ouvert) { h += on[k] ? "<mark>" : "</mark>"; ouvert = on[k]; } h += esc(s[k]); } return h + (ouvert ? "</mark>" : ""); };
    const rendre = () => { const q = inp.value, cur = actif(); vus = filtrer(P, q); if (sel >= vus.length) sel = vus.length - 1;
      box.innerHTML = vus.length ? vus.map((p, i) => { let g = {}; try { g = JSON.parse((p.cles || {})["fip.projet.ident"] || "{}") || {}; } catch (e) { } const enCours = cur && cur.id === p.id;
        return `<div class="pj-ligne ${i === sel ? "on" : ""}" data-i="${i}"><div class="t"><b>${marquer(p.nom, q)}${enCours ? ' <span style="color:#1d8a3a">(en cours)</span>' : ""}</b><span>${marquer([g.client, g.site, g.phase].filter(Boolean).join(" · "), q)}${g.client || g.site || g.phase ? " · " : ""}modifié le ${dateFr(p.maj)}</span></div>
          ${enCours ? "" : `<button type="button" data-ouvrir="${i}">Ouvrir</button>`}<button type="button" class="sec" data-suppr="${i}" title="Supprimer ce projet de ce navigateur">🗑</button></div>`; }).join("")
        : `<div class="pj-vide">${P.length ? "Aucun projet ne correspond à « " + esc(q) + " »." : "Aucun projet enregistré dans ce navigateur."}</div>`; };
    const ouvrirP = (p) => { if (!p || (actif() && actif().id === p.id)) { box.hidden = true; return; } if (confirm(`Ouvrir le projet « ${p.nom} » ?\n\nLe projet en cours est enregistré dans la liste.`)) ouvrir(p.id); };
    const charger = async () => { try { await sauverCourant(); P = await liste(); } catch (e) { inp.disabled = true; inp.placeholder = "Liste des projets indisponible (" + e.message + ") : utiliser le fichier projet"; } };
    const montrer = async () => { if (box.hidden) await charger(); box.hidden = false; rendre(); };   // liste relue à chaque ouverture (projet en cours enregistré d'abord)
    inp.addEventListener("focus", montrer); inp.addEventListener("click", montrer);
    inp.addEventListener("input", () => { sel = 0; box.hidden = false; rendre(); });
    inp.addEventListener("keydown", (e) => { if (box.hidden && ["ArrowDown", "Enter"].includes(e.key)) { montrer(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, vus.length - 1); rendre(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); rendre(); }
      else if (e.key === "Enter") { e.preventDefault(); ouvrirP(vus[Math.max(sel, 0)]); }
      else if (e.key === "Escape") { box.hidden = true; inp.blur(); } });
    box.addEventListener("mousedown", (e) => e.preventDefault());                    // garder le focus dans le champ
    box.addEventListener("click", async (e) => { const o = e.target.closest("[data-ouvrir]"), s = e.target.closest("[data-suppr]"), l = e.target.closest(".pj-ligne");
      if (s) { const p = vus[+s.dataset.suppr]; if (p && await supprimerProjet(p.id)) { if (!actif() || !P.some((x) => x.id === actif().id) || actif().id === p.id) { location.reload(); return; } P = await liste(); rendre(); } return; }
      if (o) { ouvrirP(vus[+o.dataset.ouvrir]); return; } if (l) ouvrirP(vus[+l.dataset.i]); });
    document.addEventListener("click", (e) => { if (!el.querySelector(".pj-choix").contains(e.target)) box.hidden = true; });
    charger();
    el.querySelector('[data-pj="exp"]').onclick = () => { exporter(); majEtat(); };
    el.querySelector('[data-pj="imp"]').onclick = () => importer();
    el.querySelector('[data-pj="new"]').onclick = () => nouveau();
  }
  /* ---------- identification globale du projet (accueil) ---------- */
  const CHAMPS = [["num", "N° d'affaire (projet)"], ["intitule", "Intitulé du projet"], ["client", "Client"], ["site", "Site"], ["phase", "Phase", ["APS", "APD", "PRO", "EXE"]],
    ["bonPour", "Bon pour (par défaut)", ["CONSULTATION", "APPROBATION", "INFORMATION", "EXÉCUTION"]], ["realise", "Auteur – réalisé (par défaut)"], ["controle", "Vérifié (par défaut)"], ["approuve", "Approuvé (par défaut)"]];
  function identification(id, apres) {
    const el = document.getElementById(id); if (!el) return;
    const g = SUIVI.ident();
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px 10px">${CHAMPS.map(([k, l, L]) => `<div><label style="font-size:12px;color:#5f6670">${l}</label>${L ? `<select data-ig="${k}" style="width:100%"><option value=""></option>${L.map((v) => `<option ${g[k] === v ? "selected" : ""}>${v}</option>`).join("")}</select>` : `<input data-ig="${k}" value="${esc(g[k] || "")}" style="width:100%">`}</div>`).join("")}</div>
      <div data-ig-logo style="margin-top:6px"></div>
      <div class="note">Reprise dans tous les outils : n° d'affaire, intitulé, client, site, phase et logo sont communs à tous les modules (une modification faite dans un module revient ici) ; bon pour et auteurs servent de valeurs par défaut quand le champ du module est vide. N° de document, indice, date et repère restent propres à chaque document.</div>`;
    el.addEventListener("input", (e) => { const i = e.target.closest("[data-ig]"); if (!i) return; SUIVI.majIdent({ [i.dataset.ig]: i.value }, true); if (apres) apres(); });
    el.addEventListener("change", (e) => { const i = e.target.closest("select[data-ig]"); if (!i) return; SUIVI.majIdent({ [i.dataset.ig]: i.value }, true); if (apres) apres(); });
    if (typeof IDENT !== "undefined") IDENT.logoChamp(el.querySelector("[data-ig-logo]"), () => SUIVI.ident().logo || "", (l) => { SUIVI.majIdent({ logo: l }, true); if (apres) apres(); });
  }
  const majEtat = () => { if (barre.majEtat) barre.majEtat(); };
  return { exporter, importer, fusionner, decisionModule, filtrer, texteProjet, nouveau, ouvrir, supprimer: supprimerProjet, liste, sauverCourant, barre, majEtat, identification, etatHTML, etatModule, cles, lib, MODULES, ETATS };
})();
