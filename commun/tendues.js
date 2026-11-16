/* =====================================================================
   BARRES TENDUES BOULONNÉES — cornières (simples ou jumelées) et UPN sur gousset
   Reprend la méthode du classeur « Calculette assemblages boulonnés » (BE CM, feuilles « Vérification
   cornières » et « Vérification UPN ») : NF EN 1993-1-1 §6.2.3, NF EN 1993-1-8 §3.6.1, §3.10.2, §3.10.3,
   compléments CTICM (excentricité trusquinage / axe neutre, diffusion à 30° dans le gousset).
   Unités : N, mm, MPa en interne ; efforts en kN en entrée / sortie.
   ===================================================================== */
const TENDUES = (() => {
  const BOULONS = { M10: [10, 11, 78.5, 58], M12: [12, 13, 113, 84.3], M14: [14, 15, 154, 115], M16: [16, 18, 201, 157], M18: [18, 20, 254, 192], M20: [20, 22, 314, 245],
    M22: [22, 24, 380, 303], M24: [24, 26, 452, 353], M27: [27, 30, 573, 459], M30: [30, 33, 707, 561], M33: [33, 36, 855, 694], M36: [36, 39, 1018, 817] };   // d, d0 normal, A, As (mm, mm²)
  const CLASSES = { "4.6": [240, 400], "4.8": [320, 400], "5.6": [300, 500], "5.8": [400, 500], "6.8": [480, 600], "8.8": [640, 800], "10.9": [900, 1000] };   // fyb, fub (MPa)
  const gM0 = 1.0, gM2 = 1.25;
  const fyfu = (nu, t) => { const v = NUANCES[nu.replace(/\s.*$/, "")] || NUANCES.S235; return [t > 40 ? v[1] : v[0], v[2]]; };
  const interp = (x, x0, y0, x1, y1) => x <= x0 ? y0 : x >= x1 ? y1 : y0 + (x - x0) / (x1 - x0) * (y1 - y0);
  // pression diamétrale (Tab. 3.4) : direction de l'effort (« vert. ») et perpendiculaire (« hor. »)
  function fb(o) { const { e1, p1, e2, d0, d, t, fu, fub, kt } = o;
    const k1r = Math.min(2.8 * e2 / d0 - 1.7, 2.5), k1i = Math.min(1.4 * p1 / d0 - 1.7, 2.5);
    const abr = Math.min(e1 / (3 * d0), fub / fu, 1), abi = Math.min(p1 / (3 * d0) - 0.25, fub / fu, 1), abh = Math.min(e2 / (3 * d0), fub / fu, 1);
    const F = (k, a) => Math.max(0, k) * a * fu * d * t / gM2 * kt;
    return { vR: F(k1r, abr), vI: F(k1r, abi), hR: F(k1r, abh), hI: F(k1i, abh), k1r, k1i, abr, abi, abh }; }
  /* o = { type:'L'|'U', prof, nb, nuance, NEd (kN), boulon, classe, n (boulons par file), nr (files, UPN), jeu (mm), filete, e1, p1, e2, p2 (UPN), tg, e1g, e2g, nuanceG } */
  function calculer(o) {
    const B = BOULONS[o.boulon] || BOULONS.M16, [d, d0n, Ab, As] = B, d0 = d + (o.jeu ?? (d <= 24 ? 2 : 3)), surd = d0 > d0n, kt = surd ? 0.8 : 1;
    const [, fub] = CLASSES[o.classe] || CLASSES["8.8"], n = Math.max(1, o.n | 0), nb = Math.max(1, o.nb | 0), nr = o.type === "U" ? Math.max(1, o.nr | 0) : 1;
    const p = o.prof, t = o.type === "U" ? p.tw : (p.t || p.tf), [fy, fu] = fyfu(o.nuance || "S235", t), [fyg, fug] = fyfu(o.nuanceG || "S235", o.tg);
    const A = p.A * 100 * nb, N = (o.NEd || 0) * 1000, av = !o.filete ? 0.6 : (["4.6", "5.6", "8.8"].includes(o.classe) ? 0.6 : 0.5);
    const k085 = (d <= 14 && (d0 - d) >= 2 && !["4.6", "5.6"].includes(o.classe)) ? 0.85 : 1;   // M12, M14 avec jeu de 2 mm (§3.6.1(5))
    const L = [], add = (n_, ref, R, txt) => L.push({ n: n_, ref, R: R / 1000, val: `${fmtN(N / 1000, 1)} kN`, lim: `${fmtN(R / 1000, 1)} kN${txt ? " – " + txt : ""}`, r: R > 0 ? N / R : 9.99 });
    const e1 = o.e1, p1 = o.p1, e2 = o.e2;
    let beta = 0, red = 1, ecc = 0;
    if (o.type !== "U") {                                       // excentricité trusquinage / axe neutre (CTICM)
      const a = p.h, ez = (p.ez || p.ey || 0) * 10; ecc = Math.max(0, (a - e2) - ez); beta = n > 1 ? 6 * ecc / (n * (n + 1) * p1) : 0; red = n > 1 ? 1 / Math.sqrt(1 + (n * beta) ** 2) : 1; }
    // 1. cisaillement des boulons (§3.6.1, Tab. 3.4) — cornières jumelées : double cisaillement
    const Fv = n * nr * nb * av * fub * (o.filete ? As : Ab) / gM2 * k085 * red;
    add("Boulons – cisaillement", "NF EN 1993-1-8 §3.6.1" + (o.type !== "U" && n > 1 ? " ; excentricité CTICM" : ""), Fv, `${n * nr} ${o.boulon} ${o.classe}${nb > 1 ? " × 2 plans" : ""}, α<sub>v</sub> = ${av}${red < 1 ? `, réduction 1/√(1 + (n·β)²) = ${fmtN(red, 3)} (e = ${fmtN(ecc, 1)} mm)` : ""}${k085 < 1 ? ", × 0,85" : ""}`);
    // 2. section brute (§6.2.3)
    add(`${o.type === "U" ? "UPN" : "Cornière"} – section brute`, "NF EN 1993-1-1 §6.2.3 (6.6)", A * fy / gM0, `A = ${fmtN(A, 0)} mm², f<sub>y</sub> = ${fy} MPa`);
    // 3. section nette
    if (o.type === "U") { const An = A - d0 * t * nb * nr; add("UPN – section nette", "NF EN 1993-1-1 §6.2.3 (6.7)", 0.9 * An * fu / gM2, `A<sub>net</sub> = ${fmtN(An, 0)} mm²`); }
    else { const An = A - d0 * t * nb; let R, txt;
      if (n === 1) { R = 2 * (e2 - d0 / 2) * t * fu * nb / gM2; txt = "1 boulon : 2·(e<sub>2</sub> − d<sub>0</sub>/2)·t·f<sub>u</sub>/γ<sub>M2</sub>"; }
      else { const b = n === 2 ? interp(p1 / d0, 2.5, 0.4, 5, 0.7) : interp(p1 / d0, 2.5, 0.5, 5, 0.7); R = b * An * fu / gM2; txt = `β<sub>${n === 2 ? 2 : 3}</sub> = ${fmtN(b, 3)}, A<sub>net</sub> = ${fmtN(An, 0)} mm²`; }
      add("Cornière – section nette (attache par une aile)", "NF EN 1993-1-8 §3.10.3 (3.11 à 3.13)", R, txt); }
    // 4. pression diamétrale de la barre
    const P = fb({ e1, p1, e2, d0, d, t, fu, fub, kt });
    let Rb; if (o.type === "U") { Rb = nb * nr * (P.vR + P.vI * (n - 1)); }
    else Rb = n === 1 ? P.vR * nb : nb * n / Math.sqrt(1 / Math.min(P.vR, P.vI) ** 2 + (beta * n / Math.min(P.hR, P.hI)) ** 2);
    add(`${o.type === "U" ? "UPN" : "Cornière"} – pression diamétrale`, "NF EN 1993-1-8 §3.6.1, Tab. 3.4" + (surd ? " (trous surdimensionnés × 0,8)" : ""), Rb, `k<sub>1</sub> = ${fmtN(P.k1r, 2)}, α<sub>b</sub> = ${fmtN(Math.min(P.abr, P.abi), 2)}`);
    // 5. cisaillement de bloc de la barre
    if (o.type === "U") { if (nr > 1) { const Ant = nb * t * ((o.p2 || 0) - d0 * (nr - 1)), Anv = 2 * nb * t * (e1 + p1 * (n - 1) - d0 * (n - 0.5));
        add("UPN – cisaillement de bloc (centré)", "NF EN 1993-1-8 §3.10.2 (3.9)", fu * Ant / gM2 + fy * Anv / Math.sqrt(3) / gM0, `A<sub>nt</sub> = ${fmtN(Ant, 0)}, A<sub>nv</sub> = ${fmtN(Anv, 0)} mm²`); } }
    else { const Ant = nb * t * (e2 - d0 / 2), Anv = nb * t * (e1 + p1 * (n - 1) - d0 * (n - 0.5));
      add("Cornière – cisaillement de bloc (excentré)", "NF EN 1993-1-8 §3.10.2 (3.10)", 0.5 * fu * Ant / gM2 + fy * Anv / Math.sqrt(3) / gM0, `A<sub>nt</sub> = ${fmtN(Ant, 0)}, A<sub>nv</sub> = ${fmtN(Anv, 0)} mm²`); }
    // 6. gousset : diffusion à 30° (Whitmore), section nette, pression diamétrale, bloc
    if (o.tg > 0) { const tg = o.tg, lg = o.type === "U" ? (n - 1) * p1 * Math.tan(Math.PI / 6) * 2 + (o.p2 || 0) * (nr - 1) : (n - 1) * p1 * Math.tan(Math.PI / 6) + Math.min((n - 1) * p1 * Math.tan(Math.PI / 6), o.e2g);
      if (n > 1) { add("Gousset – section brute (diffusion à 30°)", "CTICM ; NF EN 1993-1-1 §6.2.3", lg * tg * fyg / gM0, `l<sub>g</sub> = ${fmtN(lg, 0)} mm, t = ${tg} mm`);
        add("Gousset – section nette", "CTICM ; §6.2.3 (6.7)", 0.9 * tg * (lg - d0 * nr) * fug / gM2, ""); }
      const G = fb({ e1: o.e1g, p1, e2: o.e2g, d0, d, t: tg, fu: fug, fub, kt });
      const Rg = o.type === "U" ? nr * (G.vR + G.vI * (n - 1)) : (n === 1 ? G.vR : n / Math.sqrt(1 / Math.min(G.vR, G.vI) ** 2 + (beta * n / Math.min(G.hR, G.hI)) ** 2));
      add("Gousset – pression diamétrale", "NF EN 1993-1-8 §3.6.1", Rg, `k<sub>1</sub> = ${fmtN(G.k1r, 2)}`);
      if (o.type === "U") { if (nr > 1) { const Ant = tg * ((o.p2 || 0) - d0) * (nr - 1), Anv = 2 * tg * (o.e1g + p1 * (n - 1) - d0 * (n - 0.5)); add("Gousset – cisaillement de bloc", "§3.10.2 (3.9)", fug * Ant / gM2 + fyg * Anv / Math.sqrt(3) / gM0, ""); } }
      else { const Ant = tg * (o.e2g - d0 / 2), Anv = tg * (o.e1g + p1 * (n - 1) - d0 * (n - 0.5)); add("Gousset – cisaillement de bloc (excentré)", "§3.10.2 (3.10)", 0.5 * fug * Ant / gM2 + fyg * Anv / Math.sqrt(3) / gM0, ""); } }
    // dispositions constructives (Tab. 3.3)
    const alertes = [];
    if (e1 < 1.2 * d0) alertes.push(`e<sub>1</sub> = ${e1} &lt; 1,2·d<sub>0</sub> = ${fmtN(1.2 * d0, 0)} mm`);
    if (n > 1 && p1 < 2.2 * d0) alertes.push(`p<sub>1</sub> = ${p1} &lt; 2,2·d<sub>0</sub> = ${fmtN(2.2 * d0, 0)} mm`);
    if (e2 < 1.2 * d0) alertes.push(`e<sub>2</sub> = ${e2} &lt; 1,2·d<sub>0</sub> = ${fmtN(1.2 * d0, 0)} mm`);
    if (o.type === "U" && nr > 1 && (o.p2 || 0) < 2.4 * d0) alertes.push(`p<sub>2</sub> &lt; 2,4·d<sub>0</sub> = ${fmtN(2.4 * d0, 0)} mm`);
    if (o.tg > 0 && (o.e1g < 1.2 * d0 || o.e2g < 1.2 * d0)) alertes.push("pinces du gousset &lt; 1,2·d<sub>0</sub>");
    if (e1 > 4 * t + 40) alertes.push(`e<sub>1</sub> &gt; 4t + 40 = ${fmtN(4 * t + 40, 0)} mm (corrosion, Tab. 3.3)`);
    if (n > 1 && p1 > Math.min(14 * t, 200)) alertes.push(`p<sub>1</sub> &gt; min(14t ; 200) = ${fmtN(Math.min(14 * t, 200), 0)} mm`);
    if (n === 1) alertes.push("attache à un seul boulon : déconseillée pour une barre de contreventement principale (rotation, excentricité) ; prévoir au moins 2 boulons");
    if (o.type !== "U") { const w = p.h - e2, wmin = t + (p.r || 0) + d; if (w < wmin) alertes.push(`trusquinage ${fmtN(w, 0)} mm &lt; t + r + d ≈ ${fmtN(wmin, 0)} mm : boulon trop gros pour l'aile (rondelle, clé)`); }
    else { const plat = p.h - 2 * (p.tf + (p.r || 0)), occ = (o.p2 || 0) * (nr - 1) + 2 * d; if (occ > plat) alertes.push(`files de boulons (${fmtN(occ, 0)} mm avec rondelles) plus larges que la partie plane de l'âme (${fmtN(plat, 0)} mm)`); }
    if (o.tg > 0 && o.tg < 6) alertes.push("gousset d'épaisseur &lt; 6 mm : déconseillé");
    if (o.tg > 0 && nb === 1 && o.tg < t) alertes.push(`gousset (${o.tg} mm) plus mince que la barre (${t} mm)`);
    if (surd) alertes.push("trous surdimensionnés : pression diamétrale réduite (× 0,8), glissement possible");
    const NRd = Math.min(...L.map((l) => l.R));
    return { lignes: L, NRd, d0, surd, alertes, gouv: L.reduce((a, l) => (l.r > a.r ? l : a)) };
  }
  /* attache par défaut (A1 : diagonales de contreventement en cornière) : 2 boulons M16 8.8, pinces usuelles, gousset 8 mm S235 */
  function defaut(prof, nuance, NEd) {
    const a = prof.h, d0 = 18, e2 = Math.max(Math.round(1.5 * d0), Math.round(0.45 * a));
    return { type: "L", prof, nb: 1, nuance, NEd, boulon: "M16", classe: "8.8", n: 2, jeu: 2, filete: true, e1: 35, p1: 50, e2, tg: 8, e1g: 35, e2g: 35, nuanceG: "S235" };
  }
  return { calculer, defaut, BOULONS, CLASSES };
})();
