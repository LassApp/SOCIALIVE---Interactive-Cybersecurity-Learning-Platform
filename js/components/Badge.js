/**
 * Badge.js
 * -----------------------------------------------------------------------
 * Etichetta di stato compatta, non interattiva (nessun evento emesso:
 * un badge non si "clicca", è puro feedback visivo — se in futuro
 * servisse un badge cliccabile/rimovibile, quello è Chip, già distinto
 * nel piano dei componenti).
 *
 * Usa sempre la variante "soft" dei colori di stato (bg-subtle + text),
 * mai il riempimento saturo con testo bianco: più elegante e verificata
 * AA in entrambi i temi (vedi commenti in theme-light.css/theme-dark.css).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 */

import { createElement } from "../utils/dom.js";

const TONES = ["neutral", "success", "warning", "error", "info"];

function resolveTone(tone) {
  return TONES.includes(tone) ? tone : "neutral";
}

function render(el, props) {
  const { label, tone } = props;
  el.className = ["sl-badge", `sl-badge--${resolveTone(tone)}`].join(" ");
  el.textContent = label || "";
}

export function create(props = {}) {
  const element = createElement("span", {});
  render(element, props);

  function update(nextProps) {
    props = { ...props, ...nextProps };
    render(element, props);
  }

  function destroy() {
    element.remove();
  }

  return { element, update, destroy };
}
