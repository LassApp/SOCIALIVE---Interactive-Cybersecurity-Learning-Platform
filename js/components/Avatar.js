/**
 * Avatar.js
 * -----------------------------------------------------------------------
 * Immagine profilo con fallback su iniziali. Il fallback scatta in due
 * casi: nessuna "src" fornita, oppure "src" presente ma il caricamento
 * fallisce (evento "error" nativo dell'<img>) — importante per il
 * realismo richiesto dal progetto: un feed con centinaia di post reali
 * avrà prima o poi un'immagine profilo non disponibile.
 *
 * Accessibilità: se ariaHidden non è impostato, il componente espone
 * sempre un nome accessibile (alt sull'<img>, oppure role="img" +
 * aria-label sul contenitore quando è visibile solo il fallback
 * testuale). ariaHidden=true è per i casi in cui il nome è già leggibile
 * altrove nel markup (es. accanto all'avatar in un header), per evitare
 * la doppia lettura da parte dello screen reader.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 */

import { createElement } from "../utils/dom.js";

// "xl" (96px) aggiunta in Fase 6/Step 3: l'header di un profilo reale
// richiede un avatar più prominente di "lg" (56px, pensato per header/
// liste). Estensione puramente additiva: sm/md/lg invariate, nessun
// consumer esistente (AppHeader, PostCard, ProfileMenu, StoriesBar)
// ne risente.
const SIZES = ["sm", "md", "lg", "xl"];

function resolveSize(size) {
  return SIZES.includes(size) ? size : "md";
}

function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function buildFallback(name) {
  return createElement("span", {
    classNames: "sl-avatar__fallback",
    attrs: { "aria-hidden": "true" },
    text: getInitials(name),
  });
}

function applyAccessibleName(container, name, ariaHidden) {
  if (ariaHidden) {
    container.setAttribute("aria-hidden", "true");
    container.removeAttribute("role");
    container.removeAttribute("aria-label");
  } else {
    container.removeAttribute("aria-hidden");
    container.setAttribute("role", "img");
    container.setAttribute("aria-label", name || "");
  }
}

function render(container, props) {
  const { src, name, size, ariaHidden } = props;

  container.className = ["sl-avatar", `sl-avatar--${resolveSize(size)}`].join(" ");
  while (container.firstChild) container.removeChild(container.firstChild);

  if (src) {
    // Con <img> valida, il nome accessibile è l'alt: il contenitore non
    // deve duplicarlo con role/aria-label (evita la doppia annuncio).
    container.removeAttribute("role");
    container.removeAttribute("aria-label");
    if (ariaHidden) container.setAttribute("aria-hidden", "true");
    else container.removeAttribute("aria-hidden");

    const img = createElement("img", {
      classNames: "sl-avatar__image",
      attrs: { src, alt: ariaHidden ? "" : name || "" },
    });
    img.addEventListener("error", () => {
      img.remove();
      container.appendChild(buildFallback(name));
      applyAccessibleName(container, name, ariaHidden);
    });
    container.appendChild(img);
  } else {
    container.appendChild(buildFallback(name));
    applyAccessibleName(container, name, ariaHidden);
  }
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
