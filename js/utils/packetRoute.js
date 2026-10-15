/**
 * packetRoute.js
 * -----------------------------------------------------------------------
 * Logica PURA (nessun DOM) dello scenario "Viaggio dei dati" (type
 * "packet-journey"): geometria dei percorsi, linea temporale di ogni
 * pacchetto e validazione dei dati JSON. Separata dal renderer per lo
 * stesso motivo già seguito con tokenProbability.js/tokenText.js: un
 * pezzo di logica con ingressi e uscite chiari, che non ha bisogno del
 * browser per essere ragionato.
 *
 * LINEA TEMPORALE — ogni pacchetto percorre la propria polilinea a
 * velocità costante (px del viewBox al secondo, campo "speed" del JSON) e
 * si ferma una breve sosta in ogni nodo INTERMEDIO (smistamento). Il
 * tempo di arrivo non è scritto nei dati: deriva da lunghezza del
 * percorso, velocità, sosta e istante di partenza. L'ORDINE di arrivo
 * risultante deve differire da quello di partenza — è lo scopo didattico
 * della scena, quindi validatePacketNetwork() lo verifica.
 *
 * CORSIE PARALLELE — più percorsi condividono dei collegamenti (tutti
 * passano dal primo nodo). Disegnarli sulla stessa linea ne
 * nasconderebbe tutti tranne l'ultimo: ogni pacchetto percorre invece
 * una corsia affiancata (offsetPolyline), a distanza costante dalla
 * linea "geometrica" del collegamento.
 */

/** Il layout (anello a quadranti + ventaglio) è disegnato per 4 pacchetti. */
export const PACKET_COUNT = 4;

/** Colori ammessi nei dati: nome di token --sl-color-<nome>-500, mai CSS libero. */
export const PACKET_COLORS = ["primary", "success", "warning", "error", "info"];

const NODE_ROLES = ["start", "gateway", "hop", "end"];

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

/** Avanzamento normalizzato 0..1 di "now" dentro la finestra [start, start+duration]. */
export function progress(now, start, duration) {
  return clamp((now - start) / duration);
}

/**
 * Easing standard del Design System: cubic-bezier(0.4, 0, 0.2, 1), la
 * stessa curva di --sl-ease-standard (motion.css). Risolta con Newton
 * sulla coordinata x della curva.
 */
export function easeStandard(t) {
  const x1 = 0.4;
  const y1 = 0;
  const x2 = 0.2;
  const y2 = 1;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let s = t;
  for (let i = 0; i < 8; i += 1) {
    const x = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s - t;
    const dx = 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    s -= x / dx;
  }
  s = clamp(s);
  return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
}

/** Punto di una curva di Bézier quadratica a parametro u (0..1). */
export function quadraticPoint(from, control, to, u) {
  const m = 1 - u;
  return {
    x: m * m * from.x + 2 * m * u * control.x + u * u * to.x,
    y: m * m * from.y + 2 * m * u * control.y + u * u * to.y,
  };
}

function direction(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return { x: dx / length, y: dy / length };
}

function leftNormal(u) {
  return { x: u.y, y: -u.x };
}

/**
 * Polilinea affiancata a distanza "offset" (con segno) dall'originale.
 * Ai vertici interni usa una giunzione a spigolo (mitre) limitata a 2×,
 * così le curve strette non producono punte lunghe.
 * @param {Array<{x:number,y:number}>} points almeno 2 punti distinti consecutivi
 * @param {number} offset
 */
export function offsetPolyline(points, offset) {
  const last = points.length - 1;
  return points.map((point, i) => {
    let normal;
    let scale = 1;
    if (i === 0) {
      normal = leftNormal(direction(points[0], points[1]));
    } else if (i === last) {
      normal = leftNormal(direction(points[last - 1], points[last]));
    } else {
      const n1 = leftNormal(direction(points[i - 1], point));
      const n2 = leftNormal(direction(point, points[i + 1]));
      const sum = { x: n1.x + n2.x, y: n1.y + n2.y };
      const sumLength = Math.hypot(sum.x, sum.y) || 1;
      normal = { x: sum.x / sumLength, y: sum.y / sumLength };
      scale = 1 / Math.max(normal.x * n1.x + normal.y * n1.y, 0.5);
    }
    return { x: point.x + normal.x * offset * scale, y: point.y + normal.y * offset * scale };
  });
}

