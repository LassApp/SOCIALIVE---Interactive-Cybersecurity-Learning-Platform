/**
 * Modal.js
 * -----------------------------------------------------------------------
 * Contenuto sovrapposto con focus trap e chiusura via ESC/overlay/bottone
 * di chiusura. "Dialog" (conferma/alert) NON è un componente separato:
 * è la variante "dialog" di questo stesso componente (piano dei
 * componenti, Fase 1 §4), che aggiunge un footer con azioni Annulla/
 * Conferma al layout base (header con titolo+chiusura, body libero).
 *
 * Dipende da Button (bottone di chiusura a icona, azioni del footer in
 * variante dialog): la dipendenza è verso un ALTRO COMPONENTE, non un
 * service, quindi non è un'eccezione al principio "dumb" (§2.1) —
 * Modal resta privo di logica applicativa, riusa solo componenti già
 * pronti per non duplicarne markup/stile/accessibilità.
 *
 * A differenza degli altri componenti, create() qui equivale ad "apri
 * il modale": monta l'overlay in <body>, sposta il focus al suo interno
 * e lo intrappola, disabilita lo scroll della pagina sottostante. Le
 * chiusure "utente" (ESC, click overlay, bottone chiusura, Annulla)
 * fanno self-destroy — il consumer non deve ricordarsi di chiamare
 * destroy() in quei casi, ma riceve comunque "sl:modal-close" per
 * reagire (es. azzerare uno stato). destroy() resta richiamabile
 * esplicitamente in ogni momento (idempotente) e ripristina sempre
 * focus e scroll originali, indipendentemente da come viene invocata.
 *
 * NOTA — nessuno stacking: non è previsto aprire un Modal sopra un
 * altro (unico utilizzatore — il docente — nessun flusso attuale lo
 * richiede). Se in futuro servisse, il ripristino di overflow/focus
 * andrà reso stack-aware (debito tecnico noto, non introdotto ora per
 * YAGNI).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - title       {string}      opzionale, intestazione
 *   - ariaLabel   {string}      nome accessibile alternativo se non c'è
 *     title (fallback: "Finestra di dialogo") — un modale senza nome
 *     accessibile non è utilizzabile con screen reader
 *   - content     {Node|Node[]} corpo del modale (mai stringhe HTML,
 *     stesso motivo già documentato in Card.js: non diventare un
 *     vettore di injection quando i contenuti arriveranno dai JSON di
 *     scenario)
 *   - variant     {'default'|'dialog'} default: 'default'
 *   - confirmLabel {string}     default: "Conferma" (solo variant dialog)
 *   - cancelLabel  {string}     default: "Annulla" (solo variant dialog)
 *   - closeOnOverlayClick {boolean} default: true
 *   - closeOnEsc          {boolean} default: true
 *   - closeOnConfirm      {boolean} default: true — a false il modale
 *     resta aperto dopo "sl:modal-confirm" (es. futura conferma che
 *     attende un'operazione asincrona prima di chiudersi manualmente)
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:modal-close   detail: { reason: "escape"|"overlay"|"close-button"|"cancel"|"confirm" }
 *   - sl:modal-confirm detail: {}  (solo variant dialog, bottone Conferma)
 */

import { createElement } from "../utils/dom.js";
import { create as createButton } from "./Button.js";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let idCounter = 0;
function generateId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

// Icona × costruita inline: nessuna dipendenza da assets/icons/icons.svg,
// non ancora esistente (stesso limite già annotato per Button/Input).
// Quando lo sprite esisterà, sostituire con <use href="#icon-close">,
// il markup esterno del bottone (Button, variant icon) resta identico.
function buildCloseIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M6 6L18 18M18 6L6 18");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  return svg;
}

function normalizeContent(content) {
  if (content instanceof Node) return [content];
  if (Array.isArray(content)) return content.filter((node) => node instanceof Node);
  return [];
}

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

