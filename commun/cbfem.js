/* =====================================================================
   CBFEM — platine flexible sur béton (phase 2 de AN1). Unités : N, mm.
   Modèle :
   - platine : plaque épaisse de Reissner-Mindlin, quadrilatères MITC4 (3 ddl par nœud : w, βx, βy), maillage
     rectangulaire passant par les chevilles ; acier élastique – parfaitement plastique traité par rigidité sécante
     en flexion (théorie de la déformation, critère de von Mises sur le moment équivalent) ;
   - béton : appui de Winkler unilatéral (compression seule), raideur k_c = E_cm / h_c ;
   - chevilles : ressorts en traction seule de raideur k_a (déplacement de l'ETE ou tige E_s·A_s/L) ;
   - profilé : parois indéformables dans leur plan (section plane w = w0 + θ1·y − θ2·x imposée par pénalité le long
     des lignes moyennes des parois) ; N, Mx, My appliqués à ce corps rigide (au centre de la platine) ;
   - raidisseurs (3.06) : plats verticaux soudés au profilé et à la platine, modélisés en poutres de Timoshenko de hauteur
     variable h(s) (triangulaire, chanfreinée ou rectangulaire) le long de leur pied, section en T avec une bande de platine
     pour semelle (3.08), acier élastique – parfaitement plastique (rigidité sécante, critère de von Mises sur σ = M·z_s/I au
     bord libre et τ = V/(t·h)) : flèche liée à la platine (soudure),
     pied côté profilé lié au corps rigide du profilé, en déplacement et, si le raidisseur est adossé (prolongement d'une
     paroi ou paroi derrière lui), en rotation ; A_v = 5/6·t·h ;
   - tube rond (3.09) : la platine n'est pas encastrée sur la paroi (une ligne de liaison + rigidité de rotation de coque
     2·β·D) ; raidisseurs rayonnants à pied semi-rigide (k_r = κ·E·t³·H³/r³, à vérifier) ;
   - tubes ronds, carrés et rectangulaires (3.10) : raidisseurs non liés à la platine sur la première maille contre le tube,
     coefficient de pointe sur leurs cordons (K_POINTE_TUBE) ;
   - soudures (3.07) : efforts des cordons par résultante (cordons), contrainte équivalente dans la gorge (sigmaSoudure) ;
   - résolution : factorisation LDLᵀ en ligne de ciel, itérations sur l'état des contacts, des chevilles et des
     rigidités sécantes.
   Sorties : traction par cheville, pression de contact, contrainte équivalente et déformation plastique de la
   platine, effort linéique en pied de paroi (contrainte du profilé, soudures), flèches.
   Convention : z sortant du béton, w > 0 = décollement ; N > 0 traction ; Mx > 0 tend les y > 0 ; My > 0 tend les x < 0.
   ===================================================================== */
