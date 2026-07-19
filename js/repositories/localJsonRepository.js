/**
 * localJsonRepository.js
 * -----------------------------------------------------------------------
 * Interfaccia stabile di accesso ai dati (Repository Pattern, architettura
 * Fase 1 §11: "interfaccia comune... implementata oggi da un
 * localJsonRepository... in futuro da un supabaseRepository — i services
 * consumano sempre la stessa interfaccia").
 *
 * DUE fabbriche, non una sola, a partire da Fase 5:
 *   - createLocalJsonRepository({ url, collectionKey, idField })
 *     per COLLEZIONI (un array di elementi con id) — users.json,
 *     roles.json, in futuro modules.json/notifications.json. Espone
 *     list()/get(id). INVARIATA nel comportamento rispetto a Fase 3.
 *   - createLocalJsonResource({ url})
 *     per RISORSE SINGOLE (un oggetto, non un array) — introdotta ora
 *     perché data/scenarios/<id>/scenario.json è esattamente questo caso:
 *     un solo oggetto con metadati, non una lista con id da cercare.
 *     Espone solo get() (l'intero payload).
 *
 * Le due fabbriche condividono la stessa cache/fetch (fetchJson, sotto):
 * stesso principio DRY già seguito da dom.js/storage.js/focusTrap.js in
 * Fase 2 — evitare di duplicare la stessa logica di fetch+parsing+cache
 * +gestione errori in due posti che fanno concettualmente la stessa cosa
 * (recuperare un JSON da un URL, una sola volta per sessione di pagina).
 *
 * SOLO letture (list/get). create()/update()/remove() NON esistono: un
 * file JSON statico servito via fetch() su GitHub Pages non può essere
 * scritto dal client — implementarli produrrebbe metodi che non
 * potrebbero mai funzionare davvero (nessuna persistenza reale). Verranno
 * aggiunti quando esisterà un vero backend scrivibile (Supabase).
 *
 * Cache in memoria per URL: ogni risorsa/collezione viene richiesta una
 * sola volta per sessione di pagina — sufficiente per dati che oggi non
 * cambiano mai a runtime. list() restituisce sempre una COPIA
 * dell'array: un consumer non deve poter corrompere la cache interna
 * mutando l'array che gli viene restituito. get() di una risorsa singola
 * restituisce il payload così com'è: non è una collezione mutabile per
 * costruzione dei consumer attuali (scenario.json viene solo letto, mai
 * iterato/filtrato) — se un futuro consumer lo mutasse in modo
 * problematico, valutare una copia anche qui allora (YAGNI: nessun
 * bisogno reale oggi).
 */

const cache = new Map(); // url -> Promise<any> (payload JSON grezzo, non ancora estratto/validato)

/**
 * Fetch con cache condivisa da entrambe le fabbriche. Un fallimento
 * (rete o HTTP non-2xx) rimuove la entry dalla cache, così una chiamata
 * successiva può ritentare invece di restare bloccata su un errore
 * permanente — stesso comportamento già presente in Fase 3, qui isolato
 * per essere riusato da createLocalJsonResource senza duplicarlo.
 * @param {string} url
 * @returns {Promise<any>}
 */
function fetchJson(url) {
  if (!cache.has(url)) {
    const request = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`localJsonRepository: HTTP ${response.status} su ${url}`);
        }
        return response.json();
      })
      .catch((error) => {
        cache.delete(url);
        throw error;
      });
    cache.set(url, request);
  }
  return cache.get(url);
}

function extractCollection(payload, collectionKey) {
  const collection = collectionKey ? payload?.[collectionKey] : payload;
  if (!Array.isArray(collection)) {
    throw new Error(
      `localJsonRepository: la chiave "${collectionKey}" non è un array nel payload di ${JSON.stringify(payload)}`
    );
  }
  return collection;
}

/**
 * @param {{ url: string, collectionKey?: string, idField?: string }} config
 *   - url: percorso del file JSON, relativo alla pagina che lo richiede
 *     (es. "data/users.json" — MAI con "/" iniziale: su GitHub Pages
 *     l'app vive in un sottopercorso, es. "/SOCIALIVE.../", e un path
 *     assoluto risolverebbe fuori dal repository).
 *   - collectionKey: chiave dell'array dentro il JSON (es. "users"); se
 *     omessa, il payload stesso deve essere già un array.
 *   - idField: campo usato come identificatore da get() (default: "id").
 */
export function createLocalJsonRepository({ url, collectionKey, idField = "id" }) {
  async function list() {
    const payload = await fetchJson(url);
    const collection = extractCollection(payload, collectionKey);
    return [...collection];
  }

  async function get(id) {
    const payload = await fetchJson(url);
    const collection = extractCollection(payload, collectionKey);
    return collection.find((item) => item[idField] === id) ?? null;
  }

  return { list, get };
}

/**
 * Fabbrica per una risorsa JSON singola (un oggetto, non una collezione).
 * Primo consumo reale: data/scenarios/<scenarioId>/scenario.json
 * (Fase 5 — js/scenarios/scenarioEngine.js).
 *
 * @param {{ url: string }} config
 * @returns {{ get: () => Promise<object> }}
 */
export function createLocalJsonResource({ url }) {
  async function get() {
    return fetchJson(url);
  }

  return { get };
}
