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
    const AP = (m.appuis || []).map((a) => ({ n: num[cle(a.pt)], c: a.c.slice(), lib: a.lib || "", type: typeLiaison(a.c) })).sort((p, q) => p.n - q.n);
    return { N: ordre.map((k) => ({ n: num[k], ...N[k] })), B: B.map((b, k) => ({ n: k + 1, ...b, i: num[b.i], j: num[b.j] })), AP };
  }
  function tableaux(t, opt = {}) {
    const ap = (n) => t.AP.find((a) => a.n === n);
    const tN = `<table class="topo"><tr><th>Nœud</th><th class="n">X (m)</th><th class="n">Y (m)</th><th class="n">Z (m)</th><th>Appui</th></tr>${t.N.map((n) => { const a = ap(n.n);
      return `<tr><td>N${n.n}</td><td class="n">${fr(n.x)}</td><td class="n">${fr(n.y)}</td><td class="n">${fr(n.z)}</td><td>${a ? esc(a.lib || a.type) : ""}</td></tr>`; }).join("")}</table>`;
    const tB = `<table class="topo"><tr><th>Barre</th><th>Origine</th><th>Extrémité</th><th>Section</th>${t.B.some((b) => b.mat) ? "<th>Matériau</th>" : ""}<th class="n">Longueur (m)</th><th>Élément</th><th>Relâchements</th></tr>${t.B.map((b) =>
      `<tr><td>B${b.n}</td><td>N${b.i}</td><td>N${b.j}</td><td>${esc(b.section)}</td>${t.B.some((x) => x.mat) ? `<td>${esc(b.mat)}</td>` : ""}<td class="n">${fr(b.L)}</td><td>${esc(b.lib)}</td><td>${esc(b.rel || "aucun (encastrée)")}</td></tr>`).join("")}</table>`;
    const tA = t.AP.length ? `<table class="topo"><tr><th>Nœud</th><th>Liaison</th>${DDL.map((d) => `<th>${d}</th>`).join("")}<th>Repère</th></tr>${t.AP.map((a) =>
      `<tr><td>N${a.n}</td><td>${esc(a.type)}</td>${a.c.map((v, k) => `<td>${v === 1 ? "bloqué" : v > 1 ? "k = " + fr(v, 0) + (k >= 3 ? " kN·m/rad" : " kN/m") : "libre"}</td>`).join("")}<td>${esc(a.lib)}</td></tr>`).join("")}</table>` : "";
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
  return { construire, tableaux, etiquettes, typeLiaison };
})();
if (typeof module !== "undefined") module.exports = TOPO;
