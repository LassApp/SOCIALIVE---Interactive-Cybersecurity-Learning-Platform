/**
 * supabaseAuthAdapter.js
 * -----------------------------------------------------------------------
 * Unico modulo che sa COME si parla con l'identity provider reale
 * (Supabase Auth) — sostituisce localAuthAdapter.js (rimosso in questo
 * stesso intervento). Stessa responsabilità concettuale del
 * predecessore: parlare col backend di autenticazione e restituire un
 * oggetto utente già nella forma che il resto dell'app si aspetta —
 * authService.js non sa (e non deve sapere) che dietro c'è Supabase,
 * esattamente come prima non sapeva che dietro c'era un file JSON con
 * hash SHA-256.
 *
 * CLIENT SUPABASE: creato una sola volta a livello di modulo, a partire
 * dal bundle UMD vendorizzato (js/vendor/supabase-js.umd.js, caricato
 * come <script> classico in index.html PRIMA di questo modulo — vedi
 * rationale completo in quel file) che espone "window.supabase" con
 * createClient. Un controllo esplicito con messaggio d'errore chiaro
 * (non un TypeError opaco su "undefined") se lo script vendorizzato non
 * fosse stato caricato — stesso principio di errori onesti già seguito
 * altrove nel progetto (es. la distinzione "errore di rete" vs
 * "credenziali sbagliate" già presente in authService.js).
 *
 * "supabase" (il client) è esportato, non solo le funzioni di questo
 * adapter: authService.js ne ha bisogno direttamente per
 * onAuthStateChange()/getSession() (gestione della sessione, vedi
 * rationale in quel file) — un'eccezione motivata alla regola "un solo
 * modulo sa come si parla col backend", nello stesso spirito già seguito
 * per ThemeSwitch.js (unico componente autorizzato a importare un
 * service direttamente): qui è authService, non un componente UI, ma il
 * principio — un'eccezione dichiarata, non una svista — è lo stesso.
 *
 * ROLE RESOLUTION: Supabase Auth non ha un concetto nativo di "ruolo
 * applicativo" — il campo arriva da user_metadata (impostato manualmente
 * in Dashboard/SQL al momento della creazione dell'utente, oggi un solo
 * docente). data/roles.json resta il catalogo statico id→permissions
 * (invariato nella forma da Fase 3), letto qui per risolvere l'oggetto
 * "role" completo — stessa responsabilità che il vecchio adapter aveva
 * verso lo stesso file.
 *
 * NESSUN SALT/HASHING QUI: non è più responsabilità di questo adapter —
 * Supabase verifica le credenziali lato server, con la propria gestione
 * (bcrypt) mai esposta al client. La nota d'onestà architetturale del
 * vecchio file ("questo adapter non è un confine di sicurezza reale") non
 * si applica più: la verifica avviene ora davvero lato server.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/env.js";
import { createLocalJsonRepository } from "../repositories/localJsonRepository.js";

const rolesRepository = createLocalJsonRepository({ url: "data/roles.json", collectionKey: "roles" });

function getCreateClient() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error(
      '[supabaseAuthAdapter] "window.supabase" non è definito: verifica che ' +
        "js/vendor/supabase-js.umd.js sia caricato con un <script> classico " +
        "PRIMA di questo modulo in index.html."
    );
  }
  return window.supabase.createClient;
}

/**
 * Client Supabase, singleton per l'intera pagina — mai ricreato ad ogni
 * chiamata (il client mantiene internamente lo stato del token e della
 * connessione realtime; ricrearlo ne perderebbe la continuità).
 */
export const supabase = getCreateClient()(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Trasforma una Session di Supabase Auth nell'oggetto "utente
 * applicativo" già consumato da appShell.js/AppHeader.js/ProfileMenu.js
 * (displayName, avatar) — stessa forma già restituita dal vecchio
 * sanitizeUser(), qui costruita da session.user invece che da un record
 * di data/users.json. Riusata sia da login() sia da ogni transizione
 * reattiva della sessione (onAuthStateChange in authService.js): unica
 * fonte della trasformazione, nessuna duplicazione.
 * @param {object|null} session Session di Supabase Auth (o null)
 * @returns {Promise<object|null>}
 */
export async function buildAppUser(session) {
  if (!session || !session.user) return null;
  const { id, email, user_metadata: metadata = {} } = session.user;

  const roleId = metadata.role || null;
  const role = roleId ? await rolesRepository.get(roleId) : null;

  return {
    id,
    username: email,
    displayName: metadata.displayName || email,
    avatar: metadata.avatar || null,
    role,
  };
}

/**
 * Verifica una coppia email/password contro Supabase Auth. Restituisce
 * SEMPRE la forma nativa { data, error } di supabase-js, senza
 * interpretarla: la decisione su QUALE messaggio italiano mostrare
 * all'utente resta responsabilità di authService.js — stessa
 * separazione già in vigore col vecchio adapter ("qui si parla col
 * backend, lì si decide cosa dire all'utente").
 * @param {string} email
 * @param {string} password
 */
export function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Termina la sessione lato Supabase (locale + revoca del refresh token). */
export function signOut() {
  return supabase.auth.signOut();
}
