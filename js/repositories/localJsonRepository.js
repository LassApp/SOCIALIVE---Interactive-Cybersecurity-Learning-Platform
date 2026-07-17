/**
 * localJsonRepository.js
 * -----------------------------------------------------------------------
 * Interfaccia stabile di accesso ai dati (Repository Pattern, architettura
 * Fase 1 §11: "interfaccia comune... implementata oggi da un
 * localJsonRepository... in futuro da un supabaseRepository — i services
 * consumano sempre la stessa interfaccia"). Una SOLA fabbrica generica,
 * parametrizzata per URL/collezione, invece di un file per entità (utenti,
 * ruoli, e in futuro scenari/post): evita di duplicare la stessa logica
 * di fetch+parsing ad ogni nuova collezione JSON — stesso principio DRY
 * già seguito da dom.js/storage.js/focusTrap.js in Fase 2.
 *
 * SOLO list()/get() sono implementati. create()/update()/remove() NON
 * esistono ancora: un file JSON statico servito via fetch() su GitHub
 * Pages non può essere scritto dal client — implementarli ora
 * produrrebbe metodi che non potrebbero mai funzionare davvero (nessuna
 * persistenza reale, solo una mutazione della cache in memoria persa al
 * refresh): un'interfaccia bugiarda, peggiore di ometterla. Verranno
 * aggiunti quando esisteranno insieme un vero backend scrivibile
 * (Supabase) e un vero consumer (es. una futura gestione utenti).
 *
 * Cache in memoria per URL: ogni collezione viene richiesta una sola
 * volta per sessione di pagina — sufficiente per dati che oggi non
 * cambiano mai a runtime (utenti, ruoli). list() restituisce sempre una
 * COPIA dell'array: un consumer non deve poter corrompere la cache
 * interna mutando l'array che gli viene restituito.
 */

const cache = new Map(); // url -> Promise<Array>

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
  function fetchCollection() {
    if (!cache.has(url)) {
      const request = fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`localJsonRepository: HTTP ${response.status} su ${url}`);
          }
          return response.json();
        })
        .then((payload) => extractCollection(payload, collectionKey))
        .catch((error) => {
          cache.delete(url); // consente un nuovo tentativo alla chiamata successiva
          throw error;
        });
      cache.set(url, request);
    }
    return cache.get(url);
  }

  async function list() {
    const collection = await fetchCollection();
    return [...collection];
  }

  async function get(id) {
    const collection = await fetchCollection();
    return collection.find((item) => item[idField] === id) ?? null;
  }

  return { list, get };
}
