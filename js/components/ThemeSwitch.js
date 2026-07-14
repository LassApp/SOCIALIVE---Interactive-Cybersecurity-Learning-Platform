/**
 * ThemeSwitch.js
 * -----------------------------------------------------------------------
 * Toggle accessibile per il cambio tema Light/Dark — pattern ARIA
 * "switch" nativo su bottone: <button role="switch" aria-checked>.
 *
 * Unico componente del Design System autorizzato a importare
 * direttamente un service (themeService): il tema è stato applicativo
 * globale — un solo valore per l'intera pagina, applicato su <html> e
 * persistito — non un dato che scende per props da un page controller.
 * Tutti gli altri componenti restano "dumb" (architettura Fase 1, §2.1);
 * questa è l'eccezione già prevista dal piano dei componenti (§4:
 * riga ThemeSwitch → Dipendenze: themeService).
 *
 * Il componente NON duplica la logica di toggle/persistenza: chiama
 * toggleTheme() e si limita a riflettere lo stato. Resta sincronizzato
 * anche se il tema cambia da un'altra fonte (un'altra istanza di
 * ThemeSwitch altrove nella pagina, o il listener di sistema attivato
 * da themeService.initTheme()) ascoltando "sl:theme-change" su document
 * — lo stesso evento che themeService già emette per i casi che non
 * possono reagire via CSS puro (architettura Fase 1, §6).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - ariaLabel  {string}  default: "Cambia tema"
 *   - showLabel  {boolean} default: true — mostra "Tema chiaro/scuro" accanto al toggle
 *   - disabled   {boolean} default: false
 *   - currentTheme {string} opzionale, evita una lettura ridondante di
 *     getCurrentTheme() se il chiamante lo conosce già; se omesso il
 *     componente lo richiede da solo (è comunque dipendente dal service).
 */

import { createElement } from "../utils/dom.js";
import { getCurrentTheme, toggleTheme, THEME_NAMES } from "../services/themeService.js";

const THEME_CHANGE_EVENT = "sl:theme-change";

function labelForTheme(theme) {
  return theme === THEME_NAMES.DARK ? "Tema scuro" : "Tema chiaro";
}

function render(refs, state, props) {
  const isDark = state.theme === THEME_NAMES.DARK;
  refs.element.setAttribute("aria-checked", String(isDark));
  refs.element.setAttribute("aria-label", props.ariaLabel || "Cambia tema");

  refs.label.textContent = labelForTheme(state.theme);
  refs.label.hidden = props.showLabel === false;
}

export function create(props = {}) {
  const state = { theme: props.currentTheme || getCurrentTheme() };

  const thumb = createElement("span", { classNames: "sl-theme-switch__thumb" });
  const track = createElement(
    "span",
    { classNames: "sl-theme-switch__track", attrs: { "aria-hidden": "true" } },
    [thumb]
  );
  const label = createElement("span", { classNames: "sl-theme-switch__label" });

  const element = createElement(
    "button",
    { classNames: "sl-theme-switch", attrs: { type: "button", role: "switch" } },
    [track, label]
  );

  const refs = { element, track, thumb, label };

  render(refs, state, props);
  element.disabled = Boolean(props.disabled);
  element.setAttribute("aria-disabled", String(Boolean(props.disabled)));

  function handleClick() {
    if (element.disabled) return;
    // themeService applica il tema, lo persiste ed emette sl:theme-change
    // su document: questo componente non fa nulla di tutto ciò da solo.
    toggleTheme();
  }

  function handleThemeChange(event) {
    state.theme = event.detail.theme;
    render(refs, state, props);
  }

  element.addEventListener("click", handleClick);
  document.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    if (typeof nextProps.disabled === "boolean") {
      element.disabled = nextProps.disabled;
      element.setAttribute("aria-disabled", String(nextProps.disabled));
    }
    render(refs, state, props);
  }

  function destroy() {
    element.removeEventListener("click", handleClick);
    document.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    element.remove();
  }

  return { element, update, destroy };
}
