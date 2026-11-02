/**
 * settingsIcon.js
 * -----------------------------------------------------------------------
 * Icona "ingranaggio a corona" per i bottoni Impostazioni, condivisa da
 * Oversharing (profileTimelineRenderer.js, dove nacque) e dallo scenario
 * "Viaggio dei dati" (packetJourneyRenderer.js). Nessuna dipendenza dallo
 * sprite (assets/icons/icons.svg), ancora assente (debito tecnico noto).
 *
 * UN SOLO TRACCIATO PIENO CON FORO — la corona di 8 denti trapezoidali e il
 * foro centrale sono un unico <path> con fill-rule "evenodd". È la forma
 * giusta per il contesto in cui l'icona vive: button.css imposta
 * fill:currentColor sugli svg dei bottoni, quindi un ingranaggio disegnato
 * "a contorno" (anello + denti separati, la versione precedente) si
 * riempiva e si leggeva come un sole. Un solido con il foro invece si
 * legge come ingranaggio, con qualunque riempimento. Gli spigoli sono
 * arrotondati da un tratto dello stesso colore (stroke-linejoin round),
 * quindi i raggi sono ridotti di mezzo spessore.
 *
 * Il tracciato si calcola una volta al caricamento del modulo: i parametri
 * (denti, raggi, larghezze angolari) sono leggibili e ritoccabili qui,
 * invece di un `d` di decine di coordinate scritte a mano.
 *
 * @returns {SVGElement}
 */

import { svgNode } from "./svg.js";

const CENTER = 12;
const TEETH = 8;
const TIP_RADIUS = 10.4;
const ROOT_RADIUS = 7.9;
const TIP_HALF_ANGLE = 9; // gradi, metà larghezza del dente in punta
const ROOT_HALF_ANGLE = 14.5; // gradi, metà larghezza del dente alla base
const HOLE_RADIUS = 3.3;

function point(radius, degrees) {
  const rad = (degrees * Math.PI) / 180;
  return `${(CENTER + radius * Math.cos(rad)).toFixed(2)} ${(CENTER + radius * Math.sin(rad)).toFixed(2)}`;
}

function buildGearPath() {
  const step = 360 / TEETH;
  let d = "";
  for (let i = 0; i < TEETH; i += 1) {
    const angle = i * step - 90; // il primo dente guarda in alto
    d += `${i === 0 ? "M" : "L"}${point(ROOT_RADIUS, angle - ROOT_HALF_ANGLE)}`;
    d += `L${point(TIP_RADIUS, angle - TIP_HALF_ANGLE)}L${point(TIP_RADIUS, angle + TIP_HALF_ANGLE)}`;
    d += `L${point(ROOT_RADIUS, angle + ROOT_HALF_ANGLE)}`;
    // arco lungo il cerchio di base fino all'inizio del dente successivo
    d += `A${ROOT_RADIUS} ${ROOT_RADIUS} 0 0 1 ${point(ROOT_RADIUS, angle + step - ROOT_HALF_ANGLE)}`;
  }
  d += "Z";
  // foro centrale: due semicerchi, "evenodd" lo scava
  d += `M${CENTER + HOLE_RADIUS} ${CENTER}`;
  d += `A${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${CENTER - HOLE_RADIUS} ${CENTER}`;
  d += `A${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${CENTER + HOLE_RADIUS} ${CENTER}Z`;
  return d;
}

const GEAR_PATH = buildGearPath();

export function buildSettingsIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24" });
  svg.appendChild(
    svgNode("path", {
      d: GEAR_PATH,
      "fill-rule": "evenodd",
      fill: "currentColor",
      stroke: "currentColor",
      "stroke-width": "1",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}
