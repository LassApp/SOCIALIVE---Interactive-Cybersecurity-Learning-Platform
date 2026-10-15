/**
 * packetJourneyRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "packet-journey" (scenario "Viaggio
 * dei dati", area Reti): mostra come un dato viaggia in rete, in 3 passi
 * avanzabili con "Prosegui".
 *
 *   Passo 1 — Suddivisione: il dato (un anello di 4 archi colorati) si
 *             scompone in 4 pacchetti numerati che si dispongono a
 *             ventaglio.
 *   Passo 2 — Instradamento: sulla mappa a nodi ogni pacchetto percorre
 *             una strada diversa (linea colorata) in tempi diversi: gli
 *             arrivi avvengono in un ordine diverso da quello di partenza.
 *   Passo 3 — Ricomposizione: i pacchetti si riordinano per numero e si
 *             fondono di nuovo nell'anello, ricostruendo il dato.
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
 * direttamente al proprio stato finale (nessun movimento).
 *
 * DATI — nessun contenuto nel codice: nodi, collegamenti, percorsi,
 * velocità, istanti di partenza, colori (nome del token, mai CSS libero),
 * titoli e didascalie arrivano da network.json (dataRefs.network) e sono
 * validati da validatePacketNetwork(). Qui restano solo scelte di resa
 * grafica (geometria dell'anello, del ventaglio e del vassoio) e di
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
  ring: { cx: 560, cy: 360, outer: 112, inner: 68, gap: 5, detach: 24 },
  // Posizioni del ventaglio, in ordine di numero d'ordine (sinistra → destra).
  fan: [
    { x: 310, y: 195 },
    { x: 475, y: 120 },
    { x: 645, y: 120 },
    { x: 810, y: 195 },
  ],
  labelY: 62,
  packetRadius: 26,
  packetMapScale: 0.62,
  rowY: 160,
  rowGap: 125,
  laneGap: 6,
  tray: { x: 735, y: 522, width: 340, height: 96, slotY: 576, slotsX: [790, 870, 950, 1030] },
  nodeRadius: { hop: 17, start: 20, gateway: 26, end: 24 },
};

// Coreografia (ms). I tempi di viaggio dei pacchetti NON sono qui: derivano dai dati.
const MOTION = {
  step1: 2500,
  step3: 4500,
  trayMove: 550,
  traySettle: 350,
  pulse: 520,
};

const LAST_STEP = 3;

function colorVar(name) {
  return `var(--sl-color-${name}-500)`;
}

function formatTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

function addSvg(parent, tag, attrs = {}) {
  const node = svgNode(tag, attrs);
  parent.appendChild(node);
  return node;
}

function polarPoint(radius, degrees) {
  const rad = (degrees * Math.PI) / 180;
  return { x: LAYOUT.ring.cx + radius * Math.cos(rad), y: LAYOUT.ring.cy + radius * Math.sin(rad) };
}

// Settore anulare tra due angoli (gradi, 0° = destra, senso orario sullo schermo).
function annularSectorPath(outerRadius, innerRadius, startDeg, endDeg) {
  const p0 = polarPoint(outerRadius, startDeg);
  const p1 = polarPoint(outerRadius, endDeg);
  const p2 = polarPoint(innerRadius, endDeg);
  const p3 = polarPoint(innerRadius, startDeg);
  return (
    `M${p0.x} ${p0.y}A${outerRadius} ${outerRadius} 0 0 1 ${p1.x} ${p1.y}` +
    `L${p2.x} ${p2.y}A${innerRadius} ${innerRadius} 0 0 0 ${p3.x} ${p3.y}Z`
  );
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
  const { ring } = LAYOUT;
  const svg = svgNode("svg", {
    viewBox: `0 0 ${VIEW.width} ${VIEW.height}`,
    role: "img",
    focusable: "false",
    "aria-label": network.labels.stage,
    class: `${CLASS}__svg`,
  });

  // --- Mappa (livello più basso) ---
  const mapLayer = addSvg(svg, "g");
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
    trail.style.stroke = packet.color;
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

  // --- Dato: guida tratteggiata, connettori, etichette ---
  const dataLayer = addSvg(svg, "g");
  const ghost = addSvg(dataLayer, "circle", { cx: ring.cx, cy: ring.cy, r: ring.outer, class: `${CLASS}__ghost` });
  const connectorsLayer = addSvg(dataLayer, "g");
  const connectors = model.packets.map(() => addSvg(connectorsLayer, "line", { class: `${CLASS}__connector` }));
  const makeLabel = (text) => {
    const label = addSvg(dataLayer, "text", { x: ring.cx, y: LAYOUT.labelY, class: `${CLASS}__label` });
    label.textContent = text;
    return label;
  };
  const labelPackets = makeLabel(network.labels.packets);
  const labelArrival = makeLabel(network.labels.arrivalOrder);
  const labelCorrect = makeLabel(network.labels.correctOrder);

  // --- Anello del dato: un arco per pacchetto (quadranti) ---
  const ringLayer = addSvg(svg, "g");
  const arcsLayer = addSvg(ringLayer, "g");
  const sector = 360 / model.packets.length;
  const centroidRadius = (ring.outer + ring.inner) / 2;
  const arcs = model.packets.map((packet, k) => {
    // Sequenza oraziale a partire dal quadrante in basso a sinistra:
    // i numeri d'ordine crescono da sinistra a destra anche nel ventaglio.
    const start = 90 + k * sector;
    const bisector = ((start + sector / 2) * Math.PI) / 180;
    const dir = { x: Math.cos(bisector), y: Math.sin(bisector) };
    const group = addSvg(arcsLayer, "g");
    // Il bordo arrotondato è un tratto dello stesso colore: i raggi si riducono di metà spessore.
    const path = addSvg(group, "path", {
      d: annularSectorPath(ring.outer - 3, ring.inner + 3, start + ring.gap / 2, start + sector - ring.gap / 2),
      "stroke-width": 6,
      "stroke-linejoin": "round",
    });
    path.style.fill = packet.color;
    path.style.stroke = packet.color;
    return {
      group,
      dir,
      detachedPos: {
        x: ring.cx + dir.x * (centroidRadius + ring.detach),
        y: ring.cy + dir.y * (centroidRadius + ring.detach),
      },
    };
  });

  const ringLabel = addSvg(ringLayer, "text", { x: ring.cx, y: ring.cy - 8, class: `${CLASS}__ring-label` });
  ringLabel.textContent = network.data.label;
  const checkPoints = [
    { x: ring.cx - 16, y: ring.cy + 26 },
    { x: ring.cx - 4, y: ring.cy + 38 },
    { x: ring.cx + 18, y: ring.cy + 14 },
  ];
  const check = addSvg(ringLayer, "path", {
    d: `M${checkPoints[0].x} ${checkPoints[0].y} L${checkPoints[1].x} ${checkPoints[1].y} L${checkPoints[2].x} ${checkPoints[2].y}`,
    class: `${CLASS}__check`,
  });
  const checkLength =
    Math.hypot(checkPoints[1].x - checkPoints[0].x, checkPoints[1].y - checkPoints[0].y) +
    Math.hypot(checkPoints[2].x - checkPoints[1].x, checkPoints[2].y - checkPoints[1].y);
  check.style.strokeDasharray = checkLength;
  const ringPulse = addSvg(ringLayer, "circle", { cx: ring.cx, cy: ring.cy, r: ring.outer, class: `${CLASS}__ring-pulse` });

  // --- Pacchetti (livello più alto) ---
  const packetLayer = addSvg(svg, "g");
  const packetNodes = model.packets.map((packet) => {
    const group = addSvg(packetLayer, "g");
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
    pulses,
    traySlots,
    ordinals,
    ghost,
    connectors,
    labelPackets,
    labelArrival,
    labelCorrect,
    arcs,
    ringLabel,
    check,
    checkLength,
    ringPulse,
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
  const { ring } = LAYOUT;

  // ---------------------------------------------------------------------
  // Fotogrammi: ogni passo imposta l'INTERA scena a partire da "t" (ms).
  // ---------------------------------------------------------------------

  function setPacket(index, x, y, scale, opacity) {
    const node = scene.packetNodes[index];
    node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
    node.style.opacity = opacity;
  }

  function placeConnector(index, x, y) {
    // Parte dal bordo dell'anello, in direzione del pacchetto.
    const vx = x - ring.cx;
    const vy = y - ring.cy;
    const length = Math.hypot(vx, vy) || 1;
    const line = scene.connectors[index];
    line.setAttribute("x1", ring.cx + (vx / length) * ring.outer);
    line.setAttribute("y1", ring.cy + (vy / length) * ring.outer);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
  }

  function setArc(index, detach, opacity) {
    const arc = scene.arcs[index];
    arc.group.setAttribute("transform", `translate(${arc.dir.x * detach} ${arc.dir.y * detach})`);
    arc.group.style.opacity = opacity;
  }

  function rowX(position) {
    return ring.cx + (position - (model.packets.length - 1) / 2) * LAYOUT.rowGap;
  }

  // Tutto nascosto: ogni passo accende solo ciò che gli serve.
  function resetScene() {
    scene.mapLayer.style.opacity = 0;
    scene.ghost.style.opacity = 0;
    scene.ringLabel.style.opacity = 0;
    [scene.labelPackets, scene.labelArrival, scene.labelCorrect, scene.check, scene.ringPulse].forEach((node) => {
      node.style.opacity = 0;
    });
    scene.connectors.forEach((line) => {
      line.style.opacity = 0;
    });
    scene.packetNodes.forEach((node) => {
      node.style.opacity = 0;
    });
    scene.ordinals.forEach((ordinal) => {
      ordinal.style.opacity = 0;
    });
    scene.arcs.forEach((arc, i) => setArc(i, 0, 0));
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

  function frameStep0() {
    scene.arcs.forEach((arc, i) => setArc(i, 0, 1));
    scene.ringLabel.style.opacity = 1;
  }

  function frameStep1(t) {
    model.packets.forEach((packet, k) => {
      const stagger = k * 70;
      const detach = ring.detach * ease(progress(t, stagger, 400));
      const toPacket = ease(progress(t, 450 + stagger, 450));
      const toFan = ease(progress(t, 950 + k * 120, 1000));
      const from = scene.arcs[k].detachedPos;
      const to = LAYOUT.fan[k];
      const x = lerp(from.x, to.x, toFan);
      const y = lerp(from.y, to.y, toFan);
      setArc(k, detach, 1 - toPacket);
      setPacket(k, x, y, lerp(0.6, 1, toPacket), clamp(toPacket * 2));
      placeConnector(k, x, y);
      scene.connectors[k].style.opacity = 0.55 * clamp(toFan * 3);
    });
    scene.ghost.style.opacity = 0.4 * ease(progress(t, 0, 450));
    scene.ringLabel.style.opacity = 1 - 0.55 * ease(progress(t, 300, 600));
    scene.labelPackets.style.opacity = ease(progress(t, 2000, 400));
  }

  function frameStep2(t) {
    // Dissolvenza dalla scena del dato alla mappa
    const dataFade = 1 - ease(progress(t, 0, 450));
    scene.ghost.style.opacity = 0.4 * dataFade;
    scene.ringLabel.style.opacity = 0.45 * dataFade;
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

  function frameStep3(t) {
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
    scene.ghost.style.opacity = 0.4 * guideIn * (1 - guideOut);
    scene.ringLabel.style.opacity = Math.max(0.45 * guideIn, ease(progress(t, 3100, 500)));
    scene.labelArrival.style.opacity = ease(progress(t, 300, 300)) * (1 - ease(progress(t, 1500, 300)));
    scene.labelCorrect.style.opacity = ease(progress(t, 1500, 300)) * (1 - ease(progress(t, 2300, 300)));

    const detachNow = ring.detach * (1 - ease(progress(t, 3100, 600)));
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

      // 3) ricomposizione: il pacchetto si fonde nel proprio arco
      const mergeStart = 2300 + k * 90;
      const toArc = ease(progress(t, mergeStart, 700));
      const fused = ease(progress(t, mergeStart + 450, 250));
      if (toArc > 0) {
        x = lerp(inCorrectOrder.x, scene.arcs[k].detachedPos.x, toArc);
        y = lerp(inCorrectOrder.y, scene.arcs[k].detachedPos.y, toArc);
        scale = lerp(1, 0.7, fused);
      }
      setPacket(k, x, y, scale, 1 - fused);
      setArc(k, detachNow, fused);
    });

    const checked = ease(progress(t, 3700, 500));
    scene.check.style.opacity = checked > 0 ? 1 : 0;
    scene.check.style.strokeDashoffset = scene.checkLength * (1 - checked);
    const burst = progress(t, 3700, 700);
    scene.ringPulse.setAttribute("r", ring.outer + burst * 26);
    scene.ringPulse.style.opacity = burst > 0 && burst < 1 ? (1 - burst) * 0.8 : 0;
  }

  const FRAMES = [frameStep0, frameStep1, frameStep2, frameStep3];
  function renderFrame(step, t) {
    resetScene();
    FRAMES[step](t);
  }

  // ---------------------------------------------------------------------
  // Struttura della pagina
  // ---------------------------------------------------------------------

  const areaBadge = createBadge({ label: network.areaLabel, tone: "neutral" });
  const heading = createElement("h1", { classNames: `${CLASS}__title`, text: scenario.title || "" });
  const header = createElement("header", { classNames: `${CLASS}__header` }, [areaBadge.element, heading]);

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

  const proceedButton = createButton({ variant: "primary", label: network.actions.next });
  proceedButton.element.classList.add(`${CLASS}__proceed`);
  const restartButton = createButton({ variant: "secondary", label: network.actions.restart });
  restartButton.element.classList.add(`${CLASS}__restart`);
  restartButton.element.hidden = true;
  const actions = createElement("div", { classNames: `${CLASS}__actions` }, [
    proceedButton.element,
    restartButton.element,
  ]);

  // Annuncio dell'esito di un passo (ordine di arrivo, dato ricostruito).
  const outcomeStatus = createElement("p", {
    classNames: ["sl-visually-hidden", `${CLASS}__outcome`],
    attrs: { role: "status", "aria-live": "polite" },
  });

  const controls = createElement("section", { classNames: `${CLASS}__controls` }, [
    stepper,
    createElement("div", { classNames: `${CLASS}__control-row` }, [caption, actions]),
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

  function applyState() {
    root.dataset.step = String(step);
    root.dataset.animating = String(animating);
    const finished = step >= LAST_STEP && !animating;
    proceedButton.update({ disabled: animating });
    proceedButton.element.hidden = finished;
    restartButton.element.hidden = !finished;
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

  function playStep(targetStep, id) {
    return new Promise((resolve) => {
      const duration = model.durations[targetStep];
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        renderFrame(targetStep, duration);
        resolve();
        return;
      }
      const startedAt = performance.now();
      function frame(now) {
        if (id !== runId) {
          resolve();
          return;
        }
        const t = Math.min(now - startedAt, duration);
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

  function handleProceed() {
    if (animating || step >= LAST_STEP || destroyed) return;
    step += 1;
    animating = true;
    const id = ++runId;
    showCaption();
    outcomeStatus.textContent = "";
    // Il bottone sta per essere disabilitato: il focus passa alla scena.
    if (document.activeElement === proceedButton.element) stageCard.element.focus();
    applyState();
    playStep(step, id).then(() => {
      if (id !== runId || destroyed) return;
      animating = false;
      applyState();
      announceOutcome(step);
      restoreFocus();
    });
  }

  function handleRestart() {
    if (destroyed) return;
    runId += 1;
    cancelAnimationFrame(rafId);
    animating = false;
    step = 0;
    outcomeStatus.textContent = "";
    renderFrame(0, 0);
    showCaption();
    applyState();
    proceedButton.element.focus();
  }

  proceedButton.element.addEventListener("sl:click", handleProceed);
  restartButton.element.addEventListener("sl:click", handleRestart);

  renderFrame(0, 0);
  showCaption();
  applyState();

  container.appendChild(root);

  return function destroy() {
    destroyed = true;
    runId += 1;
    cancelAnimationFrame(rafId);
    proceedButton.element.removeEventListener("sl:click", handleProceed);
    restartButton.element.removeEventListener("sl:click", handleRestart);
    proceedButton.destroy();
    restartButton.destroy();
    areaBadge.destroy();
    stageCard.destroy();
    root.remove();
  };
}
