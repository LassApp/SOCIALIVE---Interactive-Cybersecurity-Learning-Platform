/**
 * Dropdown.js
 * -----------------------------------------------------------------------
 * Selettore a comparsa per scegliere UN valore tra più opzioni (piano
 * dei componenti, Fase 1 §4: "Dropdown — options/value, sl:change").
 * Pianificato fin da Fase 1 e mai costruito per mancanza di un consumer
 * reale (YAGNI): il primo è la scelta della domanda nello scenario
 * "Allucinazioni". Ora che esiste, è un componente generico — non sa
 * nulla di domande — riusabile da qualunque scenario futuro.
 *
 * PERCHÉ NON UN <select> NATIVO: il menu nativo lo disegna il sistema
 * operativo, con righe piccole e uno stile che non appartiene al Design
 * System — su una LIM, proiettato, è il punto più "scolastico" della
 * pagina. Qui le righe sono alte almeno 48px e usano gli stessi token
 * di ProfileMenu (bg-elevated, shadow-2, radius-lg).
 *
 * PATTERN ARIA: "listbox" collassabile (WAI-ARIA Authoring Practices,
 * select-only):
 *   - il trigger è un <button aria-haspopup="listbox"> con
 *     aria-expanded; il suo nome accessibile unisce l'etichetta e il
 *     valore corrente (aria-labelledby), così uno screen reader legge
 *     "Domanda, Quando è nato Gerry Scotti?";
 *   - aperta la lista, il focus passa alla lista stessa e l'opzione
 *     "attiva" è indicata con aria-activedescendant — le opzioni NON
 *     sono focalizzabili una per una (stesso modello di un <select>).
 *   - tastiera sul trigger: Invio/Spazio (click nativo del bottone),
 *     Freccia giù/su aprono; sulla lista: frecce, Home/End spostano
 *     l'opzione attiva, Invio/Spazio scelgono, Esc chiude restituendo il
 *     focus al trigger, Tab chiude e lascia proseguire il focus.
 *   - la scelta con il mouse chiude e riporta il focus sul trigger; un
 *     click fuori chiude SENZA toccare il focus (l'utente sta andando
 *     altrove).
 * Nessun type-ahead (ricerca digitando): con una decina di opzioni non
 * serve (YAGNI).
 *
 * Etichetta: "label" è sempre presente nel DOM (nome accessibile
 * reale); "hideLabel" la nasconde solo alla vista con .sl-visually-hidden
 * — stesso criterio già seguito da Input.
 *
 * Interfaccia: create(props) → { element, update(props), destroy(), focus() }
 *
 * Props:
 *   - options   {Array<{ value: string, label: string }>} richiesto
 *   - value     {string} valore selezionato (se assente, nessuna selezione)
 *   - label     {string} etichetta (nome accessibile)
 *   - hideLabel {boolean} default: false
 *   - placeholder {string} testo del trigger senza selezione
 *   - disabled  {boolean} default: false
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:change  detail: { value, label } — solo se la scelta CAMBIA
 */

import { createElement, clearChildren } from "../utils/dom.js";
import { svgNode } from "../utils/svg.js";

let idCounter = 0;
function generateId() {
  idCounter += 1;
  return `sl-dropdown-${idCounter}`;
}

