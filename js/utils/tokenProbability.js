/**
 * tokenProbability.js
 * -----------------------------------------------------------------------
 * Generatore delle percentuali di "previsione" del prossimo token
 * (scenario "Tokenizzazione", type "token-prediction"). Funzioni pure,
 * senza DOM: testabili da sole e riusabili da qualunque renderer.
 *
 * UNITÀ: MILLESIMI DI PUNTO PERCENTUALE, interi. 100% = 100000 e
 * 0,001% = 1. Lavorare in interi evita per costruzione gli errori di
 * virgola mobile (0.1 + 0.2 ≠ 0.3): la somma dei candidati è SEMPRE
 * esattamente 100,000%, in ogni istante — anche nei fotogrammi
 * intermedi dell'animazione, dove le barre si "ridistribuiscono" in
 * tempo reale pur condividendo sempre lo stesso 100%.
 *
 * FORMA DELLA DISTRIBUZIONE: softmax su punteggi casuali con una
 * "nitidezza" variabile. Un LLM reale produce distribuzioni molto
 * sbilanciate (un candidato dominante, code lunghissime): con questa
 * forma un token può valere 0,001% mentre un altro supera il 95%,
 * esattamente come nei modelli veri, e a volte invece i candidati sono
 * ravvicinati. Nessun valore scende comunque sotto MIN_MILLI (0,001%):
 * una probabilità esattamente nulla non è mai mostrata.
 *
 * VINCOLI (verificati in tests/token.spec.js):
 *   - somma esatta 100000, tutti interi, ciascuno ≥ MIN_MILLI;
 *   - vincitore UNICO e netto (almeno 5 punti sul secondo): la scelta
 *     "prende quello con la percentuale più alta" deve leggersi a colpo
 *     d'occhio dalla LIM, senza testa a testa ambigui;
 *   - "Rigenera" (opzione "previous") produce sempre una distribuzione
 *     visibilmente diversa dalla precedente (almeno 1 punto di scarto
 *     su un candidato): altrimenti il pulsante sembrerebbe rotto.
 *
 * Il generatore di numeri casuali è iniettabile (opzione "rng"): i
 * test usano un generatore con seme per risultati ripetibili, l'app
 * usa Math.random.
 */

export const TOTAL_MILLI = 100000;
export const MIN_MILLI = 1;
const MIN_WINNER_MARGIN_MILLI = 5000;
const MIN_CHANGE_MILLI = 1000;
const MIN_CANDIDATES = 2;
const MAX_CANDIDATES = 8;
const MAX_ATTEMPTS = 200;
const SHARPNESS_MIN = 1.2;
const SHARPNESS_MAX = 6;

/**
 * Converte pesi qualsiasi (≥ 0) in interi che sommano ESATTAMENTE a
 * TOTAL_MILLI, col metodo del "resto più grande" (largest remainder).
 * @param {number[]} weights
 * @param {number} [minEach=0] valore minimo garantito a ogni elemento
 * @returns {number[]}
 */
export function normalizeToMilli(weights, minEach = 0) {
  const sum = weights.reduce((total, weight) => total + weight, 0) || 1;
  const exact = weights.map((weight) => (weight / sum) * TOTAL_MILLI);
  const result = exact.map(Math.floor);

  let missing = TOTAL_MILLI - result.reduce((total, value) => total + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; missing > 0; i = (i + 1) % byRemainder.length, missing -= 1) {
    result[byRemainder[i].index] += 1;
  }

  // Garanzia del minimo: ciò che manca a un elemento viene sottratto
  // all'elemento più grande, che ha sempre margine in abbondanza.
  for (let i = 0; i < result.length; i += 1) {
    if (result[i] >= minEach) continue;
    const donor = result.indexOf(Math.max(...result));
    result[donor] -= minEach - result[i];
    result[i] = minEach;
  }
  return result;
}

/**
 * @param {number} milli
 * @returns {string} es. 87412 → "87,412" · 1 → "0,001" · 100000 → "100,000"
 *   (formato italiano, sempre 3 decimali; senza Intl, per un risultato
 *   identico in qualunque browser/lingua di sistema)
 */
export function formatMilliPercent(milli) {
  const whole = Math.floor(milli / 1000);
  const fraction = String(milli % 1000).padStart(3, "0");
  return `${whole},${fraction}`;
}

/** @returns {number} indice del valore più alto (il primo, in caso di parità) */
export function pickWinnerIndex(distribution) {
  return distribution.indexOf(Math.max(...distribution));
}

function winnerMargin(distribution) {
  const sorted = [...distribution].sort((a, b) => b - a);
  return sorted[0] - sorted[1];
}

function isVisiblyDifferent(distribution, previous) {
  return distribution.some((value, index) => Math.abs(value - previous[index]) >= MIN_CHANGE_MILLI);
}

function drawDistribution(count, rng) {
  const sharpness = SHARPNESS_MIN + rng() * (SHARPNESS_MAX - SHARPNESS_MIN);
  // Somma di tre uniformi centrata: approssima una gaussiana, senza
  // logaritmi né coppie di numeri casuali da gestire.
  const scores = Array.from({ length: count }, () => (rng() + rng() + rng() - 1.5) * 2 * sharpness);
  const top = Math.max(...scores);
  return normalizeToMilli(scores.map((score) => Math.exp(score - top)), MIN_MILLI);
}

// Rete di sicurezza deterministica: usata solo se, per assurdo, 200
// estrazioni consecutive non rispettano i vincoli (con un generatore
// bloccato su un valore costante, per esempio). Un candidato dominante,
// gli altri uguali; con "previous" il vincitore si sposta di un posto.
function fallbackDistribution(count, previous) {
  const winner = previous ? (pickWinnerIndex(previous) + 1) % count : 0;
  return normalizeToMilli(
    Array.from({ length: count }, (_, index) => (index === winner ? 6 : 1)),
    MIN_MILLI
  );
}

/**
 * @param {number} count numero di candidati (2–8)
 * @param {{ rng?: () => number, previous?: number[]|null }} [options]
 *   - rng: generatore in [0,1) (default Math.random)
 *   - previous: distribuzione dello stesso step prima di "Rigenera"
 * @returns {number[]} interi in millesimi di punto, somma 100000
 */
export function generateDistribution(count, { rng = Math.random, previous = null } = {}) {
  if (!Number.isInteger(count) || count < MIN_CANDIDATES || count > MAX_CANDIDATES) {
    throw new RangeError(`generateDistribution: i candidati devono essere tra ${MIN_CANDIDATES} e ${MAX_CANDIDATES} (ricevuti: ${count}).`);
  }
  const comparable = previous && previous.length === count ? previous : null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = drawDistribution(count, rng);
    if (winnerMargin(candidate) < MIN_WINNER_MARGIN_MILLI) continue;
    if (comparable && !isVisiblyDifferent(candidate, comparable)) continue;
    return candidate;
  }
  return fallbackDistribution(count, comparable);
}
