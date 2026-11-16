/* =====================================================================
   FICHIER PROJET — échange des données d'une affaire entre postes (projeteur ↔ calculateur)
   Exporte / importe toutes les données d'affaire enregistrées dans ce navigateur (clés « fip.* ») :
   cahier de supportage, hypothèses (C1, G1, Q1, NH), auvent A1, assemblages AS1, rapport de calcul,
   identifications des modules, options de notes. Exclus : préférences d'affichage (fip.replie.*),
   transferts ponctuels (fip.as1.pre), session de connexion.
   Format : { format: "fip-projet", version, date, affaire, cles: { cle: valeur JSON } }
   Le fichier contient des données d'affaire : à conserver sur le réseau FIP / SharePoint.
   ===================================================================== */
const PROJET = (() => {
  const EXCLUS = [/^fip\.replie\./, /^fip\.as1\.pre$/];
  const cles = () => Object.keys(localStorage).filter((k) => /^fip\./.test(k) && !EXCLUS.some((r) => r.test(k))).sort();
  const LIB = { "fip.cahier": "Cahier de supportage", "fip.climat": "C1 – transfert vers S1", "fip.hyp.C": "C1 – charges climatiques et sismiques", "fip.hyp.G": "G1 – charges permanentes",
    "fip.hyp.Q": "Q1 – charges d'exploitation", "fip.hyp.gen": "NH – hypothèses générales et documents", "fip.a1": "A1 – données de l'auvent", "fip.a1.res": "A1 – résultats",
    "fip.rc": "RC – options du rapport", "fip.rc.as1": "AS1 – attaches du rapport", "fip.s1.ndc": "S1 – options de note", "fip.reactions": "S1 – réactions transmises" };
  const lib = (k) => LIB[k] || (k.startsWith("fip.ident.") ? `Identification ${k.slice(10)}` : k);
  const affaire = () => { try { const c = JSON.parse(localStorage.getItem("fip.cahier")); const a = c && c.affaire; if (a && (a.num || a.intitule)) return [a.num, a.intitule].filter(Boolean).join(" – "); } catch (e) { }
    for (const k of cles().filter((x) => x.startsWith("fip.ident."))) { try { const o = JSON.parse(localStorage.getItem(k)); if (o && (o.num || o.intitule)) return [o.num, o.intitule].filter(Boolean).join(" – "); } catch (e) { } } return ""; };
  function exporter() {
    const L = cles(); if (!L.length) { alert("Aucune donnée d'affaire dans ce navigateur."); return; }
    const o = { format: "fip-projet", version: typeof CALC_VERSION !== "undefined" ? CALC_VERSION : "", date: new Date().toISOString(), affaire: affaire(), cles: {} };
    L.forEach((k) => { o.cles[k] = localStorage.getItem(k); });
    const nom = `Projet_${(o.affaire || "affaire").replace(/[^\w-]+/g, "_").slice(0, 60)}_${o.date.slice(0, 10)}.json`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = nom;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return nom;
  }
  function importer(apres) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = () => { const fi = inp.files[0]; if (!fi) return; const r = new FileReader();
      r.onload = () => { let o; try { o = JSON.parse(r.result); } catch (e) { alert("Fichier illisible (JSON attendu)."); return; }
        if (!o || o.format !== "fip-projet" || !o.cles) { alert("Ce fichier n'est pas un fichier projet FIP Études."); return; }
        const K = Object.keys(o.cles).filter((k) => /^fip\./.test(k) && !EXCLUS.some((x) => x.test(k)));
        const actuelles = cles(), aEcraser = K.filter((k) => actuelles.includes(k)), autres = actuelles.filter((k) => !K.includes(k));
        const msg = `Importer le projet « ${o.affaire || "sans nom"} » (${o.version || "?"}, enregistré le ${new Date(o.date).toLocaleString("fr-FR")}) ?\n\nDonnées importées :\n` + K.map((k) => " • " + lib(k)).join("\n") +
          (aEcraser.length ? `\n\n${aEcraser.length} donnée(s) actuelle(s) seront remplacées.` : "") + (autres.length ? `\n${autres.length} autre(s) donnée(s) de ce navigateur seront supprimées (projet remplacé en entier) : exportez-les d'abord si besoin.` : "");
        if (!confirm(msg)) return;
        try { autres.forEach((k) => localStorage.removeItem(k)); K.forEach((k) => { if (o.cles[k] != null) localStorage.setItem(k, o.cles[k]); }); }
        catch (e) { alert("Import impossible : " + e.message); return; }
        alert(`Projet importé (${K.length} donnée(s)).`); if (apres) apres(); else location.reload(); };
      r.readAsText(fi); };
    inp.click();
  }
  function vider(apres) {
    const L = cles(); if (!L.length) { alert("Aucune donnée d'affaire dans ce navigateur."); return; }
    if (!confirm(`Démarrer un nouveau projet ? Les ${L.length} donnée(s) d'affaire de ce navigateur seront supprimées :\n` + L.map((k) => " • " + lib(k)).join("\n") + "\n\nExportez d'abord le fichier projet si vous voulez les conserver.")) return;
    L.forEach((k) => localStorage.removeItem(k)); if (apres) apres(); else location.reload();
  }
  /* barre d'actions à insérer dans une page : PROJET.barre('idConteneur') */
  function barre(id) { const el = document.getElementById(id); if (!el) return;
    const L = cles(), af = affaire();
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><b>Fichier projet</b><span class="note">${af ? "Affaire : " + af.replace(/[&<>"]/g, "") + " · " : ""}${L.length} donnée(s) dans ce navigateur</span>
      <span style="flex:1"></span><button type="button" data-pj="exp">⬇ Exporter le projet</button><button type="button" class="sec" data-pj="imp">⬆ Importer un projet</button><button type="button" class="sec" data-pj="new">🗋 Nouveau projet</button></div>
      <div class="note" style="margin-top:4px">Pour échanger une affaire entre postes (projeteur ↔ calculateur) : un seul fichier .json avec toutes les données d'affaire (cahier, hypothèses, ossature, assemblages, rapport). Données d'affaire : à conserver sur le réseau FIP / SharePoint, pas sur un dépôt public.</div>`;
    el.querySelector('[data-pj="exp"]').onclick = () => exporter();
    el.querySelector('[data-pj="imp"]').onclick = () => importer();
    el.querySelector('[data-pj="new"]').onclick = () => vider(); }
  return { exporter, importer, vider, barre, cles, lib };
})();