const CBFEM = (() => {
  const NU = 0.3, ES = 210000;

  /* ---------- lignes moyennes des parois d'un profilé (repère local : h selon x pour les I/U, origine au centre) ----------
     p : {f, h, b, tw, tf, t} (commun/data/profils.js) ; retour [{a:[x,y], b:[x,y], t}] ou, pour un tube rond, des cordes */
  /* tube rond : rigidité de rotation du bord de la paroi (coque cylindrique mince chargée par un moment de bord uniforme,
     N·mm/mm par radian) : m/θ = 2·β·D, β = [3·(1 − ν²)]^¼/√(r·t), D = E·t³/(12·(1 − ν²)). La platine n'est pas encastrée sur la paroi :
     elle y est tenue en déplacement et retenue en rotation par cette rigidité (3.09). */
  const rotCoque = (r, t) => 2 * Math.pow(3 * (1 - NU * NU), 0.25) / Math.sqrt(r * t) * ES * t * t * t / (12 * (1 - NU * NU));
  function parois(p) {
    if (!p) return [];
    if (p.parois) return p.parois.map((w) => ({ a: w.a.slice(), b: w.b.slice(), t: w.t }));      // plats soudés (sabot) : parois données dans le repère de la platine
    const f = p.f || "";
    if (/^(HE|IP)/.test(f)) { const d = (p.h - p.tf) / 2; return [{ a: [-d, -p.b / 2], b: [-d, p.b / 2], t: p.tf }, { a: [d, -p.b / 2], b: [d, p.b / 2], t: p.tf }, { a: [-d, 0], b: [d, 0], t: p.tw }]; }
    if (/^UP/.test(f)) { const d = (p.h - p.tf) / 2, y0 = -p.b / 2 + p.tw / 2; return [{ a: [-d, y0], b: [-d, p.b / 2], t: p.tf }, { a: [d, y0], b: [d, p.b / 2], t: p.tf }, { a: [-d, y0], b: [d, y0], t: p.tw }]; }
    if (/^L/.test(f)) { const t = p.t || p.tw || p.tf, x0 = -p.b / 2 + t / 2, y0 = -p.h / 2 + t / 2; return [{ a: [x0, y0], b: [p.b / 2, y0], t }, { a: [x0, y0], b: [x0, p.h / 2], t }]; }
    if (f === "CHS") { const r = (p.h - p.t) / 2, n = Math.max(16, Math.round(2 * Math.PI * r / 15)), S = []; for (let i = 0; i < n; i++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * (i + 1) / n; S.push({ a: [r * Math.cos(u), r * Math.sin(u)], b: [r * Math.cos(v), r * Math.sin(v)], t: p.t, kr: rotCoque(r, p.t) }); } return S; }
    if (p.t && p.b && p.h) { const x = (p.b - p.t) / 2, y = (p.h - p.t) / 2; return [{ a: [-x, -y], b: [x, -y], t: p.t }, { a: [x, -y], b: [x, y], t: p.t }, { a: [x, y], b: [-x, y], t: p.t }, { a: [-x, y], b: [-x, -y], t: p.t }]; }
    return [];
  }
  /* parois placées dans le repère de la platine (excentricité ex, ey ; angle en degrés) */
  function paroisPlacees(p, pr) {
    const a = ((pr && pr.a) || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), ex = (pr && pr.x) || 0, ey = (pr && pr.y) || 0, R = ([x, y]) => [ex + x * c - y * s, ey + x * s + y * c];
    return parois(p).map((w) => ({ ...w, a: R(w.a), b: R(w.b) }));
  }

  /* ---------- faces d'un profilé où souder un raidisseur (repère local du profilé) ----------
     retour [{ id, lib, o:[x,y] (origine de la face), u:[ux,uy] (sens des positions), n:[nx,ny] (normale sortante), L (mm), bout, cercle }]
     côtés : deux faces par paroi (e = extérieure, i = intérieure ; p / m pour une paroi passant par le centre) ; bouts libres : a (début), b (fin) ;
     tube rond : une face « c », position = angle en degrés. */
  function facesProfil(p) {
    if (!p) return [];
    if (p.f === "CHS") return [{ id: "c", lib: "Pourtour (position = angle en °)", cercle: true, r: p.h / 2, L: 360, t: p.t }];
    const W = parois(p), F = [], I = /^(HE|IP)/.test(p.f || ""), U = /^UP/.test(p.f || ""), tube = !I && !U && !/^L/.test(p.f || "") && !p.parois;
    const cx = W.reduce((s, w) => s + (w.a[0] + w.b[0]) / 2, 0) / W.length, cy = W.reduce((s, w) => s + (w.a[1] + w.b[1]) / 2, 0) / W.length;
    const axe = (n) => (Math.abs(n[0]) > Math.abs(n[1]) ? (n[0] > 0 ? "x+" : "x−") : (n[1] > 0 ? "y+" : "y−"));
    W.forEach((w, k) => {
      const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], m = [-u[1], u[0]], mx = (w.a[0] + w.b[0]) / 2 - cx, my = (w.a[1] + w.b[1]) / 2 - cy, s = mx * m[0] + my * m[1];
      const nom = (I || U) ? (k < 2 ? `Aile ${k + 1}` : "Âme") : tube ? "Paroi" : `Plat ${k + 1}`, centre = Math.abs(s) < 1e-6;
      [[1, centre ? "p" : s >= 0 ? "e" : "i"], [-1, centre ? "m" : s >= 0 ? "i" : "e"]].forEach(([sg, c]) => { const n = [sg * m[0], sg * m[1]];
        F.push({ id: k + c, lib: `${nom} ${tube || centre ? "" : c === "e" ? "– face extérieure " : "– face intérieure "}(${axe(n)})`.replace("  ", " "), o: [w.a[0] + n[0] * w.t / 2, w.a[1] + n[1] * w.t / 2], u, n, L, t: w.t, iw: k }); });
      if (!tube) [[w.a, [-u[0], -u[1]], "a"], [w.b, u, "b"]].forEach(([pt, n, c]) => {                   // bout libre : aucune autre paroi à cet endroit
        if (W.some((z, j) => j !== k && distSeg(pt, z.a, z.b) < z.t / 2 + w.t / 2 + 1)) return;
        F.push({ id: k + c, lib: `${nom} – bout (${axe(n)}), dans son prolongement`, o: pt.slice(), u: [-n[1], n[0]], n, L: 0, t: w.t, iw: k, bout: true }); });
    });
    return F;
  }
  function distSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy); }
  /* raidisseur radial sur un tube rond (3.09) — À VÉRIFIER : la paroi mince du tube ne l'encastre pas ; son moment de pied M est repris
     par un couple de forces radiales (bras ≈ 2H/3) qui ovalise la paroi : rigidité de rotation du pied k_r = κ·E·t³·H³/r³ (N·mm/rad)
     (t, r : épaisseur et rayon moyen du tube ; H : hauteur du raidisseur). Anneau libre de largeur H : κ ≈ 0,25 ; la coque tenue par la
     platine et par les autres raidisseurs est plus raide : κ calé sur une note de comparaison détaillée (tube 168,3 × 5, 6 raidisseurs 100 × 200 × 5). */
  const K_RAID_TUBE = 1.5;
  /* raidisseurs sur tubes (ronds, carrés, rectangulaires), 3.10 — À VÉRIFIER : (1) le raidisseur n'est pas lié à la platine sur la première maille
     contre le tube (la paroi y tient déjà la platine ; sinon efforts opposés parasites à la jonction, qui chargent à tort la soudure du tube) ;
     (2) contrainte de ses cordons sur la platine multipliée par K_POINTE_TUBE : les deux notes détaillées sur tubes (carré 80 × 3 à 8 raidisseurs,
     rond 168,3 × 5 à 6 raidisseurs) donnent une pointe supérieure de 35 % (0,74 = 165/222 = 239/325), au-delà de f_y·t du raidisseur :
     état biaxial du raidisseur (jusqu'à 1,155·f_y) et partage inégal entre les deux cordons (±3 à 12 % relevés), non modélisés. */
  const K_POINTE_TUBE = 1.35;
  /* raidisseur défini sur une face → pied dans le repère de la platine
     r : { face, pos (mm depuis l'origine de la face, ou angle ° sur un tube rond ; ignoré sur un bout), L (longueur du pied), H (hauteur),
           t (épaisseur), forme ('tri' | 'chf' | 'rect'), bh, bv (chanfreinée : bord horizontal en tête, bord vertical en pointe) }
     retour { a, b, t, H, bh, bv, enc } ; enc : pied adossé (encastré en rotation) = bout de paroi ou autre paroi passant derrière le pied */
  function raidisseur(p, pr, r) {
    const F = facesProfil(p).find((f) => f.id === r.face); if (!F) return null;
    let a, n;
    if (F.cercle) { const g = (+r.pos || 0) * Math.PI / 180; n = [Math.cos(g), Math.sin(g)]; a = [F.r * n[0], F.r * n[1]]; }
    else { const s = F.bout ? 0 : Math.max(0, Math.min(F.L, +r.pos || 0)); n = F.n; a = [F.o[0] + F.u[0] * s, F.o[1] + F.u[1] * s]; }
    const L = Math.max(5, +r.L || 50), b = [a[0] + n[0] * L, a[1] + n[1] * L], W = parois(p);
    const enc = !F.cercle && (F.bout || W.some((z, j) => j !== F.iw && distSeg(a, z.a, z.b) < z.t / 2 + F.t + 1));
    const g = ((pr && pr.a) || 0) * Math.PI / 180, c = Math.cos(g), s = Math.sin(g), ex = (pr && pr.x) || 0, ey = (pr && pr.y) || 0, R = ([x, y]) => [ex + x * c - y * s, ey + x * s + y * c];
    const H = Math.max(5, +r.H || 100), forme = r.forme || "tri";
    const out = { a: R(a), b: R(b), t: Math.max(1, +r.t || 6), H, bh: forme === "rect" ? L : forme === "chf" ? Math.min(L, +r.bh || 0) : 0, bv: forme === "rect" ? H : forme === "chf" ? Math.min(H, +r.bv || 0) : 0, enc, forme };
    if (F.cercle || (!/^(HE|IP|UP|L)/.test(p.f || "") && !p.parois)) out.rac = true;      // tube (rond, carré, rectangulaire) : voir K_POINTE_TUBE
    if (F.cercle) out.kr = K_RAID_TUBE * ES * Math.pow(F.t, 3) * Math.pow(H, 3) / Math.pow(F.r - F.t / 2, 3);      // pied semi-rigide (voir K_RAID_TUBE)
    return out;
  }
  /* hauteur du raidisseur à l'abscisse s depuis le profilé : H sur bh, puis linéaire jusqu'à bv en pointe */
  const hauteurRaid = (r, s, L) => (s <= r.bh ? r.H : r.H + (r.bv - r.H) * (s - r.bh) / Math.max(L - r.bh, 1e-9));

  /* ---------- maillage : lignes de la grille ---------- */
  function lignes(L, pts, h) {
    const P = [-L / 2, L / 2].concat(pts.filter((v) => v > -L / 2 + 0.35 * h && v < L / 2 - 0.35 * h)).sort((a, b) => a - b), Q = [P[0]];
    for (let i = 1; i < P.length; i++) { if (P[i] - Q[Q.length - 1] < 0.35 * h) { if (i === P.length - 1) { if (Q.length > 1) Q[Q.length - 1] = P[i]; else Q.push(P[i]); } } else Q.push(P[i]); }
    const out = [];
    for (let i = 0; i < Q.length - 1; i++) { const n = Math.max(1, Math.round((Q[i + 1] - Q[i]) / h)); for (let k = 0; k < n; k++) out.push(Q[i] + (Q[i + 1] - Q[i]) * k / n); }
    out.push(Q[Q.length - 1]); return out;
  }

  /* ---------- rigidité élémentaire MITC4 (rectangle a × b) : flexion Kb (pour D = 1 → ×D) et cisaillement Ks (pour κGt = 1) ---------- */
  function elementaire(a, b) {
    const Kb = new Float64Array(144), Ks = new Float64Array(144), g = 1 / Math.sqrt(3), XI = [-1, 1, 1, -1], ET = [-1, -1, 1, 1];
    for (const xi of [-g, g]) for (const et of [-g, g]) {
      const dNx = [], dNy = []; for (let i = 0; i < 4; i++) { dNx.push(XI[i] * (1 + ET[i] * et) / 4 * 2 / a); dNy.push(ET[i] * (1 + XI[i] * xi) / 4 * 2 / b); }
      const B = [new Float64Array(12), new Float64Array(12), new Float64Array(12)];
      for (let i = 0; i < 4; i++) { B[0][3 * i + 1] = dNx[i]; B[1][3 * i + 2] = dNy[i]; B[2][3 * i + 1] = dNy[i]; B[2][3 * i + 2] = dNx[i]; }
      const Db = [[1, NU, 0], [NU, 1, 0], [0, 0, (1 - NU) / 2]], wJ = a * b / 4;
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { let v = 0; for (let m = 0; m < 3; m++) for (let n = 0; n < 3; n++) v += B[m][r] * Db[m][n] * B[n][c]; Kb[r * 12 + c] += v * wJ; }
      // cisaillement à déformations imposées (MITC4)
      const gx = new Float64Array(12), gy = new Float64Array(12), fA = (1 - et) / 2, fC = (1 + et) / 2, fD = (1 - xi) / 2, fB = (1 + xi) / 2;
      gx[0] += -fA / a; gx[3] += fA / a; gx[1] += fA / 2; gx[4] += fA / 2;           // arête 1-2
      gx[9] += -fC / a; gx[6] += fC / a; gx[10] += fC / 2; gx[7] += fC / 2;          // arête 4-3
      gy[0] += -fD / b; gy[9] += fD / b; gy[2] += fD / 2; gy[11] += fD / 2;          // arête 1-4
      gy[3] += -fB / b; gy[6] += fB / b; gy[5] += fB / 2; gy[8] += fB / 2;           // arête 2-3
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) Ks[r * 12 + c] += (gx[r] * gx[c] + gy[r] * gy[c]) * wJ;
    }
    // courbures au centre : κx, κy, κxy
    const Bc = [new Float64Array(12), new Float64Array(12), new Float64Array(12)];
    for (let i = 0; i < 4; i++) { const dx = XI[i] / 4 * 2 / a, dy = ET[i] / 4 * 2 / b; Bc[0][3 * i + 1] = dx; Bc[1][3 * i + 2] = dy; Bc[2][3 * i + 1] = dy; Bc[2][3 * i + 2] = dx; }
    return { Kb, Ks, Bc };
  }

  /* ---------- solveur ligne de ciel (LDLᵀ) ---------- */
  function ciel(n, haut) {            // haut[j] = première ligne non nulle de la colonne j
    const pos = new Int32Array(n + 1); for (let j = 0; j < n; j++) pos[j + 1] = pos[j] + (j - haut[j] + 1);
    return { n, haut, pos, v: new Float64Array(pos[n]) };
  }
  const idx = (S, i, j) => S.pos[j] + (i - S.haut[j]);          // i ≤ j, i ≥ haut[j]
  function factoriser(S) {
    const { n, haut, pos, v } = S;
    for (let j = 0; j < n; j++) {
      const hj = haut[j], pj = pos[j] - hj;
      for (let i = hj + 1; i < j; i++) { const hi = haut[i], pi = pos[i] - hi; let s = v[pj + i]; for (let k = Math.max(hi, hj); k < i; k++) s -= v[pi + k] * v[pj + k]; v[pj + i] = s; }
      let d = v[pj + j];
      for (let i = hj; i < j; i++) { const l = v[pj + i] / v[pos[i] + i - haut[i]]; d -= l * v[pj + i]; v[pj + i] = l; }
      if (!(Math.abs(d) > 1e-12)) throw new Error("Modèle CBFEM instable (aucune cheville tendue ni appui actif).");
      v[pj + j] = d;
    }
  }
  function resoudre(S, f) {
    const { n, haut, pos, v } = S, x = Float64Array.from(f);
    for (let j = 0; j < n; j++) { const pj = pos[j] - haut[j]; let s = x[j]; for (let i = haut[j]; i < j; i++) s -= v[pj + i] * x[i]; x[j] = s; }
    for (let j = 0; j < n; j++) x[j] /= v[pos[j] + j - haut[j]];
    for (let j = n - 1; j >= 0; j--) { const pj = pos[j] - haut[j], xj = x[j]; for (let i = haut[j]; i < j; i++) x[i] -= v[pj + i] * xj; }
    return x;
  }

  /* ---------- raideur axiale d'une cheville (N/mm) — À VÉRIFIER ----------
     Le logiciel de comparaison utilise des raideurs d'essais non publiées. Règle calée sur 12 notes de comparaison (2.79) :
     scellement chimique (HAS, M10 à M30, h_ef 60 à 214 mm ; HAS M20 sous-estimé de 8 à 15 %, béton fissuré ou non) : k = E_s·A_s/L avec L = 80 mm ;
     cheville à expansion (HST4 M8 à M20, h_ef 30 à 111 mm) : k = 160 kN/mm en béton non fissuré, 125 kN/mm en béton fissuré,
     indépendamment du diamètre (raideur gouvernée par le glissement du cône, pas par la tige).
     Contrôlée sans recalage sur 4 notes de plus (2.80 : HST4 M8, HAS M10 et M20) : écart sur la cheville la plus tendue −9 % à +7 %.
     Faibles efforts (chevilles peu tendues, platine comprimée) : tractions sous-estimées (raideur réelle non linéaire).
     Les déplacements à court terme des ETE (δ_N0) donnent des raideurs 2,5 à 7 fois plus faibles, donc moins d'effet de levier. */
  function raideurCheville(chimique, d, hef, t, fiss) {
    const As = 0.78 * Math.PI * d * d / 4, k = chimique ? ES * As / 80 : (fiss ? 125e3 : 160e3);
    return { k, L: ES * As / k, As, src: chimique ? "tige E_s·A_s/L, L = 80 mm (calée sur 7 notes de comparaison, contrôlée sur 8, M10 à M30)" : `${fiss ? 125 : 160} kN/mm en béton ${fiss ? "" : "non "}fissuré (calée sur 4 notes de comparaison, contrôlée sur 4, HST4 M8 à M20)` };
  }

  /* ---------- calcul ----------
     o : { plaque:{lx,ly,t,fy}, A:[{x,y}], ka (N/mm, nombre ou tableau), kc (N/mm³), parois:[{a,b,t}], comb:{N,Mx,My} (N, N·mm, au centre de la platine),
           h (taille de maille visée, facultatif), plastique (true par défaut) } */
  function calculer(o) {
    const { lx, ly, t } = o.plaque, fy = o.plaque.fy || 235, A = o.A, nA = A.length;
    if (!(o.parois && o.parois.length)) throw new Error("CBFEM : un profilé est nécessaire pour appliquer les efforts à la platine.");
    let h = o.h || Math.max(8, Math.min(14, Math.min(lx, ly) / 20));
    if (!o.h) while (3 * (lx / h + 1) * (ly / h + 1) > 6000) h *= 1.1;      // au plus ≈ 6 000 inconnues
    // points durs : chevilles et extrémités de parois parallèles aux axes
    const px = A.map((a) => a.x), py = A.map((a) => a.y);
    o.parois.forEach((w) => { if (Math.abs(w.a[0] - w.b[0]) < 1e-6) px.push(w.a[0]); if (Math.abs(w.a[1] - w.b[1]) < 1e-6) py.push(w.a[1]); });
    const RD = o.raid || [];
    RD.forEach((w) => { if (Math.abs(w.a[0] - w.b[0]) < 1e-6) px.push(w.a[0]); if (Math.abs(w.a[1] - w.b[1]) < 1e-6) py.push(w.a[1]); });
    let X = lignes(lx, px, h), Y = lignes(ly, py, h), swap = false;
    const nx = X.length, ny = Y.length, nn = nx * ny;
    if (nx < ny) swap = true;                                  // numérotation le long du petit côté (bande minimale)
    const nd = (i, j) => (swap ? j * nx + i : i * ny + j), W0 = 3 * nn, T1 = W0 + 1, T2 = W0 + 2;
    let nddl = 3 * nn + 3;
    // interpolation bilinéaire en un point
    const cherche = (L, v) => { let i = 0; while (i < L.length - 2 && v > L[i + 1]) i++; return i; };
    const interp = (x, y) => { x = Math.max(X[0], Math.min(X[nx - 1], x)); y = Math.max(Y[0], Math.min(Y[ny - 1], y)); const i = cherche(X, x), j = cherche(Y, y), u = (x - X[i]) / (X[i + 1] - X[i]), v = (y - Y[j]) / (Y[j + 1] - Y[j]);
      return [[nd(i, j), (1 - u) * (1 - v)], [nd(i + 1, j), u * (1 - v)], [nd(i + 1, j + 1), u * v], [nd(i, j + 1), (1 - u) * v]].filter((q) => q[1] > 1e-9); };
    // éléments
    const EL = [], cache = {};
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) { const a = X[i + 1] - X[i], b = Y[j + 1] - Y[j], k = a.toFixed(4) + "_" + b.toFixed(4); if (!cache[k]) cache[k] = elementaire(a, b);
      const N4 = [nd(i, j), nd(i + 1, j), nd(i + 1, j + 1), nd(i, j + 1)], dl = []; N4.forEach((n) => dl.push(3 * n, 3 * n + 1, 3 * n + 2)); EL.push({ i, j, a, b, K: cache[k], dl, s: 1, r: 0 }); }
    // aires tributaires des nœuds (Winkler)
    const aire = new Float64Array(nn); EL.forEach((e) => { for (let q = 0; q < 4; q++) aire[e.dl[3 * q] / 3] += e.a * e.b / 4; });
    // points de liaison profilé – platine
    const PT = []; o.parois.forEach((w, iw) => { const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), n = Math.max(1, Math.ceil(L / (0.6 * h)));
      const ox = -(w.b[1] - w.a[1]) / L * w.t / 2, oy = (w.b[0] - w.a[0]) / L * w.t / 2;      // deux faces de la paroi (cordons de part et d'autre)
      for (let k = 0; k <= n; k++) { const u = k / n, x = w.a[0] + (w.b[0] - w.a[0]) * u, y = w.a[1] + (w.b[1] - w.a[1]) * u, ds = L / n * (k === 0 || k === n ? 0.5 : 1);
        const rot = w.kr != null && o.coque !== false;                                         // paroi de tube rond : une ligne de liaison + rigidité de rotation finie
        for (const sg of (o.faces === 1 || rot ? [0] : [-1, 1])) PT.push({ x: x + sg * ox, y: y + sg * oy, xm: x, ym: y, ds, t: w.t, iw, k, sg, N: interp(x + sg * ox, y + sg * oy), kr: rot ? w.kr * (o.kCoque == null ? 1 : o.kCoque) * ds : 0, nx: -2 * ox / w.t, ny: -2 * oy / w.t }); } });
    // raidisseurs : nœuds de poutre (w, θ) le long du pied, éléments de Timoshenko de hauteur variable
    const RB = RD.map((r, ir) => { const L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), n = Math.max(2, Math.ceil(L / (0.6 * h))), ux = (r.b[0] - r.a[0]) / L, uy = (r.b[1] - r.a[1]) / L, N = [], E = [];
      const k1 = r.kr != null || r.rac || o.racine != null ? Math.min(n - 1, Math.max(1, Math.ceil((o.racine == null ? 1 : o.racine) * h / (L / n) - 1e-9))) : 1;      // premier nœud lié à la platine
      for (let k = 0; k <= n; k++) { const s = L * k / n, x = r.a[0] + ux * s, y = r.a[1] + uy * s; N.push({ s, x, y, ds: L / n * (k < k1 ? 0 : k === k1 ? k1 + 0.5 : k === n ? 0.5 : 1), w: nddl, th: nddl + 1, P: k >= k1 ? interp(x, y) : [] }); nddl += 2; }   // nœud 0 (contre le profilé) : non lié à la platine, déjà tenue par la paroi à cet endroit
      /* section en T : âme = raidisseur (t × h), semelle = bande de platine de largeur b_eff = t + 2·c_eff·t_p (c_eff = o.semelle, 0 : raidisseur seul) ;
         c_eff = 6 par défaut : résultats peu sensibles entre 3 et 20 ; zs : distance du centre de gravité au bord libre du raidisseur */
      const ce = o.semelle == null ? 6 : o.semelle, Af = ce > 0 ? (r.t + 2 * ce * t) * t : 0;
      for (let k = 0; k < n; k++) { const Le = L / n, hm = Math.max(2, hauteurRaid(r, (k + 0.5) * Le, L)), Aw = r.t * hm, yg = Af ? (Aw * hm / 2 - Af * t / 2) / (Aw + Af) : hm / 2,
          I = r.t * hm * hm * hm / 12 + Aw * (hm / 2 - yg) ** 2 + (Af ? Af * t * t / 12 + Af * (yg + t / 2) ** 2 : 0);
        E.push({ k, Le, hm, I, zs: hm - yg, Sf: Af ? Af * (yg + t / 2) : 0, EI: ES * I, GA: 5 / 6 * ES / (2 * (1 + NU)) * r.t * hm, s: 1, r: 0 }); }
      return { r, ir, L, ux, uy, N, E }; });
    // cheville : ressort lié au déplacement moyen sous la rondelle (8 points au rayon 2/3·d_w/2) : pas de charge ponctuelle (résultat indépendant du maillage)
    const sousRondelle = (a, k) => { const dw = Array.isArray(o.dw) ? o.dw[k] : o.dw; if (!(dw > 0)) return interp(a.x, a.y); const m = new Map(), r = dw / 3;
      for (let q = 0; q < 8; q++) for (const [n, c] of interp(a.x + r * Math.cos(q * Math.PI / 4), a.y + r * Math.sin(q * Math.PI / 4))) m.set(n, (m.get(n) || 0) + c / 8); return [...m.entries()]; };
    const AN = A.map((a, k) => ({ N: sousRondelle(a, k), actif: true })), ka = A.map((_, k) => (Array.isArray(o.ka) ? o.ka[k] : o.ka));
    // profil de la ligne de ciel
    const haut = new Int32Array(nddl); for (let j = 0; j < nddl; j++) haut[j] = j;
    const lie = (dl) => { let m = Infinity; for (const d of dl) if (d < m) m = d; for (const d of dl) if (m < haut[d]) haut[d] = m; };
    EL.forEach((e) => lie(e.dl)); AN.forEach((a) => lie(a.N.map((q) => 3 * q[0]))); PT.forEach((p) => lie(p.N.flatMap((q) => (p.kr ? [3 * q[0], 3 * q[0] + 1, 3 * q[0] + 2] : [3 * q[0]])).concat([W0, T1, T2])));
    RB.forEach((R) => { R.N.forEach((q) => { if (q.P.length) lie(q.P.map((z) => 3 * z[0]).concat([q.w])); }); R.E.forEach((e) => lie([R.N[e.k].w, R.N[e.k].th, R.N[e.k + 1].w, R.N[e.k + 1].th])); lie([W0, T1, T2, R.N[0].w, R.N[0].th]); });
    const D = ES * t * t * t / (12 * (1 - NU * NU)), Gs = 5 / 6 * ES / (2 * (1 + NU)) * t, my = fy * t * t / 6;
    const kp = 1e4 * Math.max(Gs, ...ka), cont = new Uint8Array(nn).fill(1);
    const f = new Float64Array(nddl); f[W0] = o.comb.N || 0; f[T1] = o.comb.Mx || 0; f[T2] = o.comb.My || 0;
    let u = null, it = 0, conv = false; const plast = o.plastique !== false, ITMAX = o.itmax || 80;
    for (; it < ITMAX; it++) {
      const S = ciel(nddl, haut), add = (i, j, v) => { if (i <= j) S.v[idx(S, i, j)] += v; };
      for (const e of EL) { const Kb = e.K.Kb, Ks = e.K.Ks, dl = e.dl, sb = D * e.s; for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (dl[r] <= dl[c]) S.v[idx(S, dl[r], dl[c])] += sb * Kb[r * 12 + c] + Gs * Ks[r * 12 + c]; }
      for (let n = 0; n < nn; n++) if (cont[n]) add(3 * n, 3 * n, o.kc * aire[n]);
      AN.forEach((a, k) => { if (!a.actif) return; for (const [n1, c1] of a.N) for (const [n2, c2] of a.N) add(3 * n1, 3 * n2, ka[k] * c1 * c2); });
      for (const p of PT) { const g = p.N.map(([n, c]) => [3 * n, c]).concat([[W0, -1], [T1, -p.y], [T2, p.x]]); for (const [i1, c1] of g) for (const [i2, c2] of g) add(i1, i2, kp * c1 * c2);
        /* rotation autour de la paroi : pente de la platine dans la direction n = −(βx·nx + βy·ny) ; corps rigide : θ1·ny − θ2·nx */
        if (p.kr) { const gr = p.N.flatMap(([n, c]) => [[3 * n + 1, c * p.nx], [3 * n + 2, c * p.ny]]).concat([[T1, p.ny], [T2, -p.nx]]); for (const [i1, c1] of gr) for (const [i2, c2] of gr) add(i1, i2, p.kr * c1 * c2); } }
      for (const R of RB) {
        for (const q of R.N) { if (!q.P.length) continue; const g = q.P.map(([n, c]) => [3 * n, c]).concat([[q.w, -1]]); for (const [i1, c1] of g) for (const [i2, c2] of g) add(i1, i2, kp * c1 * c2); }
        for (const e of R.E) { const a = R.N[e.k], b = R.N[e.k + 1], dl = [a.w, a.th, b.w, b.th], Bs = [-1 / e.Le, -0.5, 1 / e.Le, -0.5], Bb = [0, -1, 0, 1];
          for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (dl[r] <= dl[c]) S.v[idx(S, dl[r], dl[c])] += e.s * (e.GA * e.Le * Bs[r] * Bs[c] + e.EI / e.Le * Bb[r] * Bb[c]); }
        // pied côté profilé : w = w0 + θ1·y − θ2·x ; rotation (si adossé) θ = dw/ds = θ1·u_y − θ2·u_x
        { const q = R.N[0], g = [[q.w, 1], [W0, -1], [T1, -q.y], [T2, q.x]]; for (const [i1, c1] of g) for (const [i2, c2] of g) add(i1, i2, kp * c1 * c2);
          const kr = R.r.kr != null ? Math.max(R.r.kr, 1e-3 * R.E[0].EI / R.E[0].Le) : R.r.enc ? kp * 1e4 : 1e-3 * R.E[0].EI / R.E[0].Le, gr = [[q.th, 1], [T1, -R.uy], [T2, R.ux]]; for (const [i1, c1] of gr) for (const [i2, c2] of gr) add(i1, i2, kr * c1 * c2); }
      }
      // stabilisation minimale des rotations de corps rigide si rien n'est actif (évite un pivot nul)
      factoriser(S); u = resoudre(S, f);
      let chg = 0;
      for (let n = 0; n < nn; n++) { const c = u[3 * n] < 0 ? 1 : 0; if (c !== cont[n]) { cont[n] = c; chg++; } }
      AN.forEach((a) => { let w = 0; for (const [n, c] of a.N) w += c * u[3 * n]; a.w = w; const ac = w > 0; if (ac !== a.actif) { a.actif = ac; chg++; } });
      let ds = 0;
      for (const e of EL) { const k = [0, 0, 0]; for (let m = 0; m < 3; m++) { let v = 0; for (let r = 0; r < 12; r++) v += e.K.Bc[m][r] * u[e.dl[r]]; k[m] = v; }
        const mx = D * (k[0] + NU * k[1]), myy = D * (k[1] + NU * k[0]), mxy = D * (1 - NU) / 2 * k[2], meq = Math.sqrt(mx * mx - mx * myy + myy * myy + 3 * mxy * mxy), r = meq / my;
        e.r = r; if (plast) { const sn = r > 1 ? (1.5 - 0.5 / (r * r)) / r : 1, s2 = 0.5 * (e.s + sn); if (Math.abs(s2 - e.s) > ds) ds = Math.abs(s2 - e.s); e.s = s2; } }
      for (const R of RB) { const fyR = R.r.fy || fy; for (const e of R.E) { const a = R.N[e.k], b = R.N[e.k + 1], V = e.GA * ((u[b.w] - u[a.w]) / e.Le - (u[a.th] + u[b.th]) / 2), M = e.EI * (u[b.th] - u[a.th]) / e.Le;
          e.V = V; e.M = M; e.r = Math.sqrt((M * e.zs / e.I) ** 2 + 3 * (V / (R.r.t * e.hm)) ** 2) / fyR;      // rapport élastique (rigidité initiale) : > 1 = plastifié ; σ au bord libre = M·z_s/I
          if (plast) { const sn = e.r > 1 ? 1 / e.r : 1, s2 = 0.5 * (e.s + sn); if (Math.abs(s2 - e.s) > ds) ds = Math.abs(s2 - e.s); e.s = s2; } } }
      if (!chg && ds < 2e-3) { conv = true; it++; break; }
    }
    // ---- dépouillement
    const T = AN.map((a, k) => (a.actif ? ka[k] * a.w : 0));
    let C = 0, Cx = 0, Cy = 0, pmax = 0, Ac = 0; const pres = new Float64Array(nn);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const n = nd(i, j); if (cont[n] && u[3 * n] < 0) { const p = -o.kc * u[3 * n], F = p * aire[n]; pres[n] = p; C += F; Ac += aire[n]; Cx += F * X[i]; Cy += F * Y[j]; } }
    // pression lissée par élément (moyenne des 4 nœuds)
    const elems = EL.map((e) => { const p = (pres[e.dl[0] / 3] + pres[e.dl[3] / 3] + pres[e.dl[6] / 3] + pres[e.dl[9] / 3]) / 4; if (p > pmax) pmax = p;
      const kk = [0, 0, 0]; for (let m = 0; m < 3; m++) { let v = 0; for (let q = 0; q < 12; q++) v += e.K.Bc[m][q] * u[e.dl[q]]; kk[m] = v; }
      const sD = e.s * D;                                                          // moments réels (N·mm/mm) : mxx fléchit selon x
      return { x: X[e.i], y: Y[e.j], a: e.a, b: e.b, r: e.r, sig: Math.min(e.r, 1) * fy, epl: Math.max(0, e.r - 1) * fy / ES, p, w: (u[e.dl[0]] + u[e.dl[3]] + u[e.dl[6]] + u[e.dl[9]]) / 4,
        mxx: sD * (kk[0] + NU * kk[1]), myy: sD * (kk[1] + NU * kk[0]), mxy: sD * (1 - NU) / 2 * kk[2] }; });
    let rmax = 0; elems.forEach((e) => { if (e.r > rmax) rmax = e.r; });
    // champs aux nœuds de la grille (indice i·ny + j, indépendant de la numérotation) : w, pression, rapport r moyen des mailles voisines
    const Wn = new Float64Array(nx * ny), Pn = new Float64Array(nx * ny), Rn = new Float64Array(nx * ny), cnt = new Float64Array(nx * ny);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const n = nd(i, j); Wn[i * ny + j] = u[3 * n]; Pn[i * ny + j] = pres[n]; }
    EL.forEach((e) => { [[e.i, e.j], [e.i + 1, e.j], [e.i + 1, e.j + 1], [e.i, e.j + 1]].forEach(([i, j]) => { Rn[i * ny + j] += e.r; cnt[i * ny + j]++; }); });
    for (let k = 0; k < Rn.length; k++) Rn[k] /= cnt[k] || 1;
    // efforts linéiques en pied de paroi (N/mm, > 0 : la paroi tire la platine vers le haut)
    let qmax = 0, sprof = 0; const st = {};
    PT.forEach((p) => { let g = -u[W0] - p.y * u[T1] + p.x * u[T2]; for (const [n, c] of p.N) g += c * u[3 * n]; const k = p.iw + "_" + p.k, e = (st[k] = st[k] || { x: p.xm, y: p.ym, q: 0, t: p.t, iw: p.iw, k: p.k, ds: p.ds, qf: [0, 0] }), qq = -kp * g / p.ds; e.q += qq; if (p.sg) e.qf[p.sg < 0 ? 0 : 1] += qq; else { e.qf[0] += qq / 2; e.qf[1] += qq / 2; } });      // qf : effort de chaque face de la paroi (cordon de chaque côté)
    const nW = o.parois.length;
    RB.forEach((R) => R.N.forEach((q, k) => { if (!q.P.length) return; let g = -u[q.w]; for (const [n, c] of q.P) g += c * u[3 * n]; st["r" + R.ir + "_" + k] = { x: q.x, y: q.y, q: -kp * g / q.ds, t: R.r.t, iw: nW + R.ir, k, ds: q.ds, raid: R.ir, s: q.s }; }));
    const lin = Object.values(st);
    // lissage sur un rayon max(10 mm ; 2,5·t_paroi) (les extrémités et les angles de parois sont des points singuliers du modèle)
    lin.forEach((s) => { const Rl = o.lissage || Math.max(10, 2.5 * s.t), v = lin.filter((z) => Math.hypot(z.x - s.x, z.y - s.y) <= Rl + 1e-6); let F = 0, L = 0; v.forEach((z) => { F += z.q * z.ds; L += z.ds; }); s.qm = F / L;   // lissage commun aux parois et aux raidisseurs : à leur jonction, les efforts locaux opposés (points de liaison distants de t/2) se compensent
      if (s.raid == null) { if (Math.abs(s.qm) > qmax) qmax = Math.abs(s.qm); if (Math.abs(s.qm) / s.t > sprof) sprof = Math.abs(s.qm) / s.t; } });
    // raidisseurs : effort tranchant V et moment M par élément, contrainte de von Mises (σ = 6M/(t·h²), τ = V/(t·h)), efforts au pied
    const raid = RB.map((R) => { const fyR = R.r.fy || fy; let r = 0, sk = 0; R.E.forEach((e) => { if (e.r > r) { r = e.r; sk = (e.k + 0.5) * e.Le; } });
      const pts = lin.filter((z) => z.raid === R.ir), F = pts.reduce((s, z) => s + z.q * z.ds, 0), e0 = R.E[0];
      /* cisaillement longitudinal raidisseur – platine (N/mm) : flux v = V·S_f/I de la section en T (S_f : moment statique de la semelle = bande de platine),
         moyenne des éléments voisins ; pointe locale hors du pied (zone singulière sur 2,5·t, au moins 10 mm) : qv = max √(q² + 1,5·v²) (équivalent à q seul dans σ_w) */
      const vE = R.E.map((e) => (e.I ? Math.abs(e.s * e.V * e.Sf / e.I) : 0)), s0 = Math.min(Math.max(10, 2.5 * R.r.t), 0.5 * R.L); let qv = -1, vmax = 0, ql = 0, vl = 0;
      pts.forEach((z) => { z.v = z.k >= R.E.length ? vE[z.k - 1] : (vE[z.k - 1] + vE[z.k]) / 2; if (z.s < s0 - 1e-6) return; const e = Math.sqrt(z.qm * z.qm + 1.5 * z.v * z.v); if (e > qv) { qv = e; ql = Math.abs(z.qm); vl = z.v; } if (z.v > vmax) vmax = z.v; });
      return { ir: R.ir, L: R.L, enc: !!R.r.enc, kr: R.r.kr, rac: !!(R.r.rac || R.r.kr != null), H: R.r.H, vmax, ql, vl, r, sig: Math.min(r, 1) * fyR, epl: Math.max(0, r - 1) * fyR / ES, fy: fyR, s: sk, V0: e0.s * e0.V, M0: e0.s * e0.M, F, qmax: Math.max(...pts.map((z) => Math.abs(z.qm))),
        a: R.r.a, b: R.r.b, t: R.r.t, el: R.E.map((e) => ({ s0: e.k * e.Le, s1: (e.k + 1) * e.Le, h: e.hm, V: e.V, M: e.M, r: e.r, s: e.s, v: e.I ? e.s * e.V * e.Sf / e.I : 0 })) }; });   // el : V, M élastiques (rigidité initiale), r = σ_vm/f_y
    let wmax = 0, wmin = 0; for (let n = 0; n < nn; n++) { if (u[3 * n] > wmax) wmax = u[3 * n]; if (u[3 * n] < wmin) wmin = u[3 * n]; }
    return { T, C, Ac, pmoy: Ac ? C / Ac : 0, Cx: C ? Cx / C : 0, Cy: C ? Cy / C : 0, pmax, sigMax: Math.min(rmax, 1) * fy, eplMax: Math.max(0, rmax - 1) * fy / ES, rmax, qmax, sprof, wmax, wmin,
      elems, lin, raid, X, Y, Wn, Pn, Rn, it, conv, nddl, h, fy, rot: [u[T1], u[T2]], w0: u[W0] };
  }
  /* ---------- efforts des cordons de soudure sur la platine (N/mm), d'après les efforts linéiques du calcul ----------
     Redistribution plastique le long de chaque cordon : q = |F|/L + 4·|M|/L² (F : résultante normale à la platine, M : son moment
     autour du milieu du cordon). Les efforts locaux opposés de part et d'autre d'une paroi ou entre parois voisines se compensent
     dans les résultantes ; pour un tube (tube = true), ils se compensent seulement à l'échelle du tube entier : ses parois forment
     un seul groupe de cordons, q = |F|/ΣL + |Mx|·|y|max/Ix + |My|·|x|max/Iy (répartition linéaire, inerties de ligne).
     Jonction de deux parois (âme sur aile) : les points de liaison du bout de la paroi qui s'arrête sont comptés avec la paroi
     continue (parois : lignes moyennes [{a, b, t}] du modèle, facultatif), sinon l'effort de la jonction est partagé au hasard.
     opt (3.08) : { fy, N, Mx, My, raidies: [indices des parois portant un raidisseur] } pour les parois du profilé NON raidies
     (une paroi raidie est soulagée par ses raidisseurs : efforts du modèle seuls ; calage sur deux notes détaillées) :
       - dm : moment de la platine transmis à la paroi par ses deux cordons (N·mm/mm) = saut du moment de flexion normal à la paroi
         de part et d'autre (moyenne le long du cordon), plafonné au moment plastique de la paroi f_y·t²/4 ;
       - qbt : effort linéique maximal de la paroi sous les efforts du profilé seul (théorie des poutres, section à parois minces :
         σ = N/A + flexion déviée, q = |σ|·t), N, Mx, My étant les efforts au centre du profilé ; les raidisseurs ne sont pas comptés.
     Raidisseurs (3.09, calage sur trois notes détaillées) : en plus de q (redistribution plastique sur tout le cordon), v = cisaillement
       longitudinal maximal raidisseur – platine (flux V·S_f/I de la section en T) et (ql, vl) = pointe locale (effort lissé, hors du pied) ;
       contrainte du cordon = max[σ_w(q, v) ; σ_w(ql, vl)] : la redistribution le long du cordon n'efface pas la pointe en bout de raidisseur.
     res : résultat de calculer() ; nW : nombre de parois du profilé ; retour [{ type: 'paroi' | 'tube' | 'raid', i, L, F, M, q, dm, qbt, t, v, ql, vl, kw }] (kw : coefficient de pointe des raidisseurs sur tube) ;
     chaque point de res.lin reçoit qd, effort linéique local à afficher (valeur lissée ; tube : répartition linéaire du groupe). */
  function cordons(res, nW, tube, parois, opt) {
    /* moment de flexion de la platine au point (x, y) dans la direction n (N·mm/mm) */
    const mPl = (x, y, n) => { const e = res.elems.find((q) => x >= q.x - 1e-9 && x <= q.x + q.a + 1e-9 && y >= q.y - 1e-9 && y <= q.y + q.b + 1e-9); return e ? e.mxx * n[0] * n[0] + e.myy * n[1] * n[1] + 2 * e.mxy * n[0] * n[1] : 0; };
    const couple = (P, w) => { if (!opt || !w || !res.elems || res.elems[0].mxx == null) return 0; const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l], d = w.t / 2 + 0.75 * res.h; let s = 0, L = 0;
      P.forEach((z) => { s += Math.abs(mPl(z.x + n[0] * d, z.y + n[1] * d, n) - mPl(z.x - n[0] * d, z.y - n[1] * d, n)) * z.ds; L += z.ds; }); return Math.min(L ? s / L : 0, (opt.fy || 235) * w.t * w.t / 4); };
    /* profilé seul : caractéristiques de la section à parois minces (lignes moyennes), contrainte au point (x, y) */
    let sigBT = null;
    if (opt && parois && parois.length && (opt.N || opt.Mx || opt.My)) { let A = 0, sx = 0, sy = 0; parois.forEach((w) => { const l = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) * w.t; A += l; sx += l * (w.a[0] + w.b[0]) / 2; sy += l * (w.a[1] + w.b[1]) / 2; });
      const gx = sx / A, gy = sy / A; let Ixx = 0, Iyy = 0, Ixy = 0; parois.forEach((w) => { const l = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) * w.t, x1 = w.a[0] - gx, y1 = w.a[1] - gy, x2 = w.b[0] - gx, y2 = w.b[1] - gy;
        Ixx += l * (y1 * y1 + y1 * y2 + y2 * y2) / 3; Iyy += l * (x1 * x1 + x1 * x2 + x2 * x2) / 3; Ixy += l * (2 * x1 * y1 + x1 * y2 + x2 * y1 + 2 * x2 * y2) / 6; });
      const N = opt.N || 0, Mx = opt.Mx || 0, My2 = -(opt.My || 0), det = Ixx * Iyy - Ixy * Ixy || 1;                      // Mx tend les y > 0 ; My tend les x < 0
      sigBT = (x, y) => N / A + ((Mx * Iyy - My2 * Ixy) * (y - gy) + (My2 * Ixx - Mx * Ixy) * (x - gx)) / det; }
    const bt = (P) => (sigBT ? Math.max(...P.map((z) => Math.abs(sigBT(z.x, z.y)) * z.t)) : 0), raidie = (i) => !!(opt && opt.raidies && opt.raidies.includes(i));
    const out = [], seg = (P) => { let L = 0, F = 0; P.forEach((z) => { L += z.ds; F += z.q * z.ds; }); const x0 = P[0].x, y0 = P[0].y, sc = P.reduce((s, z) => s + Math.hypot(z.x - x0, z.y - y0) * z.ds, 0) / L; let M = 0; P.forEach((z) => { M += z.q * z.ds * (Math.hypot(z.x - x0, z.y - y0) - sc); });
      return { L, F, M, q: Math.abs(F) / L + 4 * Math.abs(M) / (L * L) }; };
    const W = res.lin.filter((z) => z.raid == null);
    if (tube && W.length) { let L = 0, F = 0, sx = 0, sy = 0; W.forEach((z) => { L += z.ds; F += z.q * z.ds; sx += z.x * z.ds; sy += z.y * z.ds; }); const cx = sx / L, cy = sy / L; let Mx = 0, My = 0, Ix = 0, Iy = 0, xm = 0, ym = 0;
      W.forEach((z) => { const dx = z.x - cx, dy = z.y - cy; Mx += z.q * z.ds * dy; My += z.q * z.ds * dx; Ix += dy * dy * z.ds; Iy += dx * dx * z.ds; xm = Math.max(xm, Math.abs(dx)); ym = Math.max(ym, Math.abs(dy)); });
      W.forEach((z) => { z.qd = F / L + Mx * (z.y - cy) / (Ix || 1) + My * (z.x - cx) / (Iy || 1); });
      out.push({ type: "tube", i: 0, L, F, M: Math.hypot(Mx, My), q: Math.abs(F) / L + Math.abs(Mx) * ym / (Ix || 1) + Math.abs(My) * xm / (Iy || 1), dm: 0, qbt: res.raid && res.raid.length ? 0 : bt(W), t: W[0].t }); }
    else { const de = W.map((z) => { if (!parois) return z.iw; for (let j = 0; j < parois.length; j++) { if (j === z.iw) continue; const w = parois[j], dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], l2 = dx * dx + dy * dy || 1, k = ((z.x - w.a[0]) * dx + (z.y - w.a[1]) * dy) / l2;
          if (k > 0.05 && k < 0.95 && Math.hypot(z.x - w.a[0] - k * dx, z.y - w.a[1] - k * dy) <= w.t / 2 + z.t / 2 + 0.5) return j; } return z.iw; });      // point situé dans l'épaisseur d'une autre paroi, hors de ses bouts
      for (let i = 0; i < nW; i++) { const P = W.filter((z, k) => de[k] === i), Pi = W.filter((z) => z.iw === i); if (P.length) out.push({ type: "paroi", i, ...seg(P), raidie: raidie(i), dm: raidie(i) ? 0 : couple(Pi, parois && parois[i]), qbt: raidie(i) ? 0 : bt(Pi), t: Pi.length ? Pi[0].t : 0 }); } }
    (res.raid || []).forEach((r) => { const P = res.lin.filter((z) => z.raid === r.ir); if (P.length) out.push({ type: "raid", i: r.ir, ...seg(P), dm: 0, qbt: 0, t: r.t, v: r.vmax || 0, ql: r.ql || 0, vl: r.vl || 0, kw: r.rac ? K_POINTE_TUBE : 1 }); });
    res.lin.forEach((z) => { if (z.qd == null || !(tube && z.raid == null)) z.qd = tube && z.raid == null ? z.qd : z.qm; });      // qd : effort linéique local à afficher (N/mm)
    return out;
  }
  /* ---------- contrainte équivalente dans la gorge d'un cordon d'angle (N/mm²), méthode directionnelle NF EN 1993-1-8 §4.5.3.2 ----------
     q : effort par mm normal à la platine (transversal au cordon), v : effort par mm le long du cordon, n : nombre de cordons, a : gorge (mm).
     Cordon à 45° : σ⊥ = τ⊥ = q/(n·a·√2), τ∥ = v/(n·a) ; σ_w = √(σ⊥² + 3·(τ⊥² + τ∥²)) = √(2·(q/(n·a))² + 3·(v/(n·a))²) ≤ f_u/(β_w·γ_M2) */
  const sigmaSoudure = (q, v, n, a) => Math.sqrt(2 * (q / (n * a)) ** 2 + 3 * ((v || 0) / (n * a)) ** 2);
  /* effort normal par cordon d'une paroi à deux cordons (N/mm) : q/2 + dm/(t + a) (dm : moment transmis par les deux cordons, bras t + a) */
  const effortCordon = (q, dm, t, a, n) => (n === 2 ? q / 2 + (dm || 0) / (t + a) : q);
  /* ---------- contrôle de l'élément : bande console (longueur L, largeur b, épaisseur t, n éléments), charge P en bout → flèche ---------- */
  function consoleTest(L, b, t, n, P) {
    const nddl = 6 * (n + 1), haut = new Int32Array(nddl), K = elementaire(L / n, b), D = ES * t * t * t / (12 * (1 - NU * NU)), Gs = 5 / 6 * ES / (2 * (1 + NU)) * t;
    const dls = (e) => { const N4 = [2 * e, 2 * e + 2, 2 * e + 3, 2 * e + 1], dl = []; N4.forEach((q) => dl.push(3 * q, 3 * q + 1, 3 * q + 2)); return dl; };
    for (let j = 0; j < nddl; j++) haut[j] = j; for (let e = 0; e < n; e++) { const dl = dls(e), m = Math.min(...dl); dl.forEach((d) => { if (m < haut[d]) haut[d] = m; }); }
    const S = ciel(nddl, haut);
    for (let e = 0; e < n; e++) { const dl = dls(e); for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (dl[r] <= dl[c]) S.v[idx(S, dl[r], dl[c])] += D * K.Kb[r * 12 + c] + Gs * K.Ks[r * 12 + c]; }
    for (const d of [0, 1, 3, 4]) S.v[idx(S, d, d)] += 1e15;                 // encastrement : w et βx des deux nœuds d'origine (βy libre : flexion cylindrique non imposée)
    const f = new Float64Array(nddl); f[3 * (2 * n)] = P / 2; f[3 * (2 * n + 1)] = P / 2; factoriser(S); const u = resoudre(S, f);
    return (u[3 * (2 * n)] + u[3 * (2 * n + 1)]) / 2;
  }
  return { calculer, parois, paroisPlacees, facesProfil, raidisseur, hauteurRaid, cordons, sigmaSoudure, effortCordon, raideurCheville, elementaire, lignes, consoleTest, NU, ES, K_RAID_TUBE, K_POINTE_TUBE };
})();
if (typeof module !== "undefined") module.exports = CBFEM;
