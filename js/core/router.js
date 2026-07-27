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
 *
 * FALLBACK "PAGINA NON TROVATA" (Fase 9): la costruzione del messaggio è
 * stata estratta in js/utils/fallbackMessage.js — bug reale corretto in
 * questo stesso step (non solo debito DRY): questo file impostava da solo
 * SOLO "padding" sul messaggio, mentre scenarioEngine.js/
 * profileTimelineRenderer.js impostavano anche "color"/"font-size" sulle
 * proprie copie (identiche tra loro) della stessa funzione — "Pagina non
 * trovata." rendeva quindi con colore/dimensione di default invece dello
 * stile "soft" usato ovunque altrove per gli stati non felici. Vedi
 * fallbackMessage.js per il rationale completo.
 *
 * document.title PER ROTTA (Fase 9, nuovo): nessuna pagina reale
 * aggiornava finora il titolo della scheda del browser (rimaneva sempre
 * "SocialAlive", il valore statico di index.html) — un doppio problema:
 * WCAG 2.4.2 (Page Titled) da un lato, e un difetto di realismo
 * dall'altro (un vero social aggiorna sempre il titolo scheda). Il
 * titolo arriva da chi registra la rotta (index.html), non è derivato
 * qui dall'hash: router.js resta ignaro del SIGNIFICATO delle pagine
 * concrete, si limita ad applicarlo al momento del mount — stesso
 * principio di dipendenza unidirezionale già seguito per "protected".
 * Per la rotta parametrica di scenario, oggi il titolo è generico
 * ("Scenario"): il nome reale del profilo si conosce solo dopo il fetch
 * asincrono in profileTimelineRenderer.js, che non fa parte di questo
 * intervento — un affinamento dinamico (il renderer sovrascrive
 * document.title una volta risolto il profilo) resta un possibile passo
 * futuro, non introdotto ora per restare nello scope dichiarato di
 * questo step.
 *
 * TRANSIZIONE TRA PAGINE (Fase 9, nuovo): il cambio rotta era l'unico
 * punto dell'intera app senza alcuna cura di transizione — mount()
 * smonta/rimonta in modo sincrono, zero opacity/transform. Si applica
 * SOLO un fade-IN del contenuto nuovo, non un fade-out del vecchio: lo
 * scambio DOM è già istantaneo e impercettibile (rimozione sincrona di
 * tutti i figli), coordinare anche un'uscita animata richiederebbe
 * ritardare la distruzione del controller precedente — complessità non
 * necessaria per l'effetto percepito voluto (un arrivo più morbido, non
 * una vera coreografia a due fasi). Le due classi (.sl-route-transition
 * base + .sl-route-transition--hidden modificatore) vivono in
 * css/base/global.css, non nel CSS di un componente: è un concern
 * generico applicato a QUALUNQUE elemento passato a init(), stesso
 * principio già seguito per la rete di sicurezza reduced-motion definita
 * nello stesso file. Nessun nuovo colore introdotto (solo opacity),
 * nessuna verifica di contrasto necessaria. Rispetta
 * prefers-reduced-motion automaticamente: --sl-duration-base è già
 * azzerato dal token (motion.css) per chi lo richiede, la rete di
 * sicurezza generale in global.css lo garantisce comunque anche se
 * questo file smettesse per errore di leggere il token in futuro —
 * stesso doppio livello di difesa già documentato per Modal/Skeleton/
 * ThemeSwitch.
 *
 * DOPPIO requestAnimationFrame in mount(), NON un reflow sincrono
 * (verificato empiricamente, non assunto sulla carta): il pattern
 * "aggiungi classe, forza un reflow con una lettura di offsetHeight,
 * rimuovi la classe" è la tecnica da manuale per ri-innescare una
 * transizione CSS — ma un harness isolato ha mostrato che NON scatta
 * "transitionstart"/"transitionend" quando eseguita dentro un handler
 * "hashchange" (esattamente il contesto in cui mount() viene SEMPRE
 * invocato in questa app, incluso il primo mount reale innescato dal
 * redirect di bootstrap): stessa identica sequenza, nessuna transizione
 * osservata. Anche un singolo requestAnimationFrame si è rivelato
 * insufficiente nello stesso harness. Solo il doppio rAF ha prodotto una
 * transizione realmente animata in modo affidabile — garantisce che il
 * browser abbia effettivamente reso un frame con lo stato "hidden"
 * applicato prima di rimuoverlo, indipendentemente dal contesto
 * (hashchange vs. script top-level) da cui mount() viene chiamato.
 */