function buildChevron() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" });
  svg.appendChild(
    svgNode("path", {
      d: "M6 9l6 6 6-6",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

function buildCheck() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" });
  svg.appendChild(
    svgNode("path", {
      d: "M5 12.5l4.5 4.5L19 7.5",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

export function create(props = {}) {
  const baseId = generateId();
  const labelId = `${baseId}-label`;
  const valueId = `${baseId}-value`;
  const listId = `${baseId}-list`;

  const state = { open: false, activeIndex: -1 };
  let options = [];
  let optionElements = [];

  const labelEl = createElement("span", { classNames: "sl-dropdown__label", attrs: { id: labelId } });

  const valueEl = createElement("span", { classNames: "sl-dropdown__value", attrs: { id: valueId } });
  const chevron = createElement("span", { classNames: "sl-dropdown__chevron", attrs: { "aria-hidden": "true" } }, [
    buildChevron(),
  ]);
  const trigger = createElement(
    "button",
    {
      classNames: "sl-dropdown__trigger",
      attrs: {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": "false",
        "aria-controls": listId,
        "aria-labelledby": `${labelId} ${valueId}`,
      },
    },
    [valueEl, chevron]
  );

  const list = createElement("ul", {
    classNames: "sl-dropdown__list",
    attrs: { id: listId, role: "listbox", tabindex: "-1", "aria-labelledby": labelId },
  });
  list.hidden = true;

  const element = createElement("div", { classNames: "sl-dropdown" }, [labelEl, trigger, list]);

  // --- rendering ------------------------------------------------------
  function selectedIndex() {
    return options.findIndex((option) => option.value === props.value);
  }

  function optionId(index) {
    return `${baseId}-option-${index}`;
  }

  function renderOptions() {
    clearChildren(list);
    optionElements = options.map((option, index) => {
      const item = createElement(
        "li",
        {
          classNames: "sl-dropdown__option",
          attrs: { id: optionId(index), role: "option", "aria-selected": "false" },
        },
        [
          createElement("span", { classNames: "sl-dropdown__option-text", text: option.label }),
          createElement("span", { classNames: "sl-dropdown__check", attrs: { "aria-hidden": "true" } }, [buildCheck()]),
        ]
      );
      item.addEventListener("click", () => selectIndex(index));
      item.addEventListener("mousemove", () => {
        if (state.activeIndex !== index) setActive(index);
      });
      list.appendChild(item);
      return item;
    });
  }

  function renderSelection() {
    const index = selectedIndex();
    valueEl.textContent = index >= 0 ? options[index].label : props.placeholder || "";
    optionElements.forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
  }

  function renderStatic() {
    labelEl.textContent = props.label || "";
    labelEl.hidden = !props.label;
    labelEl.classList.toggle("sl-visually-hidden", Boolean(props.label) && Boolean(props.hideLabel));
    trigger.disabled = Boolean(props.disabled);
    trigger.setAttribute("aria-disabled", String(Boolean(props.disabled)));
  }

  function setActive(index) {
    state.activeIndex = index;
    optionElements.forEach((item, i) => item.classList.toggle("sl-dropdown__option--active", i === index));
    if (index >= 0) {
      list.setAttribute("aria-activedescendant", optionId(index));
      optionElements[index].scrollIntoView({ block: "nearest" });
    } else {
      list.removeAttribute("aria-activedescendant");
    }
  }

  // --- apertura / chiusura -------------------------------------------
  function handleDocumentPointerDown(event) {
    if (!element.contains(event.target)) close({ restoreFocus: false });
  }

  function open() {
    if (state.open || props.disabled || options.length === 0) return;
    state.open = true;
    list.hidden = false;
    element.classList.add("sl-dropdown--open");
    trigger.setAttribute("aria-expanded", "true");
    setActive(Math.max(selectedIndex(), 0));
    list.focus({ preventScroll: true });
    document.addEventListener("pointerdown", handleDocumentPointerDown);
  }

  function close({ restoreFocus = true } = {}) {
    if (!state.open) return;
    state.open = false;
    list.hidden = true;
    element.classList.remove("sl-dropdown--open");
    trigger.setAttribute("aria-expanded", "false");
    setActive(-1);
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
    if (restoreFocus) trigger.focus();
  }

  function selectIndex(index) {
    const chosen = options[index];
    if (!chosen) return;
    const changed = chosen.value !== props.value;
    props = { ...props, value: chosen.value };
    renderSelection();
    close();
    if (changed) {
      element.dispatchEvent(
        new CustomEvent("sl:change", { bubbles: true, detail: { value: chosen.value, label: chosen.label } })
      );
    }
  }

  // --- tastiera -------------------------------------------------------
  function handleTriggerClick() {
    if (state.open) close();
    else open();
  }

  function handleTriggerKeydown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
    }
  }

  function handleListKeydown(event) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive(Math.min(state.activeIndex + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive(Math.max(state.activeIndex - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectIndex(state.activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close({ restoreFocus: false });
        break;
      default:
    }
  }

  trigger.addEventListener("click", handleTriggerClick);
  trigger.addEventListener("keydown", handleTriggerKeydown);
  list.addEventListener("keydown", handleListKeydown);

  function applyProps() {
    options = Array.isArray(props.options) ? props.options.map((option) => ({ ...option })) : [];
    renderStatic();
    renderOptions();
    renderSelection();
  }

  applyProps();

  function update(nextProps = {}) {
    const wasOpen = state.open;
    if (wasOpen) close({ restoreFocus: false });
    props = { ...props, ...nextProps };
    applyProps();
  }

  function focus() {
    trigger.focus();
  }

  function destroy() {
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
    trigger.removeEventListener("click", handleTriggerClick);
    trigger.removeEventListener("keydown", handleTriggerKeydown);
    list.removeEventListener("keydown", handleListKeydown);
    element.remove();
  }

  return { element, update, destroy, focus };
}
