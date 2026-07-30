/**
 * helpers/testKit.js
 * -----------------------------------------------------------------------
 * Micro-runner di test, deliberatamente senza un framework dedicato
 * (jest/mocha/@playwright/test): ogni fase precedente ha già verificato
 * l'app con script Playwright "grezzi" (chromium.launch diretto) — questa
 * suite persiste esattamente quello stesso approccio, non ne introduce
 * uno nuovo da imparare. Un intero test runner con la propria
 * configurazione (playwright.config.js, reporter, ecc.) sarebbe
 * complessità aggiunta senza un bisogno reale per tre soli file di
 * pagina (KISS).
 *
 * Ogni file *.spec.js esporta una funzione async run() che crea una
 * suite con createSuite(nome), chiama suite.test(nome, fn) per ciascun
 * controllo e restituisce suite.summary() alla fine — stesso pattern
 * ripetuto identico nei tre file, per restare immediatamente leggibile
 * a chiunque riprenda il progetto.
 */

function createSuite(suiteName) {
  const results = [];

  /**
   * Esegue un singolo controllo. Un controllo che lancia (assert.*,
   * o qualunque eccezione) viene registrato come fallito senza
   * interrompere gli altri — un singolo controllo rotto non deve
   * nascondere lo stato di tutti gli altri nella stessa suite.
   */
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  \u2713 ${name}`);
    } catch (error) {
      results.push({ name, ok: false, error });
      console.log(`  \u2717 ${name}`);
      console.log(`    ${error && error.message ? error.message : error}`);
    }
  }

  function summary() {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${suiteName}: ${results.length - failed.length}/${results.length} controlli superati\n`);
    return { suiteName, total: results.length, failed: failed.length, results };
  }

  return { test, summary };
}

module.exports = { createSuite };
