/* =====================================================================
   IDENTIFICATION (champs de la trame / cartouche) — commune aux modules de calcul
   IDENT.init({ cible: 'idCarte', cle: 'A1', repere: 'Portique courant' }) : carte de saisie dans le module,
   enregistrée par module (localStorage « fip.ident.<cle> ») ; bouton de reprise depuis l'affaire du cahier
   ou de la note d'hypothèses (même navigateur). IDENT.lire() : objet affaire au format du cahier
   (num, intitule, client, site, doc, indice, date, phase, realise, controle, approuve, repere, lot, bonPour, motif,
   logo, revs), utilisé par l'export Word (trame FIP : page de garde, révisions, en-tête, pied de page),
   le cartouche des plans (gabarit FIP A3) et l'en-tête d'impression.
   IDENT.revisions(a) : tableau des révisions [{rev, desc, par, verif, appr, date}] (archives + indice en cours).
   IDENT.editeurRevs(el, get, set) et IDENT.logoChamp(...) : réutilisés par le cahier de supportage.
   ===================================================================== */
const IDENT = (() => {
  const CHAMPS = [["num", "N° d'affaire (projet)"], ["intitule", "Intitulé du projet"], ["client", "Client"], ["site", "Site"], ["repere", "Repère de l'ouvrage"], ["doc", "N° de document"],
    ["lot", "Lot"], ["indice", "Révision (indice)"], ["date", "Date", "date"], ["motif", "Motif de l'émission"], ["phase", "Phase", "sel"], ["bonPour", "Bon pour", "bp"],
    ["realise", "Auteur (réalisé)"], ["controle", "Vérifié"], ["approuve", "Approuvé"]];
  const PHASES = ["APS", "APD", "PRO", "EXE"], BON_POUR = ["CONSULTATION", "APPROBATION", "INFORMATION", "EXÉCUTION"];
  let cle = null, el = null, extra = { revs: [], logo: "" };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lireCle = () => { try { return JSON.parse(localStorage.getItem("fip.ident." + cle)) || null; } catch (e) { return null; } };
  const ecrire = (o) => { try { localStorage.setItem("fip.ident." + cle, JSON.stringify(o)); } catch (e) { alert("Enregistrement impossible (logo trop lourd ?)."); } };
  const glob = (a) => typeof SUIVI !== "undefined" ? SUIVI.appliquer(a) : a;      // identification globale du projet (accueil, commun/suivi.js)
  const affaireCahier = () => { let a = null; try { const o = JSON.parse(localStorage.getItem("fip.cahier")); a = o && o.affaire ? o.affaire : null; } catch (e) { }
    if (typeof SUIVI !== "undefined") { const g = SUIVI.ident(); if (a || Object.keys(g).length) return SUIVI.appliquer(a || {}, g); } return a; };
  const dateFr = (d) => { if (!d) return ""; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }); };
  /* indice suivant : 0 → 1, A → B, B2 → B3 */
  const suivant = (i) => { const s = String(i ?? "").trim(); if (!s) return "0"; const m = /^(.*?)(\d+)$/.exec(s); if (m) return m[1] + (+m[2] + 1); if (/^[A-Y]$/i.test(s)) return String.fromCharCode(s.charCodeAt(0) + 1); return s + "1"; };
  /* révisions : archives (a.revs) puis indice en cours (a.indice, a.motif, auteurs, date) */
  function revisions(a) {
    a = a || {}; const L = (a.revs || []).map((r) => ({ ...r }));
    const cur = { rev: a.indice ?? "", desc: a.motif || (L.length ? "" : "Création du document"), par: a.realise || "", verif: a.controle || "", appr: a.approuve || "", date: dateFr(a.date) };
    if (cur.rev !== "" || !L.length) { if (L.length && String(L[L.length - 1].rev) === String(cur.rev)) L[L.length - 1] = cur; else L.push(cur); }
    return L;
  }
  /* éditeur des révisions archivées : get() → objet affaire, set(o) → enregistrer */
  function editeurRevs(zone, get, set) {
    const rendre = () => {
      const a = get(), R = a.revs || [];
      zone.innerHTML = `<div style="margin-top:6px"><b style="font-size:13px">Historique des révisions</b>${R.length ? `<table class="ed" style="font-size:12px;margin-top:4px"><tr><th>Rév.</th><th>Motif</th><th>Auteur</th><th>Vérifié</th><th>Approuvé</th><th>Date</th><th class="noprint"></th></tr>${R.map((r, i) => `<tr><td>${esc(r.rev)}</td><td>${esc(r.desc)}</td><td>${esc(r.par)}</td><td>${esc(r.verif)}</td><td>${esc(r.appr)}</td><td>${esc(r.date)}</td><td class="noprint"><button type="button" class="sec mini" data-xr="${i}">✕</button></td></tr>`).join("")}</table>` : `<div class="note">Aucune révision archivée : l'indice en cours (${esc(a.indice || "—")}) est la première émission.</div>`}
        <div class="actions noprint" style="margin-top:4px"><button type="button" class="sec" data-arch>📌 Archiver l'indice ${esc(a.indice || "")} et passer à l'indice ${esc(suivant(a.indice))}</button></div>
        <div class="note">Les 5 dernières révisions (archives + indice en cours) remplissent le tableau des révisions du cartouche des plans et de la page de garde Word.</div></div>`;
    };
    zone.addEventListener("click", (e) => {
      const a = get();
      if (e.target.closest("[data-xr]")) { a.revs = (a.revs || []).filter((_, i) => i !== +e.target.closest("[data-xr]").dataset.xr); set(a); rendre(); }
      else if (e.target.closest("[data-arch]")) { const R = revisions(a), cur = R[R.length - 1]; a.revs = R; a.indice = suivant(a.indice); a.motif = ""; a.date = new Date().toISOString().slice(0, 10); if (cur && !cur.desc) cur.desc = "Émission"; set(a, true); rendre(); }
    });
    rendre(); return rendre;
  }
  /* champ logo client (PNG, ramené à 600 px de large au plus) */
  function logoChamp(zone, get, set) {
    const rendre = () => { const l = get(); zone.innerHTML = `<label>Logo du client (PNG / JPG) – page de garde Word et en-tête</label><div class="row noprint" style="align-items:center"><input type="file" accept="image/png,image/jpeg" data-lf><div>${l ? `<img src="${l}" alt="logo client" style="max-height:40px;max-width:160px;vertical-align:middle;border:1px solid #dde2ea;background:#fff"> <button type="button" class="sec mini" data-ls>✕</button>` : '<span class="note">aucun logo</span>'}</div></div>`; };
    zone.addEventListener("change", (e) => { const f = e.target.closest("[data-lf]"); if (!f || !f.files[0]) return; const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 600 / im.naturalWidth), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); set(c.toDataURL("image/png")); rendre(); }; im.src = r.result; }; r.readAsDataURL(f.files[0]); });
    zone.addEventListener("click", (e) => { if (e.target.closest("[data-ls]")) { set(""); rendre(); } });
    rendre(); return rendre;
  }
  function lire() { if (!el) return glob(lireCle() || {}); const o = { ...extra }; CHAMPS.forEach(([k]) => { const i = el.querySelector(`[data-id="${k}"]`); if (i) o[k] = i.value; }); return o; }
  function remplir(o) { CHAMPS.forEach(([k]) => { const i = el.querySelector(`[data-id="${k}"]`); if (i && o[k] != null && o[k] !== "") i.value = o[k]; }); if (o.revs) extra.revs = o.revs; if (o.logo != null && o.logo !== "") extra.logo = o.logo; }
  function init(c) {
    cle = c.cle; el = document.getElementById(c.cible); if (!el) return;
    const opt = (L) => L.map((v) => `<option>${v}</option>`).join("");
    el.innerHTML = `<h2>Identification</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">${CHAMPS.map(([k, l, t]) => `<div><label>${l}</label>${t === "sel" ? `<select data-id="${k}">${opt(PHASES)}</select>` : t === "bp" ? `<select data-id="${k}">${opt(BON_POUR)}</select>` : `<input data-id="${k}" ${t === "date" ? 'type="date"' : ""}>`}</div>`).join("")}</div>
      <div data-logo style="margin-top:6px"></div><div data-revs></div>
      <div class="actions noprint" style="margin-top:6px"><button type="button" class="sec" data-rep>↺ Reprendre l'affaire enregistrée (cahier / note d'hypothèses)</button></div><div class="note">Champs repris dans la trame FIP de la note de calcul (page de garde, tableau des révisions, en-tête et pied de page Word) et dans le cartouche des plans. Saisie propre à ce module.</div>`;
    const o = lireCle(); if (o) remplir(glob(o)); else { const a = affaireCahier(); remplir({ phase: "APS", indice: "0", bonPour: "CONSULTATION", date: new Date().toISOString().slice(0, 10), repere: c.repere || "", ...(a || {}) }); }
    const maj = () => { const a = lire(); ecrire(a); if (typeof SUIVI !== "undefined") SUIVI.majIdent(a); if (c.change) c.change(); };   // champs du projet reportés dans l'identification globale
    const rRevs = editeurRevs(el.querySelector("[data-revs]"), lire, (a, champs) => { extra.revs = a.revs || []; if (champs) remplirForce(a); maj(); });
    const rLogo = logoChamp(el.querySelector("[data-logo]"), () => extra.logo, (l) => { extra.logo = l; maj(); });
    function remplirForce(a) { ["indice", "motif", "date"].forEach((k) => { const i = el.querySelector(`[data-id="${k}"]`); if (i) i.value = a[k] ?? ""; }); }
    el.addEventListener("input", (e) => { if (e.target.closest("[data-id]")) { maj(); if (/^(indice|motif|realise|controle|approuve|date)$/.test(e.target.dataset.id)) rRevs(); } });
    el.querySelector("[data-rep]").onclick = () => { const a = affaireCahier(); if (!a) { alert("Aucune affaire enregistrée dans ce navigateur."); return; } remplir(a); maj(); rRevs(); rLogo(); };
  }
  const libelle = (a) => [a.num, a.intitule].filter(Boolean).join(" – ") + (a.repere ? ` · ${a.repere}` : "") + (a.doc ? ` · note ${a.doc}${a.indice ? " ind. " + a.indice : ""}` : "") + (a.phase ? ` · ${a.phase}` : "");
  return { init, lire, libelle, esc, revisions, editeurRevs, logoChamp, suivant, dateFr, BON_POUR };
})();
