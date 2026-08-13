/**
 * helpers/auth.js
 * -----------------------------------------------------------------------
 * Esegue il login reale tramite l'interfaccia (mai un bypass diretto di
 * authService/localStorage) — principio invariato dalla Fase 3.
 *
 * RISCRITTO per Supabase Auth: le credenziali non sono più una demo
 * pubblica (docente@scuola.it/password123, verificate contro un hash
 * SHA-256 in un JSON versionato) — sono un vero account Supabase.
 * Scriverle in chiaro in questo file, versionato in un repository
 * pubblico, sarebbe una cattiva pratica anche per un account a basso
 * rischio: NESSUN fallback hardcoded, per costruzione. Lette da
 * SOCIALIVE_TEST_EMAIL/SOCIALIVE_TEST_PASSWORD, impostate solo
 * localmente (o come secret in un'eventuale CI futura), mai committate.
 *
 * Verificate a livello di MODULO (non solo dentro loginAsDocente()):
 * login.spec.js usa DEMO_EMAIL/DEMO_PASSWORD anche come costanti dirette
 * (non solo tramite loginAsDocente) — un controllo differito al primo
 * utilizzo lascerebbe quei casi fallire con un valore "undefined" poco
 * comprensibile invece di un errore chiaro all'avvio della suite.
 *
 * DIPENDENZA DI RETE NUOVA, da riconoscere onestamente: ogni esecuzione
 * di login.spec.js/home.spec.js/scenario.spec.js compie ora una vera
 * chiamata di rete verso Supabase Auth (prima: verifica locale contro un
 * file JSON) — la suite non è più eseguibile offline. Raccomandato un
 * progetto Supabase DI TEST separato da quello di produzione (piano
 * gratuito), per non mescolare l'account reale del docente con
 * l'esecuzione automatica dei test.
 */
const DEMO_EMAIL = process.env.SOCIALIVE_TEST_EMAIL;
const DEMO_PASSWORD = process.env.SOCIALIVE_TEST_PASSWORD;

if (!DEMO_EMAIL || !DEMO_PASSWORD) {
  throw new Error(
    "helpers/auth.js: le variabili d'ambiente SOCIALIVE_TEST_EMAIL/SOCIALIVE_TEST_PASSWORD " +
      "non sono impostate. Servono le credenziali di un account Supabase Auth reale " +
      "(idealmente di un progetto di test separato da quello di produzione) — mai un " +
      "fallback hardcoded in un file versionato. Esempio:\n" +
      '  SOCIALIVE_TEST_EMAIL="..." SOCIALIVE_TEST_PASSWORD="..." npm test'
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 */
async function loginAsDocente(page, baseUrl) {
  await page.goto(`${baseUrl}/#/login`);
  await page.waitForSelector(".sl-login-form");
  await page.fill(".sl-login-form__form input[type='email']", DEMO_EMAIL);
  await page.fill(".sl-login-form__form input[type='password']", DEMO_PASSWORD);
  await page.click(".sl-login-form__submit");
  await page.waitForFunction(() => window.location.hash === "#/home");
  await page.waitForSelector(".sl-page-container");
}

module.exports = { loginAsDocente, DEMO_EMAIL, DEMO_PASSWORD };
