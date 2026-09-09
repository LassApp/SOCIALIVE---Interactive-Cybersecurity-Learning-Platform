/**
 * helpers/auth.js
 * -----------------------------------------------------------------------
 * Esegue il login reale tramite l'interfaccia (mai un bypass diretto di
 * authService/localStorage): sia home.spec.js sia scenario.spec.js hanno
 * bisogno di partire da una sessione autenticata.
 *
 * RIPRISTINATO (revert da Supabase Auth): le credenziali tornano ad
 * essere la demo pubblica storica (docente@scuola.it/password123,
 * verificate contro l'hash SHA-256 in data/users.json) — non più un vero
 * account esterno da tenere fuori dal codice versionato. Nessuna
 * variabile d'ambiente richiesta: la suite torna eseguibile offline,
 * incluso in questa sandbox di sviluppo (nessuna dipendenza di rete
 * verso *.supabase.co).
 */
const DEMO_EMAIL = "docente@scuola.it";
const DEMO_PASSWORD = "password123";

/**
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 */
async function loginAsDocente(page, baseUrl) {
  await page.goto(`${baseUrl}/#/login`);
  await page.waitForSelector(".sl-login-form");
  // Selettori per attributo "type", non per id: Input.js genera id
  // progressivi da un contatore di modulo che NON si azzera tra un
  // rimontaggio e l'altro dello stesso form nella stessa pagina (nessun
  // reload reale con il routing hash-based) — un id fisso funzionerebbe
  // solo al primo login della sessione di test, non ai successivi.
  await page.fill(".sl-login-form__form input[type='email']", DEMO_EMAIL);
  await page.fill(".sl-login-form__form input[type='password']", DEMO_PASSWORD);
  await page.click(".sl-login-form__submit");
  await page.waitForFunction(() => window.location.hash === "#/home");
  await page.waitForSelector(".sl-page-container");
}

module.exports = { loginAsDocente, DEMO_EMAIL, DEMO_PASSWORD };
