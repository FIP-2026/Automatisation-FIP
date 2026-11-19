/* =====================================================================
   TOPO — numérotation « type Robot » du modèle de calcul d'un module (nœuds, barres, liaisons)
   Indépendante du maillage interne de calcul : un nœud à chaque extrémité de barre, à chaque appui et à chaque
   jonction ; les barres sont découpées aux nœuds qu'elles traversent (jonction d'une autre barre, appui).
   TOPO.construire({ barres:[{ lib, A:[x,y,z], B:[x,y,z], section, mat, rel }], appuis:[{ pt:[x,y,z], c:[6], lib }] })
     c : par degré de liberté DX DY DZ RX RY RZ — 1 bloqué, 0 libre, > 1 ressort (kN·m/rad ou kN/m)
     rel : relâchements d'extrémité, ex. "articulée aux deux extrémités"
   → { N:[{ n, x, y, z }], B:[{ n, lib, i, j, section, mat, L, rel }], AP:[{ n, c, lib, type }] }  (numéros à partir de 1)
   TOPO.tableaux(t) : tableaux HTML nœuds / barres / liaisons (notes de calcul, futur export Robot)
   TOPO.etiquettes(t, proj, opt) : étiquettes SVG (N1, B1 · section) d'une vue ; proj([x,y,z]) → [X,Y] (pixels) ou null
   ===================================================================== */