export function create(props = {}) {
  const variant = props.variant === "dialog" ? "dialog" : "default";
  const titleId = generateId("sl-modal-title");
  const previouslyFocused = document.activeElement;
  const childComponents = [];

  // --- struttura ----------------------------------------------------
  const titleEl = createElement("h2", { classNames: "sl-modal__title", attrs: { id: titleId } });

  const closeButton = createButton({
    variant: "icon",
    ariaLabel: "Chiudi",
    icon: buildCloseIcon(),
  });
  closeButton.element.classList.add("sl-modal__close");
  childComponents.push(closeButton);

  const header = createElement("div", { classNames: "sl-modal__header" }, [titleEl, closeButton.element]);

  const body = createElement("div", { classNames: "sl-modal__body" });
  normalizeContent(props.content).forEach((node) => body.appendChild(node));

  const panelChildren = [header, body];

  let confirmButton = null;
  let cancelButton = null;

  if (variant === "dialog") {
    cancelButton = createButton({ variant: "secondary", label: props.cancelLabel || "Annulla" });
    confirmButton = createButton({ variant: "primary", label: props.confirmLabel || "Conferma" });
    childComponents.push(cancelButton, confirmButton);
    panelChildren.push(
      createElement("div", { classNames: "sl-modal__footer" }, [cancelButton.element, confirmButton.element])
    );
  }

  const panel = createElement(
    "div",
    {
      classNames: "sl-modal",
      attrs: {
        role: variant === "dialog" ? "alertdialog" : "dialog",
        "aria-modal": "true",
        tabindex: "-1",
      },
    },
    panelChildren
  );

  const overlay = createElement("div", { classNames: "sl-modal-overlay" }, [panel]);

  function applyAccessibleName(nextProps) {
    titleEl.hidden = !nextProps.title;
    titleEl.textContent = nextProps.title || "";
    if (nextProps.title) {
      panel.setAttribute("aria-labelledby", titleId);
      panel.removeAttribute("aria-label");
    } else {
      panel.removeAttribute("aria-labelledby");
      panel.setAttribute("aria-label", nextProps.ariaLabel || "Finestra di dialogo");
    }
  }

  applyAccessibleName(props);

  // --- apertura: monta, blocca lo scroll, sposta il focus -----------
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  // Focus iniziale: per la variante dialog sul bottone "Annulla" (azione
  // meno distruttiva, pattern standard); per il default sul primo
  // elemento interattivo nel body (es. un campo di un form), altrimenti
  // sul bottone di chiusura — mai lasciare il focus fuori dal modale.
  const initialFocusTarget =
    variant === "dialog"
      ? cancelButton.element
      : getFocusable(body)[0] || getFocusable(panel)[0] || panel;
  initialFocusTarget.focus();

  function handleOverlayClick(event) {
    if (props.closeOnOverlayClick === false) return;
    if (event.target === overlay) close("overlay");
  }

  function handleCloseClick() {
    close("close-button");
  }

  function handleCancelClick() {
    close("cancel");
  }

  function handleConfirmClick() {
    overlay.dispatchEvent(new CustomEvent("sl:modal-confirm", { bubbles: true, detail: {} }));
    if (props.closeOnConfirm !== false) close("confirm");
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (props.closeOnEsc !== false) close("escape");
      return;
    }
    if (event.key === "Tab") {
      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  overlay.addEventListener("click", handleOverlayClick);
  closeButton.element.addEventListener("sl:click", handleCloseClick);
  if (cancelButton) cancelButton.element.addEventListener("sl:click", handleCancelClick);
  if (confirmButton) confirmButton.element.addEventListener("sl:click", handleConfirmClick);
  document.addEventListener("keydown", handleKeydown);

  function close(reason) {
    overlay.dispatchEvent(new CustomEvent("sl:modal-close", { bubbles: true, detail: { reason } }));
    destroy();
  }

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    document.body.style.overflow = "";
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
    overlay.removeEventListener("click", handleOverlayClick);
    document.removeEventListener("keydown", handleKeydown);
    childComponents.forEach((c) => c.destroy());
    overlay.remove();
  }

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    applyAccessibleName(props);
  }

  return { element: overlay, update, destroy };
}
