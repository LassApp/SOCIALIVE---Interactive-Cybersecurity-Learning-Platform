/**
 * run-all.js
 * -----------------------------------------------------------------------
 * Esegue le tre suite in sequenza (non in parallelo: ciascuna avvia il
 * proprio server e il proprio browser Chromium — eseguirle in parallelo
 * userebbe più memoria per un guadagno di tempo marginale su un totale
 * di ~60 controlli, non necessario a questa scala) e stampa un riepilogo
 * aggregato. Uscita con codice 1 se un qualunque controllo fallisce,
 * comodo per un'eventuale integrazione futura in CI.
 */
const login = require("./login.spec.js");
const home = require("./home.spec.js");
const scenario = require("./scenario.spec.js");

async function main() {
  const summaries = [];
  summaries.push(await login.run());
  summaries.push(await home.run());
  summaries.push(await scenario.run());

  const totalChecks = summaries.reduce((sum, s) => sum + s.total, 0);
  const totalFailed = summaries.reduce((sum, s) => sum + s.failed, 0);

  console.log("========================================");
  summaries.forEach((s) => {
    console.log(`${s.suiteName}: ${s.total - s.failed}/${s.total}`);
  });
  console.log(`TOTALE: ${totalChecks - totalFailed}/${totalChecks} controlli superati`);
  console.log("========================================");

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
