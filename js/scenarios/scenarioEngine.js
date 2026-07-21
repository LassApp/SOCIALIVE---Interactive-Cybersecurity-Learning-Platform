/**
 * scenarioEngine.js
 * -----------------------------------------------------------------------
 * Unico punto che interpreta i JSON di scenario e sceglie come
 * renderizzarli (architettura Fase 1 §2.4/§12: "cardine della
 * scalabilità richiesta — nuovi scenari = nuovi JSON, zero nuovo codice
 * nella maggioranza dei casi").
 *
 * L'engine NON conosce alcun tipo di scenario concreto (nessun
 * if/switch su "type" al proprio interno): il dispatch avviene tramite
 * un registro popolato da fuori con registerRenderer(type, renderer),
 * esattamente come router.js resta ignaro delle pagine concrete e le
 * riceve tramite registerRoute() — stesso principio di dipendenza
 * unidirezionale (Fase 1 §2.1), qui applicato ai renderer di scenario
 * invece che alle rotte. Un nuovo scenario con un "type" già registrato
 * (es. un futuro scenario "Privacy" con lo stesso "profile-timeline" di
 * Oversharing, Fase 1 §12) richiede zero modifiche a questo file.
 *
 * Firma del renderer: (container, scenario) => destroy|undefined —
 * stesso ordine argomenti già usato per i page controller
 * ((container, params) => destroy, router.js), non (scenario, container):
 * coerenza di convenzione più importante di un ordine "logico"
 * alternativo.
 *
 * Stati non felici, gestiti QUI centralmente (non nei singoli
 * renderer/page controller), stesso principio già seguito da router.js
 * per "Pagina non trovata":
 *   - nessun renderer registrato per lo "type" letto dal JSON →
 *     messaggio "in preparazione". Non è un placeholder ottimistico: è
 *     lo stato REALE di questa fase per "profile-timeline", prima che
 *     Fase 6 registri il vero renderer — descrive con onestà cosa
 *     succede oggi se si prova ad aprire un modulo collegato a uno
 *     scenario non ancora costruito.
 *   - scenario.json assente/non raggiungibile/privo del campo "type" →
 *     messaggio distinto "impossibile caricare" + console.error, stessa
 *     distinzione già applicata in authService.login() tra "errore di
 *     rete" e "credenziali sbagliate": l'utente non deve confondere un
 *     problema tecnico con "questo scenario non esiste ancora".
 *   - id dichiarato nel JSON diverso dallo scenarioId richiesto → solo
 *     un console.warn non bloccante (il file esiste ed è comunque
 *     valido: è un bug di dati da segnalare, non un motivo per negare
 *     la visualizzazione — stesso principio "non bloccare per un
 *     problema non critico" già seguito da authService per la sessione
 *     non persistita).
 *
 * Nessun nuovo file CSS per i messaggi di fallback: stesso trattamento
 * già riservato da router.js al proprio "Pagina non trovata" (stile
 * inline con i token --sl-*, non un componente/CSS dedicato) —
 * introdurre CSS reale per uno stato transitorio che Fase 6 sostituirà
 * per intero sarebbe lavoro gettato via, non riutilizzabilità (YAGNI).
 *
 * Nessun indicatore di caricamento visibile (es. Loader, Fase 2): il
 * fetch è locale e la latenza percepita è oggi trascurabile — stesso
 * livello di sobrietà già scelto da router.js, che non mostra alcun
 * indicatore mentre risolve una rotta. aria-busy sul wrapper resta
 * comunque impostato durante il caricamento, per onestà verso chi usa
 * uno screen reader anche quando la latenza reale sarà maggiore (rete
 * più lenta, scenario.json più pesante in fasi future).
 *
 * L'engine crea un proprio wrapper <div> dentro il container ricevuto,
 * non scrive direttamente nei figli del chiamante: destroy() rimuove
 * SOLO quel wrapper, mai altro contenuto che il chiamante avesse già
 * montato — stesso principio "ogni nodo ha un proprietario" già seguito
 * da Modal/Feed (ognuno distrugge solo ciò che ha creato).
 *
 * BUG TROVATO E CORRETTO in Fase 6/Step 3: il placeholder di Fase 5 era
 * sincrono (nessun fetch proprio), quindi il chiamante non aveva mai
 * avuto bisogno di attendere il valore restituito da renderer(...). Un
 * renderer che deve caricare dati propri (come il vero
 * profileTimelineRenderer, Fase 6/Step 3 — profile/stories/posts) è
 * necessariamente asincrono: senza "await", aria-busy veniva rimosso
 * subito invece che a fine caricamento reale, e "rendererDestroy"
 * restituiva una Promise invece della funzione di cleanup — la guardia
 * "typeof rendererDestroy === 'function'" in destroy() falliva quindi
 * silenziosamente, senza mai eseguire il cleanup del renderer (nessun
 * errore visibile, un leak silenzioso). Fix minimo e retrocompatibile:
 * "await" su un valore che non è già una Promise lo risolve
 * immediatamente, quindi un renderer sincrono esistente non cambia
 * comportamento.
 */

