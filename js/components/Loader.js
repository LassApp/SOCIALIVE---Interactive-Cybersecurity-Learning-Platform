/**
 * Loader.js
 * -----------------------------------------------------------------------
 * Indicatore di attesa indeterminato (piano dei componenti, Fase 1 §4).
 * Anello SVG con un arco che ruota di continuo, colorato con currentColor
 * — eredita il colore del testo circostante (es. bianco dentro un Button
 * primary, come nel bottone "Accedi" di LoginForm durante l'invio).
 *
 * Costruito ORA (non rimandato per YAGNI come icone puramente decorative
 * es. lente di ricerca di AppHeader) perché è una dipendenza REALE: il
 * bottone di submit di LoginForm ha bisogno di uno stato "in corso"
 * riconoscibile — stessa logica già seguita per Skeleton in Fase 2/Step 7
 * (dipendenza reale della UI, non estetismo rimandabile).
 *
 * Puramente decorativo: aria-hidden SEMPRE true, stesso principio già
 * seguito da Skeleton — l'annuncio "operazione in corso" per screen
 * reader è responsabilità del consumer (es. la label del bottone che
 * cambia in "Accesso in corso…", o un aria-busy sul contenitore), non
 * di Loader stesso, che non sa in quale contesto viene usato.
 *
 * Animazione: nessun override locale di prefers-reduced-motion — la rete
 * di sicurezza generale in css/base/global.css azzera già QUALUNQUE
 * animation-duration per chi lo richiede (stesso principio già seguito
 * da Skeleton/Modal/ThemeSwitch, vedi commenti lì). Per chi lo richiede
 * l'anello resta fermo ma comunque visibile come forma: non è comunque
 * l'unico segnale di stato nei consumer che lo usano (LoginForm cambia
 * SEMPRE anche la label in "Accesso in corso…" — §5.7 architettura
 * Fase 1, mai il solo movimento/colore come segnale).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - size {'sm'|'md'|'lg'} default: 'md'
 */

const SIZES = ["sm", "md", "lg"];

function resolveSize(size) {
  return SIZES.includes(size) ? size : "md";
}

function svgNode(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

export function create(props = {}) {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  const track = svgNode("circle", { class: "sl-loader__track", cx: "12", cy: "12", r: "9" });
  const indicator = svgNode("circle", { class: "sl-loader__indicator", cx: "12", cy: "12", r: "9" });
  svg.appendChild(track);
  svg.appendChild(indicator);

  function applySize(size) {
    svg.setAttribute("class", `sl-loader sl-loader--${resolveSize(size)}`);
  }
  applySize(props.size);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    applySize(props.size);
  }

  function destroy() {
    svg.remove();
  }

  return { element: svg, update, destroy };
}
