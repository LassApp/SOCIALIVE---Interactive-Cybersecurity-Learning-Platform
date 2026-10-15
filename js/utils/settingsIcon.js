/**
 * settingsIcon.js
 * -----------------------------------------------------------------------
 * Icona "ingranaggio" per i bottoni Impostazioni. Estratta da
 * profileTimelineRenderer.js (dove nacque per il pannello Impostazioni di
 * Oversharing) quando packetJourneyRenderer.js (scenario "Viaggio dei
 * dati") ne ha avuto bisogno identica: stesso principio "si estrae al
 * secondo consumo reale" già seguito per svg.js, focusTrap.js e
 * mediaViewerLauncher.js. Nessuna dipendenza dallo sprite
 * (assets/icons/icons.svg), ancora assente (debito tecnico noto).
 *
 * Stile "corona con denti squadrati" (anello + foro centrale + 8 denti
 * rettangolari ruotati), deliberatamente geometrico — scelto in
 * Oversharing su richiesta esplicita al posto di un ingranaggio "a
 * bezier" troppo generico — coerente con lo stile outline, stroke ~1.5px
 * delle altre icone inline del progetto (lucchetto, chiusura, chevron).
 * Usa currentColor: segue il tema e lo stato del bottone che la contiene.
 *
 * @returns {SVGElement}
 */

import { svgNode } from "./svg.js";

export function buildSettingsIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(svgNode("circle", { cx: "12", cy: "12", r: "6.5", stroke: "currentColor", "stroke-width": "1.6" }));
  svg.appendChild(svgNode("circle", { cx: "12", cy: "12", r: "2", fill: "currentColor" }));
  // 8 denti equidistanti: un solo <rect> ruotato di 45° in 8 copie —
  // più economico ed esplicito di 8 path scritti a mano.
  for (let i = 0; i < 8; i += 1) {
    svg.appendChild(
      svgNode("rect", {
        x: "10.75",
        y: "0.9",
        width: "2.5",
        height: "3",
        rx: "0.6",
        fill: "currentColor",
        transform: `rotate(${i * 45} 12 12)`,
      })
    );
  }
  return svg;
}
