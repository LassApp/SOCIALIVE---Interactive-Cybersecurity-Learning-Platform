/**
 * tesseract.js
 * -----------------------------------------------------------------------
 * Geometria PURA (nessun DOM) del "dato" dello scenario "Viaggio dei dati":
 * un tesseratto, cioè l'ipercubo a 4 dimensioni, che ruota su sé stesso. È
 * la forma scelta al posto dell'anello a 4 archi — più "digitale" — e
 * separata dal renderer per lo stesso motivo di packetRoute.js: ingressi e
 * uscite chiari, ragionabile senza il browser.
 *
 * LE 4 PARTI SONO I 4 ASSI — un tesseratto ha 16 vertici (±1 su 4
 * coordinate) e 32 spigoli, ciascuno parallelo a uno dei 4 assi (x, y, z,
 * w): 8 spigoli per asse. La divisione in 4 pacchetti è quindi naturale,
 * non disegnata a mano: ogni pacchetto è il "fascio" di 8 spigoli di un
 * asse. Gli assi non hanno un ordine proprio: l'ordine 1..4 è quello dei
 * numeri d'ordine dei pacchetti (asse x = pacchetto 1, … asse w = 4).
 *
 * PROIEZIONE — 4D → 3D con prospettiva sulla coordinata w (un vertice con
 * w maggiore si avvicina e ingrandisce: è ciò che dà l'effetto del cubo
 * "dentro il cubo" che si rovescia), poi rotazione 3D (attorno a Y e a X)
 * e prospettiva verso lo schermo. Le due rotazioni 4D sono nei piani XW e
 * ZW (a1, a2); ay/ax sono le rotazioni 3D. Una "posa" è { ay, ax, a1, a2 }.
 *
 * POSA CANONICA — quella di riposo, in cui la divisione e la ricomposizione
 * avvengono sempre alla stessa inquadratura: prima che il dato si apra, la
 * posa di rotazione libera viene portata alla canonica (settlePose) per il
 * più breve percorso in avanti, così le posizioni dei 4 pacchetti nel
 * ventaglio non dipendono da quando il docente ha premuto "Prosegui".
 */

const TAU = Math.PI * 2;

/** I 4 assi del tesseratto = le 4 parti = i 4 pacchetti. */
export const TESSERACT_AXES = 4;

export const CANONICAL_POSE = Object.freeze({ ay: 0.5, ax: -0.38, a1: 0.7, a2: 0.4 });

/** 16 vertici (±1)^4: il bit k dell'indice dice il segno della coordinata k. */
export const TESSERACT_VERTICES = Array.from({ length: 16 }, (_, i) => [
  i & 1 ? 1 : -1,
  i & 2 ? 1 : -1,
  i & 4 ? 1 : -1,
  i & 8 ? 1 : -1,
]);

/** 32 spigoli: coppie di vertici che differiscono in UNA coordinata (l'"asse" dello spigolo). */
export const TESSERACT_EDGES = (() => {
  const edges = [];
  for (let axis = 0; axis < TESSERACT_AXES; axis += 1) {
    const bit = 1 << axis;
    for (let i = 0; i < 16; i += 1) {
      if (!(i & bit)) edges.push({ a: i, b: i | bit, axis });
    }
  }
  return edges;
})();

/**
 * Posa di rotazione libera "a riposo": parte dalla canonica e ruota in
 * modo continuo (velocità in rad/s: Y 0,55 · XW 0,45 · ZW 0,30) con un
 * leggero beccheggio. A ms = 0 coincide con la posa canonica.
 * @param {number} ms millisecondi trascorsi dall'inizio della rotazione
 */
export function idlePose(ms) {
  const s = ms / 1000;
  return {
    ay: CANONICAL_POSE.ay + 0.55 * s,
    ax: CANONICAL_POSE.ax + 0.07 * Math.sin(ms / 1100),
    a1: CANONICAL_POSE.a1 + 0.45 * s,
    a2: CANONICAL_POSE.a2 + 0.3 * s,
  };
}

