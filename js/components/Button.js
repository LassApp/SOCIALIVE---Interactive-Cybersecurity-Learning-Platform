/**
 * Button.js
 * -----------------------------------------------------------------------
 * Azione cliccabile. Varianti: primary, secondary, ghost, icon.
 *
 * Emette "sl:click" (invece di lasciare che i consumer ascoltino il
 * "click" nativo) per due motivi: uniformità del vocabolario di eventi
 * usato in tutto il Design System (§3 naming, "sl:nome-evento"), e per
 * poter allegare un detail strutturato (qui: la variante) senza che il
 * consumer debba leggerlo dal DOM.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Estensioni Fase 2 / Step 6 (per le azioni di PostCard — like/commenta/
 * condividi, icona+contatore su variante "ghost"):
 *   - prop "pressed" {boolean} opzionale: quando definita, riflette il
 *     pattern ARIA "toggle button" (aria-pressed="true|false"). Quando
 *     omessa (default, tutti i consumer esistenti), l'attributo non
 *     viene nemmeno scritto: zero cambi di comportamento per Modal/
 *     style-guide, che non la passano. Il COLORE dello stato "premuto"
 *     non è opinione di Button (che resta generico, riusabile per
 *     qualunque toggle futuro, non solo "mi piace") — è responsabilità
 *     del consumer tramite una propria classe modificatrice aggiunta
 *     sull'elemento restituito, stesso pattern già usato da AppHeader
 *     su Input (".sl-app-header__search-field").
 *   - "ariaLabel" ora si applica a QUALUNQUE variante, non solo "icon":
 *     serve quando la label VISIBILE (es. un contatore numerico, "128")
 *     non è di per sé un nome accessibile sufficiente ("128, pulsante"
 *     non comunica l'azione). Prima di questa estensione ariaLabel era
 *     ignorata fuori dalla variante icon — nessun consumer esistente la
 *     passava in quel caso, quindi l'aggiunta è additiva.
 */

import { createElement } from "../utils/dom.js";

const VARIANTS = ["primary", "secondary", "ghost", "icon"];

function resolveVariant(variant) {
  return VARIANTS.includes(variant) ? variant : "primary";
}

function render(el, props) {
  const { label, variant, disabled, icon, ariaLabel, pressed } = props;
  const safeVariant = resolveVariant(variant);

  // BUG TROVATO in Fase 2 / Step 6 (Playwright, durante il test di
  // PostCard): "el.className = ..." sovrascriveva l'INTERO attributo
  // class ad ogni render, cancellando qualunque classe aggiunta
  // dall'esterno sull'elemento restituito (pattern già usato altrove,
  // es. AppHeader su Input: ".sl-app-header__search-field") non appena
  // il consumer richiamava update(). Mai emerso prima perché nessun
  // consumer esistente (Modal: closeButton/cancelButton/confirmButton)
  // aggiungeva classi extra E chiamava update() sulla stessa istanza.
  // Fix: gestire SOLO le classi di cui Button è proprietario (base +
  // variante) con classList.add/remove, lasciando intatta qualunque
  // altra classe presente sull'elemento.
  el.classList.add("sl-button");
  VARIANTS.forEach((v) => el.classList.remove(`sl-button--${v}`));
  el.classList.add(`sl-button--${safeVariant}`);

  el.disabled = Boolean(disabled);
  el.setAttribute("aria-disabled", String(Boolean(disabled)));

  if (typeof pressed === "boolean") {
    el.setAttribute("aria-pressed", String(pressed));
  } else {
    el.removeAttribute("aria-pressed");
  }

  while (el.firstChild) el.removeChild(el.firstChild);
  el.removeAttribute("aria-label");

  if (icon) {
    const iconWrapper = createElement("span", {
      classNames: "sl-button__icon",
      attrs: { "aria-hidden": "true" },
    });
    iconWrapper.appendChild(icon.cloneNode(true));
    el.appendChild(iconWrapper);
  }

  if (safeVariant === "icon") {
    // Bottone icona-solo: nessuna label visibile, nome accessibile obbligatorio.
    const accessibleName = ariaLabel || label;
    if (accessibleName) el.setAttribute("aria-label", accessibleName);
  } else if (label) {
    el.appendChild(createElement("span", { classNames: "sl-button__label", text: label }));
    // Variante con label visibile: ariaLabel resta opzionale e, se
    // presente, SOVRASCRIVE il nome accessibile che il browser
    // deriverebbe altrimenti dal testo visibile (vedi rationale sopra).
    if (ariaLabel) el.setAttribute("aria-label", ariaLabel);
  }
}

export function create(props = {}) {
  const element = createElement("button", { attrs: { type: props.type || "button" } });
  render(element, props);

  element.addEventListener("click", () => {
    if (element.disabled) return;
    element.dispatchEvent(
      new CustomEvent("sl:click", {
        bubbles: true,
        detail: { variant: resolveVariant(props.variant) },
      })
    );
  });

  function update(nextProps) {
    props = { ...props, ...nextProps };
    render(element, props);
  }

  function destroy() {
    element.remove();
  }

  return { element, update, destroy };
}
