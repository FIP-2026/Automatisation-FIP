/* =====================================================================
   NOTES — éléments communs aux notes (note d'hypothèses NH, notes de calcul S1 / cahier)
   - unites(ctx)  : tableau récapitulatif des unités et conventions ('nh' | 's1')
   - docs()       : tableau des documents de référence (plans, CCTP, mails…) saisis dans NH
   - TYPES_DOC    : types proposés
   Stockage des documents : localStorage « fip.hyp.gen » (champ docs), commun à NH, S1 et au cahier
   ===================================================================== */
const NOTES = (() => {
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TYPES_DOC = ["Plan", "CCTP / cahier des charges", "Note de calcul", "Rapport (sol, diagnostic…)", "Fiche fabricant", "Mail / compte rendu", "Norme / guide", "Autre"];
  const lireGen = () => { try { return JSON.parse(localStorage.getItem("fip.hyp.gen")) || {}; } catch (e) { return {}; } };
  const COMMUN = [
    ["Longueurs, portées, hauteurs, cotes de calcul", "m", ""],
    ["Dimensions de sections, épaisseurs, diamètres, cotes de plans", "mm", ""],
    ["Forces, réactions, charges ponctuelles", "kN", "1 kN = 100 daN = 1 000 N"],
    ["Moments", "kN·m", ""],
    ["Charges linéiques", "kN/m", "1 kN/m = 100 daN/m"],
    ["Charges surfaciques, pressions de vent et de neige", "kN/m²", "1 kN/m² = 100 daN/m² = 1 kPa ; complexes détaillés en daN/m²"],
    ["Poids volumiques", "kN/m³", ""],
    ["Masses volumiques ; masses", "kg/m³ ; kg", "poids = masse × g, g = 9,81 m/s²"],
    ["Contraintes, résistances, modules", "MPa", "1 MPa = 1 N/mm²"],
    ["Vitesses ; accélérations (spectres sismiques)", "m/s ; m/s²", ""],
    ["Angles ; températures", "° ; °C", ""],
  ];
  const S1 = [
    ["Caractéristiques de sections", "cm², cm³, cm⁴, cm⁶", "A ; W ; I, I_t ; I_w"],
    ["Déplacements ; rotations", "mm ; rad", ""],
    ["Raideur de platine S_j", "kN·m/rad", ""],
    ["Taux de travail", "%", "sollicitation / résistance de calcul ; ≤ 100 %"],
    ["Repère global", "X, Y, Z", "X axe des tuyaux, Y horizontal transversal, Z vertical ascendant"],
    ["Efforts internes", "N, V, M", "N > 0 traction ; efforts de la partie aval sur la partie amont"],
  ];
  const NH = [
    ["Pressions de fluide", "kPa abs ; bar", "1 bar = 100 kPa"],
    ["Coefficients (c_pe, c_pi, c_p,net, μ, ψ, γ)", "sans unité", "c > 0 : pression vers la paroi ; c < 0 : dépression"],
  ];
  const sub = (t) => esc(t).replace(/_([a-z0-9,]+)/gi, "<sub>$1</sub>");
  function unites(ctx = "nh") {
    const L = COMMUN.concat(ctx === "s1" ? S1 : NH);
    return `<table><tr><th>Grandeur</th><th>Unité</th><th>Équivalence / convention</th></tr>${L.map(([a, b, c]) => `<tr><td>${sub(a)}</td><td><b>${sub(b)}</b></td><td>${sub(c)}</td></tr>`).join("")}</table>`;
  }
  function liste() { return (lireGen().docs || []).filter((d) => d && (d.ref || d.titre)); }
  function docs(vide = "") {
    const L = liste();
    if (!L.length) return vide;
    return `<table><tr><th>Type</th><th>Référence</th><th>Désignation / objet</th><th>Indice</th><th>Date</th><th>Émetteur</th></tr>${L.map((d) => `<tr><td>${esc(d.type)}</td><td><b>${esc(d.ref)}</b></td><td>${esc(d.titre)}</td><td>${esc(d.ind)}</td><td>${d.date ? new Date(d.date).toLocaleDateString("fr-FR") : ""}</td><td>${esc(d.emet)}</td></tr>`).join("")}</table>`;
  }
  return { unites, docs, liste, TYPES_DOC };
})();
