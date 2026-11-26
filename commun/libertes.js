/* =====================================================================
   LIBERTÉS DES APPUIS DE TUYAUTERIE (S1) — types de supports à la manière de CAESAR II
   Axes locaux du tuyau : Lo = axe de la tuyauterie (X de S1), Tr = transversal horizontal (Y), Vr = vertical (Z).
   État par axe : « libre » ; « bloque » (deux sens) ; « appui » (Vr : support poids, soulèvement libre) ;
   « + » (déplacement +Lo libre, −Lo bloqué : convention CAESAR II de « +LIM ») ; « - » (l'inverse).
   Efforts transmis au support par appui (cas T de S1) :
     - axe libre : frottement μ·G le long de Lo (0 en Tr : déplacement transversal négligé) ;
     - axe bloqué : effort saisi (efforts sur le support issus du calcul de tuyauterie, CAESAR II ou autre) ;
     - butée un sens : l'effort saisi n'est repris que dans le sens bloqué, sinon la tuyauterie glisse (frottement).
   Les valeurs historiques de S1 sont conservées : glissant (+Vr), guide (+Vr GUI), fixe (ANC).
   ===================================================================== */
const LIBERTES = (() => {
  const T = {
    glissant: { code: "+Vr", lib: "Support poids – glissant", Lo: "libre", Tr: "libre", Vr: "appui" },
    bilat: { code: "Vr", lib: "Appui vertical bilatéral (anti-soulèvement) – glissant", Lo: "libre", Tr: "libre", Vr: "bloque" },
    guide: { code: "+Vr GUI", lib: "Guidé (transversal bloqué)", Lo: "libre", Tr: "bloque", Vr: "appui" },
    lim: { code: "+Vr LIM", lib: "Butée axiale (axial bloqué)", Lo: "bloque", Tr: "libre", Vr: "appui" },
    limp: { code: "+Vr +LIM", lib: "Butée axiale un sens (+Lo libre, −Lo bloqué)", Lo: "+", Tr: "libre", Vr: "appui" },
    limm: { code: "+Vr −LIM", lib: "Butée axiale un sens (−Lo libre, +Lo bloqué)", Lo: "-", Tr: "libre", Vr: "appui" },
    guilim: { code: "+Vr GUI LIM", lib: "Guidé + butée axiale", Lo: "bloque", Tr: "bloque", Vr: "appui" },
    fixe: { code: "ANC", lib: "Ancrage (point fixe)", Lo: "bloque", Tr: "bloque", Vr: "bloque" },
  };
  const de = (f) => T[f] || T.glissant;
  /* axe bloqué (dans au moins un sens) : Lo, Tr ou Vr (« appui » = poids seul, non compté) */
  const bloque = (f, ax) => !["libre", "appui"].includes(de(f)[ax]);
  /* efforts [X, Y, Z] (kN) transmis au support ; G : poids sur l'appui (kN) ; F = { x, y, z } efforts saisis sur le support */
  function efforts(f, G, mu, F = {}) {
    const d = de(f), fr = (+mu || 0) * G, Fx = +F.x || 0;
    let x;
    if (d.Lo === "libre") x = fr;
    else if (d.Lo === "+") x = Fx < 0 ? Fx : fr;          // butée vers −Lo : la tuyauterie pousse le support vers −X ; sinon elle glisse vers +X
    else if (d.Lo === "-") x = Fx > 0 ? Fx : -fr;
    else x = Fx;
    return [x, d.Tr === "libre" ? 0 : +F.y || 0, d.Vr === "bloque" ? +F.z || 0 : 0];
  }
  const ETAT = { libre: "libre", bloque: "bloqué", appui: "appui (poids)", "+": "+ libre / − bloqué", "-": "− libre / + bloqué" };
  const txt = (f) => { const d = de(f); return `Lo ${ETAT[d.Lo]} · Tr ${ETAT[d.Tr]} · Vr ${ETAT[d.Vr]}`; };
  const libelle = (f) => `${de(f).code} – ${de(f).lib}`;
  return { T, de, bloque, efforts, txt, libelle };
})();
if (typeof module !== "undefined") module.exports = LIBERTES;
