/**
 * authService.js
 * -----------------------------------------------------------------------
 * Orchestrazione applicativa dell'autenticazione: login/logout/sessione.
 * Non conosce il DOM (architettura Fase 1 §2.1: "i servizi... non
 * conoscono il DOM") — riceve credenziali, restituisce risultati/stato,
 * comunica un evento sul document per i rari consumer che non possono
 * osservare la sessione in altro modo (stesso principio già seguito da
 * themeService con sl:theme-change).
 *
 * Punto di integrazione Supabase futuro (Fase 1 §11): solo la riga di
 * import sotto cambierà (import { verifyCredentials } from
 * "../adapters/supabaseAuthAdapter.js"), più probabilmente la sessione
 * stessa arriverà già gestita da Supabase Auth (che ha un proprio
 * meccanismo di persistenza/refresh token) — a quel punto le funzioni
 * hasValidSession()/getCurrentUser() andranno adattate per delegare a
 * Supabase invece che a storage.js. Nessun impatto sui CONSUMER di
 * questo servizio (page controller, router): la superficie pubblica
 * (login/logout/hasValidSession/getCurrentUser) resta identica.
 *
 * NON un secondo "checkSession()" oltre a hasValidSession(): il piano di
 * Fase 1 §2.4 nominava entrambi nello stesso flusso di bootstrap, ma
 * servono esattamente alla stessa domanda ("la sessione corrente è
 * valida?"). Un secondo metodo con la stessa risposta sarebbe superficie
 * pubblica duplicata senza un consumer distinto — hasValidSession() è
 * sufficiente sia per il router (guardia di rotta) sia per un eventuale
 * bootstrap iniziale.
 */

import { verifyCredentials } from "../adapters/localAuthAdapter.js";
import { getJSON, setJSON, removeItem } from "../utils/storage.js";

const SESSION_STORAGE_KEY = "sl-session";

// 24 ore: il docente proietta la piattaforma più volte nella stessa
// giornata scolastica — evita un nuovo login ad ogni lezione, restando
// comunque una scadenza reale (non "per sempre"). Facilmente
// riconfigurabile se in futuro servisse un valore diverso.
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const AUTH_LOGOUT_EVENT = "sl:auth-logout";

/**
 * Legge la sessione da storage e ne verifica la scadenza in un unico
 * punto (usato sia da hasValidSession() sia da getCurrentUser(), invece
 * di duplicare la stessa logica di validazione in due posti — DRY).
 * Una sessione scaduta viene rimossa immediatamente da storage, non solo
 * ignorata: evita che un valore "morto" resti a occupare localStorage.
 * @returns {{ user: object, expiresAt: number } | null}
 */
function readSession() {
  const session = getJSON(SESSION_STORAGE_KEY);
  if (!session || typeof session.expiresAt !== "number") return null;
  if (Date.now() >= session.expiresAt) {
    removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  return session;
}

/**
 * Verifica le credenziali e, se valide, crea e persiste una sessione.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: true, user: object } | { success: false, error: string }>}
 */
export async function login(username, password) {
  let user;
  try {
    user = await verifyCredentials(username, password);
  } catch (error) {
    // Errore di rete/parsing (es. data/users.json non raggiungibile),
    // non "credenziali sbagliate": messaggio distinto per non confondere
    // l'utente con un problema che non dipende da ciò che ha scritto.
    console.error("[authService] Errore durante la verifica delle credenziali", error);
    return { success: false, error: "Errore imprevisto durante l'accesso. Riprova." };
  }

  if (!user) {
    return { success: false, error: "Credenziali non valide." };
  }

  const session = { user, expiresAt: Date.now() + SESSION_DURATION_MS };
  const persisted = setJSON(SESSION_STORAGE_KEY, session);
  if (!persisted) {
    // storage.js gestisce già silenziosamente l'assenza di localStorage
    // (es. modalità privata di alcuni browser). Caso limite noto e
    // accettato: il login "riesce" per la navigazione immediata alla
    // pagina successiva nella stessa sessione di pagina, ma un refresh
    // successivo non troverebbe alcuna sessione persistita — preferibile
    // a bloccare del tutto il login per un problema di persistenza
    // secondario, su un'app a singolo utente reale.
    console.warn("[authService] Sessione non persistita (storage non disponibile).");
  }

  return { success: true, user };
}

/**
 * Pulisce la sessione e notifica l'evento sl:auth-logout (Fase 1 §8).
 */
export function logout() {
  removeItem(SESSION_STORAGE_KEY);
  document.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: {} }));
}

/** @returns {boolean} true se esiste una sessione valida e non scaduta. */
export function hasValidSession() {
  return readSession() !== null;
}

/**
 * Utente della sessione corrente (già sanificato da localAuthAdapter:
 * mai un passwordHash), o null se non autenticato/scaduto.
 * @returns {object | null}
 */
export function getCurrentUser() {
  return readSession()?.user ?? null;
}
