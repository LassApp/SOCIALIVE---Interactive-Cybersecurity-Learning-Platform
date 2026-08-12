/**
 * authService.js
 * -----------------------------------------------------------------------
 * Orchestrazione applicativa dell'autenticazione: login/logout/sessione.
 * RISCRITTO per Supabase Auth (in precedenza: adapter locale su
 * data/users.json) — superficie pubblica INVARIATA per ogni consumer
 * esistente (loginPageController.js, router.js, appShell.js): stessi
 * quattro nomi esportati, stessa forma dei valori di ritorno. Un solo
 * export realmente nuovo, initSession() — additivo, richiesto solo dal
 * bootstrap in index.html (vedi sotto), zero impatto sugli altri
 * consumer che non lo chiamano.
 *
 * IL VINCOLO ARCHITETTURALE CENTRALE DI QUESTA RISCRITTURA:
 * router.js chiama hasValidSession() in modo SINCRONO, dentro resolve(),
 * invocato a sua volta sincronicamente da un handler "hashchange" — non
 * è mai stato asincrono in 10 fasi di sviluppo, ed è un'invariante che
 * NON si vuole rompere ora (renderlo asincrono propagherebbe la
 * ristrutturazione fino a mount()/navigate(), un raggio di modifica non
 * commisurato all'obiettivo di questa fase). Supabase Auth espone però
 * solo API asincrone (anche getSession(), che pure legge quasi sempre un
 * valore già in cache, resta sempre una Promise per costruzione della
 * libreria).
 *
 * SOLUZIONE — cache sincrona in-memory, mai una seconda fonte di verità:
 * "currentUser" (variabile di modulo) rispecchia SEMPRE lo stato reale
 * della sessione Supabase, aggiornato reattivamente da
 * supabase.auth.onAuthStateChange() per OGNI evento che Supabase stesso
 * gestisce internamente — login, logout, refresh automatico del token,
 * e persino un logout avvenuto in un'ALTRA SCHEDA dello stesso browser
 * (Supabase lo propaga da solo via BroadcastChannel: risolve
 * gratuitamente un limite noto e accettato fin dalla Fase 3, "la
 * sessione non si sincronizza tra schede", mai stato nello scope di
 * nessuna fase precedente). hasValidSession()/getCurrentUser() restano
 * quindi sincrone: leggono solo questa cache, mai Supabase direttamente.
 *
 * initSession() — L'UNICO PUNTO ASINCRONO INTRODOTTO, isolato al
 * bootstrap: va chiamato una sola volta in index.html, con un "await",
 * PRIMA di router.init() — popola la cache con lo stato reale già
 * esistente (se un token valido è già persistito da Supabase) prima che
 * la prima resolve() del router possa mai osservarla. Ometterlo
 * produrrebbe un falso "non autenticato" al primo caricamento pagina,
 * anche per chi ha già una sessione valida.
 *
 * "sl:auth-logout" resta lo stesso evento su cui router.js è già in
 * ascolto (nessuna modifica lì): la differenza è SOLO nel momento in cui
 * viene emesso — non più in modo sincrono dentro logout() (come con la
 * sessione custom precedente), ma dentro il listener onAuthStateChange,
 * non appena Supabase confermi il SIGNED_OUT. In pratica un ritardo di
 * pochi millisecondi, dipendente dalla rete — un compromesso onesto,
 * non un difetto nascosto: preferibile a mantenere un secondo meccanismo
 * di stato locale in parallelo a quello reale di Supabase.
 *
 * Punto di integrazione Supabase (Fase 1 §11): completato con questa
 * riscrittura. Nessun impatto ulteriore sui CONSUMER di questo servizio:
 * la superficie pubblica (login/logout/hasValidSession/getCurrentUser)
 * resta identica, esattamente come promesso dal piano originario.
 */

import {
  supabase,
  signInWithPassword,
  signOut as adapterSignOut,
  buildAppUser,
} from "../adapters/supabaseAuthAdapter.js";

const AUTH_LOGOUT_EVENT = "sl:auth-logout";

// Mirror sincrono dello stato reale della sessione Supabase — vedi
// rationale completo in testa al file. Mai scritto altrove che qui.
let currentUser = null;
let sessionInitialized = false;

/**
 * Da chiamare UNA SOLA VOLTA all'avvio dell'app (index.html), PRIMA di
 * router.init() — vedi rationale "initSession()" in testa al file.
 * Idempotente (una seconda chiamata accidentale è un no-op): protegge
 * da un doppio bootstrap, anche se oggi non ha un consumer che lo
 * farebbe.
 * @returns {Promise<void>}
 */
export async function initSession() {
  if (sessionInitialized) return;
  sessionInitialized = true;

  const { data } = await supabase.auth.getSession();
  currentUser = await buildAppUser(data.session);

  supabase.auth.onAuthStateChange(async (event, session) => {
    // "INITIAL_SESSION" è già stato gestito in modo esplicito sopra
    // (getSession()): elaborarlo di nuovo qui duplicherebbe lo stesso
    // lavoro per lo stesso identico stato.
    if (event === "INITIAL_SESSION") return;

    currentUser = await buildAppUser(session);

    if (event === "SIGNED_OUT") {
      document.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: {} }));
    }
  });
}

/**
 * Verifica le credenziali contro Supabase Auth e, se valide, aggiorna la
 * cache sincrona della sessione.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: true, user: object } | { success: false, error: string }>}
 */
export async function login(email, password) {
  let result;
  try {
    result = await signInWithPassword(email, password);
  } catch (error) {
    // Errore di rete/servizio (Supabase irraggiungibile), non
    // "credenziali sbagliate" — stessa distinzione di messaggio già
    // presente prima di questa riscrittura, qui applicata a una causa
    // diversa (rete verso un servizio esterno, non un file JSON locale).
    console.error("[authService] Errore di rete durante il login", error);
    return { success: false, error: "Errore imprevisto durante l'accesso. Riprova." };
  }

  const { data, error } = result;

  if (error) {
    // Supabase risponde con lo stesso errore generico sia per un utente
    // inesistente sia per una password sbagliata (protezione contro
    // l'enumerazione degli account) — stesso messaggio unico già usato
    // con l'adapter locale, per lo stesso identico motivo di UX.
    const isInvalidCredentials = error.status === 400 || error.name === "AuthApiError";
    console.error("[authService] Login Supabase fallito", error);
    return {
      success: false,
      error: isInvalidCredentials ? "Credenziali non valide." : "Errore imprevisto durante l'accesso. Riprova.",
    };
  }

  currentUser = await buildAppUser(data.session);
  return { success: true, user: currentUser };
}

/**
 * Avvia il logout lato Supabase. Il redirect a #/login resta gestito
 * centralmente da router.js, come sempre — vedi rationale
 * "sl:auth-logout" in testa al file per il perché l'evento arriva ora in
 * modo reattivo (onAuthStateChange) invece che sincrono qui dentro.
 * @returns {Promise<void>}
 */
export function logout() {
  return adapterSignOut();
}

/** @returns {boolean} true se esiste una sessione valida, letta dalla cache sincrona. */
export function hasValidSession() {
  return currentUser !== null;
}

/**
 * Utente della sessione corrente, dalla cache sincrona (mai null durante
 * una sessione valida — buildAppUser() risolve sempre un oggetto quando
 * la Session di Supabase esiste).
 * @returns {object | null}
 */
export function getCurrentUser() {
  return currentUser;
}
