/* =====================================================================
   PORTIQUE 2D — moteur de prédimensionnement APS/APD (A1 toiture isolée ; futur bâtiment fermé)
   Portique à une travée, pieds articulés, nœuds de tête rigides, jarrets optionnels, mono ou bi-pente.
   Unités : m, kN, kN/m, kN/m² ; sections en mm / cm (base PROFILS) ; E en kN/m² dans Barres3D.
   Références : NF EN 1990 + AN, NF EN 1991-1-3 + AN, NF EN 1991-1-4 + AN (§7.3 + CNC2M),
                NF EN 1993-1-1 + AN (§5.2, §5.3, §6.2, §6.3, Annexe B, §7.2)
   Dépend de : Barres3D, ACIER, NUANCES, classeSection, ALPHA, chi, Mcr, genererCombinaisons, PSI_NEIGE, PSI_VENT, CV
   ===================================================================== */
const PORTIQUE = (() => {
  const g0 = 9.81, Ek = 210e6, Gk = 81e6;

  /* ---------- section en I soudée (PRS, jarret) : mm → propriétés au format PROFILS (cm) ---------- */
  function sectionI(h, b, tw, tf, nom) {
    const hw = h - 2 * tf, A = 2 * b * tf + hw * tw;
    const Iy = (b * h ** 3 - (b - tw) * hw ** 3) / 12, Iz = (2 * tf * b ** 3 + hw * tw ** 3) / 12;
    const Wply = b * tf * (h - tf) + tw * hw * hw / 4, Wplz = tf * b * b / 2 + hw * tw * tw / 4;
    const It = (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3, Iw = tf * b ** 3 * (h - tf) ** 2 / 24;
    return { f: "PRS", n: nom || `PRS ${h}×${b}×${tw}×${tf}`, h, b, tw, tf, r: 0, soude: true,
      A: A / 100, Iy: Iy / 1e4, Iz: Iz / 1e4, Wely: 2 * Iy / h / 1e3, Wply: Wply / 1e3, Welz: 2 * Iz / b / 1e3, Wplz: Wplz / 1e3,
      iy: Math.sqrt(Iy / A) / 10, iz: Math.sqrt(Iz / A) / 10, It: It / 1e4, Iw: Iw / 1e6, Avz: hw * tw / 100, m: A * 7850 / 1e6 };
  }
  /* courbes de flambement / déversement : laminés (courbes() commun) ; soudés Tab. 6.2 et Tab. 6.4 (cas général) */
  function courbesS(p) {
    if (!p.soude) return courbes(p);
    const cy = p.tf <= 40 ? "b" : "c", cz = p.tf <= 40 ? "c" : "d", clt = p.h / p.b <= 2 ? "c" : "d";
    return { y: ALPHA[cy], z: ALPHA[cz], cy, cz, lt: ALPHA[clt], clt };
  }
  const bar = (p) => ({ E: Ek, G: Gk, A: p.A * 1e-4, Iy: p.Iy * 1e-8, Iz: p.Iz * 1e-8, J: p.It * 1e-8 });

  /* ---------- géométrie ---------- */
  function geometrie(D) {
    const L = D.L, H = D.H, pt = D.p / 100, bi = D.type === "bi";
    const xr = bi ? L / 2 : L, Hd = H + (bi ? pt * L / 2 : pt * L);         // faîtage (bi) ou tête du poteau haut (mono)
    const zT = (x) => bi ? H + pt * Math.min(x, L - x) : H + pt * x;       // altitude de la traverse (axe) en x
    const nC = 8, nR = bi ? 14 : 24, nJ = 4;
    const Lj = D.jarret ? Math.min(D.Lj || 0.1 * L, bi ? L / 4 : L / 3) : 0;
    const N = [], B = [];
    const nd = (x, z) => { N.push({ x, y: 0, z }); return N.length - 1; };
    // poteaux (pied → tête)
    const pied = [nd(0, 0)], piedD = [];
    const colG = [pied[0]]; for (let k = 1; k <= nC; k++) colG.push(nd(0, H * k / nC));
    const hD = bi ? H : Hd; const colD = [nd(L, 0)]; for (let k = 1; k <= nC; k++) colD.push(nd(L, hD * k / nC));
    // abscisses de la traverse (jarrets raffinés)
    const xs = new Set([0, L]); if (bi) xs.add(L / 2);
    const ajout = (a, b, n) => { for (let k = 0; k <= n; k++) xs.add(+(a + (b - a) * k / n).toFixed(6)); };
    if (Lj) { ajout(0, Lj, nJ); ajout(L - Lj, L, nJ); }
    if (bi) { ajout(Lj, L / 2, nR / 2); ajout(L / 2, L - Lj, nR / 2); } else ajout(Lj, L - Lj, nR);
    const X = [...xs].sort((a, b) => a - b);
    const tr = X.map((x, k) => k === 0 ? colG[nC] : k === X.length - 1 ? colD[nC] : nd(x, zT(x)));
    const membres = [];
    const addB = (i, j, mb, sec, extra = {}) => { B.push({ i, j, mb, sec, ...extra }); };
    for (let k = 0; k < nC; k++) addB(colG[k], colG[k + 1], "PG", "col");
    for (let k = 0; k < nC; k++) addB(colD[k], colD[k + 1], "PD", "col");
    for (let k = 0; k < X.length - 1; k++) {
      const xm = (X[k] + X[k + 1]) / 2, dj = Lj ? Math.min(xm, L - xm) : Infinity;
      const enJ = Lj && dj < Lj, hj = enJ ? (D.hj || 0) * (1 - dj / Lj) : 0;
      addB(tr[k], tr[k + 1], bi ? (xm < L / 2 ? "TG" : "TD") : "T", enJ ? "jar" : "tra", { hj, xm });
    }
    return { N, B, X, tr, colG, colD, pieds: [colG[0], colD[0]], tetes: [colG[nC], colD[nC]], H, Hd, hD, L, pt, bi, Lj, zT,
      alpha: Math.atan(pt), Lr: bi ? Math.hypot(L / 2, pt * L / 2) : Math.hypot(L, pt * L) };
  }

  /* ---------- cas de charge élémentaires (chaque cas : partie verticale V et horizontale Hz pour l'amplification) ---------- */
  function cas(D, Gm, S) {
    const C = {}, e = D.e, kc = D.kc || 1, L = Gm.L;
    const mk = (id, nom, type) => (C[id] = { id, nom, type, V: [], Hz: [] });
    const ajout = (c, b, q) => { if (q[2]) c.V.push({ b, q: [0, 0, q[2]] }); if (q[0]) c.Hz.push({ b, q: [q[0], 0, 0] }); };
    const traverses = Gm.B.map((b, k) => ({ b, k })).filter((o) => o.b.sec !== "col");
    const dir = (b) => { const a = Gm.N[b.i], c = Gm.N[b.j], l = Math.hypot(c.x - a.x, c.z - a.z); return [(c.x - a.x) / l, (c.z - a.z) / l, l]; };
    // G : poids propre (profilés + jarrets) + couverture + pannes + divers
    const G = mk("G", "G – poids propre, couverture, pannes, équipements", "G");
    Gm.B.forEach((b, k) => { ajout(G, k, [0, 0, -S[k].m * g0 / 1000]); });
    const gs = (D.gCouv || 0) + (D.gDiv || 0) + (D.gPannes || 0);
    traverses.forEach(({ k }) => ajout(G, k, [0, 0, -gs * e * kc]));
    // neige
    const s0 = D.neige && D.neige.sk ? 0.8 * D.neige.Ce * D.neige.Ct * D.neige.sk : 0, maj = D.neige ? D.neige.maj || 0 : 0;
    const neige = (id, nom, fg, fd) => { const c = mk(id, nom, "S"); traverses.forEach(({ b, k }) => { const [cx] = dir(b), f = !Gm.bi || b.xm < L / 2 ? fg : fd; ajout(c, k, [0, 0, -(f * s0 + maj) * e * kc * Math.abs(cx)]); }); };
    if (s0) { if (Gm.bi) { neige("S1", "S (i) – μ₁ sur les deux versants", 1, 1); neige("S2", "S (ii) – 0,5·μ₁ à gauche, μ₁ à droite", 0.5, 1); neige("S3", "S (iii) – μ₁ à gauche, 0,5·μ₁ à droite", 1, 0.5); }
      else neige("S1", "S – μ₁ uniforme", 1, 1); }
    const sAd = D.neige && D.neige.sAd ? 0.8 * D.neige.Ce * D.neige.Ct * D.neige.sAd : 0;
    if (sAd) { const c = mk("SA", "S<sub>Ad</sub> – neige exceptionnelle (accidentelle)", "A"); traverses.forEach(({ b, k }) => { const [cx] = dir(b); ajout(c, k, [0, 0, -sAd * e * kc * Math.abs(cx)]); }); }
    // charge d'entretien H (Tab. 6.10(NF)) : 0,8 kN/m² sur 10 m² (rectangle l ≤ 2·b) placé à mi-portée du versant gauche
    if (D.qH) { const c = mk("Q", "Q – entretien H : 0,8 kN/m² sur 10 m²", "Q"), lp = Math.sqrt(10 * 2), x0 = (Gm.bi ? L / 4 : L / 2) - lp / 2, qtot = D.qH * 10 * kc / lp;
      traverses.forEach(({ b, k }) => { if (b.xm >= x0 && b.xm <= x0 + lp) { const [cx] = dir(b); ajout(c, k, [0, 0, -qtot * Math.abs(cx)]); } }); }
    // vent (toiture isolée) : pression nette normale w = c·q_p·e (> 0 vers le bas) + traînée des poteaux
    const qp = D.vent ? D.vent.qp || 0 : 0;
    if (qp) {
      const W = (id, nom, cfun, sens) => { const c = mk(id, nom, "W");
        traverses.forEach(({ b, k }) => { const [tx, tz] = dir(b), cc = cfun(b.xm); if (!cc) return; const w = cc * qp * e * kc; ajout(c, k, [w * tz, 0, -w * tx]); });
        if (sens) Gm.B.forEach((b, k) => { if (b.sec === "col") ajout(c, k, [sens * qp * (D.cfCol || 2.0) * S[k].h / 1000, 0, 0]); }); };
      if (Gm.bi) {
        const T = CV.toitIsolee2(D.p >= 0 ? Math.atan(Gm.pt) * 180 / Math.PI : 0, D.vent.phi || 0), mx = T.max[0], mn = T.min[0], G_ = (x) => x < L / 2, D_ = (x) => x >= L / 2;
        W("W1", `W – deux versants c<sub>f</sub> max ${CV.fx(mx)} (vent →)`, () => mx, 1); W("W2", `W – deux versants c<sub>f</sub> max ${CV.fx(mx)} (vent ←)`, () => mx, -1);
        W("W3", `W – deux versants c<sub>f</sub> min ${CV.fx(mn)} (vent →)`, () => mn, 1); W("W4", `W – deux versants c<sub>f</sub> min ${CV.fx(mn)} (vent ←)`, () => mn, -1);
        W("W5", `W – versant gauche seul c<sub>f</sub> max (vent →)`, (x) => G_(x) ? mx : 0, 1); W("W6", `W – versant droit seul c<sub>f</sub> max (vent ←)`, (x) => D_(x) ? mx : 0, -1);
        W("W7", `W – versant gauche seul c<sub>f</sub> min (vent →)`, (x) => G_(x) ? mn : 0, 1); W("W8", `W – versant droit seul c<sub>f</sub> min (vent ←)`, (x) => D_(x) ? mn : 0, -1);
        S.ventInfo = { type: "bi", T };
      } else {
        const T = CV.toitIsolee1(Math.atan(Gm.pt) * 180 / Math.PI, D.vent.phi || 0);
        const prof = (c, depuisG) => (x) => { const u = depuisG ? x / L : 1 - x / L; return u <= 0.1 ? c[1] : c[2] + (c[3] - c[2]) * (u - 0.1) / 0.9; };   // CNC2M fig. 22
        W("W1", "W – c max, vent sur la rive basse (→)", prof(T.max, true), 1); W("W2", "W – c min, vent sur la rive basse (→)", prof(T.min, true), 1);
        W("W3", "W – c max, vent sur la rive haute (←)", prof(T.max, false), -1); W("W4", "W – c min, vent sur la rive haute (←)", prof(T.min, false), -1);
        W("W5", `W – vent sur la rive latérale, c<sub>f</sub> ${CV.fx(T.rive.max)} uniforme`, () => T.rive.max, 0); W("W6", `W – vent sur la rive latérale, c<sub>f</sub> ${CV.fx(T.rive.min)} uniforme`, () => T.rive.min, 0);
        S.ventInfo = { type: "mono", T };
      }
    }
    return C;
  }

  /* ---------- analyse ---------- */
  function analyser(D) {
    const Gm = geometrie(D), fy0 = NUANCES[D.nuance || "S355"][0];
    const colSec = (b) => { const V = D.colVar; if (!V) return D.col; const a = Gm.N[b.i], c = Gm.N[b.j], hc = a.x < Gm.L / 2 ? Gm.H : Gm.hD, t = ((a.z + c.z) / 2) / hc, hh = V.h0 + (V.h1 - V.h0) * t;
      return sectionI(Math.round(hh), V.b, V.tw, V.tf, `PRS variable h = ${Math.round(hh)} mm`); };
    const S = Gm.B.map((b) => b.sec === "col" ? colSec(b) : b.sec === "tra" ? D.tra : sectionI(D.tra.h + b.hj, D.tra.b, D.tra.tw, D.tra.tf, `jarret h = ${Math.round(D.tra.h + b.hj)} mm`));
    const barres = Gm.B.map((b, k) => ({ i: b.i, j: b.j, ...bar(S[k]), vz: b.sec === "col" ? [1, 0, 0] : [0, 0, 1] }));
    const app = {}; Gm.N.forEach((n, k) => { app[k] = [0, 1, 0, 1, 0, 1]; }); Gm.pieds.forEach((k) => { app[k] = [1, 1, 1, 1, 0, 1]; });
    const res = (ch, rep) => Barres3D.resoudre({ noeuds: Gm.N, barres, appuis: app, charges: ch || [], reparties: rep || [] });
    const C = cas(D, Gm, S), R = {};
    for (const c of Object.values(C)) { R[c.id] = { V: res([], c.V), H: c.Hz.length ? res([], c.Hz) : null }; }
    // raideur latérale : 1 kN réparti en tête des poteaux (0,5 + 0,5)
    const ru = res(Gm.tetes.map((n) => ({ n, F: [0.5, 0, 0, 0, 0, 0] })));
    const dU = (Gm.tetes.reduce((s, n) => s + ru.depl(n)[0], 0)) / 2, K = 1 / dU, hm = (Gm.H + Gm.hD) / 2;
    const imp = Gm.tetes.map((n) => res([{ n, F: [1, 0, 0, 0, 0, 0] }]));       // forces unitaires en tête (imperfection)
    return { D, Gm, S, C, R, K, hm, imp, fy0, ru };
  }

  /* efforts [N, Vz, My] d'une combinaison à l'élément k, abscisse s : Σ f·(V + amp·H) + amp·Σ φ·N_i·u_i */
  function efforts(A, comb, k, s) {
    const out = [0, 0, 0];
    const add = (r, f) => { if (!r || !f) return; const v = Barres3D.interne(r.elems[k], s); out[0] += f * v[0]; out[1] += f * v[2]; out[2] += f * v[4]; };
    for (const [c, f] of Object.entries(comb.f)) { const r = A.R[c]; if (!r) continue; add(r.V, f); add(r.H, f * (comb.amp || 1)); }
    (comb.imp || []).forEach((F, i) => add(A.imp[i], F * (comb.amp || 1)));
    return out;
  }
  function reactions(A, comb, nd) {
    const out = [0, 0];
    const add = (r, f) => { if (!r || !f) return; const v = r.reactions[nd]; out[0] += f * v[0]; out[1] += f * v[2]; };
    for (const [c, f] of Object.entries(comb.f)) { const r = A.R[c]; if (!r) continue; add(r.V, f); add(r.H, f * (comb.amp || 1)); }
    (comb.imp || []).forEach((F, i) => add(A.imp[i], F * (comb.amp || 1)));
    return out;
  }
  function deplacement(A, comb, nd) {
    const out = [0, 0];
    const add = (r, f) => { if (!r || !f) return; const v = r.depl(nd); out[0] += f * v[0]; out[1] += f * v[2]; };
    for (const [c, f] of Object.entries(comb.f)) { const r = A.R[c]; if (!r) continue; add(r.V, f); add(r.H, f); }
    return out;
  }

  /* ---------- combinaisons, α_cr, imperfections, amplification ---------- */
  function combinaisons(A) {
    const { D, C } = A, vars = [], S = Object.values(C).filter((c) => c.type === "S"), W = Object.values(C).filter((c) => c.type === "W");
    S.forEach((c) => vars.push({ id: c.id, psi: PSI_NEIGE(!!(D.neige && D.neige.alt1000)), grp: "S" }));
    W.forEach((c) => vars.push({ id: c.id, psi: PSI_VENT, grp: "W" }));
    if (C.Q) vars.push({ id: "Q", psi: [0, 0, 0], exclut: S.map((c) => c.id).concat(W.map((c) => c.id)) });
    const cb = genererCombinaisons(vars);
    const ELU = cb.ELU.map((c) => ({ ...c, situation: "Fondamentale (6.10)" }));
    if (C.SA) { ELU.push({ f: { G: 1, SA: 1 }, nom: "1·G + 1·S<sub>Ad</sub>", type: "ELU", situation: "Accidentelle (6.11b)" }); }
    // α_cr (§5.2.1(4)B) et imperfections (§5.3.2) par combinaison
    const phi0 = 1 / 200, ah = Math.min(1, Math.max(2 / 3, 2 / Math.sqrt(A.hm))), am = Math.sqrt(0.5 * (1 + 1 / 2)), phi = phi0 * ah * am;
    const out = [];
    for (const c of ELU) {
      const R0 = A.Gm.pieds.map((nd) => reactions(A, { f: c.f }, nd)), V = R0.reduce((s, r) => s + r[1], 0), Hh = Math.abs(R0.reduce((s, r) => s + r[0], 0));
      const acr = V > 1e-6 ? A.K * A.hm / V : Infinity;
      const amp = acr >= 10 ? 1 : acr >= 3 ? 1 / (1 - 1 / acr) : 1 / (1 - 1 / Math.max(acr, 1.01));
      const sansImp = Hh >= 0.15 * V || V <= 0;
      const base = { ...c, acr, amp, V, Hh, phi, horsDomaine: acr < 3, impNeg: sansImp };
      if (sansImp) out.push({ ...base, imp: [] });
      else for (const sg of [1, -1]) out.push({ ...base, nom: c.nom + (sg > 0 ? " + φ→" : " + φ←"), imp: R0.map((r) => sg * phi * r[1]) });
    }
    return { ELU: out, CAR: cb.CAR, phi, ah, am, vars };
  }

  /* ---------- vérifications EN 1993-1-1 ---------- */
  function verifier(A) {
    const { D, Gm, S } = A, nu = D.nuance || "S355", K = combinaisons(A), lignes = [], fyOf = (p) => fyDe(nu, p);
    const membres = { col: { nom: "Poteaux", ks: [] }, jar: { nom: "Jarrets", ks: [] }, tra: { nom: "Traverse", ks: [] } };
    Gm.B.forEach((b, k) => membres[b.sec].ks.push(k));
    const lam1 = (fy) => Math.PI * Math.sqrt(ACIER.E / fy);
    const segs = (k) => { const L = Barres3D.repere(Gm.N, { i: Gm.B[k].i, j: Gm.B[k].j }).L; return [0, L / 2, L]; };
    const res = { sec: {}, stab: {}, comb: K };
    // zones de semelle inférieure comprimée (M_y > 0) le long de la traverse : longueur et contact avec un nœud de tête
    const kR = Gm.B.map((b, k) => ({ b, k })).filter((o) => o.b.sec !== "col").sort((a, b) => a.b.xm - b.b.xm);
    function zonesLT(c) {
      const out = {}, pts = kR.map(({ k }) => { const L = Barres3D.repere(Gm.N, { i: Gm.B[k].i, j: Gm.B[k].j }).L; return { k, L, M: efforts(A, c, k, L / 2)[2] }; });
      let i = 0; while (i < pts.length) { if (pts[i].M <= 0) { i++; continue; } let j = i, L = 0; while (j < pts.length && pts[j].M > 0) { L += pts[j].L; j++; }
        const bout = i === 0 || j === pts.length; for (let t = i; t < j; t++) out[pts[t].k] = { L, bout }; i = j; }
      return out; }
    for (const [m, M] of Object.entries(membres)) {
      if (!M.ks.length) continue;
      let best = { r: 0 }, bestB = { r: 0 }, bestV = { r: 0 };
      for (const c of K.ELU) {
        const ZL = m === "col" ? null : zonesLT(c);
        // N de compression maxi du membre (pour le flambement)
        let Nc = 0; M.ks.forEach((k) => segs(k).forEach((s) => { Nc = Math.min(Nc, efforts(A, c, k, s)[0]); }));
        for (const k of M.ks) for (const s of segs(k)) {
          const p = S[k], fy = fyOf(p), [N, Vz, My] = efforts(A, c, k, s), Npl = p.A * fy / 10, Mpl = p.Wply * fy / 1000, Mel = p.Wely * fy / 1000;
          const n = Math.max(0, -N) / Npl, cl = classeSection(p, fy, n > 0.1 ? "compression" : "flexion");
          const Vpl = (p.Avz || p.A * 0.45) * fy / Math.sqrt(3) / 10;
          // résistance de section (§6.2.6, 6.2.8, 6.2.9)
          let rS, rV = Math.abs(Vz) / Vpl, txt;
          if (cl.cl >= 4) { rS = 9.99; txt = "classe 4 : hors domaine"; }
          else if (cl.cl <= 2) { const a = Math.min((p.A * 100 - 2 * p.b * p.tf) / (p.A * 100), 0.5), nn = Math.abs(N) / Npl;
            let MN = Math.min(Mpl, Mpl * (1 - nn) / (1 - 0.5 * a)); if (rV > 0.5) { const rho = (2 * rV - 1) ** 2, Aw = (p.h - 2 * p.tf) * p.tw; MN = Math.min(MN, (p.Wply * 1000 - rho * Aw * Aw / (4 * p.tw)) * fy / 1e6); }
            rS = Math.max(nn, Math.abs(My) / MN); txt = `cl. ${cl.cl} – M<sub>N,y,Rd</sub> = ${fmtN(MN, 1)} kNm (6.36), N<sub>pl</sub> = ${fmtN(Npl, 0)} kN`; }
          else { rS = Math.abs(N) / Npl + Math.abs(My) / Mel; txt = `cl. 3 – σ élastique (6.42)`; }
          if (rS > best.r) best = { r: rS, c, k, s, N, Vz, My, txt, p };
          if (rV > bestV.r) bestV = { r: rV, c, k, s, Vz, Vpl, p };
          // stabilité (§6.3.1, 6.3.2, 6.3.3 + Annexe B)
          const cb = courbesS(p), l1 = lam1(fy);
          let Lcy, Lcz, Llt, C1 = 1, Cmy = 0.9, CmLT = 0.95, comprime;
          if (m === "col") { const h = Gm.N[Gm.B[k].j].x < Gm.L / 2 ? Gm.H : Gm.hD; Lcy = h; Lcz = h / ((D.maintCol || 0) + 1); Llt = Lcz; C1 = 1.77; Cmy = 0.9; CmLT = 0.6; comprime = "—"; }
          else { Lcy = Gm.Lr; const top = My < 0, z = ZL[k] || { L: Gm.Lr, bout: false }; comprime = top ? "supérieure" : "inférieure";
            const aM = D.maintEff === false ? (D.aPav || Gm.Lr) : (D.aPanne || 1.5);           // maintiens efficaces : pannes reliées à la poutre au vent ; sinon nœuds de la poutre au vent
            Lcz = aM;
            if (top) { Llt = aM; C1 = 1.0; }                                                // semelle sup. tenue par les pannes
            else if (D.lBas > 0 && D.maintEff !== false) { Llt = Math.min(D.lBas, z.L); C1 = 1.0; }   // bracons
            else { Llt = z.L; C1 = z.bout ? 1.77 : 1.13; } }                                // zone comprimée entre nœud et point d'inflexion
          const lamy = Lcy * 100 / p.iy / l1, lamz = Lcz * 100 / p.iz / l1, chiy = chi(lamy, cb.y).chi, chiz = chi(lamz, cb.z).chi;
          const MRk = (cl.cl <= 2 ? p.Wply : p.Wely) * fy / 1000, mcr = Mcr(p, Llt, C1, 0, 0), lamLT = Math.sqrt(MRk / mcr);
          const chiLT = lamLT <= 0.2 || Math.abs(My) / mcr <= 0.04 ? 1 : chi(lamLT, cb.lt).chi;
          const Ned = Math.max(0, -Nc), ny = Ned / (chiy * Npl), nz = Ned / (chiz * Npl), mm = Math.abs(My) / (chiLT * MRk);
          let kyy, kzy;
          if (cl.cl <= 2) { kyy = Cmy * (1 + Math.min(Math.max(lamy - 0.2, 0), 0.8) * ny);
            kzy = lamz < 0.4 ? Math.min(0.6 + lamz, 1 - 0.1 * lamz / (CmLT - 0.25) * nz) : Math.max(1 - 0.1 * Math.min(lamz, 1) / (CmLT - 0.25) * nz, 1 - 0.1 / (CmLT - 0.25) * nz); }
          else { kyy = Cmy * (1 + 0.6 * Math.min(lamy, 1) * ny); kzy = Math.max(1 - 0.05 * Math.min(lamz, 1) / (CmLT - 0.25) * nz, 1 - 0.05 / (CmLT - 0.25) * nz); }
          const r61 = ny + kyy * mm, r62 = nz + kzy * mm, rB = Math.max(r61, r62);
          if (rB > bestB.r) bestB = { r: rB, c, k, s, Ned, My, lamy, lamz, chiy, chiz, lamLT, chiLT, mcr, MRk, kyy, kzy, r61, r62, Lcy, Lcz, Llt, C1, cb, cl: cl.cl, comprime, p };
        }
      }
      res.sec[m] = best; res.stab[m] = bestB; res.sec[m].V = bestV;
      const pos = (o) => { const b = Gm.B[o.k], x = (Gm.N[b.i].x + Gm.N[b.j].x) / 2, z = (Gm.N[b.i].z + Gm.N[b.j].z) / 2; return m === "col" ? `z ≈ ${fmtN(z, 2)} m` : `x ≈ ${fmtN(x, 2)} m`; };
      lignes.push({ n: `${M.nom} – résistance de section N + M`, ref: "§6.2.9 (6.36) / §6.2.1 (6.42)", val: `${fmtN(best.N || 0, 1)} kN ; ${fmtN(Math.abs(best.My || 0), 1)} kNm (${pos(best)}, ${escH(best.p.n)})`, lim: best.txt || "", r: best.r, comb: best.c ? best.c.nom : "" });
      lignes.push({ n: `${M.nom} – effort tranchant`, ref: "§6.2.6 (6.17)", val: `${fmtN(Math.abs(bestV.Vz || 0), 1)} kN`, lim: `V<sub>pl,Rd</sub> = ${fmtN(bestV.Vpl || 0, 1)} kN`, r: bestV.r, comb: bestV.c ? bestV.c.nom : "" });
      if (m !== "jar") lignes.push({ n: `${M.nom} – flambement et déversement (N + M)`, ref: "§6.3.3 (6.61) (6.62) + Annexe B", val: `N = ${fmtN(bestB.Ned || 0, 1)} kN ; M = ${fmtN(Math.abs(bestB.My || 0), 1)} kNm ; χ<sub>y</sub> ${fmtN(bestB.chiy || 1, 2)}, χ<sub>z</sub> ${fmtN(bestB.chiz || 1, 2)}, χ<sub>LT</sub> ${fmtN(bestB.chiLT || 1, 2)}`, lim: `L<sub>LT</sub> = ${fmtN(bestB.Llt || 0, 2)} m${m !== "col" ? ` (semelle ${bestB.comprime} comprimée)` : ""}`, r: bestB.r, comb: bestB.c ? bestB.c.nom : "" });
    }
    // ELS : flèche de traverse et déplacement en tête
    let fl = { r: 0 }, dh = { r: 0 };
    const tN = Gm.tr, xs = tN.map((n) => Gm.N[n].x), x0 = xs[0], x1 = xs[xs.length - 1];
    for (const c of K.CAR) {
      const dg = deplacement(A, c, Gm.tetes[0]), dd = deplacement(A, c, Gm.tetes[1]);
      tN.forEach((n, i) => { const u = deplacement(A, c, n)[1], ref = dg[1] + (dd[1] - dg[1]) * (xs[i] - x0) / (x1 - x0), w = Math.abs(u - ref) * 1000, lim = Gm.L * 1000 / (D.wL || 200), r = w / lim; if (r > fl.r) fl = { r, w, lim, c, x: xs[i] }; });
      [dg, dd].forEach((d, i) => { const h = i ? Gm.hD : Gm.H, w = Math.abs(d[0]) * 1000, lim = h * 1000 / (D.hH || 150), r = w / lim; if (r > dh.r) dh = { r, w, lim, c }; });
    }
    lignes.push({ n: "Traverse – flèche verticale (ELS caractéristique)", ref: "NF EN 1993-1-1/NA §7.2.1, Tab. 7.1", val: `${fmtN(fl.w || 0, 1)} mm (x ≈ ${fmtN(fl.x || 0, 2)} m)`, lim: `L/${D.wL || 200} = ${fmtN(fl.lim || 0, 1)} mm`, r: fl.r, comb: fl.c ? fl.c.nom : "" });
    lignes.push({ n: "Poteaux – déplacement horizontal en tête (ELS)", ref: "NF EN 1993-1-1/NA §7.2.2", val: `${fmtN(dh.w || 0, 1)} mm`, lim: `H/${D.hH || 150} = ${fmtN(dh.lim || 0, 1)} mm`, r: dh.r, comb: dh.c ? dh.c.nom : "" });
    // stabilité globale (α_cr)
    const cMin = K.ELU.filter((c) => isFinite(c.acr)).reduce((a, c) => (!a || c.acr < a.acr ? c : a), null);
    // validité de la formule (5.2) : λ̄ traverse ≥ 0,3·√(A·fy/N_Ed) (§5.2.1(4)B NOTE 2B)
    let valide = true; if (cMin) { const kt = membres.tra.ks[0], p = S[kt], fy = fyOf(p); let Nt = 0; membres.tra.ks.concat(membres.jar.ks).forEach((k) => segs(k).forEach((s) => { Nt = Math.min(Nt, efforts(A, cMin, k, s)[0]); }));
      const lam = Gm.Lr * 100 / p.iy / lam1(fy); valide = Nt >= 0 || lam < 0.3 * Math.sqrt(p.A * fy / 10 / -Nt); /* N_Ed traverse non significatif */ res.validAcr = { lam, Nt }; }
    res.global = { cMin, valide, K: A.K, hm: A.hm };
    // descente de charges (pieds) : cas élémentaires (caractéristiques) et enveloppe ELU
    const ddc = { cas: [], env: [] };
    for (const c of Object.values(A.C)) ddc.cas.push({ id: c.id, nom: c.nom, R: Gm.pieds.map((nd) => reactions(A, { f: { [c.id]: 1 } }, nd)) });
    Gm.pieds.forEach((nd, i) => { const e = { Hmax: -1e9, Hmin: 1e9, Vmax: -1e9, Vmin: 1e9 }; K.ELU.forEach((c) => { const [h, v] = reactions(A, c, nd); if (h > e.Hmax) { e.Hmax = h; e.cHmax = c.nom; } if (h < e.Hmin) { e.Hmin = h; e.cHmin = c.nom; } if (v > e.Vmax) { e.Vmax = v; e.cVmax = c.nom; } if (v < e.Vmin) { e.Vmin = v; e.cVmin = c.nom; } }); ddc.env.push(e); });
    res.ddc = ddc;
    res.lignes = lignes; res.gov = lignes.reduce((a, l) => (l.r > a.r ? l : a), { r: 0 });
    return res;
  }

  /* ---------- pannes : poutre continue (≥ 3 travées, soit ≥ 4 portiques) ou sur deux appuis ---------- */
  function pannes(D, Ccl) {
    const P = D.panne, e = D.e, n = D.nP >= 4 ? D.nP - 1 : 1, cont = D.nP >= 4, a = D.aPanne || 1.5, al = Math.atan((D.p || 0) / 100), ca = Math.cos(al), sa = Math.sin(al);
    // poutre continue de n travées (Barres3D, axe X, flexion verticale) : moments et réactions pour q = 1 kN/m
    const nE = 8, N = [], B = []; for (let i = 0; i <= n * nE; i++) N.push({ x: i * e / nE, y: 0, z: 0 });
    const sec = P.prof || { A: 10, Iy: 500, Iz: 50, It: 1 };
    for (let i = 0; i < n * nE; i++) B.push({ i, j: i + 1, ...bar(sec) });
    const app = {}; N.forEach((_, k) => { app[k] = [0, 1, 0, 1, 0, 1]; }); for (let t = 0; t <= n; t++) app[t * nE] = [t === 0 ? 1 : 0, 1, 1, 1, 0, 1];
    const r = Barres3D.resoudre({ noeuds: N, barres: B, appuis: app, reparties: B.map((_, b) => ({ b, q: [0, 0, -1] })) });
    let Mt = 0, Ma = 0; r.elems.forEach((el) => [0, el.L / 2, el.L].forEach((s) => { const M = Barres3D.interne(el, s)[4]; Mt = Math.min(Mt, M); Ma = Math.max(Ma, M); }));
    const Rmax = Math.max(...Array.from({ length: n + 1 }, (_, t) => r.reactions[t * nE][2])) / e, wMax = Math.max(...N.map((_, k) => -r.depl(k)[2]));
    const coef = { mTrav: -Mt / (e * e), mApp: Ma / (e * e), kR: cont ? Rmax : 1, w: wMax * Ek * (sec.Iy * 1e-8) / e ** 4 };
    // charges sur la panne (kN/m) : normale (flexion forte) et tangentielle (flexion faible, reprise par les liernes)
    const gp = (D.gCouv + (D.gDiv || 0)) * a + (P.prof ? P.prof.m : P.m || 0) * g0 / 1000, s = D.neige && D.neige.sk ? 0.8 * D.neige.Ce * D.neige.Ct * D.neige.sk * a * ca + (D.neige.maj || 0) * a * ca : 0;
    const cw = Ccl || { max: 0, min: 0 }, qp = D.vent ? D.vent.qp || 0 : 0, wD = cw.max * qp * a, wU = cw.min * qp * a;
    const combos = [{ nom: "1,35·G + 1,5·S", n: 1.35 * gp * ca + 1.5 * s * ca, t: 1.35 * gp * sa + 1.5 * s * sa },
      { nom: "1,35·G + 1,5·W↓ + 0,75·S", n: 1.35 * gp * ca + 1.5 * wD + 0.75 * s * ca, t: (1.35 * gp + 0.75 * s) * sa },
      { nom: "1,0·G + 1,5·W↑", n: 1.0 * gp * ca + 1.5 * wU, t: 1.0 * gp * sa }];
    const carS = Math.max(gp * ca + s * ca, gp * ca + wD + 0.5 * s * ca), carU = gp * ca + wU;
    const out = { n, cont, coef, gp, s, wD, wU, combos, lignes: [], kR: coef.kR };
    if (P.type === "sadef") {
      const qd = Math.max(...combos.map((c) => c.n)), qu = Math.min(...combos.map((c) => c.n)), km = Math.max(coef.mTrav, coef.mApp), fyb = (typeof SADEF !== "undefined" ? SADEF.fyb : 390);
      const MD = km * qd * e * e, MU = km * Math.max(0, -qu) * e * e, pn = P.prof ? P.prof.n : (P.nom || "SADEF");
      if (P.qD) out.lignes.push({ n: "Pannes SADEF – charge descendante ELU", ref: "Catalogue SADEF (charge admissible)", val: `${fmtN(qd, 2)} kN/m`, lim: `q<sub>adm</sub> = ${fmtN(P.qD, 2)} kN/m`, r: qd / P.qD, comb: combos.find((c) => c.n === qd).nom });
      else if (P.Weff) out.lignes.push({ n: "Pannes SADEF – flexion descendante ELU", ref: "NF EN 1993-1-3 §6.1.4.1 : M<sub>c,Rd</sub> = W<sub>eff</sub>·f<sub>yb</sub>/γ<sub>M0</sub>", val: `M<sub>Ed</sub> = ${fmtN(MD, 2)} kNm`, lim: `W<sub>eff</sub> = ${fmtN(P.Weff, 1)} cm³ ; f<sub>yb</sub> = ${fyb} MPa → ${fmtN(P.Weff * fyb / 1000, 2)} kNm`, r: MD / (P.Weff * fyb / 1000), comb: combos.find((c) => c.n === qd).nom });
      else out.lignes.push({ n: "Pannes SADEF – flexion descendante ELU", ref: "données efficaces à saisir", val: `M<sub>Ed</sub> = ${fmtN(MD, 2)} kNm (${escH(pn)})`, lim: "W<sub>eff</sub> ou q<sub>adm</sub> SADEF à saisir", r: 9.99, comb: "" });
      if (qu < 0) {
        if (P.qU) out.lignes.push({ n: "Pannes SADEF – charge ascendante ELU", ref: "Catalogue SADEF (charge admissible)", val: `${fmtN(-qu, 2)} kN/m`, lim: `q<sub>adm</sub> = ${fmtN(P.qU, 2)} kN/m`, r: -qu / P.qU, comb: "1,0·G + 1,5·W↑" });
        else if (P.Weff && P.chiU) out.lignes.push({ n: "Pannes SADEF – flexion ascendante ELU (semelle libre)", ref: "NF EN 1993-1-3 §10.1.4.2 : M/(χ<sub>LT</sub>·W<sub>eff</sub>·f<sub>yb</sub>) ≤ 1", val: `M<sub>Ed</sub> = ${fmtN(MU, 2)} kNm`, lim: `χ<sub>LT</sub> = ${fmtN(P.chiU, 2)} (saisi)`, r: MU / (P.chiU * P.Weff * fyb / 1000), comb: "1,0·G + 1,5·W↑" });
        else out.lignes.push({ n: "Pannes SADEF – flexion ascendante ELU (semelle libre)", ref: "données à saisir", val: `M<sub>Ed</sub> = ${fmtN(MU, 2)} kNm`, lim: "q<sub>adm</sub> ascendante ou χ<sub>LT</sub> (§10.1.4) à saisir", r: 9.99, comb: "1,0·G + 1,5·W↑" });
      }
      if (P.prof) { const w = coef.w * Math.max(carS, -carU) * e ** 4 / (Ek * P.prof.Iy * 1e-8) * 1000, lim = e * 1000 / (D.wPanne || 200);
        out.lignes.push({ n: "Pannes SADEF – flèche (ELS caractéristique)", ref: "I<sub>y</sub> brut du catalogue (approché, NF EN 1993-1-3 §7.1)", val: `${fmtN(w, 1)} mm`, lim: `L/${D.wPanne || 200} = ${fmtN(lim, 1)} mm`, r: w / lim, comb: "caractéristique" }); }
      else if (P.qS) out.lignes.push({ n: "Pannes SADEF – flèche (charge de service)", ref: "Catalogue SADEF (charge admissible ELS)", val: `${fmtN(Math.max(carS, -carU), 2)} kN/m`, lim: `${fmtN(P.qS, 2)} kN/m`, r: Math.max(carS, -carU) / P.qS, comb: "caractéristique" });
      return out;
    }
    const p = P.prof, fy = fyDe(D.nuance || "S355", p), cb = courbesS(p), lt = (D.liernes || 0) + 1, et = e / lt;
    for (const c of combos) {
      const My = Math.max(coef.mTrav, coef.mApp) * Math.abs(c.n) * e * e, Mz = Math.abs(c.t) * et * et / 8, Vz = 0.6 * Math.abs(c.n) * e * (cont ? 1.0 : 0.833);
      const Mply = p.Wply * fy / 1000, Mplz = p.Wplz * fy / 1000, rS = (My / Mply) ** 2 + Mz / Mplz;   // 6.2.9 (6.41), α = 2, β = 1
      const up = c.n < 0, Llt = up ? (lt > 1 ? et : e) : 0, mcr = Llt ? Mcr(p, Llt, 1.13, 0, 0) : Infinity, lamLT = Llt ? Math.sqrt(Mply / mcr) : 0, chiLT = lamLT <= 0.2 ? 1 : chi(lamLT, cb.lt).chi;
      const rB = My / (chiLT * Mply) + Mz / Mplz;
      c.res = { My, Mz, rS, rB, chiLT, Llt, up };
    }
    const g1 = combos.reduce((a, c) => (c.res.rS > a.res.rS ? c : a)), g2 = combos.reduce((a, c) => (c.res.rB > a.res.rB ? c : a));
    out.lignes.push({ n: "Pannes – résistance en flexion déviée", ref: "§6.2.9 (6.41), α = 2, β = 1", val: `M<sub>y</sub> = ${fmtN(g1.res.My, 2)} ; M<sub>z</sub> = ${fmtN(g1.res.Mz, 2)} kNm`, lim: `${escH(p.n)}, ${cont ? `continue ${n} travées` : "deux appuis"}, liernes ${D.liernes ? (D.liernes === 1 ? "à mi-portée" : "aux tiers") : "aucune"}`, r: g1.res.rS, comb: g1.nom });
    out.lignes.push({ n: "Pannes – déversement (semelle libre comprimée sous soulèvement)", ref: "§6.3.2, §6.3.3 simplifiée", val: g2.res.up ? `χ<sub>LT</sub> = ${fmtN(g2.res.chiLT, 3)} (L = ${fmtN(g2.res.Llt || 0, 2)} m)` : "χ<sub>LT</sub> = 1 (semelle comprimée maintenue) ; M<sub>y</sub>/M<sub>pl,y</sub> + M<sub>z</sub>/M<sub>pl,z</sub>", lim: "semelle supérieure maintenue par la couverture sous charge descendante", r: g2.res.rB, comb: g2.nom });
    const w = coef.w * Math.max(carS, -carU) * e ** 4 / (Ek * p.Iy * 1e-8) * 1000, lim = e * 1000 / (D.wPanne || 200);
    out.lignes.push({ n: "Pannes – flèche (ELS caractéristique)", ref: "NF EN 1993-1-1/NA Tab. 7.1", val: `${fmtN(w, 1)} mm`, lim: `L/${D.wPanne || 200} = ${fmtN(lim, 1)} mm`, r: w / lim, comb: "caractéristique" });
    return out;
  }

  return { sectionI, courbesS, geometrie, analyser, combinaisons, verifier, efforts, reactions, deplacement, pannes };
})();
