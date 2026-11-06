/**
 * animationTimeline.js
 * -----------------------------------------------------------------------
 * Motore di animazione a "esecuzioni" interrompibili, con un unico
 * moltiplicatore globale del tempo. Nessuna libreria: setTimeout per le
 * attese e requestAnimationFrame per i fotogrammi continui.
 *
 * Ogni passaggio animato è una funzione async che riceve una "run":
 *   const run = motion.begin();
 *   if (!(await run.wait(400))) return;   // false = interrotta, esci subito
 * begin() annulla l'esecuzione precedente: le sue attese pendenti si
 * risolvono subito con false (nessun timer orfano) e il suo codice esce
 * senza toccare più nulla. Questo rende pulita l'interruzione (salto a un
 * altro passaggio, Ripristina, Ricomincia, cambio scenario, destroy) e
 * garantisce che il passaggio interrotto NON risulti completato: lo
 * sblocco avviene solo dopo l'ultimo wait/frames che torna true.
 *
 * VELOCITÀ E MOVIMENTO RIDOTTO in un solo punto: factor() = (ridotto ?
 * 0.1 : 1) / velocità. Le durate (ms) passano da qui e le animazioni CSS
 * della scena leggono lo stesso valore dalla variabile --k, quindi la
 * velocità cambia i tempi ma mai la sequenza né lo stato finale. Con
 * prefers-reduced-motion i tempi si riducono drasticamente ma la
 * sequenza resta comprensibile e "Procedi" funziona con le stesse regole.
 * Il fattore è letto a ogni attesa: un cambio di velocità durante la
 * simulazione vale dall'attesa successiva.
 */

export function createMotion({ getSpeed = () => 1, isReduced = () => false } = {}) {
  let current = null;
  const factor = () => (isReduced() ? 0.1 : 1) / (getSpeed() || 1);

  function makeRun() {
    let alive = true;
    let frameId = 0;
    const pending = new Set();
    const run = {
      get alive() {
        return alive;
      },
      /** Attende "ms" (scalati dal fattore). Risolve true se la run è ancora valida. */
      wait(ms) {
        return new Promise((resolve) => {
          if (!alive) return resolve(false);
          const entry = { resolve };
          entry.timer = setTimeout(() => {
            pending.delete(entry);
            resolve(alive);
          }, ms * factor());
          pending.add(entry);
        });
      },
      /** Chiama onFrame(p) con p in [0,1] per "ms" (scalati). Risolve true a fine naturale. */
      frames(ms, onFrame) {
        return new Promise((resolve) => {
          if (!alive) return resolve(false);
          const duration = ms * factor();
          const start = performance.now();
          const tick = (now) => {
            if (!alive) return resolve(false);
            const p = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
            onFrame(p);
            if (p < 1) frameId = requestAnimationFrame(tick);
            else resolve(true);
          };
          frameId = requestAnimationFrame(tick);
        });
      },
      cancel() {
        alive = false;
        cancelAnimationFrame(frameId);
        pending.forEach((entry) => {
          clearTimeout(entry.timer);
          entry.resolve(false);
        });
        pending.clear();
      },
    };
    return run;
  }

  return {
    begin() {
      if (current) current.cancel();
      current = makeRun();
      return current;
    },
    cancel() {
      if (current) current.cancel();
      current = null;
    },
    factor,
  };
}
