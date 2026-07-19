/**
 * router.js
 * -----------------------------------------------------------------------
 * Router hash-based (architettura Fase 1 §7): nessuna configurazione
 * server richiesta, funziona su qualunque hosting statico (GitHub Pages)
 * senza 404 al refresh — a differenza della History API, scartata
 * esplicitamente in Fase 1 per questo stesso motivo.
 *
 * Interfaccia dei page controller: (container, params) => destroy | undefined
 * "params" è un'aggiunta ADDITIVA di Fase 5 (debito tecnico segnalato
 * esplicitamente in Fase 3 §10, "da estendere quando servirà davvero"):
 * i controller di Fase 3/4 (#/login, #/home) non lo leggono e continuano
 * a funzionare invariati — JavaScript ignora silenziosamente un
 * argomento in più su una funzione che ne dichiara uno solo. Per le
 * rotte SENZA parametri, "params" è sempre un oggetto vuoto {}, non
 * undefined: un controller futuro che leggesse per errore params.qualcosa
 * su una rotta non parametrica ottiene "undefined" invece di un'eccezione
 * su "impossibile leggere una proprietà di undefined".
 *
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
 * conosciuti da quelli inferiori). Lo stesso principio si applica ora
 * anche ai renderer di scenario (js/scenarios/scenarioEngine.js, Fase
 * 5): il router non sa che "#/scenario/:scenarioId" porta a uno
 * scenario, sa solo che porta a un controller — è il page controller
 * registrato su quella rotta a sapere cosa farne del parametro.
 *
 * ROTTE PARAMETRICHE (Fase 5, nuovo): un secondo elenco, separato dalla
 * Map di corrispondenza esatta già esistente da Fase 3 (#/login, #/home)
 * — la Map resta il percorso rapido invariato per le rotte statiche,
 * verificata PRIMA di scorrere l'elenco parametrico (nessuna modifica di
 * comportamento/prestazioni per il caso comune). Un segmento che inizia
 * con ":" (es. ":scenarioId" in "#/scenario/:scenarioId") diventa un
 * gruppo di cattura che accetta qualunque valore SENZA "/" — un id con
 * "/" al suo interno non è un caso reale per gli scenari di SOCIALIVE
 * (slug kebab-case) e viene deliberatamente trattato come "nessuna
 * corrispondenza" piuttosto che gestito in modo ambiguo.
 *
 * Nessun decodeURIComponent sui valori estratti: gli scenarioId sono
 * identificatori applicativi generati/costruiti internamente (mai
 * digitati liberamente da un utente in un campo di testo), quindi non
 * contengono caratteri che richiedano una decodifica — se un futuro
 * parametro dovesse accettare testo libero, andrà rivalutato allora
 * (YAGNI, stesso criterio già seguito ovunque nel progetto).
 *
 * Guardia (Fase 1 §7/§8): una rotta "protected" richiede
 * authService.hasValidSession() — altrimenti redirect a #/login PRIMA di
 * montare qualunque cosa (mai un flash di contenuto protetto). La
 * guardia si applica IDENTICA sia alle rotte esatte sia a quelle
 * parametriche (stessa struttura { controller, protected }, letta nello
 * stesso punto di resolve() per entrambe — nessuna duplicazione della
 * logica di guardia).
 *
 * Simmetricamente, #/login con sessione già valida redirige a #/home:
 * un utente già autenticato non deve rivedere il form. Questo redirect
 * resta specifico della sola rotta esatta "#/login" (non ha senso per le
 * rotte parametriche, che non esistevano quando questa regola fu scritta
 * in Fase 3).
 *
 * Bootstrap (hash assente o "#/"): non è una vera rotta, è il punto di
 * ingresso — decide da solo dove andare in base alla sessione (Fase 1
 * §2.4: "Bootstrap → redirect in base alla sessione"), non un default
 * fisso su #/login.
 *
 * sl:auth-logout ascoltato QUI, centralmente: qualunque punto
 * dell'interfaccia che scatena un logout (oggi ProfileMenu su #/home,
 * Fase 4) non deve "ricordarsi" di navigare a #/login — lo fa il router
 * una sola volta, per tutti i chiamanti presenti e futuri.
 */

import { hasValidSession } from "../services/authService.js";

const routes = new Map(); // corrispondenza esatta: hash -> { controller, protected }
const parameterizedRoutes = []; // corrispondenza per pattern: [{ regex, paramNames, controller, protected }]
let currentDestroy = null;
let rootElement = null;

function renderNotFound(container) {
  const message = document.createElement("p");
  message.textContent = "Pagina non trovata.";
  message.style.padding = "var(--sl-space-8)";
  container.appendChild(message);
  return undefined; // nessun cleanup necessario per questo fallback minimale
}

/**
 * Compila un pattern con segmenti ":nome" in una regex con gruppi di
 * cattura posizionali, risolti poi per nome tramite paramNames — un
 * array posizionale resta più semplice da leggere qui ed è sufficiente
 * al bisogno reale (un solo parametro per rotta, oggi), nessun vantaggio
 * concreto nell'uso di gruppi nominati (?<nome>...) a questa scala.
 * @param {string} pattern es. "#/scenario/:scenarioId"
 */
function compilePattern(pattern) {
  const paramNames = [];
  const source = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      // Escape defensivo dei caratteri speciali di regex nei segmenti
      // letterali — nessuno dei nostri hash li usa oggi, ma è lo stesso
      // criterio di validazione prudente già seguito altrove nel
      // progetto (es. extractCollection in localJsonRepository.js).
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${source}$`), paramNames };
}

function matchParameterizedRoute(rawHash) {
  for (const route of parameterizedRoutes) {
    const match = route.regex.exec(rawHash);
    if (!match) continue;
    const params = {};
    route.paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });
    return { route, params };
  }
  return null;
}

function mount(controller, params) {
  if (currentDestroy) {
    currentDestroy();
    currentDestroy = null;
  }
  while (rootElement.firstChild) rootElement.removeChild(rootElement.firstChild);
  currentDestroy = controller(rootElement, params) || null;
}

function resolve() {
  const rawHash = window.location.hash;

  if (!rawHash || rawHash === "#" || rawHash === "#/") {
    navigate(hasValidSession() ? "#/home" : "#/login");
    return;
  }

  const exactRoute = routes.get(rawHash);
  if (exactRoute) {
    if (exactRoute.protected && !hasValidSession()) {
      navigate("#/login");
      return;
    }
    if (rawHash === "#/login" && hasValidSession()) {
      navigate("#/home");
      return;
    }
    mount(exactRoute.controller, {});
    return;
  }

  const matched = matchParameterizedRoute(rawHash);
  if (matched) {
    if (matched.route.protected && !hasValidSession()) {
      navigate("#/login");
      return;
    }
    mount(matched.route.controller, matched.params);
    return;
  }

  mount(renderNotFound, {});
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
 * Registra una rotta, esatta o parametrica (un segmento ":nome" la
 * rende parametrica — Fase 5). Da chiamare in fase di bootstrap
 * (index.html), PRIMA di init().
 * @param {string} hash es. "#/home" oppure "#/scenario/:scenarioId"
 * @param {(container: HTMLElement, params: object) => (Function|void)} controller
 * @param {{ protected?: boolean }} [options]
 */
export function registerRoute(hash, controller, { protected: isProtected = false } = {}) {
  if (hash.includes(":")) {
    const { regex, paramNames } = compilePattern(hash);
    parameterizedRoutes.push({ regex, paramNames, controller, protected: isProtected });
  } else {
    routes.set(hash, { controller, protected: isProtected });
  }
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
