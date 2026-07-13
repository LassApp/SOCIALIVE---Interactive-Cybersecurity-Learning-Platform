/**
 * Card.js
 * -----------------------------------------------------------------------
 * Contenitore generico riutilizzabile. PostCard (Fase 6/7) lo comporrà
 * come base, non lo duplicherà (regola esplicita di progetto: mai due
 * componenti per la stessa funzione).
 *
 * "content" accetta un Node singolo o un array di Node — mai una stringa
 * HTML: i chiamanti costruiscono i propri nodi (anche con l'helper
 * createElement) invece di passare markup grezzo, evitando che Card
 * diventi un vettore di injection quando in futuro i contenuti
 * arriveranno dai JSON di scenario.
 *
 * "interactive" è un'aggiunta rispetto al piano minimo (che indicava
 * solo "content"): senza, PostCard dovrebbe reimplementare gli stati
 * hover/focus di una card cliccabile invece di riusare questa base —
 * esattamente la duplicazione che il progetto vuole evitare.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 */

import { createElement } from "../utils/dom.js";

function normalizeContent(content) {
  if (content instanceof Node) return [content];
  if (Array.isArray(content)) return content.filter((node) => node instanceof Node);
  return [];
}

function render(el, props) {
  const { content, interactive } = props;
  el.className = ["sl-card", interactive ? "sl-card--interactive" : ""].filter(Boolean).join(" ");
  while (el.firstChild) el.removeChild(el.firstChild);
  normalizeContent(content).forEach((node) => el.appendChild(node));
}

export function create(props = {}) {
  const element = createElement("div", { attrs: { "data-component": "card" } });
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
