/* =====================================================================
   SUIVI DU PROJET DE TRAVAIL — chargé sur chaque page, juste après auth.js (puis commun/projet.js)
   Les modules sont reliés par le projet : identification, climat (C1), efforts et platines (S1 ↔ AN1), cahier…
   1. Identification globale du projet (localStorage « fip.projet.ident »), saisie en haut de l'accueil :
      - champs du projet (num, intitule, client, site, phase, logo) : communs à tous les modules,
        une modification dans un module (IDENT, cahier) est reportée dans l'identification globale ;
      - champs par défaut (realise, controle, approuve, bonPour) : proposés aux modules dont le champ est vide.
      Migration : sans identification globale, celle de l'affaire du cahier (fip.cahier.affaire) est reprise.
   2. Modifications (« fip.projet.suivi ») : une écriture d'une clé « fip.* » n'est datée (maj[clé], par[clé] =
      utilisateur connecté, affiché dans l'état des modules et le journal) que si elle suit une action de l'utilisateur sur la page (saisie, choix, bouton de calcul) :
      les écritures automatiques à l'ouverture d'un module (valeurs par défaut) ne rendent pas le module « renseigné ».
      save[clé] = empreinte au dernier « Enregistrer » (bouton 💾 de chaque page, Ctrl+S) ; ref[clé] = empreinte
      au dernier export / import du fichier projet ; journal[] = enregistrements, forçages, conflits, imports.
   3. Projet de travail (« fip.projet.actif », commun/projet.js) : si un autre onglet change de projet,
      la page est rechargée pour ne pas écrire les données de l'ancien projet dans le nouveau.
   ===================================================================== */
