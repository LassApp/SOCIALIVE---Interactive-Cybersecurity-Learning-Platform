/**
 * packetJourneyRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "packet-journey" (scenario "Viaggio
 * dei dati", area Reti): mostra come un dato viaggia in rete, in 3 passi
 * avanzabili con "Prosegui".
 *
 *   Passo 0 — Il dato è un tesseratto (ipercubo 4D) che ruota su sé stesso.
 *   Passo 1 — Suddivisione: il tesseratto si apre nelle sue 4 parti (una
 *             per asse, 8 spigoli ciascuna), che diventano 4 pacchetti
 *             numerati e si dispongono a ventaglio.
 *   Passo 2 — Instradamento: sulla mappa a nodi ogni pacchetto percorre
 *             una strada diversa (linea colorata) in tempi diversi: gli
 *             arrivi avvengono in un ordine diverso da quello di partenza.
 *   Passo 3 — Ricomposizione: i pacchetti si riordinano per numero e si
 *             fondono di nuovo nelle 4 parti, ricostruendo il tesseratto,
 *             che riprende a ruotare.
 *
 * ANIMAZIONE COME FUNZIONE DEL TEMPO — ogni passo è una funzione pura
 * render(passo, t): dato un istante "t" (ms dall'inizio del passo)
 * imposta TUTTI gli attributi visivi della scena. Un solo ciclo
 * requestAnimationFrame la chiama con il tempo trascorso; niente
 * animazioni CSS né Web Animations per pacchetto. Vantaggi: un solo
 * loop per tutta la scena, ogni frame è deterministico, "movimento
 * ridotto" = chiamare render(passo, durata) una volta sola, interrompere
 * (destroy / Ricomincia) = smettere di chiamarla. Si animano solo
 * transform, opacity e stroke-dashoffset; nessuna lettura di layout nel
 * ciclo (le lunghezze dei percorsi sono calcolate una volta).
 *
 * prefers-reduced-motion: la rete di sicurezza CSS di global.css NON
 * copre animazioni guidate da JavaScript — la preferenza è letta qui,
 * all'avvio di ogni passo: con riduzione attiva il passo salta
 * direttamente al proprio stato finale (nessun movimento) e il
 * tesseratto resta fermo nella posa canonica.
 *
 * ROTAZIONE A RIPOSO — l'unico movimento fuori dai passi: a passo 0 e a
 * passo 3 concluso il tesseratto ruota con un ciclo rAF proprio
 * (startIdle/stopIdle), che si ferma appena parte un passo. Il passo 1
 * parte dalla posa in cui la rotazione si trova (settlePose la porta alla
 * canonica) — nessun salto — e dal passo 1 al passo 3 la posa resta
 * canonica, così ventaglio e ricomposizione hanno sempre la stessa
 * inquadratura. La geometria vive in js/utils/tesseract.js.
 *
 * DATI — nessun contenuto nel codice: nodi, collegamenti, percorsi,
 * velocità, istanti di partenza, colori (nome del token, mai CSS libero),
 * titoli e didascalie arrivano da network.json (dataRefs.network) e sono
 * validati da validatePacketNetwork(). Qui restano solo scelte di resa
 * grafica (geometria del tesseratto, del ventaglio e del vassoio) e di
 * coreografia (durate dei passi).
 *
 * COLORI — nessun accostamento nuovo rispetto a quelli già verificati
 * nel Design System: i 4 colori dei pacchetti sono i token -500 di
 * primary/warning/success/error (graphici ≥ 3:1 su bg-surface, WCAG
 * 1.4.11); il colore non è mai l'unico segnale: ogni pacchetto porta il
 * proprio numero in testo.
 *
 * ACCESSIBILITÀ — didascalia del passo in una regione role="status"; un
 * secondo annuncio nascosto comunica l'esito dei passi 2 (ordine di
 * arrivo) e 3 (dato ricostruito). Il bottone "Prosegui" è disabilitato
 * durante l'animazione (stesso pattern di Tokenizzazione): il focus passa
 * al riquadro della scena e torna su "Prosegui" (o "Ricomincia" alla
 * fine) a passo concluso, solo se l'utente non l'ha spostato altrove.
 *
 * STATO ESPOSTO SULLA RADICE — data-step ("0".."3", ultimo passo
 * completato o in corso) e data-animating ("true"/"false"): unico
 * aggancio stabile per i test, indipendente dai tempi.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement } from "../../utils/dom.js";
import { svgNode } from "../../utils/svg.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { createLocalJsonResource } from "../../repositories/localJsonRepository.js";
import { create as createButton } from "../../components/Button.js";
import { create as createCard } from "../../components/Card.js";
import { create as createBadge } from "../../components/Badge.js";
import { buildSettingsIcon } from "../../utils/settingsIcon.js";
import {
  CANONICAL_POSE,
  TESSERACT_EDGES,
  idlePose,
  settlePose,
  projectTesseract,
} from "../../utils/tesseract.js";
import {
  clamp,
  lerp,
  progress,
  easeStandard as ease,
  quadraticPoint,
  offsetPolyline,
  buildTimeline,
  sampleTimeline,
  computeArrivalRanks,
  validatePacketNetwork,
} from "../../utils/packetRoute.js";

const CLASS = "sl-packet-journey";

// Spazio di coordinate della scena (16:9, pensata per la LIM): i dati di
// network.json (x, y dei nodi) sono espressi in questo stesso sistema.
const VIEW = { width: 1120, height: 630 };

const LAYOUT = {
  // Il dato è un tesseratto (ipercubo 4D) che ruota: 4 parti = 4 assi.
  // radius/hyperDistance/focal/cameraZ: vedi projectTesseract(); detach: di quanti
  // px ogni parte si allontana dal centro quando il dato si apre.
  // Raggio 46: in tutte le pose di rotazione il dato resta tra x 434–686 e y 168–512
  // (misurato su 2 minuti di rotazione), cioè lontano dall'etichetta "Pacchetti", dai
  // pacchetti del ventaglio (y ≤ 146 in alto) e dall'etichetta "Dato" sotto.
  shape: { center: { x: 560, y: 340 }, radius: 46, hyperDistance: 2.4, focal: 620, cameraZ: 620, detach: 74 },
  dataLabelY: 548,
  // Posizioni del ventaglio, in ordine di numero d'ordine (sinistra → destra).
  fan: [
    { x: 310, y: 195 },
    { x: 475, y: 120 },
    { x: 645, y: 120 },
    { x: 810, y: 195 },
  ],
  labelY: 62,
  packetRadius: 26,
  packetHitRadius: 34,
  packetMapScale: 0.62,
  rowY: 160,
  rowGap: 125,
  laneGap: 6,
  tray: { x: 735, y: 522, width: 340, height: 96, slotY: 576, slotsX: [790, 870, 950, 1030] },
  nodeRadius: { hop: 17, start: 20, gateway: 26, end: 24 },
  connectorStart: 80, // distanza dal centro del tesseratto da cui partono i connettori
};

// Coreografia (ms). I tempi di viaggio dei pacchetti NON sono qui: derivano dai dati.
const MOTION = {
  step1: 3300,
  step3: 4500,
  trayMove: 550,
  traySettle: 350,
  pulse: 520,
};

// Direzione di allontanamento di ciascuna parte (gradi, 0° = destra, senso orario
// sullo schermo): in basso a sinistra, in alto a sinistra, in alto a destra, in
// basso a destra — i numeri d'ordine crescono da sinistra a destra anche nel ventaglio.
const PART_DIRECTIONS = [135, 225, 315, 45].map((deg) => ({
  x: Math.cos((deg * Math.PI) / 180),
  y: Math.sin((deg * Math.PI) / 180),
}));

const LAST_STEP = 3;

function colorVar(name) {
  return `var(--sl-color-${name}-500)`;
}

// Icona "ricomincia dall'inizio": freccia circolare a contorno. fill="none" sui
// tratti: button.css riempie gli svg dei bottoni con currentColor e, senza,
// l'arco diventerebbe una macchia piena. Un solo consumer: resta qui (YAGNI).
function buildRefreshIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("path", {
      d: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
    })
  );
  svg.appendChild(
    svgNode("path", {
      d: "M19.8 3.8v4.4h-4.4",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

let instanceCounter = 0; // id univoci: la scena può essere montata più volte nella stessa pagina

function formatTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

function addSvg(parent, tag, attrs = {}) {
  const node = svgNode(tag, attrs);
  parent.appendChild(node);
  return node;
}

/**
 * Prepara i dati derivati: nodi con raggio, pacchetti con percorso
 * affiancato (corsia), linea temporale e rango di arrivo.
 */
