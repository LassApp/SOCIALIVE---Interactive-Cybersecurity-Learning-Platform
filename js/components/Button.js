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
 */

import { createElement } from "../utils/dom.js";

const VARIANTS = ["primary", "secondary", "ghost", "icon"];

function resolveVariant(variant) {
  return VARIANTS.includes(variant) ? variant : "primary";
}

function render(el, props) {
  const { label, variant, disabled, icon, ariaLabel } = props;
  const safeVariant = resolveVariant(variant);

  el.className = ["sl-button", `sl-button--${safeVariant}`].join(" ");
  el.disabled = Boolean(disabled);
  el.setAttribute("aria-disabled", String(Boolean(disabled)));

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