import { createLocalJsonResource } from "../repositories/localJsonRepository.js";

const renderers = new Map(); // type -> (container, scenario) => destroy|undefined

/**
 * Registra un renderer per un "type" di scenario. Da chiamare in fase di
 * bootstrap (index.html), PRIMA che scenarioPageController possa
 * risolvere una rotta #/scenario/:scenarioId — stesso momento e stesso
 * ruolo già svolto da router.registerRoute().
 * @param {string} type es. "profile-timeline"
 * @param {(container: HTMLElement, scenario: object) => (Function|void|Promise<Function|void>)} renderer
 *   Può essere sincrono o asincrono (Fase 6/Step 3 — bug corretto in questo
 *   stesso step: l'engine ora "awaita" sempre il valore restituito, anche
 *   se non è una Promise, quindi entrambe le forme funzionano). Un
 *   renderer che deve caricare dati propri (es. profile-timeline, che
 *   fa fetch di profile/stories/posts) è necessariamente asincrono.
 */
export function registerRenderer(type, renderer) {
  renderers.set(type, renderer);
}

function buildFallbackMessage(text) {
  const message = document.createElement("p");
  message.textContent = text;
  message.style.padding = "var(--sl-space-8)";
  message.style.color = "var(--sl-color-text-secondary)";
  message.style.fontSize = "var(--sl-font-size-md)";
  return message;
}

/**
 * Carica lo scenario identificato da scenarioId, risolve il renderer in
 * base al campo "type" del suo scenario.json e lo invoca dentro un
 * wrapper proprio, montato in "container".
 * @param {string} scenarioId es. "oversharing"
 * @param {HTMLElement} container
 * @returns {Promise<Function>} destroy — rimuove il wrapper e invoca il
 *   cleanup del renderer, se ne aveva restituito uno
 */
export async function loadScenario(scenarioId, container) {
  const wrapper = document.createElement("div");
  wrapper.className = "sl-scenario-viewport";
  wrapper.dataset.scenarioId = scenarioId;
  wrapper.setAttribute("aria-busy", "true");
  container.appendChild(wrapper);

  let rendererDestroy;

  try {
    const resource = createLocalJsonResource({ url: `data/scenarios/${scenarioId}/scenario.json` });
    const scenario = await resource.get();

    if (!scenario || typeof scenario !== "object" || !scenario.type) {
      throw new Error(`scenario.json non valido per "${scenarioId}": manca il campo "type".`);
    }

    if (scenario.id !== scenarioId) {
      console.warn(
        `[scenarioEngine] Lo scenario richiesto ("${scenarioId}") ha un id dichiarato diverso ("${scenario.id}") nel proprio scenario.json.`
      );
    }

    const renderer = renderers.get(scenario.type);
    if (renderer) {
      rendererDestroy = (await renderer(wrapper, scenario)) || undefined;
    } else {
      wrapper.appendChild(
        buildFallbackMessage(`Lo scenario "${scenario.title || scenarioId}" è in preparazione.`)
      );
    }
  } catch (error) {
    console.error(`[scenarioEngine] Impossibile caricare lo scenario "${scenarioId}"`, error);
    wrapper.appendChild(buildFallbackMessage("Impossibile caricare questo scenario. Riprova più tardi."));
  } finally {
    wrapper.removeAttribute("aria-busy");
  }

  return function destroy() {
    if (typeof rendererDestroy === "function") rendererDestroy();
    wrapper.remove();
  };
}