/**
 * Porta una posa qualunque alla canonica, per t01 da 0 a 1. Gli angoli
 * che crescono senza limite (ay, a1, a2) vanno al prossimo multiplo di 2π
 * sopra la canonica — mai all'indietro, per non invertire il senso di
 * rotazione —, il beccheggio ax torna direttamente al valore canonico.
 */
export function settlePose(from, t01) {
  const wrapTo = (value, base) => value + (base + TAU * Math.ceil((value - base) / TAU) - value) * t01;
  return {
    ay: wrapTo(from.ay, CANONICAL_POSE.ay),
    ax: from.ax + (CANONICAL_POSE.ax - from.ax) * t01,
    a1: wrapTo(from.a1, CANONICAL_POSE.a1),
    a2: wrapTo(from.a2, CANONICAL_POSE.a2),
  };
}

/**
 * Proietta il tesseratto sullo schermo.
 * @param {{ay:number, ax:number, a1:number, a2:number}} pose
 * @param {{ center:{x:number,y:number}, radius:number, hyperDistance:number, focal:number, cameraZ:number }} view
 *   radius: raggio (px) del cubo; hyperDistance: distanza della "camera 4D"
 *   (più è piccola, più la deformazione prospettica in w è marcata);
 *   focal/cameraZ: prospettiva 3D → 2D.
 * @returns {{ points: Array<{x:number,y:number,z:number}>, centres: Array<{x:number,y:number}> }}
 *   points: i 16 vertici proiettati (z = profondità, minore = più vicino);
 *   centres: baricentro schermo di ciascuna delle 4 parti (punto medio
 *   degli spigoli del proprio asse). Per simmetria i 4 baricentri cadono
 *   (quasi) sul centro del dato: sono il perno di spostamento e riduzione
 *   delle parti, che si distinguono per la DIREZIONE in cui si allontanano.
 */
export function projectTesseract(pose, view) {
  const cosY = Math.cos(pose.ay);
  const sinY = Math.sin(pose.ay);
  const cosX = Math.cos(pose.ax);
  const sinX = Math.sin(pose.ax);
  const cos1 = Math.cos(pose.a1);
  const sin1 = Math.sin(pose.a1);
  const cos2 = Math.cos(pose.a2);
  const sin2 = Math.sin(pose.a2);

  const points = TESSERACT_VERTICES.map(([x, y, z, w]) => {
    // rotazioni 4D nei piani XW e ZW
    const x1 = x * cos1 - w * sin1;
    const w1 = x * sin1 + w * cos1;
    const z1 = z * cos2 - w1 * sin2;
    const w2 = z * sin2 + w1 * cos2;
    // 4D → 3D: prospettiva su w
    const k = (view.hyperDistance / (view.hyperDistance - w2)) * view.radius;
    const px = x1 * k;
    const py = y * k;
    const pz = z1 * k;
    // rotazioni 3D (Y, poi X)
    const rx = px * cosY + pz * sinY;
    const rz = -px * sinY + pz * cosY;
    const ry = py * cosX - rz * sinX;
    const rz2 = py * sinX + rz * cosX;
    // 3D → 2D
    const scale = view.focal / (rz2 + view.cameraZ);
    return { x: view.center.x + rx * scale, y: view.center.y - ry * scale, z: rz2 };
  });

  const sums = Array.from({ length: TESSERACT_AXES }, () => ({ x: 0, y: 0, n: 0 }));
  TESSERACT_EDGES.forEach((edge) => {
    const sum = sums[edge.axis];
    sum.x += (points[edge.a].x + points[edge.b].x) / 2;
    sum.y += (points[edge.a].y + points[edge.b].y) / 2;
    sum.n += 1;
  });
  const centres = sums.map((sum) => ({ x: sum.x / sum.n, y: sum.y / sum.n }));

  return { points, centres };
}
