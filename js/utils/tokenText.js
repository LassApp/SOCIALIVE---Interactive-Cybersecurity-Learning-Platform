/**
 * tokenText.js
 * -----------------------------------------------------------------------
 * Regole di spaziatura per ricomporre una frase a partire da una
 * sequenza di token (scenario "Tokenizzazione", type "token-prediction").
 *
 * Nel JSON dell'albero (token-tree.json) ogni nodo contiene il token
 * "nudo" ("giornata", "/", "."): la presenza dello spazio davanti NON è
 * un dato autorizzato a mano ma una conseguenza di due regole
 * tipografiche, applicate qui in un unico punto:
 *   1. punteggiatura (. , ; : ! ? / …) → mai uno spazio prima;
 *   2. un numero subito dopo ":" o "/" → mai uno spazio prima
 *      (così "06", "/", "10" si ricompongono come "06/10" e non
 *      come "06 / 10", e "06", ":", "30" come "06:30").
 * Ogni altro token è preceduto da uno spazio, tranne il primo.
 *
 * Questa stessa decisione serve due volte: per il TESTO mostrato nella
 * frase in costruzione e per scegliere la forma corretta del token
 * reale nel vocabolario (token-vocab.json): un tokenizer vero distingue
 * "giornata" da " giornata" (con lo spazio iniziale) e assegna ID
 * diversi. Un'unica funzione evita che testo e ID si disallineino.
 */

const NO_SPACE_BEFORE = /^[.,;:!?/…)]$/;
const DIGITS_ONLY = /^\d+$/;
const DIGIT_GLUE_PREVIOUS = new Set([":", "/"]);

/**
 * @param {string|null} previousToken token precedente (null per il primo)
 * @param {string} token
 * @returns {boolean}
 */
export function needsSpaceBefore(previousToken, token) {
  if (previousToken === null || previousToken === undefined) return false;
  if (NO_SPACE_BEFORE.test(token)) return false;
  if (DIGITS_ONLY.test(token) && DIGIT_GLUE_PREVIOUS.has(previousToken)) return false;
  return true;
}

/**
 * @param {string[]} tokens
 * @returns {string} es. ["Oggi","06","/","10","."] → "Oggi 06/10."
 */
export function joinTokens(tokens) {
  return tokens.reduce((text, token, index) => {
    const previous = index === 0 ? null : tokens[index - 1];
    return text + (needsSpaceBefore(previous, token) ? " " : "") + token;
  }, "");
}