/**
 * Linea temporale di un percorso: tratti "move" a velocità costante e
 * "dwell" (sosta) nei nodi intermedi. Tempi in ms dalla partenza.
 * @param {Array<{x:number,y:number}>} points punti del percorso (già affiancato)
 * @param {number} speed px del viewBox al secondo
 * @param {number} dwellMs sosta in ogni nodo intermedio
 * @returns {{ segments: object[], arrivals: Array<{pointIndex:number,t:number}>, totalMs: number, length: number }}
 */
export function buildTimeline(points, speed, dwellMs) {
  const segments = [];
  const arrivals = [];
  let t = 0;
  let distance = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const duration = (length / speed) * 1000;
    segments.push({ type: "move", t0: t, t1: t + duration, a, b, d0: distance, d1: distance + length });
    t += duration;
    distance += length;
    arrivals.push({ pointIndex: i + 1, t });
    if (i < points.length - 2) {
      segments.push({ type: "dwell", t0: t, t1: t + dwellMs, at: b, d0: distance });
      t += dwellMs;
    }
  }
  return { segments, arrivals, totalMs: t, length: distance };
}

/**
 * Posizione e distanza percorsa all'istante "t" (ms dalla partenza).
 * Prima della partenza restituisce il punto iniziale, dopo l'arrivo
 * quello finale.
 */
export function sampleTimeline(timeline, t) {
  const { segments } = timeline;
  if (t <= 0) return { x: segments[0].a.x, y: segments[0].a.y, distance: 0 };
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (t <= seg.t1) {
      const p = seg.t1 > seg.t0 ? (t - seg.t0) / (seg.t1 - seg.t0) : 1;
      if (seg.type === "move") {
        return { x: lerp(seg.a.x, seg.b.x, p), y: lerp(seg.a.y, seg.b.y, p), distance: lerp(seg.d0, seg.d1, p) };
      }
      return { x: seg.at.x, y: seg.at.y, distance: seg.d0 };
    }
  }
  const lastSeg = segments[segments.length - 1];
  return { x: lastSeg.b.x, y: lastSeg.b.y, distance: timeline.length };
}

/**
 * Rango di arrivo (0 = primo arrivato) per ciascun pacchetto, a partire
 * dagli istanti assoluti di arrivo (stesso ordine dell'array in ingresso).
 */
export function computeArrivalRanks(arrivalTimes) {
  const ranks = new Array(arrivalTimes.length);
  arrivalTimes
    .map((time, index) => ({ time, index }))
    .sort((x, y) => x.time - y.time)
    .forEach((entry, rank) => {
      ranks[entry.index] = rank;
    });
  return ranks;
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Valida i dati di network.json. Restituisce l'elenco degli errori (vuoto
 * se tutto è coerente): il renderer li scrive in console e mostra il
 * fallback condiviso, invece di animare una rete rotta.
 * @param {object} network contenuto di network.json
 * @returns {string[]}
 */
