/**
 * router.js
 * -----------------------------------------------------------------------
 * Router hash-based (architettura Fase 1 §7): nessuna configurazione
 * server richiesta, funziona su qualunque hosting statico (GitHub Pages)
 * senza 404 al refresh — a differenza della History API, scartata
 * esplicitamente in Fase 1 per questo stesso motivo.
 *
 * Interfaccia dei page controller: (container) => destroy | undefined
 * Diversa DELIBERATAMENTE dall'interfaccia dei componenti UI
 * (create(props) => {element, update, destroy}): un page controller non
 * è un componente riusabile/passato per props — viene montato una sola
 * volta per navigazione e smontato alla successiva. Non serve un
 * update(): la sua reattività interna passa attraverso eventi/service,
 * non attraverso props ricevute dall'esterno.
 *
 * router.js NON importa alcun page controller: le rotte vengono
 * registrate da fuori (index.html, in fase di bootstrap) via
 * registerRoute(). Router resta infrastruttura CORE, ignara delle
 * pagine concrete — stesso principio di dipendenza unidirezionale già
 * fissato in Fase 1 §2.1 (i livelli superiori non devono essere
 * conosciuti da quelli inferiori).
 *
 * Guardia (Fase 1 §7/§8): una rotta "protected" richiede
 * authService.hasValidSession() — altrimenti redirect a #/login PRIMA di
 * montare qualunque cosa (mai un flash di contenuto protetto).
 * Simmetricamente, #/login con sessione già valida redirige a #/home:
 * un utente già autenticato non deve rivedere il form.
 *
 * Bootstrap (hash assente o "#/"): non è una vera rotta, è il punto di
 * ingresso — decide da solo dove andare in base alla sessione (Fase 1
 * §2.4: "Bootstrap → redirect in base alla sessione"), non un default
 * fisso su #/login.
 *
 * sl:auth-logout ascoltato QUI, centralmente: qualunque punto
 * dell'interfaccia che in futuro scatenerà un logout (oggi nessuno,
 * Fase 4+ probabilmente ProfileMenu su una pagina reale) non dovrà
 * "ricordarsi" di navigare a #/login — lo fa il router una sola volta,
 * per tutti i chiamanti presenti e futuri.
 */

import { hasValidSession } from "../services/authService.js";

const routes = new Map();
let currentDestroy = null;
let rootElement = null;

function renderNotFound(container) {
  const message = document.createElement("p");
  message.textContent = "Pagina non trovata.";
  message.style.padding = "var(--sl-space-8)";
  container.appendChild(message);
  return undefined; // nessun cleanup necessario per questo fallback minimale
}

function mount(controller) {
  if (currentDestroy) {
    currentDestroy();
    currentDestroy = null;
  }
  while (rootElement.firstChild) rootElement.removeChild(rootElement.firstChild);
  currentDestroy = controller(rootElement) || null;
}

function resolve() {
  const rawHash = window.location.hash;

  if (!rawHash || rawHash === "#" || rawHash === "#/") {
    navigate(hasValidSession() ? "#/home" : "#/login");
    return;
  }

  const route = routes.get(rawHash);
  if (!route) {
    mount(renderNotFound);
    return;
  }

  if (route.protected && !hasValidSession()) {
    navigate("#/login");
    return;
  }

  if (rawHash === "#/login" && hasValidSession()) {
    navigate("#/home");
    return;
  }

  mount(route.controller);
}

/**
 * Naviga programmaticamente verso un hash. Se l'hash richiesto è già
 * quello corrente, "hashchange" non scatterebbe da solo (il browser lo
 * emette solo su un cambiamento reale) — in quel caso si forza comunque
 * una risoluzione, per non lasciare il router silenzioso.
 */
export function navigate(hash) {
  if (window.location.hash === hash) {
    resolve();
  } else {
    window.location.hash = hash;
  }
}

/**
 * Registra una rotta. Da chiamare in fase di bootstrap (index.html),
 * PRIMA di init().
 * @param {string} hash es. "#/home"
 * @param {(container: HTMLElement) => (Function|void)} controller
 * @param {{ protected?: boolean }} [options]
 */
export function registerRoute(hash, controller, { protected: isProtected = false } = {}) {
  routes.set(hash, { controller, protected: isProtected });
}

/**
 * Avvia il router: monta la rotta corrente e resta in ascolto dei
 * cambi di hash e dell'evento di logout applicativo.
 * @param {HTMLElement} root elemento in cui montare/smontare le pagine
 */
export function init(root) {
  rootElement = root;
  window.addEventListener("hashchange", resolve);
  document.addEventListener("sl:auth-logout", () => navigate("#/login"));
  resolve();
}