const SUIVI = (() => {
  const META = "fip.projet.suivi", ACTIF = "fip.projet.actif", IDENT = "fip.projet.ident";
  const HORS = [/^fip\.replie\./, /^fip\.projet\.(suivi|actif)$/, /^fip\.(as1|an1)\.pre$/, /^fip\.an1\.retour$/, /^fip\.(s1|a1)\.num$/];
  const EXCLUS = [/^fip\.replie\./, /^fip\.as1\.pre$/, /^fip\.projet\.(actif|suivi)$/];       // hors données du projet
  const CP = ["num", "intitule", "client", "site", "phase", "logo"], CD = ["realise", "controle", "approuve", "bonPour"];
  /* modules : code, nom, clés de données, page (T1, H1, P1, P2 calculent à la volée : rien d'enregistré) */
  const MODULES = [
    ["ID", "Identification du projet", [IDENT], "accueil.html"],
    ["C1", "Charges climatiques et sismiques", ["fip.hyp.C", "fip.climat"], "climat/"], ["G1", "Charges permanentes", ["fip.hyp.G"], "charges-permanentes/"],
    ["Q1", "Charges d'exploitation", ["fip.hyp.Q"], "charges-exploitation/"], ["CS", "Cahier de supportage", ["fip.cahier"], "cahier/"],
    ["S1", "Supports standards", ["fip.s1.ndc", "fip.reactions"], "supports/"], ["A1", "Toiture isolée (auvent)", ["fip.a1", "fip.a1.res", "fip.ident.A1"], "auvent/"],
    ["AS1", "Barres tendues", ["fip.ident.AS1", "fip.rc.as1"], "barres-tendues/"], ["AN1", "Ancrages", ["fip.an1", "fip.ident.AN1", "fip.an1.retour"], "ancrages/"],
    ["NH", "Note d'hypothèses", ["fip.hyp.gen"], "note-hypotheses/"], ["RC", "Rapport de calcul", ["fip.rc", "fip.ident.RC"], "rapport-calcul/"]];
  const PAGES = { climat: "C1", "charges-permanentes": "G1", "charges-exploitation": "Q1", cahier: "CS", supports: "S1", auvent: "A1", "barres-tendues": "AS1",
    ancrages: "AN1", "note-hypotheses": "NH", "rapport-calcul": "RC", "portee-tuyauterie": "T1", fluides: "H1", poutre: "P1", poteau: "P2" };
  const suivie = (k) => /^fip\./.test(String(k)) && !HORS.some((r) => r.test(k));
  let S = null; try { S = window.localStorage; } catch (e) { }
  const set0 = Storage.prototype.setItem, rem0 = Storage.prototype.removeItem;
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const user = () => { try { return (typeof calcSession === "function" && (calcSession() || {}).u) || ""; } catch (e) { return ""; } };
  const lireMeta = () => { try { return JSON.parse(S.getItem(META)) || {}; } catch (e) { return {}; } };
  const ecrireMeta = (m) => { try { set0.call(S, META, JSON.stringify(m)); } catch (e) { } };
  const cles = () => S ? Object.keys(S).filter((k) => /^fip\./.test(k) && !EXCLUS.some((r) => r.test(k))).sort() : [];
  const moduleDeCle = (k) => (MODULES.find((m) => m[2].includes(k)) || [])[0] || null;
  const module = () => { const s = location.pathname.split("/").filter(Boolean); if (/accueil\.html$/.test(location.pathname)) return "ID";
    for (let i = s.length - 1; i >= 0; i--) if (PAGES[s[i]]) return PAGES[s[i]]; return null; };
  /* ---------- action de l'utilisateur sur la page ---------- */
  let saisie = false;
  const UTIL = /aide|replier|déplier|imprimer|pdf|dxf|word|excel|robot|accueil|enregistrer|nœuds|vues?\b|aperçu|planche|perspective|montrer/i;
  if (typeof document !== "undefined") {
    ["input", "change"].forEach((t) => document.addEventListener(t, (e) => { if (e.isTrusted) saisie = true; }, true));
    document.addEventListener("click", (e) => { const b = e.target && e.target.closest && e.target.closest("button"); if (e.isTrusted && b && !UTIL.test(b.textContent + " " + (b.title || ""))) saisie = true; }, true);
  }
  /* ---------- journal ---------- */
  function journal(o) { const m = lireMeta(); (m.journal = m.journal || []).push({ d: new Date().toISOString(), u: user(), ...o }); m.journal = m.journal.slice(-200); ecrireMeta(m); }
  /* ---------- écritures : dates, auteurs ---------- */
  let tMaj = null; const majBoutonDiffere = () => { clearTimeout(tMaj); tMaj = setTimeout(majBouton, 150); };
  const noter = (k) => { if (!saisie) return; const m = lireMeta(); (m.maj = m.maj || {})[k] = new Date().toISOString(); (m.par = m.par || {})[k] = user(); ecrireMeta(m); majBoutonDiffere(); };
  if (S) {
    Storage.prototype.setItem = function (k, v) {
      const t = this === S && suivie(k), old = t ? S.getItem(k) : null;
      set0.call(this, k, v); if (t && old !== String(v)) noter(k);
    };
    Storage.prototype.removeItem = function (k) {
      const t = this === S && suivie(k) && S.getItem(k) !== null;
      rem0.call(this, k); if (t) noter(k);
    };
    window.addEventListener("storage", (e) => { if (e.key === ACTIF && e.newValue !== e.oldValue) { alert("Le projet de travail a été changé dans un autre onglet : la page est rechargée sur ce projet."); location.reload(); } });
  }
  /* empreinte FNV-1a (32 bits) + longueur */
  const empreinte = (s) => { s = String(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ":" + s.length; };
  /* état d'une valeur pour le fichier projet : vide, nouveau (jamais exporté), ajour, modifie (compatibilité 3.01) */
  const etatDe = (v, ref) => v == null ? "vide" : ref == null ? "nouveau" : ref === empreinte(v) ? "ajour" : "modifie";
  /* état d'une clé : etat = vide (jamais saisie) | modifie (non enregistrée) | enregistre ; fichier = jamais | aexporter | ajour */
  function etatCle(k, m) {
    m = m || lireMeta(); const v = S && S.getItem(k), h = v == null ? null : empreinte(v), maj = m.maj && m.maj[k] || null, sv = m.save && m.save[k], ex = m.ref && m.ref[k];
    const rens = v != null && !!(maj || sv != null || ex != null);
    return { etat: !rens ? "vide" : sv === h ? "enregistre" : "modifie", fichier: !rens ? null : ex == null ? "jamais" : ex === h ? "ajour" : "aexporter", maj, par: m.par && m.par[k] || "" };
  }
  const etat = (k) => { const m = lireMeta(); return { etat: etatDe(S && S.getItem(k), m.ref && m.ref[k]), maj: m.maj && m.maj[k] || null }; };
  /* référence du fichier projet (export / import) ; valeurs : map clé → texte (défaut : valeurs actuelles) */
  function figer(K, maj, valeurs, par) {
    const m = lireMeta(); m.ref = {}; K.forEach((k) => { const v = valeurs ? valeurs[k] : S.getItem(k); if (v != null) m.ref[k] = empreinte(v); });
    m.refDate = new Date().toISOString(); if (maj) m.maj = { ...(m.maj || {}), ...maj }; if (par) m.par = { ...(m.par || {}), ...par }; ecrireMeta(m);
  }
  /* « Enregistrer » : valide l'état de toutes les données (puis liste des projets, commun/projet.js) */
  async function enregistrer(b) {
    const K = cles(), m = lireMeta(), mod = [...new Set(K.filter((k) => etatCle(k, m).etat === "modifie").map((k) => moduleDeCle(k) || k))];
    m.save = {}; K.forEach((k) => { m.save[k] = empreinte(S.getItem(k)); }); m.saveDate = new Date().toISOString(); ecrireMeta(m);
    if (mod.length) journal({ a: "Enregistrement", m: mod.join(", ") });
    try { if (typeof PROJET !== "undefined") await PROJET.sauverCourant(); } catch (e) { }
    majBouton(); if (b) { const t = b.textContent; b.textContent = "✔ Enregistré"; setTimeout(() => majBouton(), 1500); }
    if (typeof PROJET !== "undefined" && PROJET.majEtat) PROJET.majEtat();
  }
  function aEnregistrer() { const m = lireMeta(); return cles().filter((k) => etatCle(k, m).etat === "modifie"); }
  function majBouton() { const b = document.querySelector("[data-enr]"); if (!b) return; const n = aEnregistrer().length;
    b.textContent = n ? "💾 Enregistrer •" : "💾 Enregistrer"; b.title = (n ? "Modifications non enregistrées. " : "") + "Enregistrer le projet (Ctrl+S) : valide les modifications de tous les modules et met à jour la liste des projets."; }
  /* ---------- page : bouton Enregistrer ---------- */
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      const hd = document.getElementById("enteteAccueil") || document.querySelector("body > header");
      if (hd && !hd.querySelector("[data-enr]")) { const b = document.createElement("button"); b.type = "button"; b.dataset.enr = "1"; b.className = "noprint"; b.onclick = () => enregistrer(b);
        const p = hd.querySelector(":scope > button"); if (p) p.before(b); else hd.appendChild(b); majBouton(); }
      try { if (S.getItem("fip.projet.droits") != null) rem0.call(S, "fip.projet.droits"); } catch (e) { }   // responsables (3.02) : abandonnés en 3.03
    });
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === "s") { e.preventDefault(); enregistrer(document.querySelector("[data-enr]")); } });
  }
  /* ---------- identification globale ---------- */
  function ident() {
    let o = null; try { o = JSON.parse(S.getItem(IDENT)); } catch (e) { }
    if (!o) try { const c = JSON.parse(S.getItem("fip.cahier")), a = c && c.affaire;               // migration : affaire du cahier
      if (a && (a.num || a.intitule || a.client)) { o = {}; [...CP, ...CD].forEach((k) => { if (a[k]) o[k] = a[k]; }); } } catch (e) { }
    return o || {};
  }
  /* report dans l'identification globale ; tous = false : champs du projet seulement (modification depuis un module) */
  function majIdent(patch, tous) {
    const o = { ...ident() }; let ch = false;
    (tous ? [...CP, ...CD] : CP).forEach((k) => { if (patch && k in patch && (o[k] ?? "") !== (patch[k] ?? "")) { o[k] = patch[k] ?? ""; ch = true; } });
    if (ch || (tous && S.getItem(IDENT) == null)) try { S.setItem(IDENT, JSON.stringify(o)); } catch (e) { alert("Enregistrement de l'identification impossible (logo trop lourd ?)."); }
    return o;
  }
  /* applique l'identification globale g à un objet affaire a (cahier, module) */
  function appliquer(a, g) {
    g = g || ident(); const o = { ...(a || {}) };
    CP.forEach((k) => { if (g[k]) o[k] = g[k]; }); CD.forEach((k) => { if (!o[k] && g[k]) o[k] = g[k]; });
    return o;
  }
  const libelle = (g) => { g = g || ident(); return [g.num, g.intitule].filter(Boolean).join(" – "); };
  return { META, ACTIF, IDENT, CP, CD, MODULES, EXCLUS, suivie, empreinte, etatDe, etat, etatCle, figer, lireMeta, ecrireMeta, ident, majIdent, appliquer, libelle,
    set0, rem0, cles, moduleDeCle, module, user, journal, enregistrer, aEnregistrer, majBouton };
})();