export function validatePacketNetwork(network) {
  const errors = [];
  if (!network || typeof network !== "object") return ["network.json non è un oggetto."];

  // Testi
  ["packets", "arrivalOrder", "correctOrder", "stage", "stepperAria", "stepCounter"].forEach((key) => {
    if (!isText(network.labels?.[key])) errors.push(`labels.${key} mancante.`);
  });
  ["arrived", "rebuilt"].forEach((key) => {
    if (!isText(network.announcements?.[key])) errors.push(`announcements.${key} mancante.`);
  });
  ["next", "restart"].forEach((key) => {
    if (!isText(network.actions?.[key])) errors.push(`actions.${key} mancante.`);
  });
  if (!isText(network.areaLabel)) errors.push("areaLabel mancante.");
  if (!isText(network.data?.label)) errors.push("data.label mancante.");
  if (!Array.isArray(network.steps) || network.steps.length !== 4) {
    errors.push("steps deve contenere esattamente 4 elementi (stato iniziale + 3 passi).");
  } else {
    network.steps.forEach((step, i) => {
      ["stepper", "title", "text"].forEach((key) => {
        if (!isText(step?.[key])) errors.push(`steps[${i}].${key} mancante.`);
      });
    });
  }
  if (!isNumber(network.timing?.dwellMs) || network.timing.dwellMs < 0) errors.push("timing.dwellMs non valido.");

  // Grafo
  const nodes = Array.isArray(network.nodes) ? network.nodes : [];
  const nodeIds = new Set();
  nodes.forEach((node) => {
    if (!isText(node?.id)) errors.push("Nodo senza id.");
    else if (nodeIds.has(node.id)) errors.push(`Nodo duplicato: ${node.id}.`);
    else nodeIds.add(node.id);
    if (!NODE_ROLES.includes(node?.role)) errors.push(`Nodo ${node?.id}: role non valido.`);
    if (!isNumber(node?.x) || !isNumber(node?.y)) errors.push(`Nodo ${node?.id}: coordinate non valide.`);
  });
  const starts = nodes.filter((n) => n.role === "start");
  const ends = nodes.filter((n) => n.role === "end");
  if (starts.length !== 1) errors.push("Serve esattamente un nodo con role \"start\".");
  if (ends.length !== 1) errors.push("Serve esattamente un nodo con role \"end\".");

  const linkSet = new Set();
  (Array.isArray(network.links) ? network.links : []).forEach((link) => {
    if (!Array.isArray(link) || link.length !== 2 || !nodeIds.has(link[0]) || !nodeIds.has(link[1])) {
      errors.push(`Collegamento non valido: ${JSON.stringify(link)}.`);
      return;
    }
    linkSet.add(`${link[0]}|${link[1]}`);
    linkSet.add(`${link[1]}|${link[0]}`);
  });

  // Pacchetti
  const packets = Array.isArray(network.packets) ? network.packets : [];
  if (packets.length !== PACKET_COUNT) {
    errors.push(`Servono esattamente ${PACKET_COUNT} pacchetti (il layout è disegnato per ${PACKET_COUNT}).`);
    return errors;
  }
  const seqs = packets.map((p) => p?.seq).sort();
  if (seqs.join() !== "1,2,3,4") errors.push("I numeri d'ordine (seq) devono essere 1..4, senza duplicati.");

  packets.forEach((packet) => {
    const label = `Pacchetto ${packet?.seq}`;
    if (!PACKET_COLORS.includes(packet?.color)) errors.push(`${label}: color non ammesso.`);
    if (!isNumber(packet?.speed) || packet.speed <= 0) errors.push(`${label}: speed non valida.`);
    if (!isNumber(packet?.departMs) || packet.departMs < 0) errors.push(`${label}: departMs non valido.`);
    const route = packet?.route;
    if (!Array.isArray(route) || route.length < 2) {
      errors.push(`${label}: route non valida.`);
      return;
    }
    if (route[0] !== starts[0]?.id) errors.push(`${label}: il percorso non parte dal nodo di partenza.`);
    if (route[route.length - 1] !== ends[0]?.id) errors.push(`${label}: il percorso non termina nel nodo di arrivo.`);
    for (let i = 0; i < route.length - 1; i += 1) {
      if (!linkSet.has(`${route[i]}|${route[i + 1]}`)) {
        errors.push(`${label}: ${route[i]} → ${route[i + 1]} non è un collegamento.`);
      }
    }
  });

  // Lo scopo didattico: l'ordine di arrivo NON coincide con quello di partenza.
  if (errors.length === 0) {
    const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const ordered = [...packets].sort((a, b) => a.seq - b.seq);
    const arrivals = ordered.map((packet) => {
      const points = packet.route.map((id) => nodeById[id]);
      return packet.departMs + buildTimeline(points, packet.speed, network.timing.dwellMs).totalMs;
    });
    const ranks = computeArrivalRanks(arrivals);
    if (ranks.every((rank, index) => rank === index)) {
      errors.push("L'ordine di arrivo coincide con quello di partenza: la scena perderebbe il suo scopo didattico.");
    }
  }

  return errors;
}
