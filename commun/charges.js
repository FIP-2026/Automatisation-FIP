/* =====================================================================
   CHARGES — module commun (G1 permanentes, Q1 exploitation, C1 climat, NH note d'hypothèses)
   - stockage des hypothèses de l'affaire (navigateur) : fip.hyp.G / .Q / .C / .gen
   - catalogue des matériaux de complexes (repris de C1) + planchers + divers
   - poids volumiques (NF EN 1991-1-1 Annexe A, sélection)
   - charges d'exploitation (NF EN 1991-1-1 + AN : Tab. 6.2(NF), 6.10(NF), 6.12(NF)), passerelles (NF EN ISO 14122)
   - éditeur de complexes, schémas (symboles de charges, coupe de complexe)
   ===================================================================== */
const CH = (() => {
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fx = (x, d = 2) => (typeof x === "number" && isFinite(x) ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
  const g = 9.81;
  /* ---------- stockage ---------- */
  const CLES = { G: "fip.hyp.G", Q: "fip.hyp.Q", C: "fip.hyp.C", gen: "fip.hyp.gen" };
  const lire = (k) => { try { return JSON.parse(localStorage.getItem(CLES[k] || k)); } catch (e) { return null; } };
  const ecrire = (k, o) => { try { localStorage.setItem(CLES[k] || k, JSON.stringify({ ...o, date: new Date().toISOString() })); return true; } catch (e) { return false; } };

  /* ---------- catalogue des complexes ---------- */
  const PLANCHERS = [
    { ref: "PL01", fam: "Planchers – structure", nom: "Dalle béton armé pleine (e)", mode: "vol", val: 2500, e: 150, obs: "Béton armé 25 kN/m³ (NF EN 1991-1-1 Tab. A.1)" },
    { ref: "PL02", fam: "Planchers – structure", nom: "Plancher collaborant – bac acier 0,75 mm (forfait)", mode: "surf", val: 10, e: null, obs: "Bac de hauteur 60 à 80 mm : 9 à 11 kg/m² – fiche fabricant" },
    { ref: "PL03", fam: "Planchers – structure", nom: "Plancher collaborant – béton, épaisseur moyenne équivalente (e)", mode: "vol", val: 2500, e: 100, obs: "e moyenne = volume de béton / surface (fiche du bac)" },
    { ref: "PL04", fam: "Planchers – structure", nom: "Caillebotis pressé galvanisé 30×30, porteur 30×2", mode: "surf", val: 22, e: null, obs: "≈ 22 kg/m² – catalogue fabricant" },
    { ref: "PL05", fam: "Planchers – structure", nom: "Caillebotis pressé galvanisé 30×30, porteur 40×3", mode: "surf", val: 38, e: null, obs: "≈ 38 kg/m² – catalogue fabricant" },
    { ref: "PL06", fam: "Planchers – structure", nom: "Caillebotis électroforgé galvanisé 34×38, porteur 30×3", mode: "surf", val: 28, e: null, obs: "≈ 28 kg/m² – catalogue fabricant" },
    { ref: "PL07", fam: "Planchers – structure", nom: "Tôle larmée 4/6", mode: "surf", val: 34, e: null, obs: "≈ 34 kg/m²" },
    { ref: "PL08", fam: "Planchers – structure", nom: "Tôle larmée 5/7", mode: "surf", val: 42, e: null, obs: "≈ 42 kg/m²" },
    { ref: "PL09", fam: "Planchers – structure", nom: "Tôle larmée 6/8", mode: "surf", val: 50, e: null, obs: "≈ 50 kg/m²" },
    { ref: "PL10", fam: "Planchers – structure", nom: "Tôle larmée 8/10", mode: "surf", val: 66, e: null, obs: "≈ 66 kg/m²" },
    { ref: "PL11", fam: "Planchers – structure", nom: "Platelage bois massif résineux (e)", mode: "vol", val: 500, e: 40, obs: "Résineux ≈ 5 kN/m³ (NF EN 1991-1-1 Tab. A.3)" },
    { ref: "PL12", fam: "Planchers – structure", nom: "Panneau OSB / contreplaqué de plancher (e)", mode: "vol", val: 650, e: 22, obs: "≈ 6 à 7 kN/m³ – fiche fabricant" },
    { ref: "PL13", fam: "Planchers – structure", nom: "Ossature secondaire de plancher (solives, chevêtres) – forfait", mode: "surf", val: 15, e: null, obs: "À remplacer par le poids réel si l'ossature est calculée à part" },
    { ref: "PL20", fam: "Planchers – finitions et équipements", nom: "Chape ciment (e)", mode: "vol", val: 2100, e: 50, obs: "Mortier de ciment 19 à 23 kN/m³ (NF EN 1991-1-1 Tab. A.1)" },
    { ref: "PL21", fam: "Planchers – finitions et équipements", nom: "Carrelage scellé ou collé (forfait)", mode: "surf", val: 50, e: null, obs: "≈ 0,5 kN/m² colle comprise – indicatif" },
    { ref: "PL22", fam: "Planchers – finitions et équipements", nom: "Revêtement de sol résine ou souple (forfait)", mode: "surf", val: 5, e: null, obs: "Indicatif" },
    { ref: "PL23", fam: "Planchers – finitions et équipements", nom: "Étanchéité de plancher extérieur (forfait)", mode: "surf", val: 10, e: null, obs: "Indicatif – fiche fabricant" },
    { ref: "PL24", fam: "Planchers – finitions et équipements", nom: "Faux plafond suspendu (forfait)", mode: "surf", val: 20, e: null, obs: "0,15 à 0,25 kN/m² – indicatif" },
  ];
  const DIVERS = [
    { ref: "DV01", fam: "Divers (réseaux, équipements légers)", nom: "Réseaux suspendus légers – gaines, chemins de câbles (provision)", mode: "surf", val: 25, e: null, obs: "Provision 0,25 kN/m² à adapter ; tuyauteries lourdes et équipements comptés à part" },
    { ref: "DV02", fam: "Divers (réseaux, équipements légers)", nom: "Éclairage et électricité en sous-face (provision)", mode: "surf", val: 5, e: null, obs: "Provision indicative 0,05 kN/m²" },
    { ref: "DV03", fam: "Divers (réseaux, équipements légers)", nom: "Réseau sprinkler en eau (provision)", mode: "surf", val: 15, e: null, obs: "Provision indicative 0,10 à 0,20 kN/m² selon la maille et le DN – à confirmer par le lot" },
    { ref: "DV04", fam: "Divers (réseaux, équipements légers)", nom: "Lanterneaux, exutoires, costières (provision répartie)", mode: "surf", val: 5, e: null, obs: "Indicatif ; charges locales à vérifier" },
    { ref: "DV05", fam: "Divers (réseaux, équipements légers)", nom: "Ligne libre (saisie en daN/m²)", mode: "libre", val: 0, e: null, obs: "Saisie directe" },
  ];
  let CAT = null;
  const catalogue = () => { if (CAT) return CAT; const base = (typeof ZONAGE !== "undefined" ? ZONAGE.catalogue : []).filter((m) => m && m.mode && m.nom); CAT = base.concat(PLANCHERS, DIVERS); return CAT; };
  const DEFAUTS_CPX = {
    couv: [["Tôle acier nervurée (e = épaisseur d'acier)", 0.75], ["Pare-vapeur / écran (forfait)"], ["Laine de roche haute densité – support d'étanchéité (≈ 150 kg/m³)", 100], ["Membrane synthétique monocouche (PVC / TPO / EPDM 1,5 mm)"], ["Ossature secondaire acier légère – pannes / lisses (forfait)"], ["Réseaux suspendus légers – gaines, chemins de câbles (provision)"]],
    bard: [["Tôle acier nervurée (e = épaisseur d'acier)", 0.75], ["Laine de roche semi-rigide (≈ 45 kg/m³)", 100], ["Ossature secondaire acier légère – pannes / lisses (forfait)"], ["Tôle acier nervurée (e = épaisseur d'acier)", 0.63]],
    plan: [["Caillebotis pressé galvanisé 30×30, porteur 30×2"], ["Ossature secondaire de plancher (solives, chevêtres) – forfait"]],
    autre: [["Ligne libre (saisie en daN/m²)"]],
  };
  /* poids d'un complexe : couches [{nom, e, libre}] → kN/m² */
  function poidsComplexe(cx) {
    const lignes = (cx.couches || []).map((c) => { const m = catalogue().find((x) => x.nom === c.nom); if (!m) return null;
      let e = "", kN = 0; if (m.mode === "vol") { e = isFinite(parseFloat(c.e)) ? +c.e : m.e; kN = m.val * e / 1000 * g / 1000; } else if (m.mode === "surf") kN = m.val * g / 1000; else kN = (+c.libre || 0) / 100;
      return { m, e, kN }; }).filter(Boolean);
    const st = lignes.reduce((a, b) => a + b.kN, 0), maj = (isFinite(+cx.maj) ? +cx.maj : 3) / 100;
    return { lignes, st, maj, majv: st * maj, tot: st * (1 + maj) };
  }

  /* ---------- poids volumiques : NF EN 1991-1-1 Annexe A (sélection, valeurs à recouper avec la norme) ---------- */
  const ANNEXE_A = [
    ["A.1 Béton et mortier", "Béton de masse volumique normale (non armé)", 24], ["A.1 Béton et mortier", "Béton armé ou précontraint (+1 kN/m³)", 25], ["A.1 Béton et mortier", "Béton frais (+1 kN/m³)", 25],
    ["A.1 Béton et mortier", "Béton léger LC1,0 à LC2,0", [9, 20]], ["A.1 Béton et mortier", "Mortier de ciment", [19, 23]], ["A.1 Béton et mortier", "Mortier de plâtre", [12, 18]], ["A.1 Béton et mortier", "Mortier de chaux", [12, 18]],
    ["A.3 Bois et dérivés", "Bois massif résineux C24", 4.2], ["A.3 Bois et dérivés", "Bois massif résineux C16", 3.7], ["A.3 Bois et dérivés", "Contreplaqué de résineux", 5.0], ["A.3 Bois et dérivés", "Panneau de particules", [7, 8]], ["A.3 Bois et dérivés", "Panneau OSB", 7.0],
    ["A.4 Métaux", "Acier", [77, 78.5]], ["A.4 Métaux", "Aluminium", 27], ["A.4 Métaux", "Cuivre", [87, 89]], ["A.4 Métaux", "Fonte", [71, 72.5]], ["A.4 Métaux", "Plomb", [112, 114]], ["A.4 Métaux", "Zinc", [71, 72]], ["A.4 Métaux", "Laiton", [83, 85]],
    ["A.5 Autres matériaux", "Verre en feuilles", 25], ["A.5 Autres matériaux", "Verre armé", 26],
    ["A.7 Matériaux de construction stockés", "Ciment en vrac", 16], ["A.7 Matériaux de construction stockés", "Ciment en sacs", 15], ["A.7 Matériaux de construction stockés", "Sable sec", [15, 16]], ["A.7 Matériaux de construction stockés", "Gravier, granulats", [15, 20]], ["A.7 Matériaux de construction stockés", "Chaux", 13],
    ["A.10 Liquides", "Eau douce", 10.0], ["A.10 Liquides (voir H1 pour la température)", "Hydrocarbures : voir H1 Propriétés des fluides", null],
  ].map(([fam, nom, v], i) => ({ id: "A" + i, fam, nom, v }));
  /* AN 2 (NF P 06-111-2) : à défaut de spécification du projet, valeur médiane des fourchettes des tableaux A.1 à A.12 */
  const medA = (v) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v);
  const valA = (v) => (Array.isArray(v) ? `${fx(v[0], 1)} à ${fx(v[1], 1)} → ${fx(medA(v), 2)} (médiane)` : v == null ? "—" : fx(v, 1));

  /* ---------- charges d'exploitation : NF EN 1991-1-1 + AN ---------- */
  /* [code, libellé, qk (kN/m²), Qk (kN), aire de Qk, ψ0, ψ1, ψ2, référence, à vérifier ?] */
  const CAT_Q = [
    ["A", "A – habitation, résidentiel : planchers", 1.5, 2.0, "50 × 50 mm", 0.7, 0.5, 0.3, "Tab. 6.2(NF)"],
    ["A-esc", "A – escaliers", 2.5, 2.0, "50 × 50 mm", 0.7, 0.5, 0.3, "Tab. 6.2(NF)"],
    ["A-bal", "A – balcons", 3.5, 2.0, "50 × 50 mm", 0.7, 0.5, 0.3, "Tab. 6.2(NF)"],
    ["B", "B – bureaux", 2.5, 4.0, "50 × 50 mm", 0.7, 0.5, 0.3, "Tab. 6.2(NF)"],
    ["C1", "C1 – lieux de réunion avec tables (écoles, cafés, restaurants…)", 2.5, 3.0, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["C2", "C2 – lieux de réunion avec sièges fixes", 4.0, 4.0, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["C3", "C3 – locaux sans obstacle à la circulation (halls, salles d'exposition…)", 4.0, 4.0, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["C4", "C4 – activités physiques (salles de danse, gymnases…)", 5.0, 7.0, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["C5", "C5 – foules importantes (salles de concert, tribunes…)", 5.0, 4.5, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["D1", "D1 – commerces de détail courants", 5.0, 5.0, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["D2", "D2 – grands magasins", 5.0, 7.0, "50 × 50 mm", 0.7, 0.7, 0.6, "Tab. 6.2(NF)"],
    ["E1", "E1 – stockage (accumulation de marchandises)", 7.5, 7.0, "50 × 50 mm", 1.0, 0.9, 0.8, "Tab. 6.4 ; §6.3.2"],
    ["E2", "E2 – usage industriel (valeur du projet)", null, null, "projet", 1.0, 0.9, 0.8, "§6.3.2.3 : charges définies par le projet (process, équipements, chariots)"],
    ["F", "F – circulation et stationnement, véhicules ≤ 30 kN", 2.3, 15, "2 × 100 × 100 mm", 0.7, 0.7, 0.6, "Tab. 6.8(NF) – effets dynamiques couverts jusqu'à 20 km/h ; αA, αn applicables"],
    ["G", "G – circulation et stationnement, véhicules 30 à 160 kN", 5.0, 90, "2 × 200 × 200 mm", 0.7, 0.5, 0.3, "Tab. 6.8(NF) – effets dynamiques couverts jusqu'à 10 km/h ; véhicules lourds à spécifier pour le projet (AN 1.1(5))"],
    ["PASS", "Passerelle, plate-forme industrielle (NF EN ISO 14122-2)", 2.0, 1.5, "200 × 200 mm", 0.7, 0.7, 0.6, "NF EN ISO 14122-2 §4.2 (minimum ; à majorer selon l'exploitation) ; passerelles industrielles hors machines : NF E 85-014 (non intégrée, valeurs à vérifier) ; ψ assimilés à C"],
    ["ESC-I", "Escalier et palier industriels – NF E 85-015", 2.0, 1.0, "100 × 100 mm", 0.7, 0.7, 0.6, "NF E 85-015 §5.1.2.1 ; marches : 1,5 kN sur 100 × 100 mm (§5.1.2.2) ; flèche du limon ≤ L/300 ; ψ assimilés à C"],
    ["ESC-I1", "Escalier industriel d'accès occasionnel, une seule personne de front – NF E 85-015", 1.5, 1.0, "100 × 100 mm", 0.7, 0.7, 0.6, "NF E 85-015 §5.1.2.1 (valeurs réduites) ; marches §5.1.2.2 ; ψ assimilés à C"],
    ["H-et", "H – toiture inaccessible sauf entretien, pente < 15 % avec étanchéité", 0.8, 1.5, "sur 10 m² (q) ; 50 × 50 mm (Q)", 0, 0, 0, "Tab. 6.10(NF) ; q et Q non simultanés ; non cumulée avec neige et vent (AN)"],
    ["H", "H – autre toiture inaccessible sauf entretien", 0, 1.5, "50 × 50 mm", 0, 0, 0, "Tab. 6.10(NF) ; non cumulée avec neige et vent (AN)"],
    ["ND", "Catégorie non spécifiée (utilisation future inconnue) → D1", 5.0, 5.0, "50 × 50 mm", 0.7, 0.7, 0.6, "AN §6.3.1.2(1) : valeurs de D1 ; vérifier la compatibilité une fois l'usage connu"],
    ["I-pays", "I – toiture accessible avec aménagement paysager", 3.0, null, "projet", 0.7, 0.7, 0.6, "AN §6.3.4.1 : minimum recommandé 3 kN/m² (Qk selon l'usage)"],
    ["perso", "Valeur du projet (cahier des charges)", null, null, "projet", 0.7, 0.7, 0.6, "Cahier des charges du maître d'ouvrage"],
  ].map(([c, n, qk, Qk, aire, p0, p1, p2, ref, verif]) => ({ c, n, qk, Qk, aire, psi: [p0, p1, p2], ref, verif: !!verif }));
  /* charges horizontales sur garde-corps et parois : Tab. 6.12(NF) ; industrie NF E 85-015 §7.3.2 (vérifié) ; machines spéciales NF EN ISO 14122-3 §8.2.2 (vérifié) */
  const GARDE_CORPS = [
    ["A", "Catégorie A (habitation)", 0.6, "Tab. 6.12(NF)"], ["B", "Catégories B et C1", 0.6, "Tab. 6.12(NF)"], ["C", "Catégories C2 à C4 et D", 1.0, "Tab. 6.12(NF)"], ["C5", "Catégorie C5 (foules)", 3.0, "Tab. 6.12(NF)"], ["E", "Catégorie E (stockage) – minimum", 2.0, "Tab. 6.12(NF) NOTE 1 : valeur minimale selon la destination"],
    ["P01", "Garde-corps de bâtiment – NF P 01-012 (valeur de la norme à saisir)", null, "NF P 01-012", true],
    ["E85", "Garde-corps industriel – NF E 85-015 (30 daN/m)", 0.3, "NF E 85-015 §7.3.2.1 : Fmin,ser = 300·L N (flèche < 30 mm, résiduelle ≤ 3 mm) ; §7.3.2.2 : Fult = γM1 × 1,5 × Fmin,ser = 1,725 Fmin,ser (γM1 = 1,15 à défaut) ; §7.3.4 (calcul) : flèche ≤ 30 mm sous 1,2 Fmin,ser, comportement élastique sous 1,2 Fult"],
    ["ISO", "Accès aux machines (machine spéciale) – NF EN ISO 14122-3 (30 daN/m)", 0.3, "NF EN ISO 14122-3 §8.2.2 : FU = 300 N/m × L (flèche ≤ 30 mm) ; FS = 1,75 FU = 525 N/m × L"],
    ["perso", "Valeur du projet", null, "Cahier des charges"],
  ].map(([c, n, q, ref, verif]) => ({ c, n, q, ref, verif: !!verif }));
  /* AN §6.3.1.2(10) et (11) : coefficients de réduction (non simultanés, AN §6.2) */
  const ALPHA_A = ["A", "A-esc", "A-bal", "B", "C3", "D1", "F"], ALPHA_N = { A: [0.5, 1.36], "A-esc": [0.5, 1.36], "A-bal": [0.5, 1.36], B: [0.7, 0.8], F: [0.7, 0.8] };
  const alphaA = (cat, A) => (ALPHA_A.includes(cat) && A > 0 ? Math.min(0.77 + 3.5 / A, 1) : 1);
  const alphaN = (cat, n) => (ALPHA_N[cat] && n >= 2 ? Math.min(ALPHA_N[cat][0] + ALPHA_N[cat][1] / n, 1) : 1);
  const CLOISONS = [[0, "aucune"], [0.5, "cloisons ≤ 1,0 kN/m → q = 0,5 kN/m²"], [0.8, "cloisons ≤ 2,0 kN/m → q = 0,8 kN/m²"], [1.2, "cloisons ≤ 3,0 kN/m → q = 1,2 kN/m²"]];

  /* ---------- schémas ---------- */
  const flecheV = (x, y1, y2, c = "#e30009", w = 1.6) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 6}" stroke="${c}" stroke-width="${w}"/><path d="M${x - 4},${y2 - 7} L${x + 4},${y2 - 7} L${x},${y2}z" fill="${c}"/>`;
  function symboles() {
    let s = `<svg viewBox="0 0 640 150" style="width:100%;max-width:640px" font-family="Inter,Arial,sans-serif" font-size="12">`;
    // surfacique
    s += `<g><rect x="20" y="70" width="150" height="40" fill="#cfd8e3" stroke="#171a1e"/><path d="M20,70 L60,40 L210,40 L170,70z" fill="#eef1f5" stroke="#8a929c"/>`;
    for (let i = 0; i < 6; i++) s += flecheV(45 + i * 28, 10, 52 - i * 0, "#e30009", 1.3);
    s += `<text x="95" y="130" text-anchor="middle" font-weight="700">Charge surfacique</text><text x="95" y="145" text-anchor="middle" fill="#5f6670">g, q (kN/m²)</text></g>`;
    // linéique
    s += `<g><line x1="250" y1="80" x2="400" y2="80" stroke="#171a1e" stroke-width="3"/><line x1="250" y1="35" x2="400" y2="35" stroke="#e30009"/>`;
    for (let i = 0; i < 7; i++) s += flecheV(255 + i * 23.5, 35, 78, "#e30009", 1.3);
    s += `<text x="325" y="130" text-anchor="middle" font-weight="700">Charge linéique</text><text x="325" y="145" text-anchor="middle" fill="#5f6670">g, q (kN/m)</text></g>`;
    // ponctuelle
    s += `<g><line x1="460" y1="80" x2="600" y2="80" stroke="#171a1e" stroke-width="3"/>` + flecheV(530, 20, 78, "#e30009", 2.4) + `<text x="540" y="40" fill="#e30009" font-weight="700">G, Q</text>`;
    s += `<text x="530" y="130" text-anchor="middle" font-weight="700">Charge ponctuelle</text><text x="530" y="145" text-anchor="middle" fill="#5f6670">G, Q (kN)</text></g></svg>`;
    return s;
  }
  /* coupe d'un complexe (épaisseurs représentatives, motif par famille) */
  const court = (n) => { const t = n.replace(/ \(.*$/, "").replace(/ – .*$/, ""); return t.length > 34 ? t.slice(0, 33) + "…" : t; };
  function coupeComplexe(P, titre) {
    const L = P.lignes; if (!L.length) return "";
    const W = 640, x0 = 20, w = 300, hMin = 10, hMax = 46;
    const hEp = (l) => { const e = l.m.mode === "vol" ? +l.e : null; return e ? Math.min(hMax, Math.max(hMin, Math.sqrt(e) * 4)) : l.m.fam.startsWith("Ossature") || l.m.fam.startsWith("Divers") ? 0 : hMin; };
    const motif = (fam) => /métallique|Bardage/.test(fam) ? "tole" : /Isolant/.test(fam) ? "iso" : /Étanch/.test(fam) ? "etan" : /béton|Béton|Planchers – structure/.test(fam) ? "beton" : /bois|Bois|Supports/.test(fam) ? "bois" : "uni";
    const vis = L.filter((l) => hEp(l) > 0), hTot = vis.reduce((a, l) => a + hEp(l), 0), H = Math.max(120, hTot + 60);
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px" font-family="Inter,Arial,sans-serif" font-size="11.5"><defs>
      <pattern id="pIso" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0,4 Q4,0 8,4 T16,4" fill="none" stroke="#c59b00" stroke-width="1"/></pattern>
      <pattern id="pBet" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" fill="#6b7480"/><circle cx="6" cy="6" r="0.6" fill="#6b7480"/></pattern>
      <pattern id="pBois" width="10" height="6" patternUnits="userSpaceOnUse"><path d="M0,3 Q5,0 10,3" fill="none" stroke="#9b6b3c"/></pattern></defs>`;
    s += `<text x="${x0}" y="16" font-weight="700" fill="#114088">${esc(titre || "Coupe du complexe")}</text>`;
    let y = 30; const lbl = [];
    vis.forEach((l) => { const h = hEp(l), m = motif(l.m.fam);
      if (m === "tole") { let d = `M${x0},${y + h}`; for (let x = x0; x < x0 + w; x += 30) d += ` L${x + 6},${y + h} L${x + 10},${y + 2} L${x + 20},${y + 2} L${x + 24},${y + h}`; s += `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="#eef1f5"/><path d="${d}" fill="none" stroke="#4a525c" stroke-width="1.4"/>`; }
      else s += `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="${m === "iso" ? "url(#pIso)" : m === "beton" ? "url(#pBet)" : m === "bois" ? "url(#pBois)" : m === "etan" ? "#3a3f46" : "#d9dde3"}" stroke="#4a525c" stroke-width="0.8"/>`;
      lbl.push([y + h / 2, l]); y += h; });
    lbl.forEach(([yy, l], i) => { const ty = 36 + i * ((H - 50) / Math.max(lbl.length, 1)); s += `<line x1="${x0 + w + 4}" y1="${yy}" x2="${x0 + w + 40}" y2="${ty}" stroke="#8a929c" stroke-width=".8"/><text x="${x0 + w + 44}" y="${ty + 4}">${esc(court(l.m.nom))}${l.e !== "" && l.e != null ? ` – ${fx(+l.e, l.e < 2 ? 2 : 0)} mm` : ""} : <tspan font-weight="700">${fx(l.kN * 100, 1)} daN/m²</tspan></text>`; });
    const autres = L.filter((l) => hEp(l) === 0); if (autres.length) s += `<text x="${x0}" y="${H - 8}" fill="#5f6670">+ ${autres.map((l) => `${esc(l.m.nom.replace(/ \(.*$/, ""))} ${fx(l.kN * 100, 1)} daN/m²`).join(" ; ")}</text>`;
    return s + "</svg>";
  }
  /* ---------- charge linéique d'une tuyauterie (kN/m) ---------- */
  /* Tuyauterie (linéique) : q_vide = tube + calorifuge ; q_service = q_vide + fluide (ρ_f) ; q_eau = q_vide + eau (épreuve hydraulique)
     Classement : en service G = q_service ; si ρ_f < ρ_eau, situation d'épreuve hydraulique où l'eau remplace le fluide :
     G = q_vide et Q_ép = eau = q_eau − q_vide (action variable, cas EP de S1) ; sinon l'épreuve est couverte par G. */
  function qTuyau(t) {
    if (t.mode === "saisie" || typeof PIPES === "undefined") { const q = +t.q || 0; return { q, qVide: q, qServ: q, qEau: q, qEp: 0, desc: "valeur saisie" }; }
    const P = PIPES.find((p) => p.dn == t.dn) || PIPES[0], en = P.s[t.sch] ?? Object.values(P.s)[0], m = (typeof MATS !== "undefined" ? MATS.find((x) => x.id === t.mat) : null) || { rho: 7850, id: "acier" };
    const D = P.od, di = D - 2 * en, A = (d) => Math.PI / 4 * d * d * 1e-6, ec = +t.ecal || 0, rf = +t.rhoF || 0;
    const mt = (A(D) - A(di)) * m.rho, mf = A(di) * rf, mw = A(di) * 1000, mi = (A(D + 2 * ec) - A(D)) * (+t.rhoCal || 0);
    const qVide = (mt + mi) * g / 1000, qServ = (mt + mf + mi) * g / 1000, qEau = (mt + mw + mi) * g / 1000, qEp = rf < 1000 ? qEau - qVide : 0;
    const fl = typeof FLUIDS !== "undefined" && t.fluide != null && FLUIDS[+t.fluide] ? FLUIDS[+t.fluide].n.replace(/ \(négligé\)/, "") : "fluide";
    return { q: qServ, qVide, qServ, qEau, qEp, mt, mf, mw, mi, D, en, di, fl, rf, leger: rf < 1000,
      desc: `DN${P.dn} – Ø${fx(D, 1)} × ${fx(en, 2)} (sch ${t.sch}) – ${m.id}${rf ? ` – ${fl} ${fx(rf, 0)} kg/m³` : " – vide / gaz"}${ec ? ` – calorifuge ${ec} mm à ${fx(+t.rhoCal || 0, 0)} kg/m³` : ""}` };
  }
  /* ---------- rendus pour la note d'hypothèses (niveau : simple | classique | complet) ---------- */
  const T = (cols, rows) => `<table><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${rows.join("")}</table>`;
  function noteG(G, niv) {
    if (!G) return "<p><i>Charges permanentes non renseignées (outil G1).</i></p>";
    const cx = (G.complexes || []).filter((c) => c.note !== false), li = (G.lineiques || []).filter((c) => c.note !== false), po = (G.ponctuelles || []).filter((c) => c.note !== false), ma = (G.materiaux || []);
    let h = `<p>Le poids propre des éléments de structure calculés (profilés, platines forfaitaires) est pris en compte automatiquement dans les notes de calcul (masse volumique de l'acier 7 850 kg/m³). Les charges permanentes complémentaires retenues sont les suivantes.</p>`;
    const TYP = { couv: "Couverture", bard: "Bardage", plan: "Plancher", autre: "Charge surfacique" };
    if (cx.length) { h += `<h3>Charges surfaciques (complexes)</h3>`;
      if (niv === "simple") h += `<ul>${cx.map((c) => { const P = poidsComplexe(c); return `<li><b>${esc(c.nom || TYP[c.type])}</b> : g = <b>${fx(P.tot, 2)} kN/m²</b> (${P.lignes.map((l) => esc(l.m.nom.replace(/ \(.*$/, ""))).join(", ")}${P.maj ? `, majoration ${fx(P.maj * 100, 0)} %` : ""}).</li>`; }).join("")}</ul>`;
      else cx.forEach((c) => { const P = poidsComplexe(c);
        h += `<h4>${esc(c.nom || TYP[c.type])} – ${TYP[c.type] || ""}</h4>` + (niv !== "simple" ? coupeComplexe(P, "") : "") +
          T(["Couche", ...(niv === "complet" ? ["Mode", "Valeur", "e (mm)"] : []), "daN/m²"], P.lignes.map((l) => `<tr><td>${esc(l.m.nom)}</td>${niv === "complet" ? `<td>${l.m.mode === "vol" ? "ρ × e" : l.m.mode === "surf" ? "masse surfacique" : "saisie"}</td><td class="n">${l.m.mode === "vol" ? fx(l.m.val, 0) + " kg/m³" : l.m.mode === "surf" ? fx(l.m.val, 1) + " kg/m²" : "—"}</td><td class="n">${l.e !== "" && l.e != null ? fx(+l.e, 2) : "—"}</td>` : ""}<td class="n">${fx(l.kN * 100, 2)}</td></tr>`)
            .concat([`<tr><td>Majoration (recouvrements, fixations) ${fx(P.maj * 100, 1)} %</td>${niv === "complet" ? "<td></td><td></td><td></td>" : ""}<td class="n">${fx(P.majv * 100, 2)}</td></tr>`, `<tr><td><b>Total g</b></td>${niv === "complet" ? "<td></td><td></td><td></td>" : ""}<td class="n"><b>${fx(P.tot * 100, 1)} daN/m² = ${fx(P.tot, 3)} kN/m²</b></td></tr>`]))
          + (niv === "complet" ? `<p class="pied">Mode « ρ × e » : g = ρ·e·g<sub>0</sub> (g<sub>0</sub> = 9,81 m/s²) ; masses volumiques : NF EN 1991-1-1 Annexe A et fiches fabricants (observations du catalogue).</p>` : ""); }); }
    const tu = li.filter((l) => l.type === "tuy"), au = li.filter((l) => l.type !== "tuy");
    if (au.length) { h += `<h3>Charges linéiques</h3>` + (niv === "simple" ? `<ul>${au.map((l) => `<li>${esc(l.nom)} : <b>${fx(l.q, 3)} kN/m</b>${l.detail ? ` (${esc(l.detail)})` : ""}</li>`).join("")}</ul>` :
      T(["Élément", "Nature", "Détail", "g (kN/m)"], au.map((l) => `<tr><td>${esc(l.nom)}</td><td>${esc({ gc: "Garde-corps", autre: "Autre" }[l.type] || "")}</td><td>${esc(l.detail || "")}</td><td class="n"><b>${fx(l.q, 3)}</b></td></tr>`))); }
    if (tu.length) { const R = tu.map((l) => ({ l, r: qTuyau(l) }));
      h += `<h3>Tuyauteries (charges linéiques)</h3>` + (niv === "simple" ? `<ul>${R.map(({ l, r }) => `<li>${esc(l.nom)} (${esc(r.desc)}) : à vide ${fx(r.qVide, 3)} kN/m ; <b>G = ${fx(r.qServ, 3)} kN/m</b> en service${r.qEp > 0 ? ` ; épreuve hydraulique : G = ${fx(r.qVide, 3)} kN/m et eau <b>Q<sub>ép</sub> = ${fx(r.qEp, 3)} kN/m</b> (action variable)` : " ; épreuve à l'eau couverte par G"}.</li>`).join("")}</ul>` :
        T(["Ligne", "Description", "q vide (kN/m)", "Service : G (kN/m)", "Épreuve : G = q vide + Q<sub>ép</sub> eau (kN/m)"], R.map(({ l, r }) => `<tr><td>${esc(l.nom)}</td><td>${esc(r.desc)}</td><td class="n">${fx(r.qVide, 3)}</td><td class="n"><b>${fx(r.qServ, 3)}</b></td><td class="n">${r.qEp > 0 ? `${fx(r.qVide, 3)} + <b>${fx(r.qEp, 3)}</b>` : "— (couverte par G)"}</td></tr>`))
        + `<p class="pied">Classement : le contenu en service est une charge permanente (G = tube + calorifuge + fluide). Lorsque le fluide est moins dense que l'eau (ρ<sub>f</sub> &lt; 1 000 kg/m³ : gaz, vapeur, hydrocarbures légers…), une situation d'épreuve hydraulique est étudiée : l'eau remplace le fluide et est classée en action variable Q<sub>ép</sub> (situation transitoire, NF EN 1990 §3.2 et §4.1.1), soit γ<sub>G</sub>·q<sub>vide</sub> + γ<sub>Q</sub>·Q<sub>ép</sub>, sans cumul avec les autres actions variables. Sinon l'épreuve est couverte par G.</p>`
        + (niv === "complet" ? `<p class="pied">q = g<sub>0</sub>·[π/4·(D² − d<sub>i</sub>²)·ρ<sub>tube</sub> + π/4·((D + 2t<sub>c</sub>)² − D²)·ρ<sub>calo</sub> + π/4·d<sub>i</sub>²·ρ<sub>contenu</sub>] ; D et épaisseur nominale selon ASME B36.10M / B36.19M (base T1), d<sub>i</sub> = D − 2e.</p>` : "")); }
    if (po.length) { h += `<h3>Charges ponctuelles (équipements)</h3>` + (niv === "simple" ? `<ul>${po.map((p) => `<li>${esc(p.nom)} : ${fx(p.mServ * g / 1000, 2)} kN en service sur ${p.n} appui(s), soit <b>${fx(p.mServ * g / 1000 / Math.max(p.n, 1), 2)} kN par appui</b></li>`).join("")}</ul>` :
      T(["Équipement", "Masse à vide (kg)", "Masse en service (kg)", "Appuis", "G à vide / appui (kN)", "G en service / appui (kN)"], po.map((p) => `<tr><td>${esc(p.nom)}${p.obs ? `<br><span class="pied">${esc(p.obs)}</span>` : ""}</td><td class="n">${fx(p.mVide, 0)}</td><td class="n">${fx(p.mServ, 0)}</td><td class="n">${p.n}</td><td class="n">${fx(p.mVide * g / 1000 / Math.max(p.n, 1), 2)}</td><td class="n"><b>${fx(p.mServ * g / 1000 / Math.max(p.n, 1), 2)}</b></td></tr>`))
      + (niv === "complet" ? `<p class="pied">G = m·g<sub>0</sub>/n (répartition égale sur les appuis, à affiner selon la position du centre de gravité et le plan d'implantation du fabricant). Le contenu en service est une charge permanente si son niveau est stable, sinon une charge variable (à préciser).</p>` : "")); }
    if (ma.length) { const L = ANNEXE_A.filter((a) => ma.includes(a.id)); h += `<h3>Poids volumiques retenus</h3>` + (niv === "simple" ? `<p>${L.map((a) => `${esc(a.nom)} : ${valA(a.v)} kN/m³`).join(" ; ")} (NF EN 1991-1-1 Annexe A).</p>` : T(["Matériau", "Famille (Annexe A)", "γ (kN/m³)"], L.map((a) => `<tr><td>${esc(a.nom)}</td><td>${esc(a.fam)}</td><td class="n">${valA(a.v)}</td></tr>`))); }
    if (niv !== "simple") h += `<h3>Symboles</h3>${symboles()}`;
    return h;
  }
  function noteQ(Q, niv) {
    if (!Q) return "<p><i>Charges d'exploitation non renseignées (outil Q1).</i></p>";
    const z = (Q.zones || []).filter((c) => c.note !== false), gc = (Q.gardecorps || []).filter((c) => c.note !== false).map((g) => (g.cat === "E85" ? { ...g, cat: "ISO", q: g.q ?? 0.3 } : g));   // E85 : fusionnée avec ISO en 2.41
    let h = `<p>Charges d'exploitation selon la NF EN 1991-1-1 et son annexe nationale (NF EN 1991-1-1/NA)${z.some((x) => x.cat === "PASS") ? " et la NF EN ISO 14122 pour les accès industriels" : ""}. Les charges concentrées Q<sub>k</sub> ne se cumulent pas avec les charges réparties q<sub>k</sub> (§6.3.1.2(5)) ; elles servent aux vérifications locales.</p>`;
    if (z.length) { h += `<h3>Charges réparties et concentrées</h3>`;
      if (niv === "simple") h += `<ul>${z.map((x) => { const c = CAT_Q.find((k) => k.c === x.cat) || {}; const aA = alphaA(x.cat, +x.A); return `<li><b>${esc(x.nom)}</b> (${esc(c.n || x.cat)}) : q<sub>k</sub> = <b>${fx(+x.qk + (+x.cl || 0), 2)} kN/m²</b>${+x.cl ? ` dont cloisons ${fx(+x.cl, 1)}` : ""}${aA < 1 ? ` (α<sub>A</sub> = ${fx(aA, 3)} pour A = ${fx(+x.A, 1)} m² : ${fx(aA * x.qk, 2)} kN/m²)` : ""} ; Q<sub>k</sub> = ${fx(+x.Qk, 1)} kN (${esc(c.aire || "")}) ; ψ<sub>0</sub>/ψ<sub>1</sub>/ψ<sub>2</sub> = ${(c.psi || []).map((v) => fx(v, 1)).join(" / ")}.</li>`; }).join("")}</ul>`;
      else h += T(["Zone", "Catégorie", "q<sub>k</sub> (kN/m²)", "Cloisons (kN/m²)", "Q<sub>k</sub> (kN)", "Aire de Q<sub>k</sub>", "ψ<sub>0</sub> / ψ<sub>1</sub> / ψ<sub>2</sub>", "Référence"], z.map((x) => { const c = CAT_Q.find((k) => k.c === x.cat) || {}, aA = alphaA(x.cat, +x.A);
          return `<tr><td>${esc(x.nom)}</td><td>${esc(c.n || x.cat)}</td><td class="n"><b>${fx(+x.qk, 2)}</b>${aA < 1 ? `<br><span class="pied">α<sub>A</sub> = ${fx(aA, 3)} (A = ${fx(+x.A, 1)} m²) → ${fx(aA * x.qk, 2)}</span>` : ""}</td><td class="n">${+x.cl ? fx(+x.cl, 1) : "—"}</td><td class="n"><b>${fx(+x.Qk, 1)}</b></td><td>${esc(c.aire || "")}</td><td>${(c.psi || []).map((v) => fx(v, 1)).join(" / ")}</td><td class="pied">${esc(c.ref || "")}${c.verif ? " – valeur à vérifier sur l'AN" : ""}</td></tr>`; }))
          + (niv === "complet" ? `<p class="pied">Cloisons mobiles (§6.3.1.2(8)) : poids propre ≤ 1,0 / 2,0 / 3,0 kN/m → charge uniforme équivalente 0,5 / 0,8 / 1,2 kN/m². Coefficients de réduction (AN, non simultanés) : surface α<sub>A</sub> = 0,77 + A<sub>0</sub>/A ≤ 1,0, A<sub>0</sub> = 3,5 m², catégories A, B, C3, D1, F seulement (AN §6.3.1.2(10)) ; nombre d'étages n &gt; 2 : α<sub>n</sub> = 0,5 + 1,36/n (A), 0,7 + 0,8/n (B, F) (AN §6.3.1.2(11)). α<sub>A</sub> appliqué uniquement aux zones dont l'aire est renseignée. Coefficients ψ : NF EN 1990 Tab. A1.1 + AN.</p>` : "")
          + (niv !== "simple" ? schemaQ() : ""); }
    if (gc.length) { h += `<h3>Charges horizontales sur garde-corps et parois</h3>` + (niv === "simple" ? `<ul>${gc.map((x) => `<li>${esc(x.nom)} : <b>${fx(+x.q, 2)} kN/m</b> à la hauteur de la main courante (${esc((GARDE_CORPS.find((k) => k.c === x.cat) || {}).n || "")})</li>`).join("")}</ul>` :
      T(["Garde-corps / paroi", "Catégorie", "q<sub>k</sub> (kN/m)", "Référence"], gc.map((x) => `<tr><td>${esc(x.nom)}</td><td>${esc((GARDE_CORPS.find((k) => k.c === x.cat) || {}).n || "")}</td><td class="n"><b>${fx(+x.q, 2)}</b></td><td class="pied">${esc((GARDE_CORPS.find((k) => k.c === x.cat) || {}).ref || "")}${(GARDE_CORPS.find((k) => k.c === x.cat) || {}).verif ? " – valeur à saisir selon la norme" : ""}</td></tr>`))); }
    return h;
  }
  /* tableau de référence : valeurs surfaciques q_k (kN/m²), ponctuelles Q_k (kN) et linéiques des garde-corps (kN/m) */
  function tableRefQ() {
    const v = (x, d) => (x == null ? "projet" : fx(x, d));
    return `<table class="bd"><tr><th>Catégorie</th><th class="n">q<sub>k</sub> surfacique (kN/m²)</th><th class="n">Q<sub>k</sub> ponctuelle (kN)</th><th>Surface d'application de Q<sub>k</sub></th><th class="n">ψ<sub>0</sub> / ψ<sub>1</sub> / ψ<sub>2</sub></th><th>Référence</th></tr>` +
      CAT_Q.filter((c) => c.c !== "perso").map((c) => `<tr><td>${esc(c.n)}</td><td class="n"><b>${v(c.qk, 1)}</b></td><td class="n"><b>${v(c.Qk, 1)}</b></td><td>${esc(c.aire)}</td><td class="n">${c.psi.map((p) => fx(p, 1)).join(" / ")}</td><td class="pied">${esc(c.ref)}</td></tr>`).join("") + `</table>
      <p class="pied">q<sub>k</sub> et Q<sub>k</sub> ne sont pas simultanés (§6.3.1.2(5)) : q<sub>k</sub> pour les effets d'ensemble (poutres, poteaux, fondations), Q<sub>k</sub> pour les effets locaux (platelage, caillebotis, solives), à la position la plus défavorable. Cloisons mobiles (§6.3.1.2(8)) : + 0,5 / 0,8 / 1,2 kN/m² (poids propre ≤ 1 / 2 / 3 kN/m). Réduction α<sub>A</sub> = 0,77 + 3,5/A ≤ 1 (A, B, C3, D1, F ; AN §6.3.1.2(10)).</p>
      <h3>Charges linéiques horizontales sur garde-corps et parois</h3><table class="bd"><tr><th>Usage</th><th class="n">q<sub>k</sub> (kN/m)</th><th>Référence</th></tr>` +
      GARDE_CORPS.filter((c) => c.c !== "perso").map((c) => `<tr><td>${esc(c.n)}</td><td class="n"><b>${c.q == null ? "norme" : fx(c.q, 2)}</b></td><td class="pied">${esc(c.ref)}${c.verif ? " – à saisir selon le texte" : ""}</td></tr>`).join("") + `</table><p class="pied">Appliquée à la hauteur de la main courante, sans dépasser 1,20 m (§6.4).</p>`;
  }
  function schemaQ() {
    let s = `<svg viewBox="0 0 640 140" style="width:100%;max-width:640px" font-family="Inter,Arial,sans-serif" font-size="12"><path d="M30,100 L250,100 L300,60 L80,60z" fill="#eef1f5" stroke="#4a525c"/>`;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) s += flecheV(70 + i * 28 + j * 22, 12, 72 + j * 18 - j * 0, "#0098db", 1.1);
    s += `<text x="165" y="125" text-anchor="middle" font-weight="700">q<tspan font-size="9" dy="3">k</tspan><tspan dy="-3"> réparti sur la zone (kN/m²)</tspan></text>`;
    s += `<path d="M350,100 L570,100 L620,60 L400,60z" fill="#eef1f5" stroke="#4a525c"/><rect x="478" y="74" width="16" height="10" fill="#e30009" opacity=".6"/>` + flecheV(486, 10, 76, "#e30009", 2.4);
    s += `<text x="498" y="30" fill="#e30009" font-weight="700">Q<tspan font-size="9" dy="3">k</tspan></text><text x="485" y="125" text-anchor="middle" font-weight="700">Q<tspan font-size="9" dy="3">k</tspan><tspan dy="-3"> concentrée, position la plus défavorable (non cumulée)</tspan></text></svg>`;
    return s;
  }
  return { lire, ecrire, catalogue, DEFAUTS_CPX, poidsComplexe, ANNEXE_A, valA, medA, CAT_Q, tableRefQ, alphaA, alphaN, ALPHA_A, GARDE_CORPS, CLOISONS, symboles, coupeComplexe, schemaQ, qTuyau, noteG, noteQ, fx, esc, g, PLANCHERS };
})();