const TOPO = (() => {
  const TOL = 1e-6, DDL = ["DX", "DY", "DZ", "RX", "RY", "RZ"];
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fr = (v, d = 3) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const dist = (P, Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]);
  /* abscisse de P sur le segment [A, B] s'il y est (hors extrémités), sinon null */
  function surSegment(A, B, P) {
    const L = dist(A, B); if (L < TOL) return null; const u = [0, 1, 2].map((k) => (B[k] - A[k]) / L), s = [0, 1, 2].reduce((a, k) => a + (P[k] - A[k]) * u[k], 0);
    if (s <= TOL || s >= L - TOL) return null; return dist(P, [0, 1, 2].map((k) => A[k] + u[k] * s)) < 1e-5 ? s : null;
  }
  function typeLiaison(c) {
    const b = c.map((v) => (v === 1 ? "b" : v > 1 ? "r" : "l")).join("");
    if (b === "bbbbbb") return "Encastrement";
    if (b === "bbblll") return "Rotule (translations bloquées)";
    if (/r/.test(b)) return "Encastrement élastique (ressorts)";
    return "Appui : " + DDL.filter((_, k) => c[k] === 1).join(" ") + " bloqués";
  }
  function construire(m) {
    const N = [], cle = (P) => { let k = N.findIndex((n) => dist([n.x, n.y, n.z], P) < 1e-5); if (k < 0) { N.push({ x: P[0], y: P[1], z: P[2] }); k = N.length - 1; } return k; };
    // nœuds : extrémités puis appuis
    m.barres.forEach((b) => { cle(b.A); cle(b.B); });
    (m.appuis || []).forEach((a) => cle(a.pt));
    // barres découpées aux nœuds intérieurs
    const B = [];
    m.barres.forEach((b) => {
      const ss = [[0, cle(b.A)], [dist(b.A, b.B), cle(b.B)]];
      N.forEach((n, k) => { const s = surSegment(b.A, b.B, [n.x, n.y, n.z]); if (s !== null) ss.push([s, k]); });
      ss.sort((p, q) => p[0] - q[0]); const nb = ss.length - 1;
      for (let q = 0; q < nb; q++) { if (ss[q + 1][0] - ss[q][0] < TOL) continue;
        B.push({ lib: b.lib + (nb > 1 ? ` (${q + 1}/${nb})` : ""), i: ss[q][1], j: ss[q + 1][1], section: b.section || "", mat: b.mat || "", L: ss[q + 1][0] - ss[q][0], rel: b.rel || "" }); }
    });
    // renumérotation lisible : par défaut de bas en haut, puis selon X et Y (opt.tri : fonction de comparaison des nœuds)
    const tri = m.tri || ((p, q) => (p.z - q.z) || (p.x - q.x) || (p.y - q.y)), ordre = N.map((n, k) => k).sort((p, q) => { const d = tri(N[p], N[q]); return Math.abs(d) < 1e-6 ? p - q : d; });
    const num = []; ordre.forEach((k, r) => { num[k] = r + 1; });
    const AP = (m.appuis || []).map((a, k) => ({ n: num[cle(a.pt)], c: a.c.slice(), lib: a.lib || "", type: typeLiaison(a.c), ref: a.ref ?? k })).sort((p, q) => p.n - q.n);
    return { N: ordre.map((k) => ({ n: num[k], ...N[k] })), B: B.map((b, k) => ({ n: k + 1, ...b, i: num[b.i], j: num[b.j] })), AP };
  }
  function tableaux(t, opt = {}) {
    const ap = (n) => t.AP.find((a) => a.n === n);
    const tN = `<table class="topo"><tr><th>Nœud</th><th class="n">X (m)</th><th class="n">Y (m)</th><th class="n">Z (m)</th><th>Appui</th></tr>${t.N.map((n) => { const a = ap(n.n);
      return `<tr><td>N${n.n}</td><td class="n">${fr(n.x)}</td><td class="n">${fr(n.y)}</td><td class="n">${fr(n.z)}</td><td>${a ? esc(a.lib || a.type) : ""}</td></tr>`; }).join("")}</table>`;
    const tB = `<table class="topo"><tr><th>Barre</th><th>Origine</th><th>Extrémité</th><th>Section</th>${t.B.some((b) => b.mat) ? "<th>Matériau</th>" : ""}<th class="n">Longueur (m)</th><th>Élément</th><th>Relâchements</th></tr>${t.B.map((b) =>
      `<tr><td>B${b.n}</td><td>N${b.i}</td><td>N${b.j}</td><td>${esc(b.section)}</td>${t.B.some((x) => x.mat) ? `<td>${esc(b.mat)}</td>` : ""}<td class="n">${fr(b.L)}</td><td>${esc(b.lib)}</td><td>${esc(b.rel || "aucun (encastrée)")}</td></tr>`).join("")}</table>`;
    const act = opt.assemblage, tA = t.AP.length ? `<table class="topo"><tr><th>Nœud</th><th>Liaison</th>${DDL.map((d) => `<th>${d}</th>`).join("")}<th>Repère</th>${act ? '<th class="noprint">Assemblage</th>' : ""}</tr>${t.AP.map((a) =>
      `<tr><td>N${a.n}</td><td>${esc(a.type)}</td>${a.c.map((v, k) => `<td>${v === 1 ? "bloqué" : v > 1 ? "k = " + fr(v, 0) + (k >= 3 ? " kN·m/rad" : " kN/m") : "libre"}</td>`).join("")}<td>${esc(a.lib)}</td>${act ? `<td class="noprint">${act(a) || ""}</td>` : ""}</tr>`).join("")}</table>` : "";
    const h = opt.titres || "h5";
    return `<${h}>Nœuds</${h}>${tN}<${h}>Barres</${h}>${tB}${tA ? `<${h}>Liaisons (appuis)</${h}>${tA}` : ""}${opt.note ? `<p class="note">${opt.note}</p>` : ""}`;
  }
  function etiquettes(t, proj, opt = {}) {
    let s = ""; const fs = opt.fs || 10, PP = t.N.map((n) => proj([n.x, n.y, n.z])).filter(Boolean), cx = PP.reduce((a, p) => a + p[0], 0) / (PP.length || 1), cy = PP.reduce((a, p) => a + p[1], 0) / (PP.length || 1);
    t.B.forEach((b) => { const a = t.N[b.i - 1], c = t.N[b.j - 1], P = proj([a.x, a.y, a.z]), Q = proj([c.x, c.y, c.z]); if (!P || !Q) return;
      const lp = Math.hypot(P[0] - Q[0], P[1] - Q[1]); if (lp < 2) return;          // barre vue en bout
      // étiquette décalée perpendiculairement à la barre, du côté du centre de la structure
      let nx = -(Q[1] - P[1]) / lp, ny = (Q[0] - P[0]) / lp; const m0x = (P[0] + Q[0]) / 2, m0y = (P[1] + Q[1]) / 2; if (nx * (cx - m0x) + ny * (cy - m0y) < 0) { nx = -nx; ny = -ny; }
      const txt0 = `B${b.n}` + (opt.sections === false ? "" : ` · ${String(b.section).replace(/ \(.*\)$/, "")}`), w0 = txt0.length * fs * 0.56 + 8, dd = Math.abs(nx) * (w0 / 2 + 6) + Math.abs(ny) * (fs * 0.75 + 6);
      const mx = m0x + nx * dd, my = m0y + ny * dd, txt = `B${b.n}` + (opt.sections === false ? "" : ` · ${String(b.section).replace(/ \(.*\)$/, "")}`), w = txt.length * fs * 0.56 + 8;
      s += `<g pointer-events="none"><rect x="${mx - w / 2}" y="${my - fs * 0.75}" width="${w}" height="${fs * 1.5}" rx="3" fill="#fff" stroke="#1d8a3a" stroke-width=".8" opacity=".95"/><text x="${mx}" y="${my + fs * 0.36}" text-anchor="middle" font-size="${fs}" fill="#1d8a3a" font-weight="600">${esc(txt)}</text></g>`; });
    const vus = [];
    t.N.forEach((n) => { const P = proj([n.x, n.y, n.z]); if (!P) return; const dej = vus.filter((v) => Math.hypot(v[0] - P[0], v[1] - P[1]) < 6).length; vus.push(P);
      const dx = 8 + dej * 26, dy = -8;
      s += `<g pointer-events="none"><circle cx="${P[0]}" cy="${P[1]}" r="3" fill="#c0141c"/><rect x="${P[0] + dx - 2}" y="${P[1] + dy - fs * 0.8}" width="${(`N${n.n}`).length * fs * 0.6 + 6}" height="${fs * 1.4}" rx="3" fill="#fff" stroke="#c0141c" stroke-width=".8"/><text x="${P[0] + dx + 1}" y="${P[1] + dy + fs * 0.3}" font-size="${fs}" fill="#c0141c" font-weight="700">N${n.n}</text></g>`; });
    return s;
  }
  /* ---------- localisation sur les barres numérotées ---------- */
  const coord = (t, n) => { const N = t.N[n - 1]; return [N.x, N.y, N.z]; };
  /* point P → { b, x } : barre qui le porte (extrémités comprises) et abscisse depuis son origine (m) */
  function localiser(t, P) {
    for (const b of t.B) { const A = coord(t, b.i), B = coord(t, b.j), L = dist(A, B);
      if (dist(A, P) < 1e-5) return { b: b.n, x: 0 }; if (dist(B, P) < 1e-5) return { b: b.n, x: L }; const s = surSegment(A, B, P); if (s !== null) return { b: b.n, x: s }; }
    return null; }
  /* segment [P, Q] (élément de calcul) → { b, x1, x2 } sur la barre qui le contient */
  function localiserSeg(t, P, Q) { const M = [0, 1, 2].map((k) => (P[k] + Q[k]) / 2), m = localiser(t, M); if (!m) return null; const b = t.B[m.b - 1], A = coord(t, b.i);
    const x1 = dist(A, P), x2 = dist(A, Q); return { b: m.b, x1: Math.min(x1, x2), x2: Math.max(x1, x2) }; }
  /* ---------- export vers Robot : classeur Excel au format des tableaux Robot (copier-coller) ----------
     d = { titre, fichier, repere (texte), cas:[{ id, nom, nature, ponct:[{ P:[x,y,z], F:[6] }], rep:[{ A, B, q:[3] }] }], combis:[{ nom, type, f:{ id: coef }, note }], notes:[texte] }
     unités : m, kN, kN/m, kN·m ; repère global ; charges réparties par mètre de barre (repère global) */
  const BASE = (typeof document !== "undefined" && document.currentScript && document.currentScript.src.replace(/topo\.js.*$/, "")) || "../commun/";
  const chargerXLSX = () => new Promise((ok, ko) => { if (typeof XLSX !== "undefined") return ok(); const s = document.createElement("script"); s.src = BASE + "lib/xlsx/xlsx.mini.min.js"; s.onload = ok; s.onerror = () => ko(new Error("Chargement de SheetJS impossible")); document.head.appendChild(s); });
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  /* charges d'un cas localisées sur les barres numérotées : ponctuelles cumulées par point, réparties fusionnées par barre */
  function chargesBarres(t, c, hors) {
    const ponct = new Map();
    (c.ponct || []).forEach((p) => { const m = localiser(t, p.P); if (!m) { hors.push(c.id); return; } const k = m.b + "_" + r4(m.x), o = ponct.get(k) || { b: m.b, x: m.x, F: [0, 0, 0, 0, 0, 0] }; p.F.forEach((v, q) => { o.F[q] += v || 0; }); ponct.set(k, o); });
    const segs = []; (c.rep || []).forEach((r) => {
      // segment coupé aux nœuds numérotés qu'il traverse (élément de calcul à cheval sur une jonction)
      const L0 = dist(r.A, r.B), cps = [0, L0]; t.N.forEach((n) => { const x = surSegment(r.A, r.B, [n.x, n.y, n.z]); if (x !== null) cps.push(x); }); cps.sort((p, q) => p - q);
      for (let k = 0; k < cps.length - 1; k++) { if (cps[k + 1] - cps[k] < 1e-6) continue; const P = [0, 1, 2].map((q) => r.A[q] + (r.B[q] - r.A[q]) * cps[k] / L0), Q = [0, 1, 2].map((q) => r.A[q] + (r.B[q] - r.A[q]) * cps[k + 1] / L0);
        const m = localiserSeg(t, P, Q); if (!m) { hors.push(c.id); continue; } segs.push({ ...m, q: r.q.map((v) => v || 0) }); } });
    // 1) somme des charges d'un même tronçon (ex. composantes verticale et horizontale du vent rangées séparément) ; 2) fusion des tronçons contigus de même intensité
    const parT = new Map(); segs.forEach((s) => { const k = s.b + "_" + r4(s.x1) + "_" + r4(s.x2), o = parT.get(k); if (o) o.q = o.q.map((v, q) => v + s.q[q]); else parT.set(k, { ...s, q: s.q.slice() }); });
    const tri = [...parT.values()].sort((a, b) => a.b - b.b || a.x1 - b.x1), fus = [];
    tri.forEach((s) => { const l = fus[fus.length - 1]; if (l && l.b === s.b && Math.abs(l.x2 - s.x1) < 1e-6 && l.q.every((v, k) => Math.abs(v - s.q[k]) < 1e-6)) l.x2 = s.x2; else fus.push({ ...s, q: s.q.slice() }); });
    return { ponct: [...ponct.values()].filter((o) => o.F.some((v) => Math.abs(v) > 1e-9)).sort((a, b) => a.b - b.b || a.x - b.x), rep: fus.filter((s) => s.q.some((v) => Math.abs(v) > 1e-9)) };
  }
  function lignesRobot(t, d) {
    const nat = (c) => c.nature || "";
    const charges = [["Cas", "Nom du cas", "Type de charge", "Barre", "X1 (m)", "X2 (m)", "FX (kN | kN/m)", "FY (kN | kN/m)", "FZ (kN | kN/m)", "MX (kN·m)", "MY (kN·m)", "MZ (kN·m)", "Repère"]], hors = [];
    (d.cas || []).forEach((c, ic) => { const CB = chargesBarres(t, c, hors);
      CB.ponct.forEach((o) => charges.push([ic + 1, c.nom, "Force concentrée sur barre", o.b, r4(o.x), "", ...o.F.map(r4), "global"]));
      CB.rep.forEach((s) => { const L = t.B[s.b - 1].L, tot = s.x1 < 1e-6 && Math.abs(s.x2 - L) < 1e-6;
        charges.push([ic + 1, c.nom, tot ? "Charge uniforme sur barre" : "Charge uniforme partielle sur barre", s.b, tot ? "" : r4(s.x1), tot ? "" : r4(s.x2), ...s.q.map(r4), "", "", "", "global"]); });
    });
    const ids = (d.cas || []).map((c) => c.id);
    return {
      noeuds: [["Nœud", "X (m)", "Y (m)", "Z (m)", "Commentaire"], ...t.N.map((n) => [n.n, r4(n.x), r4(n.y), r4(n.z), (t.AP.find((a) => a.n === n.n) || {}).lib || ""])],
      barres: [["Barre", "Nœud 1", "Nœud 2", "Section", "Matériau", "Longueur (m)", "Relâchements", "Élément"], ...t.B.map((b) => [b.n, b.i, b.j, b.section, b.mat || "", r4(b.L), b.rel || "", b.lib])],
      appuis: [["Nœud", "Liaison", ...DDL, "Commentaire"], ...t.AP.map((a) => [a.n, a.type, ...a.c.map((v) => (v === 1 ? "bloqué" : v > 1 ? r4(v) : "libre")), a.lib])],
      cas: [["Cas", "Nom", "Nature", "Identifiant FIP"], ...(d.cas || []).map((c, i) => [i + 1, c.nom, nat(c), c.id])],
      charges,
      combis: [["Combinaison", "Type", ...ids.map((id, i) => `Cas ${i + 1} (${id})`), "Remarque"], ...(d.combis || []).map((c) => [c.nom, c.type || "", ...ids.map((id) => (c.f && c.f[id] ? r4(c.f[id]) : "")), c.note || ""])],
      hors: [...new Set(hors)],
    };
  }
  async function exportRobot(t, d) {
    await chargerXLSX(); const L = lignesRobot(t, d), wb = XLSX.utils.book_new(), add = (nom, aoa, l) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = (l || aoa[0].map(() => 14)).map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, nom); };
    add("Lisez-moi", [["Export vers Robot – " + (d.titre || "")], [d.repere || ""], [], ["Contenu", "Feuilles Nœuds, Barres, Appuis, Cas, Charges, Combinaisons, au format des tableaux de Robot (copier-coller)."],
      ["Unités", "Longueurs m ; forces kN ; charges réparties kN/m (par mètre de barre, repère global) ; moments kN·m ; ressorts d'appui kN·m/rad (rotations) ou kN/m (translations)."],
      ["Repère", "Global, Z vertical ascendant ; X1 / X2 : abscisses en m depuis le nœud 1 de la barre."],
      ["Procédure (à valider dans votre version de Robot)", "1. Créer les matériaux et sections avec les noms de la feuille Barres (Robot exige des noms identiques à sa base). 2. Tableau Nœuds : coller X, Y, Z. 3. Tableau Barres : coller nœud 1, nœud 2, section, matériau ; appliquer les relâchements indiqués. 4. Appuis : créer les types de liaison de la feuille Appuis et les affecter aux nœuds. 5. Cas de charge : créer les cas dans l'ordre de la feuille Cas, puis coller les charges (tableau des charges). 6. Combinaisons : créer les combinaisons manuelles avec les coefficients de la feuille Combinaisons."],
      ...(d.notes || []).map((n) => ["Remarque", n]), ...(L.hors.length ? [["Attention", "Charges non localisées sur une barre pour les cas : " + L.hors.join(", ")]] : []),
      ["Statut", "Prédimensionnement (APS/APD) – non valable pour exécution. Export généré par FIP Études " + (typeof CALC_VERSION !== "undefined" ? CALC_VERSION : "") + " le " + new Date().toLocaleString("fr-FR") + "."]], [44, 140]);
    add("Nœuds", L.noeuds, [8, 12, 12, 12, 36]); add("Barres", L.barres, [8, 9, 9, 30, 10, 13, 36, 30]); add("Appuis", L.appuis, [8, 32, 10, 10, 10, 10, 10, 10, 34]);
    add("Cas", L.cas, [6, 60, 16, 14]); add("Charges", L.charges, [6, 44, 34, 7, 9, 9, 14, 14, 14, 11, 11, 11, 9]); add("Combinaisons", L.combis, [50, 12, ...L.combis[0].slice(2).map(() => 12)]);
    XLSX.writeFile(wb, (d.fichier || "export") + "_Robot.xlsx", { compression: true }); return L;
  }
  /* ---------- export Robot texte (.str, syntaxe ROBOT97 relevée sur un fichier Robot v40) ----------
     Barres découpées aux points de charge (numérotation discontinue : la barre B3 devient 301, 302… ; nœuds ajoutés à partir de 1001),
     charges nodales (NOEuds FX= …) et réparties sur barres entières (ELEments PZ= …), unités m et daN (1 kN = 100 daN ; kN·m → daN·m ×100).
     d : comme exportRobot, plus { horsPlan:true } (portique plan : UY, RX, RZ bloqués à tous les nœuds) */
  const ASCII = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[·×]/g, (c) => (c === "·" ? "." : "x")).replace(/[–—−]/g, "-").replace(/±/g, "+/-").replace(/→/g, "->").replace(/←/g, "<-").replace(/[φϕ]/g, "phi").replace(/[ψ]/g, "psi").replace(/[γ]/g, "g").replace(/[μ]/g, "mu").replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();
  const n2 = (v) => { const r = Math.round(v * 100) / 100; return (Object.is(r, -0) ? 0 : r).toFixed(2); };
  const nc = (v) => String(Math.round(v * 1e6) / 1e6);
  function sectionRobot(sec) {
    const s = String(sec), m = /^(HEA|HEB|HEM|IPE|IPN|UPN|UPE) (\d+)/.exec(s); if (m) return { txt: `${m[1]} ${m[2]}`, ok: true, jarret: /jarret/i.test(s) };
    const c = /^CHS ([\d,]+)x([\d,]+)/.exec(s); if (c) { const D = parseFloat(c[1].replace(",", ".")) / 1000, e = parseFloat(c[2].replace(",", ".")) / 1000; return { txt: ` Diamètre ${nc(D)} EP ${nc(e)}`, ok: true }; }
    return { txt: s.replace(/,/g, "."), ok: false };   // SHS, RHS, cornières, PRS : nom à vérifier dans la base Robot
  }
  function texteSTR(t, d) {
    const hors = [], CAS = (d.cas || []).map((c) => ({ c, CB: chargesBarres(t, c, hors) }));
    // points de découpe par barre
    const cuts = t.B.map(() => new Set());
    CAS.forEach(({ CB }) => { CB.ponct.forEach((o) => cuts[o.b - 1].add(r4(o.x))); CB.rep.forEach((s) => { cuts[s.b - 1].add(r4(s.x1)); cuts[s.b - 1].add(r4(s.x2)); }); });
    const nodes = t.N.map((n) => ({ id: n.n, x: n.x, y: n.y, z: n.z })), base = Math.max(1000, ...t.N.map((n) => n.n)) + 1, mult = t.B.length < 100 ? 100 : 1000;
    const pieces = [];   // { id, b, x1, x2, i, j }
    t.B.forEach((b, k) => { const L = b.L, A = coord(t, b.i), B = coord(t, b.j), xs = [...cuts[k]].filter((x) => x > 1e-4 && x < L - 1e-4).sort((p, q) => p - q);
      const pts = [{ x: 0, id: b.i }, ...xs.map((x) => { const P = [0, 1, 2].map((q) => A[q] + (B[q] - A[q]) * x / L), ex = nodes.find((n) => dist([n.x, n.y, n.z], P) < 1e-5); if (ex) return { x, id: ex.id };
        const id = base + nodes.length - t.N.length; nodes.push({ id, x: P[0], y: P[1], z: P[2] }); return { x, id }; }), { x: L, id: b.j }];
      for (let q = 0; q < pts.length - 1; q++) pieces.push({ id: pts.length > 2 ? b.n * mult + q + 1 : b.n, b: b.n, x1: pts[q].x, x2: pts[q + 1].x, i: pts[q].id, j: pts[q + 1].id }); });
    const noeudA = (b, x) => { const P = pieces.find((p) => p.b === b && Math.abs(p.x1 - x) < 2e-4); if (P) return P.i; const Q = pieces.find((p) => p.b === b && Math.abs(p.x2 - x) < 2e-4); return Q ? Q.j : null; };
    const L = [], pad = (v, w) => String(v).padStart(w), date = new Date(), dt = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;
    const nsec = [];
    L.push(";+---------------------------+-------------------------+---------------------+", `;! Fichier: ${ASCII(d.fichier || "FIP").slice(0, 16).padEnd(16)}! Date: ${dt}    ! FIP Etudes ${typeof CALC_VERSION !== "undefined" ? CALC_VERSION : ""}      !`, ";+---------------------------+-------------------------+---------------------+");
    L.push(`; ${ASCII(d.titre || "")}`, `; ${ASCII(d.repere || "")}`, "; Predimensionnement (APS/APD) - non valable pour execution. Fichier a verifier a l'ouverture dans Robot.",
      "; Poids propre des profiles inclus dans le cas G (charges reparties) : ne pas ajouter le poids propre automatique de Robot.",
      "; Combinaisons manuelles en fin de fichier (COMbinaison) ; combinaisons sismiques en nature ELU (comme Robot), libelle prefixe SIS.", ...(d.notes || []).map((n) => "; " + ASCII(n)), "ROBOT97", "", "PORtique SPAtial", "", "NUMérotation DIScontinue", "", `NOEuds ${nodes.length}  ELEments ${pieces.length}`, "", "UNItés", "Longueur=m\tForce=daN", "");
    L.push(";+------+-------------------+--------------------+--------------------+", ";!  N° !        X         !         Y         !         Z         !", ";+------+-------------------+--------------------++-------------------+", "NOEuds");
    nodes.forEach((n) => L.push(`${pad(n.id, 5)}  ${pad(nc(n.x), 11)}          ${pad(nc(n.y), 11)}          ${pad(nc(n.z), 11)}`));
    L.push("", "ELEments", ";+------+-------+-------+", ";!  N° ! ORIG.! EXTR.!", ";+------+-------+-------+");
    pieces.forEach((p) => L.push(`${pad(p.id, 5)}   ${pad(p.i, 5)}   ${pad(p.j, 5)}`));
    L.push("", "", "CARactéristiques physiques");
    const parMat = {}, jar = new Set(); pieces.forEach((p) => { const b = t.B[p.b - 1], mat = ASCII(b.mat || "S235").replace(/^S(\d)/, "S $1"), sr = sectionRobot(b.section); if (!sr.ok) nsec.push(b.section); if (sr.jarret) jar.add(`B${b.n} (${ASCII(b.section)})`);
      ((parMat[mat] = parMat[mat] || {})[sr.txt] = parMat[mat][sr.txt] || []).push(p.id); });
    const liste = (ids, suf) => { const out = []; for (let k = 0; k < ids.length; k += 25) out.push(" " + ids.slice(k, k + 25).join(" ") + " " + suf); return out; };
    Object.entries(parMat).forEach(([mat, S]) => { L.push(`"${mat}"`); Object.entries(S).forEach(([sec, ids]) => L.push(...liste(ids, sec.startsWith(" ") ? sec.trim() : sec))); });
    if (jar.size) L.push("; Jarrets exportes avec la section constante de la traverse - a definir en section variable (jarret) dans Robot : " + [...jar].join(", "));
    if (nsec.length) L.push("; Sections a verifier dans la base Robot (noms FIP) : " + [...new Set(nsec)].map(ASCII).join(", "));
    // appuis : ddl LIBRES listés (relevé sur le fichier de référence : rotules « RX RY RZ ») ; ressorts → bloqués (signalés)
    const DL = ["UX", "UY", "UZ", "RX", "RY", "RZ"], grp = {}, ress = [];
    const appui = (id, c) => { const lib = DL.filter((_, k) => c[k] === 0).join(" "); (grp[lib] = grp[lib] || []).push(id); if (c.some((v) => v > 1)) ress.push(`N${id} : ` + DL.map((d0, k) => (c[k] > 1 ? `${d0} k = ${Math.round(c[k])} kN.m/rad` : "")).filter(Boolean).join(", ")); };
    t.AP.forEach((a) => appui(a.n, a.c));
    if (d.horsPlan) nodes.forEach((n) => { if (!t.AP.some((a) => a.n === n.id)) appui(n.id, [0, 1, 0, 1, 0, 1]); });
    L.push("", "APPuis", ""); Object.entries(grp).forEach(([lib, ids]) => L.push(...liste(ids, lib).map((l) => l.trimEnd())));
    if (ress.length) L.push("; Ressorts d'appui (platine semi-rigide) exportes comme blocages - a definir en appui elastique dans Robot :", ...ress.map((r) => "; " + r));
    const rel = t.B.filter((b) => /articul/i.test(b.rel || ""));
    if (rel.length) { L.push("", "RELâchements", ""); rel.forEach((b) => { const P = pieces.filter((p) => p.b === b.n); if (P.length === 1) L.push(`ELEments ${P[0].id}  ORigine RX RY RZ EX RY RZ`); else { L.push(`ELEments ${P[0].id}  ORigine RX RY RZ`); L.push(`ELEments ${P[P.length - 1].id}  EX RY RZ`); } }); }
    L.push("", "CHArgements", "");
    CAS.forEach(({ c, CB }, ic) => { L.push(`CAs # ${ic + 1} ${ASCII(c.nom).toUpperCase().slice(0, 60)}`);
      const el = []; CB.rep.forEach((s) => { const ids = pieces.filter((p) => p.b === s.b && p.x1 >= s.x1 - 2e-4 && p.x2 <= s.x2 + 2e-4).map((p) => p.id); ["PX", "PY", "PZ"].forEach((k, q) => { if (Math.abs(s.q[q]) > 1e-9) el.push(...liste(ids, `${k}=${n2(s.q[q] * 100)}`).map((l) => "\t" + l.trim())); }); });
      const no = []; CB.ponct.forEach((o) => { const id = noeudA(o.b, r4(o.x)); ["FX", "FY", "FZ", "CX", "CY", "CZ"].forEach((k, q) => { if (Math.abs(o.F[q]) > 1e-9) no.push(`\t${id} ${k}=${n2(o.F[q] * 100)}`); }); });
      if (el.length) L.push("ELEments", ...el); if (no.length) L.push("NOEuds", ...no); L.push(""); });
    // combinaisons manuelles (syntaxe relevée sur un fichier Robot v40) : « COMbinaison # n libellé », nature (ELU, ELS, ACCidentelle), paires « cas coefficient »
    const numCas = {}; CAS.forEach(({ c }, ic) => { numCas[c.id] = ic + 1; }); let nC = CAS.length, nSis = 0;
    const vues = new Set(); let nDbl = 0;
    (d.combis || []).forEach((cb) => { const P = Object.entries(cb.f || {}).filter(([id, k]) => numCas[id] && Math.abs(k) > 1e-9); if (!P.length) return;
      const sig = String(cb.type || "").slice(0, 3) + P.map(([id, k]) => numCas[id] + ":" + Math.round(k * 1e4)).sort().join("|"); if (vues.has(sig)) { nDbl++; return; } vues.add(sig);
      const ty = String(cb.type || ""), sis = /sism/i.test(ty), nat = /ELS/i.test(ty) ? "ELS" : sis ? (nSis++, "ELU") : /accid/i.test(ty) ? "ACCidentelle" : "ELU";
      const lib = (sis ? "SIS " : "") + ASCII(cb.nom).replace(/,/g, ".").replace(/\s*\.\s*(?=[A-Za-z])/g, "*").slice(0, 80);
      L.push(`COMbinaison # ${++nC} ${lib}`, ` ${nat}`, P.map(([id, k]) => `${numCas[id]} ${Math.round(k * 1e4) / 1e4}`).join(" ") + " ", ""); });
    if (nSis) L.push(`; ${nSis} combinaison(s) sismique(s) (statique equivalente 6.12b) en nature ELU, libelle SIS.`, "");
    if (nDbl) L.push(`; ${nDbl} combinaison(s) identique(s) une fois les imperfections retirees (sens phi -> / <-) non repetee(s) : definir les defauts dans Robot.`, "");
    L.push("FIN", "", "");
    return { texte: L.join("\r\n"), nodes, pieces, ress, combis: nC - CAS.length, jarrets: [...jar], sections: [...new Set(nsec)], hors: [...new Set(hors)], moments: CAS.some(({ CB }) => CB.ponct.some((o) => o.F.slice(3).some((v) => Math.abs(v) > 1e-9))) };
  }
  /* encodage Windows-1252 (fichiers Robot) */
  function cp1252(txt) { const sp = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c }, out = new Uint8Array(txt.length);
    for (let k = 0; k < txt.length; k++) { const ch = txt[k], c = txt.charCodeAt(k); out[k] = sp[ch] ?? (c < 256 ? c : 63); } return out; }
  function exportSTR(t, d) { const R = texteSTR(t, d), blob = new Blob([cp1252(R.texte)], { type: "application/octet-stream" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = (d.fichier || "export") + ".str"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return R; }
  /* ---------- liens avec les modules d'assemblage (aller : fip.an1.pre ; retour : fip.an1.retour[clé]) ----------
     empreinte(x) : empreinte courte des efforts envoyés ; badge(cle, emp) : résultat renvoyé par AN1 pour cette clé */
  function empreinte(x) { const s = JSON.stringify(x); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function retour(cle) { try { return (JSON.parse(localStorage.getItem("fip.an1.retour")) || {})[cle] || null; } catch (e) { return null; } }
  function badge(cle, emp) { const r = retour(cle); if (!r) return '<span class="note">non vérifié dans AN1</span>';
    const ok = isFinite(r.u) && r.u <= 1, perime = emp && r.emp !== emp, d = new Date(r.t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `<span style="font-weight:700;color:${perime ? "#b26a00" : ok ? "#1d7a36" : "#c0141c"}">${perime ? "⚠" : ok ? "✔" : "✘"} AN1 : ${isFinite(r.u) ? Math.round(r.u * 100) + " %" : "non vérifiable"}</span> <span class="note">${esc(r.cheville || "")}${r.methode ? " – " + esc(r.methode) : ""} (${d})${r.modifie ? " – combinaisons modifiées dans AN1" : ""}${perime ? " – efforts modifiés depuis : à relancer" : ""}</span>`; }
  return { construire, tableaux, etiquettes, typeLiaison, localiser, localiserSeg, chargesBarres, lignesRobot, exportRobot, texteSTR, exportSTR, sectionRobot, empreinte, retour, badge };
})();
if (typeof module !== "undefined") module.exports = TOPO;
