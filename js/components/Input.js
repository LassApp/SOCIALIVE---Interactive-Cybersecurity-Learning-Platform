/**
 * Input.js
 * -----------------------------------------------------------------------
 * Campo di testo generico (text/email/password). Componente "dumb":
 * nessuna dipendenza da servizi, nessuna validazione applicativa — la
 * validazione (Fase 3, form di login) resta responsabilità del page
 * controller/authService, che passerà "error" come prop quando serve
 * (stesso principio già seguito da Card: il componente riceve dati,
 * non li produce).
 *
 * Estensioni rispetto al piano minimo (type, value, error): "label",
 * "placeholder", "helperText", "disabled", "required", "id", "name".
 * Senza una label visibile associata via <label for>, il campo non è
 * utilizzabile in modo accessibile — non è un'aggiunta opzionale ma un
 * requisito minimo (stesso criterio già usato per aggiungere
 * "interactive" a Card: evitare che ogni consumer debba reimplementare
 * ciò che il componente dovrebbe già garantire).
 *
 * Bordo di default: --sl-color-border-strong, non --sl-color-border-subtle
 * — coerente con il commento già presente in card.css ("border-strong,
 * usato altrove per confini funzionali come l'outline di un input"),
 * che aveva già anticipato questa scelta.
 *
 * Niente pulsante mostra/nascondi per il tipo "password": richiederebbe
 * un'icona dallo sprite (assets/icons/icons.svg), non ancora esistente
 * — stesso limite già annotato per l'icona segnaposto di Button in
 * style-guide.html. Rimandato a quando lo sprite esisterà (YAGNI).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 */

import { createElement } from "../utils/dom.js";

const TYPES = ["text", "email", "password"];

let idCounter = 0;
function generateId() {
  idCounter += 1;
  return `sl-input-${idCounter}`;
}

function resolveType(type) {
  return TYPES.includes(type) ? type : "text";
}

function render(refs, props) {
  const { label, type, placeholder, error, helperText, disabled, required, name } = props;

  refs.labelEl.textContent = label ? `${label}${required ? " *" : ""}` : "";
  refs.labelEl.hidden = !label;

  refs.field.type = resolveType(type);
  refs.field.placeholder = placeholder || "";
  refs.field.disabled = Boolean(disabled);
  refs.field.required = Boolean(required);
  refs.field.setAttribute("aria-disabled", String(Boolean(disabled)));
  if (name) refs.field.name = name;

  const message = error || helperText;
  refs.helper.textContent = message || "";
  refs.helper.hidden = !message;
  refs.helper.classList.toggle("sl-input__helper--error", Boolean(error));

  refs.field.setAttribute("aria-invalid", String(Boolean(error)));
  if (message) {
    refs.field.setAttribute("aria-describedby", refs.helper.id);
  } else {
    refs.field.removeAttribute("aria-describedby");
  }
}

export function create(props = {}) {
  const baseId = props.id || generateId();
  const helperId = `${baseId}-helper`;

  const labelEl = createElement("label", {
    classNames: "sl-input__label",
    attrs: { for: baseId },
  });

  const field = createElement("input", {
    classNames: "sl-input__field",
    attrs: { id: baseId },
  });
  if (props.value !== undefined) field.value = props.value;

  const helper = createElement("p", {
    classNames: "sl-input__helper",
    attrs: { id: helperId },
  });

  const element = createElement("div", { classNames: "sl-input" }, [labelEl, field, helper]);

  const refs = { labelEl, field, helper };
  render(refs, props);

  function handleInput() {
    element.dispatchEvent(
      new CustomEvent("sl:input", { bubbles: true, detail: { value: field.value } })
    );
  }

  function handleBlur() {
    element.dispatchEvent(
      new CustomEvent("sl:blur", { bubbles: true, detail: { value: field.value } })
    );
  }

  field.addEventListener("input", handleInput);
  field.addEventListener("blur", handleBlur);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    if (nextProps.value !== undefined && nextProps.value !== field.value) {
      field.value = nextProps.value;
    }
    render(refs, props);
  }

  function destroy() {
    field.removeEventListener("input", handleInput);
    field.removeEventListener("blur", handleBlur);
    element.remove();
  }

  return { element, update, destroy };
}
