/**
 * focusTrap.js
 * -----------------------------------------------------------------------
 * Logica di focus-trap condivisa. Estratta in questo step (Fase 2 / Step
 * 5) perché ProfileMenu ha bisogno esattamente della stessa selezione di
 * elementi focalizzabili e dello stesso ciclo Tab/Shift+Tab già scritti
 * per Modal: mantenerla duplicata in due componenti avrebbe violato DRY
 * (due copie da tenere sincronizzate ad ogni bugfix futuro sulla stessa
 * logica). Modal.js è stato aggiornato in questo stesso step per usare
 * questa utility al posto della propria copia locale — zero cambi di
 * comportamento, solo eliminazione della duplicazione (vedi test di
 * regressione).
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * Da invocare dentro un handler "keydown" quando event.key === "Tab":
 * impedisce che Tab/Shift+Tab facciano uscire il focus da "container",
 * facendolo invece ciclare tra il primo e l'ultimo elemento focalizzabile.
 */
export function trapTabKey(event, container) {
  const focusable = getFocusableElements(container);
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