import { hasValidSession } from "../services/authService.js";
import { buildFallbackMessage } from "../utils/fallbackMessage.js";

const routes = new Map(); // corrispondenza esatta: hash -> { controller, protected }
const parameterizedRoutes = []; // corrispondenza per pattern: [{ regex, paramNames, controller, protected }]
let currentDestroy = null;
let rootElement = null;

// document.title per rotta (Fase 9): centralizzato qui, non nei singoli
// page controller — stesso principio già seguito per la guardia di
// sessione e per "Pagina non trovata" (un concern generico di ogni
// rotta vive nel router, non ripetuto in ciascun controller). Il titolo
// arriva da chi registra la rotta (index.html, unico punto che conosce
// il significato di ciascuna — router.js resta ignaro delle pagine
// concrete, stesso principio già seguito per "protected"). Nessun
// titolo registrato (oggi: solo il fallback 404) → solo APP_NAME, senza
// un trattino finale vuoto.
const APP_NAME = "SocialAlive";

function applyTitle(title) {
  document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
}

function renderNotFound(container) {
  container.appendChild(buildFallbackMessage("Pagina non trovata."));
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

function mount(controller, params, title) {
  if (currentDestroy) {
    currentDestroy();
    currentDestroy = null;
  }
  while (rootElement.firstChild) rootElement.removeChild(rootElement.firstChild);
  applyTitle(title);
  currentDestroy = controller(rootElement, params) || null;

  // Fade-in del contenuto appena montato — vedi rationale in testa al
  // file. Doppio requestAnimationFrame, non il solo reflow sincrono
  // (void rootElement.offsetHeight): verificato empiricamente che
  // mount() viene SEMPRE invocato da dentro un handler "hashchange" in
  // questa app (anche il primo mount reale, innescato dal redirect di
  // bootstrap) — e in quel contesto specifico un reflow sincrono, o
  // anche un singolo rAF, non fanno scattare transitionstart/-end
  // (verificato con un harness isolato: stessa identica sequenza,
  // eseguita in un handler "hashchange" invece che nello script top-level
  // della pagina, non anima). Il doppio rAF garantisce che il browser
  // abbia effettivamente reso un frame con "hidden" applicato prima di
  // rimuoverlo, indipendentemente dal contesto di chiamata.
  rootElement.classList.add("sl-route-transition--hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rootElement.classList.remove("sl-route-transition--hidden");
    });
  });
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
    mount(exactRoute.controller, {}, exactRoute.title);
    return;
  }

  const matched = matchParameterizedRoute(rawHash);
  if (matched) {
    if (matched.route.protected && !hasValidSession()) {
      navigate("#/login");
      return;
    }
    mount(matched.route.controller, matched.params, matched.route.title);
    return;
  }

  mount(renderNotFound, {}, "Pagina non trovata");
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
 * @param {{ protected?: boolean, title?: string }} [options] "title"
 *   (Fase 9, additivo): testo mostrato come `${title} — SocialAlive` nel
 *   titolo della scheda del browser quando questa rotta è attiva. Se
 *   omesso, resta il solo APP_NAME — nessuna rotta esistente lo leggeva
 *   prima di questo step, quindi ometterlo non cambia comportamento.
 */
export function registerRoute(hash, controller, { protected: isProtected = false, title } = {}) {
  if (hash.includes(":")) {
    const { regex, paramNames } = compilePattern(hash);
    parameterizedRoutes.push({ regex, paramNames, controller, protected: isProtected, title });
  } else {
    routes.set(hash, { controller, protected: isProtected, title });
  }
}

/**
 * Avvia il router: monta la rotta corrente e resta in ascolto dei
 * cambi di hash e dell'evento di logout applicativo.
 * @param {HTMLElement} root elemento in cui montare/smontare le pagine
 */
export function init(root) {
  rootElement = root;
  rootElement.classList.add("sl-route-transition");
  window.addEventListener("hashchange", resolve);
  document.addEventListener("sl:auth-logout", () => navigate("#/login"));
  resolve();
}
