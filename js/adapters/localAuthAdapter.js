/**
 * localAuthAdapter.js
 * -----------------------------------------------------------------------
 * Unico modulo che sa COME si verificano le credenziali oggi (contro
 * data/users.json + data/roles.json). Alla migrazione Supabase, questo
 * intero file verrà sostituito da supabaseAuthAdapter.js (che userà
 * supabase.auth.signInWithPassword o equivalente), con la stessa firma
 * pubblica (verifyCredentials) — authService.js (prossimo step) non
 * cambierà una riga (architettura Fase 1 §11).
 *
 * NOTA D'ONESTÀ ARCHITETTURALE — da non dimenticare in nessuna fase
 * futura: questo repository è PUBBLICO, servito staticamente da GitHub
 * Pages. data/users.json (incluso passwordHash) è leggibile da chiunque
 * apra il repository o gli strumenti di sviluppo del browser. Questo
 * adapter non è quindi un confine di sicurezza reale: l'intera verifica
 * avviene lato client. Il suo unico scopo è completare il flusso UX di
 * un login credibile (realismo richiesto dal progetto) in attesa di
 * Supabase Auth, che verificherà le credenziali lato server come si deve.
 *
 * Hashing: SHA-256 via crypto.subtle.digest (Web Crypto, API nativa del
 * browser — nessuna libreria, coerente col vincolo di stack). Nessuna
 * password viene mai confrontata o loggata in chiaro, anche se — per il
 * motivo sopra — l'hash non protegge nulla che non sia già pubblico.
 * Nessun salt: per un solo utente demo in un file già pubblico non
 * aggiungerebbe protezione reale; verrà eliminato in blocco (non
 * riusato) alla migrazione Supabase.
 *
 * sanitizeUser(): passwordHash non deve MAI uscire da questo file — è un
 * dettaglio implementativo dell'adapter, non un dato di dominio che
 * authService o la UI abbiano motivo di vedere.
 */

import { createLocalJsonRepository } from "../repositories/localJsonRepository.js";

const usersRepository = createLocalJsonRepository({ url: "data/users.json", collectionKey: "users" });
const rolesRepository = createLocalJsonRepository({ url: "data/roles.json", collectionKey: "roles" });

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digestBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digestBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeUser(user, role) {
  const { passwordHash, ...publicUser } = user;
  return { ...publicUser, role };
}

/**
 * Verifica una coppia username/password contro data/users.json.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object|null>} utente pubblico (senza passwordHash) +
 *   ruolo risolto da data/roles.json, oppure null se le credenziali non
 *   corrispondono a nessun utente.
 */
export async function verifyCredentials(username, password) {
  const users = await usersRepository.list();
  const user = users.find((candidate) => candidate.username === username);
  if (!user) return null;

  const suppliedHash = await sha256Hex(password);
  if (suppliedHash !== user.passwordHash) return null;

  const role = await rolesRepository.get(user.roleId);
  return sanitizeUser(user, role);
}
