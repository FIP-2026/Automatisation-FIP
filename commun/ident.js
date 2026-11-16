/* =====================================================================
   IDENTIFICATION (champs de la trame / cartouche) — commune aux modules de calcul
   IDENT.init({ cible: 'idCarte', cle: 'A1', repere: 'Portique courant' }) : carte de saisie dans le module,
   enregistrée par module (localStorage « fip.ident.<cle> ») ; bouton de reprise depuis l'affaire du cahier
   ou de la note d'hypothèses (même navigateur). IDENT.lire() : objet affaire au format du cahier
   (num, intitule, client, site, doc, indice, date, phase, realise, controle, approuve, repere), utilisé
   par l'export Word (cartouche) et l'en-tête d'impression.
   ===================================================================== */
const IDENT = (() => {
  const CHAMPS = [["num", "N° d'affaire"], ["intitule", "Intitulé"], ["client", "Client"], ["site", "Site"], ["repere", "Repère de l'ouvrage"], ["doc", "N° de note"],
    ["indice", "Indice"], ["date", "Date", "date"], ["phase", "Phase", "sel"], ["realise", "Réalisé"], ["controle", "Contrôlé"], ["approuve", "Approuvé"]];
  let cle = null, el = null;
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lireCle = () => { try { return JSON.parse(localStorage.getItem("fip.ident." + cle)) || null; } catch (e) { return null; } };
  const ecrire = (o) => { try { localStorage.setItem("fip.ident." + cle, JSON.stringify(o)); } catch (e) { } };
  const affaireCahier = () => { try { const o = JSON.parse(localStorage.getItem("fip.cahier")); return o && o.affaire ? o.affaire : null; } catch (e) { return null; } };
  function lire() { const o = {}; if (!el) return lireCle() || {}; CHAMPS.forEach(([k]) => { const i = el.querySelector(`[data-id="${k}"]`); if (i) o[k] = i.value; }); return o; }
  function remplir(o) { CHAMPS.forEach(([k]) => { const i = el.querySelector(`[data-id="${k}"]`); if (i && o[k] != null && o[k] !== "") i.value = o[k]; }); }
  function init(c) {
    cle = c.cle; el = document.getElementById(c.cible); if (!el) return;
    el.innerHTML = `<h2>Identification</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">${CHAMPS.map(([k, l, t]) => `<div><label>${l}</label>${t === "sel" ? `<select data-id="${k}"><option>APS</option><option>APD</option><option>PRO</option><option>EXE</option></select>` : `<input data-id="${k}" ${t === "date" ? 'type="date"' : ""}>`}</div>`).join("")}</div>
      <div class="actions noprint" style="margin-top:6px"><button type="button" class="sec" data-rep>↺ Reprendre l'affaire enregistrée (cahier / note d'hypothèses)</button></div><div class="note">Champs repris dans le cartouche de la note de calcul (Word, PDF). Saisie propre à ce module.</div>`;
    const o = lireCle(); if (o) remplir(o); else { const a = affaireCahier(); remplir({ phase: "APS", date: new Date().toISOString().slice(0, 10), repere: c.repere || "", ...(a || {}) }); }
    el.addEventListener("input", () => { ecrire(lire()); if (c.change) c.change(); });
    el.querySelector("[data-rep]").onclick = () => { const a = affaireCahier(); if (!a) { alert("Aucune affaire enregistrée dans ce navigateur."); return; } remplir(a); ecrire(lire()); if (c.change) c.change(); };
  }
  const libelle = (a) => [a.num, a.intitule].filter(Boolean).join(" – ") + (a.repere ? ` · ${a.repere}` : "") + (a.doc ? ` · note ${a.doc}${a.indice ? " ind. " + a.indice : ""}` : "") + (a.phase ? ` · ${a.phase}` : "");
  return { init, lire, libelle, esc };
})();
