/**
 * themeService.js
 * -----------------------------------------------------------------------
 * Selezione, persistenza e applicazione del tema (light/dark).
 * Non conosce altro DOM oltre all'attributo data-theme su <html>: i
 * componenti reagiscono da soli tramite le custom property CSS, non
 * vengono mai notificati singolarmente (§6 del documento di Fase 1).
 * L'evento sl:theme-change resta disponibile per i rari casi che non
 * possono reagire via CSS puro (es. un futuro grafico su <canvas>).
 */

import { getItem, setItem } from "../utils/storage.js";

// Deve coincidere con la chiave usata dallo script anti-FOUC in <head>
// di ogni pagina (duplicazione intenzionale: quello script deve restare
// sincrono e indipendente dai moduli ES per eliminare il flash del tema
// sbagliato, quindi non può importare questa costante).
export const THEME_STORAGE_KEY = "sl-theme";

export const THEME_NAMES = Object.freeze({ LIGHT: "light", DARK: "dark" });

const THEME_CHANGE_EVENT = "sl:theme-change";

let systemListenerAttached = false;

function systemPrefersDark() {
  return (
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function readStoredTheme() {
  const stored = getItem(THEME_STORAGE_KEY);
  return stored === THEME_NAMES.LIGHT || stored === THEME_NAMES.DARK ? stored : null;
}

/** Tema da usare quando non è ancora stato applicato nulla al documento. */
export function getPreferredTheme() {
  return readStoredTheme() ?? (systemPrefersDark() ? THEME_NAMES.DARK : THEME_NAMES.LIGHT);
}

/** Tema attualmente applicato al documento (fallback alla preferenza). */
export function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") || getPreferredTheme();
}

/** Applica il tema al documento senza persisterlo. */
export function applyTheme(theme) {
  const validTheme = theme === THEME_NAMES.DARK ? THEME_NAMES.DARK : THEME_NAMES.LIGHT;
  document.documentElement.setAttribute("data-theme", validTheme);
  document.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: validTheme } })
  );
  return validTheme;
}

/** Applica il tema e lo persiste come scelta esplicita dell'utente. */
export function setTheme(theme) {
  const validTheme = applyTheme(theme);
  setItem(THEME_STORAGE_KEY, validTheme);
  return validTheme;
}

export function toggleTheme() {
  return setTheme(getCurrentTheme() === THEME_NAMES.DARK ? THEME_NAMES.LIGHT : THEME_NAMES.DARK);
}

/**
 * Da chiamare una sola volta all'avvio dell'app, dopo lo script
 * anti-FOUC. Rifinisce lo stato (nel caso lo script inline non fosse
 * riuscito a leggere la preferenza) e resta in ascolto dei cambi di
 * preferenza di sistema — ma solo finché l'utente non ha scelto
 * esplicitamente un tema in SOCIALIVE.
 */
export function initTheme() {
  applyTheme(getCurrentTheme());

  if (systemListenerAttached || !window.matchMedia) return;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", (event) => {
    if (readStoredTheme() !== null) return; // preferenza esplicita: non sovrascrivere
    applyTheme(event.matches ? THEME_NAMES.DARK : THEME_NAMES.LIGHT);
  });
  systemListenerAttached = true;
}