function prepareModel(network) {
  const nodes = {};
  network.nodes.forEach((node) => {
    nodes[node.id] = { ...node, r: LAYOUT.nodeRadius[node.role] || LAYOUT.nodeRadius.hop };
  });

  const packets = [...network.packets]
    .sort((a, b) => a.seq - b.seq)
    .map((packet, index) => {
      const lane = (packet.seq - (network.packets.length + 1) / 2) * LAYOUT.laneGap;
      const points = offsetPolyline(
        packet.route.map((id) => nodes[id]),
        lane
      );
      const timeline = buildTimeline(points, packet.speed, network.timing.dwellMs);
      return {
        index,
        seq: packet.seq,
        color: colorVar(packet.color),
        route: packet.route,
        points,
        timeline,
        departMs: packet.departMs,
        arriveMs: packet.departMs + timeline.totalMs,
        rank: 0,
      };
    });

  computeArrivalRanks(packets.map((p) => p.arriveMs)).forEach((rank, i) => {
    packets[i].rank = rank;
  });

  const step2Ms = Math.max(...packets.map((p) => p.arriveMs)) + MOTION.trayMove + MOTION.traySettle;
  return { nodes, packets, durations: [0, MOTION.step1, step2Ms, MOTION.step3] };
}

/**
 * Costruisce la scena SVG a livelli (mappa, dato, anello, pacchetti) e
 * restituisce i riferimenti agli elementi che i fotogrammi aggiornano.
 */
