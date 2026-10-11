/**
 * questionDeck.js
 * -----------------------------------------------------------------------
 * Estrazione "a mazzo" dell'indice di una domanda (scenario
 * "Allucinazioni"): un'estrazione puramente casuale ripeterebbe spesso
 * la stessa domanda a distanza di pochi click — esattamente quello che
 * il pulsante "Casuale" deve evitare. Il mazzo si mescola una volta e si
 * consuma fino a esaurimento, poi si rimescola: ogni domanda esce una
 * volta per giro, in ordine casuale.
 *
 * "avoid" (l'indice della domanda attualmente a schermo) non viene mai
 * restituito: nemmeno quando un nuovo giro del mazzo comincerebbe
 * proprio con quella domanda. Le scelte fatte A MANO dal menu non
 * consumano il mazzo (il renderer non le registra qui): il mazzo
 * governa solo l'estrazione casuale.
 *
 * Funzione pura rispetto al generatore: "rng" è iniettabile (default
 * Math.random) per poterla verificare in modo deterministico.
 *
 * @param {number} count numero di domande (≥ 0)
 * @param {() => number} [rng] generatore in [0, 1)
 * @returns {{ next: (avoid?: number) => number }}
 */

function shuffled(count, rng) {
  const indexes = Array.from({ length: count }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

export function createQuestionDeck(count, rng = Math.random) {
  let bag = [];

  function next(avoid = -1) {
    if (count <= 1) return 0;
    if (bag.length === 0) bag = shuffled(count, rng);
    let position = bag.findIndex((index) => index !== avoid);
    if (position === -1) {
      // Nel mazzo resta solo la domanda da evitare: nuovo giro.
      bag = shuffled(count, rng);
      position = bag.findIndex((index) => index !== avoid);
    }
    return bag.splice(position, 1)[0];
  }

  return { next };
}
