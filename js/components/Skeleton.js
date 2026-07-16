/**
 * Skeleton.js
 * -----------------------------------------------------------------------
 * Placeholder di caricamento generico (piano dei componenti, Fase 1 §4).
 * Componente puramente decorativo: aria-hidden SEMPRE true — l'annuncio
 * "caricamento in corso" per screen reader è responsabilità del
 * consumer tramite una propria regione aria-live (qui: Feed), non di
 * Skeleton stesso, che non sa in quale contesto viene usato né cosa sta
 * effettivamente caricando.
 *
 * "shape" seleziona la forma:
 *   - "text"   (default) barra rettangolare, per righe di testo
 *   - "circle" cerchio, per placeholder di Avatar — prop "size"
 *     (sm/md/lg), STESSE dimensioni di Avatar (32/40/56px) per
 *     allinearsi visivamente quando i due compaiono fianco a fianco
 *   - "block"  rettangolo alto, per placeholder di immagini/media
 *
 * "count" ripete la stessa forma N volte, impilata verticalmente con un
 * piccolo gap — comodo per "N righe di testo" senza dover creare N
 * istanze manualmente dal consumer.
 *
 * ANIMAZIONE: pulsazione di sola OPACITÀ (non uno shimmer con gradiente
 * in movimento, per restare semplice) sul colore --sl-color-border-subtle,
 * già verificato per uso puramente decorativo (cfr. card.css) — nessun
 * nuovo accostamento colore da verificare, l'animazione non tocca mai
 * testo/contenuto reale, solo forme vuote. Nessun override locale di
 * prefers-reduced-motion: la rete di sicurezza generale già presente in
 * css/base/global.css azzera automaticamente QUALUNQUE animation-duration
 * per chi lo richiede (stesso principio già seguito da modal.css/
 * theme-switch.css, vedi commenti lì).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 * (nessun listener viene mai attaccato: destroy() si limita a rimuovere
 * il nodo dal DOM).
 *
 * Props:
 *   - shape {'text'|'circle'|'block'} default: 'text'
 *   - size  {'sm'|'md'|'lg'} solo per shape 'circle', default: 'md'
 *   - width {string} solo per shape 'text'/'block' (es. '60%', '120px'),
 *     default: '100%' (CSS)
 *   - count {number} default: 1
 */

import { createElement } from "../utils/dom.js";

const SHAPES = ["text", "circle", "block"];
const SIZES = ["sm", "md", "lg"];

function resolveShape(shape) {
  return SHAPES.includes(shape) ? shape : "text";
}

function resolveSize(size) {
  return SIZES.includes(size) ? size : "md";
}

function buildBone(props) {
  const shape = resolveShape(props.shape);
  const bone = createElement("span", {
    classNames: [
      "sl-skeleton",
      `sl-skeleton--${shape}`,
      shape === "circle" ? `sl-skeleton--${resolveSize(props.size)}` : "",
    ],
  });
  if (shape !== "circle" && props.width) {
    bone.style.width = props.width;
  }
  return bone;
}

function render(element, props) {
  while (element.firstChild) element.removeChild(element.firstChild);
  const count = Math.max(1, Number(props.count) || 1);
  for (let i = 0; i < count; i += 1) {
    element.appendChild(buildBone(props));
  }
}

export function create(props = {}) {
  const element = createElement("div", {
    classNames: "sl-skeleton-group",
    attrs: { "aria-hidden": "true" },
  });
  render(element, props);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    render(element, props);
  }

  function destroy() {
    element.remove();
  }

  return { element, update, destroy };
}