function buildScene(network, model) {
  const svg = svgNode("svg", {
    viewBox: `0 0 ${VIEW.width} ${VIEW.height}`,
    // "group" e non "img": un role="img" renderebbe presentazionali i figli, e i
    // pacchetti del vassoio diventano bottoni (selezione del percorso).
    role: "group",
    focusable: "false",
    "aria-label": network.labels.stage,
    class: `${CLASS}__svg`,
  });

  // --- Mappa (livello più basso) ---
  const mapLayer = addSvg(svg, "g", { "aria-hidden": "true" });
  const gLinks = addSvg(mapLayer, "g");
  const gTrails = addSvg(mapLayer, "g");
  const gNodes = addSvg(mapLayer, "g");
  const gTray = addSvg(mapLayer, "g");
  const gPulses = addSvg(mapLayer, "g");

  network.links.forEach(([from, to]) => {
    const a = model.nodes[from];
    const b = model.nodes[to];
    addSvg(gLinks, "line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `${CLASS}__link` });
  });

  Object.values(model.nodes).forEach((node) => {
    const isKey = node.role !== "hop";
    addSvg(gNodes, "circle", {
      cx: node.x,
      cy: node.y,
      r: node.r,
      class: `${CLASS}__node${isKey ? ` ${CLASS}__node--key` : ""}`,
    });
    addSvg(gNodes, "circle", { cx: node.x, cy: node.y, r: isKey ? 6 : 5, class: `${CLASS}__node-dot` });
    if (node.label) {
      // "Arrivo" sta sopra il nodo (spazio libero in alto a destra), gli altri sotto.
      const y = node.role === "end" ? node.y - node.r - 16 : node.y + node.r + 26;
      const label = addSvg(gNodes, "text", { x: node.x, y, class: `${CLASS}__node-label` });
      label.textContent = node.label;
    }
  });

  // Vassoio di arrivo: i pacchetti si dispongono nell'ordine in cui arrivano.
  const { tray } = LAYOUT;
  addSvg(gTray, "rect", { x: tray.x, y: tray.y, width: tray.width, height: tray.height, rx: 14, class: `${CLASS}__tray` });
  const trayTitle = addSvg(gTray, "text", { x: tray.x + 16, y: tray.y + 24, class: `${CLASS}__tray-title` });
  trayTitle.textContent = network.labels.arrivalOrder;
  const traySlots = [];
  const ordinals = [];
  tray.slotsX.forEach((x, i) => {
    addSvg(gTray, "circle", { cx: x, cy: tray.slotY, r: 17, class: `${CLASS}__tray-slot` });
    const ordinal = addSvg(gTray, "text", { x, y: tray.y + tray.height - 6, class: `${CLASS}__tray-ordinal` });
    ordinal.textContent = `${i + 1}°`;
    traySlots.push({ x, y: tray.slotY });
    ordinals.push(ordinal);
  });

  // Scie e impulsi per pacchetto
  const trails = model.packets.map((packet) => {
    const d = `M${packet.points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L")}`;
    const trail = addSvg(gTrails, "path", { d, class: `${CLASS}__trail` });
    // Colore come variabile, non come stroke inline: le scie non selezionate si
    // "spengono" con una classe CSS (un valore inline batterebbe qualunque regola).
    trail.style.setProperty("--packet-color", packet.color);
    trail.style.strokeDasharray = packet.timeline.length;
    return trail;
  });
  const pulses = model.packets.map((packet) =>
    packet.timeline.arrivals.map((arrival) => {
      const node = model.nodes[packet.route[arrival.pointIndex]];
      const element = addSvg(gPulses, "circle", { cx: node.x, cy: node.y, r: node.r, class: `${CLASS}__pulse` });
      element.style.stroke = packet.color;
      return { element, t: arrival.t, baseRadius: node.r };
    })
  );

  // --- Dato: guida tratteggiata (sagoma del tesseratto), connettori, etichette ---
  const { shape } = LAYOUT;
  const dataLayer = addSvg(svg, "g", { "aria-hidden": "true" });
  // La sagoma sta ferma nella posa canonica: le coordinate si scrivono una volta, i fotogrammi ne cambiano solo l'opacità.
  const canonicalProjection = projectTesseract(CANONICAL_POSE, shape);
  const ghostLines = TESSERACT_EDGES.map((edge) => {
    const a = canonicalProjection.points[edge.a];
    const b = canonicalProjection.points[edge.b];
    return addSvg(dataLayer, "line", {
      x1: a.x.toFixed(1),
      y1: a.y.toFixed(1),
      x2: b.x.toFixed(1),
      y2: b.y.toFixed(1),
      class: `${CLASS}__ghost`,
    });
  });
  // Dove va ciascuna parte quando il dato è aperto (posa canonica): da qui nascono i pacchetti.
  const openAnchors = canonicalProjection.centres.map((centre, k) => ({
    x: centre.x + PART_DIRECTIONS[k].x * shape.detach,
    y: centre.y + PART_DIRECTIONS[k].y * shape.detach,
  }));
  const connectorsLayer = addSvg(dataLayer, "g");
  const connectors = model.packets.map(() => addSvg(connectorsLayer, "line", { class: `${CLASS}__connector` }));
  const makeLabel = (text) => {
    const label = addSvg(dataLayer, "text", { x: shape.center.x, y: LAYOUT.labelY, class: `${CLASS}__label` });
    label.textContent = text;
    return label;
  };
  const labelPackets = makeLabel(network.labels.packets);
  const labelArrival = makeLabel(network.labels.arrivalOrder);
  const labelCorrect = makeLabel(network.labels.correctOrder);

  // --- Il tesseratto: 4 parti (una per asse, 8 spigoli ciascuna) ---
  const shapeLayer = addSvg(svg, "g", { "aria-hidden": "true" });
  const parts = model.packets.map((packet, k) => ({
    group: addSvg(shapeLayer, "g", { class: `${CLASS}__part`, "data-part": k + 1 }),
  }));
  const edges = TESSERACT_EDGES.map((edge) => {
    const line = addSvg(parts[edge.axis].group, "line", { class: `${CLASS}__edge` });
    line.style.stroke = model.packets[edge.axis].color;
    return line;
  });

  const dataLabel = addSvg(shapeLayer, "text", { x: shape.center.x, y: LAYOUT.dataLabelY, class: `${CLASS}__data-label` });
  dataLabel.textContent = network.data.label;
  const checkPoints = [
    { x: shape.center.x + 64, y: LAYOUT.dataLabelY + 2 },
    { x: shape.center.x + 76, y: LAYOUT.dataLabelY + 14 },
    { x: shape.center.x + 98, y: LAYOUT.dataLabelY - 10 },
  ];
  const check = addSvg(shapeLayer, "path", {
    d: `M${checkPoints[0].x} ${checkPoints[0].y} L${checkPoints[1].x} ${checkPoints[1].y} L${checkPoints[2].x} ${checkPoints[2].y}`,
    class: `${CLASS}__check`,
  });
  const checkLength =
    Math.hypot(checkPoints[1].x - checkPoints[0].x, checkPoints[1].y - checkPoints[0].y) +
    Math.hypot(checkPoints[2].x - checkPoints[1].x, checkPoints[2].y - checkPoints[1].y);
  check.style.strokeDasharray = checkLength;
  const burst = addSvg(shapeLayer, "circle", { cx: shape.center.x, cy: shape.center.y, r: 110, class: `${CLASS}__burst` });

  // --- Pacchetti (livello più alto) ---
  const packetLayer = addSvg(svg, "g");
  const packetNodes = model.packets.map((packet) => {
    // Decorativo finché la scena anima; diventa un bottone solo a fine passo 2
    // (vedi syncSelectableTray). L'area di click è più larga del pacchetto
    // rimpicciolito sulla mappa, e l'anello di focus è un elemento SVG vero:
    // outline su un <g> SVG non è reso allo stesso modo da tutti i browser.
    const group = addSvg(packetLayer, "g", { class: `${CLASS}__packet`, "data-seq": packet.seq, "aria-hidden": "true" });
    addSvg(group, "circle", { r: LAYOUT.packetHitRadius, class: `${CLASS}__packet-hit` });
    addSvg(group, "circle", { r: LAYOUT.packetRadius + 6, class: `${CLASS}__packet-focus` });
    const body = addSvg(group, "circle", { r: LAYOUT.packetRadius, class: `${CLASS}__packet-body` });
    body.style.stroke = packet.color;
    const number = addSvg(group, "text", { class: `${CLASS}__packet-number` });
    number.textContent = packet.seq;
    return group;
  });

  return {
    svg,
    mapLayer,
    trails,
    trailsLayer: gTrails,
    pulses,
    traySlots,
    ordinals,
    ghostLines,
    openAnchors,
    connectors,
    labelPackets,
    labelArrival,
    labelCorrect,
    parts,
    edges,
    dataLabel,
    check,
    checkLength,
    burst,
    packetNodes,
  };
}

export async function renderPacketJourney(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.network) {
    console.error(`[packetJourneyRenderer] "dataRefs.network" assente per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let network;
  try {
    network = await createLocalJsonResource({ url: refs.network }).get();
  } catch (error) {
    console.error(`[packetJourneyRenderer] Impossibile caricare i dati di "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  const problems = validatePacketNetwork(network);
  if (problems.length > 0) {
    problems.forEach((problem) => console.error(`[packetJourneyRenderer] ${problem}`));
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  const model = prepareModel(network);
  const scene = buildScene(network, model);

  // ---------------------------------------------------------------------
  // Fotogrammi: ogni passo imposta l'INTERA scena a partire da "t" (ms).
  // ---------------------------------------------------------------------

  function setPacket(index, x, y, scale, opacity) {
    const node = scene.packetNodes[index];
    node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
    node.style.opacity = opacity;
  }

  function placeConnector(index, x, y) {
    // Parte da poco fuori dal tesseratto, in direzione del pacchetto.
    const vx = x - LAYOUT.shape.center.x;
    const vy = y - LAYOUT.shape.center.y;
    const length = Math.hypot(vx, vy) || 1;
    const line = scene.connectors[index];
    line.setAttribute("x1", LAYOUT.shape.center.x + (vx / length) * LAYOUT.connectorStart);
    line.setAttribute("y1", LAYOUT.shape.center.y + (vy / length) * LAYOUT.connectorStart);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
  }

  function setGhost(opacity) {
    scene.ghostLines.forEach((line) => {
      line.style.opacity = opacity;
    });
  }

  const perPart = (fn) => model.packets.map((_, k) => fn(k));

  // Posa corrente del tesseratto: serve a partire da dove la rotazione libera si
  // trova quando il docente preme "Prosegui" (vedi settleFrom).
  let lastPose = CANONICAL_POSE;
  let settleFrom = CANONICAL_POSE;

  /**
   * Disegna il tesseratto: 32 spigoli proiettati nella posa data, poi ogni
   * parte (gruppo di 8 spigoli) viene spostata, rimpicciolita e sfumata.
   * Spostamento e riduzione sono la trasformazione del GRUPPO, non delle
   * coordinate: con spostamento nullo e scala 1 l'attributo transform sparisce.
   * @param {{ay:number,ax:number,a1:number,a2:number}} pose
   * @param {number} explode 0 = dato intero, 1 = parti allontanate
   * @param {number[]} shrink per parte, 0 = intera, 1 = ridotta quasi a un punto
   * @param {number[]} alpha per parte, opacità
   */
  function drawShape(pose, explode, shrink, alpha) {
    const { points, centres } = projectTesseract(pose, LAYOUT.shape);
    TESSERACT_EDGES.forEach((edge, i) => {
      const a = points[edge.a];
      const b = points[edge.b];
      const line = scene.edges[i];
      line.setAttribute("x1", a.x.toFixed(1));
      line.setAttribute("y1", a.y.toFixed(1));
      line.setAttribute("x2", b.x.toFixed(1));
      line.setAttribute("y2", b.y.toFixed(1));
      // Profondità: gli spigoli lontani sono più tenui.
      line.style.opacity = clamp(0.95 - ((a.z + b.z) / 2) * 0.004, 0.4, 1);
    });
    scene.parts.forEach((part, k) => {
      const dx = PART_DIRECTIONS[k].x * explode * LAYOUT.shape.detach;
      const dy = PART_DIRECTIONS[k].y * explode * LAYOUT.shape.detach;
      const scale = 1 - 0.85 * shrink[k];
      if (Math.abs(dx) + Math.abs(dy) < 0.01 && scale > 0.999) {
        part.group.removeAttribute("transform");
      } else {
        const c = centres[k];
        part.group.setAttribute(
          "transform",
          `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) translate(${c.x.toFixed(2)} ${c.y.toFixed(2)}) ` +
            `scale(${scale.toFixed(3)}) translate(${(-c.x).toFixed(2)} ${(-c.y).toFixed(2)})`
        );
      }
      part.group.style.opacity = alpha[k];
    });
    lastPose = pose;
  }

  // Tutto nascosto: ogni passo accende solo ciò che gli serve.
  function resetScene() {
    scene.mapLayer.style.opacity = 0;
    scene.dataLabel.style.opacity = 0;
    [scene.labelPackets, scene.labelArrival, scene.labelCorrect, scene.check, scene.burst].forEach((node) => {
      node.style.opacity = 0;
    });
    setGhost(0);
    scene.connectors.forEach((line) => {
      line.style.opacity = 0;
    });
    scene.packetNodes.forEach((node) => {
      node.style.opacity = 0;
    });
    scene.ordinals.forEach((ordinal) => {
      ordinal.style.opacity = 0;
    });
    drawShape(lastPose, 0, perPart(() => 0), perPart(() => 0));
    scene.trails.forEach((trail, i) => {
      trail.style.opacity = 0;
      trail.style.strokeDashoffset = model.packets[i].timeline.length;
    });
    scene.pulses.forEach((list) =>
      list.forEach((pulse) => {
        pulse.element.style.opacity = 0;
      })
    );
  }

  // Stato iniziale (e riposo dopo il passo 3): il dato intero, che ruota.
  function frameStep0(t, pose) {
    drawShape(pose, 0, perPart(() => 0), perPart(() => 1));
    scene.dataLabel.style.opacity = 1;
  }

  function frameStep1(t) {
    // La rotazione libera si ferma nella posa canonica, poi il dato si apre,
    // le parti diventano pacchetti e i pacchetti si dispongono a ventaglio.
    const pose = settlePose(settleFrom, ease(progress(t, 0, 700)));
    const convert = (k) => ease(progress(t, 1250 + k * 80, 450));
    drawShape(
      pose,
      ease(progress(t, 500, 700)),
      perPart(convert),
      perPart((k) => 1 - convert(k))
    );
    model.packets.forEach((packet, k) => {
      const from = scene.openAnchors[k];
      const to = LAYOUT.fan[k];
      const toFan = ease(progress(t, 1700 + k * 120, 1000));
      const x = lerp(from.x, to.x, toFan);
      const y = lerp(from.y, to.y, toFan);
      setPacket(k, x, y, lerp(0.6, 1, convert(k)), clamp(convert(k) * 2));
      placeConnector(k, x, y);
      scene.connectors[k].style.opacity = 0.55 * clamp(toFan * 3);
    });
    setGhost(0.4 * ease(progress(t, 700, 500)));
    scene.dataLabel.style.opacity = 1 - 0.55 * ease(progress(t, 500, 600));
    scene.labelPackets.style.opacity = ease(progress(t, 2800, 400));
  }

  function frameStep2(t) {
    // Dissolvenza dalla scena del dato alla mappa
    const dataFade = 1 - ease(progress(t, 0, 450));
    setGhost(0.4 * dataFade);
    scene.dataLabel.style.opacity = 0.45 * dataFade;
    scene.labelPackets.style.opacity = dataFade;
    scene.connectors.forEach((line, k) => {
      placeConnector(k, LAYOUT.fan[k].x, LAYOUT.fan[k].y);
      line.style.opacity = 0.55 * dataFade;
    });
    scene.mapLayer.style.opacity = ease(progress(t, 250, 600));

    model.packets.forEach((packet, k) => {
      const fan = LAYOUT.fan[k];
      const start = packet.points[0];
      const end = packet.points[packet.points.length - 1];
      let x;
      let y;
      let scale = LAYOUT.packetMapScale;
      let distance = 0;

      if (t < packet.departMs) {
        // Raccolta in Partenza (sulla propria corsia), poi attesa del proprio turno
        const gather = ease(progress(t, 150 + k * 80, 800));
        x = lerp(fan.x, start.x, gather);
        y = lerp(fan.y, start.y, gather);
        scale = lerp(1, LAYOUT.packetMapScale, gather);
      } else if (t < packet.arriveMs) {
        const sampled = sampleTimeline(packet.timeline, t - packet.departMs);
        x = sampled.x;
        y = sampled.y;
        distance = sampled.distance;
      } else {
        // Arrivato: scende nel vassoio, nella casella dell'ordine di arrivo
        const toTray = ease(progress(t, packet.arriveMs, MOTION.trayMove));
        const slot = scene.traySlots[packet.rank];
        x = lerp(end.x, slot.x, toTray);
        y = lerp(end.y, slot.y, toTray);
        distance = packet.timeline.length;
        scene.ordinals[packet.rank].style.opacity = ease(progress(t, packet.arriveMs + 350, 250));
      }

      setPacket(k, x, y, scale, 1);
      scene.trails[k].style.opacity = distance > 0.5 ? 1 : 0;
      scene.trails[k].style.strokeDashoffset = packet.timeline.length - distance;

      scene.pulses[k].forEach((pulse) => {
        const p = (t - packet.departMs - pulse.t) / MOTION.pulse;
        if (p > 0 && p < 1) {
          pulse.element.setAttribute("r", pulse.baseRadius + 4 + p * 18);
          pulse.element.style.opacity = (1 - p) * 0.9;
        } else {
          pulse.element.style.opacity = 0;
        }
      });
    });
  }

  function rowX(position) {
    return LAYOUT.shape.center.x + (position - (model.packets.length - 1) / 2) * LAYOUT.rowGap;
  }

  // "pose": solo a passo concluso, quando il tesseratto ricostruito riprende a ruotare.
  function frameStep3(t, pose) {
    scene.mapLayer.style.opacity = 1 - ease(progress(t, 0, 500));
    scene.trails.forEach((trail) => {
      trail.style.opacity = 1;
      trail.style.strokeDashoffset = 0;
    });
    scene.ordinals.forEach((ordinal) => {
      ordinal.style.opacity = 1;
    });

    const guideIn = ease(progress(t, 300, 400));
    const guideOut = ease(progress(t, 3100, 600));
    setGhost(0.4 * guideIn * (1 - guideOut));
    scene.dataLabel.style.opacity = Math.max(0.45 * guideIn, ease(progress(t, 3100, 500)));
    scene.labelArrival.style.opacity = ease(progress(t, 300, 300)) * (1 - ease(progress(t, 1500, 300)));
    scene.labelCorrect.style.opacity = ease(progress(t, 1500, 300)) * (1 - ease(progress(t, 2300, 300)));

    // Ogni pacchetto si fonde nella propria parte (che riappare, riducendosi
    // all'inizio), poi le parti si richiudono nel tesseratto.
    const merged = (k) => ease(progress(t, 2300 + k * 90 + 450, 250));
    drawShape(
      pose,
      1 - ease(progress(t, 3100, 600)),
      perPart((k) => 1 - merged(k)),
      perPart(merged)
    );

    model.packets.forEach((packet, k) => {
      const slot = scene.traySlots[packet.rank];
      const inArrivalOrder = { x: rowX(packet.rank), y: LAYOUT.rowY };
      const inCorrectOrder = { x: rowX(packet.seq - 1), y: LAYOUT.rowY };

      // 1) dal vassoio alla riga, in ordine di arrivo
      const toRow = ease(progress(t, 0, 600));
      let x = lerp(slot.x, inArrivalOrder.x, toRow);
      let y = lerp(slot.y, inArrivalOrder.y, toRow);
      let scale = lerp(LAYOUT.packetMapScale, 1, toRow);

      // 2) riordino: ogni pacchetto raggiunge il proprio posto con un piccolo arco
      const reorder = ease(progress(t, 900 + k * 110, 800));
      if (reorder > 0) {
        const bulge = (packet.rank % 2 ? -1 : 1) * (30 + Math.abs(inCorrectOrder.x - inArrivalOrder.x) * 0.07);
        const control = { x: (inArrivalOrder.x + inCorrectOrder.x) / 2, y: LAYOUT.rowY + 2 * bulge };
        const point = quadraticPoint(inArrivalOrder, control, inCorrectOrder, reorder);
        x = point.x;
        y = point.y;
        scale = 1;
      }

      // 3) ricomposizione: il pacchetto raggiunge la propria parte
      const toPart = ease(progress(t, 2300 + k * 90, 700));
      if (toPart > 0) {
        x = lerp(inCorrectOrder.x, scene.openAnchors[k].x, toPart);
        y = lerp(inCorrectOrder.y, scene.openAnchors[k].y, toPart);
        scale = lerp(1, 0.7, merged(k));
      }
      setPacket(k, x, y, scale, 1 - merged(k));
    });

    const checked = ease(progress(t, 3700, 500));
    scene.check.style.opacity = checked > 0 ? 1 : 0;
    scene.check.style.strokeDashoffset = scene.checkLength * (1 - checked);
    const spread = progress(t, 3700, 700);
    scene.burst.setAttribute("r", 110 + spread * 34);
    scene.burst.style.opacity = spread > 0 && spread < 1 ? (1 - spread) * 0.8 : 0;
  }

  const FRAMES = [frameStep0, frameStep1, frameStep2, frameStep3];
  // "pose" conta solo per il passo 0 e per il passo 3 concluso (rotazione libera).
  function renderFrame(step, t, pose = CANONICAL_POSE) {
    resetScene();
    FRAMES[step](t, pose);
  }

  // ---------------------------------------------------------------------
  // Struttura della pagina
  // ---------------------------------------------------------------------

  const instanceId = `${CLASS}-${(instanceCounter += 1)}`;

  const areaBadge = createBadge({ label: network.areaLabel, tone: "neutral" });
  const heading = createElement("h1", { classNames: `${CLASS}__title`, text: scenario.title || "" });
  const titleBlock = createElement("div", { classNames: `${CLASS}__title-block` }, [areaBadge.element, heading]);

  // Impostazioni (velocità) e "ricomincia dall'inizio": due bottoni icona al
  // margine destro della riga del titolo, così il titolo resta pulito e la
  // posizione dei comandi è la stessa in ogni stato della scena.
  const settingsButton = createButton({
    variant: "icon",
    ariaLabel: network.labels.settings,
    icon: buildSettingsIcon(),
  });
  settingsButton.element.classList.add(`${CLASS}__settings-trigger`);
  settingsButton.element.setAttribute("title", network.labels.settings);
  settingsButton.element.setAttribute("aria-haspopup", "true");
  settingsButton.element.setAttribute("aria-expanded", "false");
  settingsButton.element.setAttribute("aria-controls", `${instanceId}-settings`);

  const refreshButton = createButton({
    variant: "icon",
    ariaLabel: network.labels.refresh,
    icon: buildRefreshIcon(),
  });
  refreshButton.element.classList.add(`${CLASS}__refresh`);
  refreshButton.element.setAttribute("title", network.labels.refresh);

  // Pannello a comparsa (non un Modal: la velocità si cambia anche mentre la
  // scena anima, e l'overlay la coprirebbe). Un gruppo di radio NATIVI:
  // frecce, focus e annuncio dello stato arrivano gratis dal browser.
  let speed = network.settings.defaultSpeed;
  const speedOptions = network.settings.speeds.map((option) => {
    const input = createElement("input", {
      classNames: `${CLASS}__speed-input`,
      attrs: { type: "radio", name: `${instanceId}-speed`, value: String(option.value) },
    });
    input.checked = option.value === speed;
    const chip = createElement("label", { classNames: `${CLASS}__speed-chip` }, [
      input,
      createElement("span", { classNames: `${CLASS}__speed-label`, text: option.label }),
    ]);
    return { input, chip, value: option.value };
  });
  const speedGroup = createElement("fieldset", { classNames: `${CLASS}__speed-group` }, [
    createElement("legend", { classNames: `${CLASS}__speed-legend`, text: network.labels.speedGroup }),
    createElement("div", { classNames: `${CLASS}__speed-options` }, speedOptions.map((option) => option.chip)),
  ]);
  const settingsPanel = createElement(
    "div",
    { classNames: `${CLASS}__settings-panel`, attrs: { id: `${instanceId}-settings` } },
    [speedGroup]
  );
  settingsPanel.hidden = true;

  const toolbar = createElement("div", { classNames: `${CLASS}__toolbar` }, [
    createElement("div", { classNames: `${CLASS}__toolbar-buttons` }, [settingsButton.element, refreshButton.element]),
    settingsPanel,
  ]);
  const header = createElement("header", { classNames: `${CLASS}__header` }, [titleBlock, toolbar]);

  // Il riquadro della scena è il bersaglio del focus mentre "Prosegui" è disabilitato.
  const stageCard = createCard({ content: scene.svg });
  stageCard.element.classList.add(`${CLASS}__stage`);
  stageCard.element.setAttribute("tabindex", "-1");
  stageCard.element.setAttribute("role", "group");
  stageCard.element.setAttribute("aria-label", scenario.title || "");

  const stepper = createElement(
    "ol",
    { classNames: `${CLASS}__stepper`, attrs: { "aria-label": network.labels.stepperAria } },
    network.steps.map((step) => createElement("li", { classNames: `${CLASS}__stepper-item`, text: step.stepper }))
  );
  const stepperItems = Array.from(stepper.children);

  const captionStep = createElement("p", { classNames: `${CLASS}__caption-step` });
  const captionTitle = createElement("h2", { classNames: `${CLASS}__caption-title` });
  const captionText = createElement("p", { classNames: `${CLASS}__caption-text` });
  const caption = createElement(
    "div",
    { classNames: `${CLASS}__caption`, attrs: { role: "status", "aria-live": "polite" } },
    [captionStep, captionTitle, captionText]
  );
  // Suggerimento fuori dalla regione "status": comparirebbe come annuncio a ogni cambio.
  const hint = createElement("p", { classNames: `${CLASS}__hint`, text: network.labels.routeHint });
  hint.hidden = true;
  const captionColumn = createElement("div", { classNames: `${CLASS}__caption-column` }, [caption, hint]);

  const reviewButton = createButton({ variant: "secondary", label: network.actions.review });
  reviewButton.element.classList.add(`${CLASS}__review`);
  reviewButton.element.hidden = true;
  const proceedButton = createButton({ variant: "primary", label: network.actions.next });
  proceedButton.element.classList.add(`${CLASS}__proceed`);
  const restartButton = createButton({ variant: "primary", label: network.actions.restart });
  restartButton.element.classList.add(`${CLASS}__restart`);
  restartButton.element.hidden = true;
  const actions = createElement("div", { classNames: `${CLASS}__actions` }, [
    reviewButton.element,
    proceedButton.element,
    restartButton.element,
  ]);

  // Annuncio dell'esito di un passo (ordine di arrivo, dato ricostruito, percorso in evidenza).
  const outcomeStatus = createElement("p", {
    classNames: ["sl-visually-hidden", `${CLASS}__outcome`],
    attrs: { role: "status", "aria-live": "polite" },
  });

  const controls = createElement("section", { classNames: `${CLASS}__controls` }, [
    stepper,
    createElement("div", { classNames: `${CLASS}__control-row` }, [captionColumn, actions]),
    outcomeStatus,
  ]);

  const root = createElement("div", { classNames: CLASS }, [header, stageCard.element, controls]);

  // ---------------------------------------------------------------------
  // Macchina a stati
  // ---------------------------------------------------------------------

  let step = 0;
  let animating = false;
  let runId = 0;
  let rafId = 0;
  let destroyed = false;
  let selectedSeq = null; // percorso in evidenza (solo a fine passo 2)
  let settingsOpen = false;

  const isSelectionEnabled = () => step === 2 && !animating;

  // --- Percorso in evidenza -------------------------------------------------

  // Selezione = classi CSS, mai attributi inline: i fotogrammi non le toccano,
  // quindi la selezione sopravvive a qualunque ridisegno.
  function applySelection(seq) {
    selectedSeq = seq;
    if (seq === null) root.removeAttribute("data-selected");
    else root.dataset.selected = String(seq);
    model.packets.forEach((packet, k) => {
      const isSelected = packet.seq === seq;
      scene.trails[k].classList.toggle(`${CLASS}__trail--selected`, isSelected);
      scene.trails[k].classList.toggle(`${CLASS}__trail--muted`, seq !== null && !isSelected);
      const node = scene.packetNodes[k];
      node.classList.toggle(`${CLASS}__packet--selected`, isSelected);
      node.classList.toggle(`${CLASS}__packet--dimmed`, seq !== null && !isSelected);
      if (node.hasAttribute("role")) node.setAttribute("aria-pressed", String(isSelected));
    });
    // Ordine di sovrapposizione: la scia in evidenza sopra le altre; senza
    // selezione, l'ordine originale (per numero d'ordine).
    const onTop = scene.trails.filter((_, k) => model.packets[k].seq === seq);
    const others = scene.trails.filter((_, k) => model.packets[k].seq !== seq);
    [...others, ...onTop].forEach((trail) => scene.trailsLayer.appendChild(trail));
  }

  // I pacchetti del vassoio sono decorazione finché la scena anima; a fine
  // passo 2 diventano bottoni a due stati (aria-pressed) navigabili da tastiera.
  function syncSelectableTray() {
    const enabled = isSelectionEnabled();
    if (!enabled && selectedSeq !== null) applySelection(null);
    scene.packetNodes.forEach((node, k) => {
      const packet = model.packets[k];
      node.classList.toggle(`${CLASS}__packet--interactive`, enabled);
      if (enabled) {
        node.setAttribute("role", "button");
        node.setAttribute("tabindex", "0");
        node.setAttribute(
          "aria-label",
          formatTemplate(network.labels.packetButton, { seq: packet.seq, rank: packet.rank + 1 })
        );
        node.setAttribute("aria-pressed", String(selectedSeq === packet.seq));
        node.removeAttribute("aria-hidden");
      } else {
        ["role", "tabindex", "aria-label", "aria-pressed"].forEach((name) => node.removeAttribute(name));
        node.setAttribute("aria-hidden", "true");
      }
    });
  }

  function togglePacketRoute(index) {
    if (!isSelectionEnabled() || destroyed) return;
    const packet = model.packets[index];
    const next = selectedSeq === packet.seq ? null : packet.seq;
    applySelection(next);
    outcomeStatus.textContent =
      next === null
        ? network.announcements.routeCleared
        : formatTemplate(network.announcements.routeSelected, {
            seq: packet.seq,
            hops: packet.route.length - 2,
            rank: packet.rank + 1,
          });
  }

  const packetHandlers = scene.packetNodes.map((node, index) => {
    const onClick = () => togglePacketRoute(index);
    const onKeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); // Spazio non deve far scorrere la pagina
      togglePacketRoute(index);
    };
    node.addEventListener("click", onClick);
    node.addEventListener("keydown", onKeydown);
    return { node, onClick, onKeydown };
  });

  // --- Stato e didascalia ---------------------------------------------------

  function applyState() {
    root.dataset.step = String(step);
    root.dataset.animating = String(animating);
    root.dataset.speed = String(speed);
    const finished = step >= LAST_STEP && !animating;
    proceedButton.update({ disabled: animating });
    proceedButton.element.hidden = finished;
    restartButton.element.hidden = !finished;
    reviewButton.element.hidden = step === 0;
    hint.hidden = !isSelectionEnabled();
    syncSelectableTray();
  }

  function showCaption() {
    const data = network.steps[step];
    captionStep.textContent =
      step === 0
        ? network.labels.startPoint
        : formatTemplate(network.labels.stepCounter, { step, total: LAST_STEP });
    captionTitle.textContent = data.title;
    captionText.textContent = data.text;
    stepperItems.forEach((item, i) => {
      item.classList.toggle(`${CLASS}__stepper-item--done`, i < step);
      item.classList.toggle(`${CLASS}__stepper-item--current`, i === step);
      if (i === step) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  }

  function announceOutcome(finishedStep) {
    if (finishedStep === 2) {
      const order = [...model.packets]
        .sort((a, b) => a.rank - b.rank)
        .map((p) => p.seq)
        .join(", ");
      outcomeStatus.textContent = formatTemplate(network.announcements.arrived, { order });
    } else if (finishedStep === 3) {
      outcomeStatus.textContent = network.announcements.rebuilt;
    }
  }

  // --- Riproduzione ---------------------------------------------------------

  // Il tempo trascorso si ACCUMULA (dt × velocità) invece di essere
  // ricalcolato dall'inizio: cambiare velocità a passo in corso non fa saltare
  // la scena avanti o indietro.
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function playStep(targetStep, id) {
    return new Promise((resolve) => {
      const duration = model.durations[targetStep];
      if (prefersReducedMotion()) {
        renderFrame(targetStep, duration);
        resolve();
        return;
      }
      let elapsed = 0;
      let previous = performance.now();
      function frame(now) {
        if (id !== runId) {
          resolve();
          return;
        }
        elapsed += (now - previous) * speed;
        previous = now;
        const t = Math.min(elapsed, duration);
        renderFrame(targetStep, t);
        if (t >= duration) {
          resolve();
          return;
        }
        rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);
    });
  }

  // Riporta il focus sul bottone giusto, ma solo se l'utente non l'ha spostato altrove.
  function restoreFocus() {
    const active = document.activeElement;
    const lost = !active || active === document.body || active === stageCard.element || active === proceedButton.element;
    if (!lost) return;
    const target = step >= LAST_STEP ? restartButton.element : proceedButton.element;
    target.focus();
  }

  // Rotazione libera del tesseratto: solo a riposo (passo 0 e passo 3 concluso),
  // con un ciclo requestAnimationFrame proprio che si ferma appena parte un passo.
  // Con "riduci animazioni" il dato resta fermo nella posa canonica.
  let idleRafId = 0;

  function stopIdle() {
    cancelAnimationFrame(idleRafId);
    idleRafId = 0;
  }

  function startIdle() {
    stopIdle();
    const duration = model.durations[step];
    if (prefersReducedMotion()) {
      renderFrame(step, duration, CANONICAL_POSE);
      return;
    }
    const startedAt = performance.now();
    renderFrame(step, duration, idlePose(0));
    function loop(now) {
      idleRafId = requestAnimationFrame(loop);
      renderFrame(step, duration, idlePose(now - startedAt));
    }
    idleRafId = requestAnimationFrame(loop);
  }

  // Avvia (o riavvia da capo) il passo corrente: usato da "Prosegui" e "Rivedi".
  function runCurrentStep() {
    const id = ++runId;
    cancelAnimationFrame(rafId);
    stopIdle();
    // Il passo 1 parte da dove la rotazione libera si trova, non da un salto.
    if (step === 1) settleFrom = lastPose;
    applySelection(null);
    outcomeStatus.textContent = "";
    animating = true;
    applyState();
    playStep(step, id).then(() => {
      if (id !== runId || destroyed) return;
      animating = false;
      applyState();
      announceOutcome(step);
      restoreFocus();
      if (step === LAST_STEP) startIdle(); // il dato ricostruito riprende a ruotare
    });
  }

  function handleProceed() {
    if (animating || step >= LAST_STEP || destroyed) return;
    step += 1;
    showCaption();
    // Il bottone sta per essere disabilitato: il focus passa alla scena.
    if (document.activeElement === proceedButton.element) stageCard.element.focus();
    runCurrentStep();
  }

  // "Rivedi": rimostra il passo corrente dall'inizio, anche a metà animazione.
  // Il fotogramma t=0 di ogni passo coincide con lo stato finale del precedente.
  function handleReview() {
    if (destroyed || step === 0) return;
    runCurrentStep();
  }

  // Ritorno al punto di partenza. Il focus resta sul comando usato dall'utente.
  function restart(focusTarget) {
    if (destroyed) return;
    runId += 1;
    cancelAnimationFrame(rafId);
    animating = false;
    step = 0;
    applySelection(null);
    outcomeStatus.textContent = "";
    startIdle();
    showCaption();
    applyState();
    focusTarget.focus();
  }

  const handleRestartButton = () => restart(proceedButton.element);
  const handleRefresh = () => restart(refreshButton.element);

  // --- Impostazioni -----------------------------------------------------------

  // Click fuori e Esc chiudono il pannello; un click DENTRO la barra degli
  // strumenti (incluso quello che lo ha aperto, che risale fino al document)
  // viene ignorato.
  function handleDocumentClick(event) {
    if (!toolbar.contains(event.target)) setSettingsOpen(false);
  }
  function handleDocumentKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setSettingsOpen(false, { restoreFocus: true });
  }
  function setSettingsOpen(open, { restoreFocus: shouldRestore = false } = {}) {
    if (open === settingsOpen) return;
    settingsOpen = open;
    settingsPanel.hidden = !open;
    settingsButton.element.setAttribute("aria-expanded", String(open));
    if (open) {
      document.addEventListener("click", handleDocumentClick);
      document.addEventListener("keydown", handleDocumentKeydown);
    } else {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeydown);
      if (shouldRestore) settingsButton.element.focus();
    }
  }
  function handleSettingsToggle() {
    setSettingsOpen(!settingsOpen);
    if (settingsOpen) speedOptions.find((option) => option.input.checked)?.input.focus();
  }
  const speedHandlers = speedOptions.map((option) => {
    const onChange = () => {
      if (!option.input.checked) return;
      speed = option.value;
      root.dataset.speed = String(speed);
    };
    option.input.addEventListener("change", onChange);
    return { input: option.input, onChange };
  });

  settingsButton.element.addEventListener("sl:click", handleSettingsToggle);
  refreshButton.element.addEventListener("sl:click", handleRefresh);
  reviewButton.element.addEventListener("sl:click", handleReview);
  proceedButton.element.addEventListener("sl:click", handleProceed);
  restartButton.element.addEventListener("sl:click", handleRestartButton);

  startIdle();
  showCaption();
  applyState();

  container.appendChild(root);

  return function destroy() {
    destroyed = true;
    runId += 1;
    cancelAnimationFrame(rafId);
    stopIdle();
    setSettingsOpen(false);
    settingsButton.element.removeEventListener("sl:click", handleSettingsToggle);
    refreshButton.element.removeEventListener("sl:click", handleRefresh);
    reviewButton.element.removeEventListener("sl:click", handleReview);
    proceedButton.element.removeEventListener("sl:click", handleProceed);
    restartButton.element.removeEventListener("sl:click", handleRestartButton);
    speedHandlers.forEach(({ input, onChange }) => input.removeEventListener("change", onChange));
    packetHandlers.forEach(({ node, onClick, onKeydown }) => {
      node.removeEventListener("click", onClick);
      node.removeEventListener("keydown", onKeydown);
    });
    [settingsButton, refreshButton, reviewButton, proceedButton, restartButton, areaBadge, stageCard].forEach(
      (component) => component.destroy()
    );
    root.remove();
  };
}
