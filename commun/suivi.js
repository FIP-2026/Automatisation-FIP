/* =====================================================================
   SUIVI DU PROJET EN COURS — chargé sur chaque page, juste après auth.js
   1. Identification globale du projet (localStorage « fip.projet.ident »), saisie en haut de l'accueil :
      - champs du projet (num, intitule, client, site, phase, logo) : communs à tous les modules,
        une modification dans un module (IDENT, cahier) est reportée dans l'identification globale ;
      - champs par défaut (realise, controle, approuve, bonPour) : proposés aux modules dont le champ est vide.
      Migration : sans identification globale, celle de l'affaire du cahier (fip.cahier.affaire) est reprise.
   2. Dates de modification des données d'affaire (« fip.projet.suivi » : maj[clé] = date ISO) : toute écriture
      localStorage d'une clé « fip.* » qui change sa valeur est datée (préférences d'affichage et transferts exclus).
      ref[clé] = empreinte de la valeur au dernier export / import du fichier projet → état « à jour » / « modifié ».
   3. Projet de travail (« fip.projet.actif », géré par commun/projet.js) : si un autre onglet change de projet,
      la page est rechargée pour ne pas écrire les données de l'ancien projet dans le nouveau.
   ===================================================================== */
const SUIVI = (() => {
  const META = "fip.projet.suivi", ACTIF = "fip.projet.actif", IDENT = "fip.projet.ident";
  const HORS = [/^fip\.replie\./, /^fip\.projet\.(suivi|actif)$/, /^fip\.(as1|an1)\.pre$/, /^fip\.an1\.retour$/, /^fip\.(s1|a1)\.num$/];
  const CP = ["num", "intitule", "client", "site", "phase", "logo"], CD = ["realise", "controle", "approuve", "bonPour"];
  const suivie = (k) => /^fip\./.test(String(k)) && !HORS.some((r) => r.test(k));
  let S = null; try { S = window.localStorage; } catch (e) { }
  const set0 = Storage.prototype.setItem, rem0 = Storage.prototype.removeItem;
  const lireMeta = () => { try { return JSON.parse(S.getItem(META)) || {}; } catch (e) { return {}; } };
  const ecrireMeta = (m) => { try { set0.call(S, META, JSON.stringify(m)); } catch (e) { } };
  const noter = (k) => { const m = lireMeta(); (m.maj = m.maj || {})[k] = new Date().toISOString(); ecrireMeta(m); };
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
  /* empreinte FNV-1a (32 bits) + longueur : comparaison avec la valeur exportée */
  const empreinte = (s) => { s = String(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ":" + s.length; };
  /* état d'une valeur : vide (absente), nouveau (pas de fichier exporté), ajour (identique), modifie */
  const etatDe = (v, ref) => v == null ? "vide" : ref == null ? "nouveau" : ref === empreinte(v) ? "ajour" : "modifie";
  function etat(k) { const m = lireMeta(); return { etat: etatDe(S && S.getItem(k), m.ref && m.ref[k]), maj: m.maj && m.maj[k] || null }; }
  /* fige l'état courant comme référence (après export ou import du fichier projet) */
  function figer(cles, maj) {
    const m = lireMeta(); m.ref = {}; cles.forEach((k) => { const v = S.getItem(k); if (v != null) m.ref[k] = empreinte(v); });
    m.refDate = new Date().toISOString(); if (maj) m.maj = { ...(m.maj || {}), ...maj }; ecrireMeta(m);
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
  return { META, ACTIF, IDENT, CP, CD, suivie, empreinte, etatDe, etat, figer, lireMeta, ident, majIdent, appliquer, libelle, set0, rem0 };
})();
