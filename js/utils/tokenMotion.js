/**
 * tokenMotion.js
 * -----------------------------------------------------------------------
 * Fotogrammi dell'animazione "calcolo delle percentuali" (scenario
 * "Tokenizzazione"). Funzioni pure: dato il risultato FINALE già
 * estratto (target) e un avanzamento da 0 a 1, restituiscono i valori
 * da mostrare in quell'istante. Il renderer si limita a dipingerli.
 *
 * L'EFFETTO: le barre non crescono ciascuna per conto proprio verso il
 * proprio valore. Condividono sempre lo STESSO 100%, quindi quando una
 * sale le altre scendono, e per metà animazione il "quadro" cambia di
 * continuo (i candidati sembrano contendersi la scelta) prima di
 * assestarsi sul risultato. Ogni candidato oscilla attorno alla propria
 * quota con una fase e una frequenza proprie (createMotionSeed, estratte
 * una volta per step); l'oscillazione si spegne man mano che
 * l'interpolazione verso il target prende il sopravvento (easeInOutCubic).
 * Ad avanzamento 1 il risultato è ESATTAMENTE il target.
 *
 * INVARIANTE: a ogni fotogramma i valori sono interi in millesimi di
 * punto percentuale e sommano esattamente a 100000 (100,000%) — grazie a
 * normalizeToMilli di tokenProbability.js. Nessun fotogramma mostra
 * percentuali che non tornano a 100.
 *
 * MOVIMENTO RIDOTTO (prefers-reduced-motion): l'animazione è la sostanza
 * dello scenario, non una decorazione — per questo con "riduci
 * animazioni" non viene eliminata ma semplificata: nessuna
 * oscillazione, partenza da quote uguali e riempimento breve e
 * monotòno verso il risultato (REDUCED_MOTION_MS). Il CSS di sicurezza
 * globale non copre questi valori perché sono calcolati in JavaScript:
 * la scelta va quindi fatta qui, esplicitamente.
 *
 * Le durate sono costanti dedicate, non token --sl-duration-*: come per
 * Skeleton e Loader, quei token (120–320 ms) sono pensati per
 * transizioni di interfaccia, non per una sequenza narrativa che deve
 * durare abbastanza da poter essere commentata a voce.
 */

import { normalizeToMilli, TOTAL_MILLI } from "./tokenProbability.js";

export const CALCULATION_MS = 2200;
export const REDUCED_MOTION_MS = 600;

const WOBBLE_AMPLITUDE = 0.9;
const MIN_CYCLES = 1.5;
const CYCLE_RANGE = 2.5;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Fase e frequenza dell'oscillazione di ciascun candidato.
 * @param {number} count
 * @param {() => number} [rng]
 * @returns {{ phase: number, cycles: number }[]}
 */
export function createMotionSeed(count, rng = Math.random) {
  return Array.from({ length: count }, () => ({
    phase: rng() * 2 * Math.PI,
    cycles: MIN_CYCLES + rng() * CYCLE_RANGE,
  }));
}

/**
 * @param {number[]} target distribuzione finale (millesimi, somma 100000)
 * @param {number} progress 0–1
 * @param {{ phase: number, cycles: number }[]} seed da createMotionSeed
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {number[]} interi, somma esattamente 100000
 */
export function distributionAtProgress(target, progress, seed, { reducedMotion = false } = {}) {
  const t = clamp01(progress);
  if (t >= 1) return [...target];

  const count = target.length;
  const eased = easeInOutCubic(t);
  const weights = target.map((finalValue, index) => {
    const wobble = reducedMotion
      ? 1
      : 1 + WOBBLE_AMPLITUDE * Math.sin(2 * Math.PI * seed[index].cycles * t + seed[index].phase);
    const searching = (wobble / count) * TOTAL_MILLI;
    return (1 - eased) * searching + eased * finalValue;
  });
  return normalizeToMilli(weights);
}
