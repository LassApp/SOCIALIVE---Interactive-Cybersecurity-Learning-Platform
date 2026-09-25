/**
 * helpers/auth.js
 * -----------------------------------------------------------------------
 * Esegue il login reale tramite l'interfaccia (mai un bypass diretto di
 * authService/localStorage): sia home.spec.js sia scenario.spec.js hanno
 * bisogno di partire da una sessione autenticata.
 *
 * CREDENZIALI DA VARIABILE D'AMBIENTE (mai hardcoded nel file): il
 * precedente commento "torna ad essere la demo pubblica storica
 * docente@scuola.it/password123" descriveva un account che NON esiste
 * più in data/users.json (verificato sul file reale, non per assunzione
 * — username reale diverso, hash diverso) — un caso concreto della
 * stessa classe di errore già documentata più volte nella storia del
 * progetto ("il commento descrive uno stato non riscontrabile nel
 * codice reale"). Al di là del disallineamento, scrivere una password
 * vera in chiaro in un file versionato su un repository pubblico
 * sarebbe comunque sbagliato: users.json la tiene infatti come hash
 * SHA-256, mai in chiaro — questo file deve rispettare la stessa
 * disciplina, non aggirarla per comodità dei test.
 *
 * SL_TEST_EMAIL / SL_TEST_PASSWORD: da impostare in locale (shell o un
 * file .env non versionato, aggiunto a .gitignore) prima di eseguire
 * "npm test" — mai committate. Fallisce subito con un errore leggibile
 * se assenti, invece di un timeout criptico più a valle nel primo login
 * fallito (stesso principio "fallire presto, con un messaggio chiaro"
 * già seguito da localJsonRepository.js per un URL non raggiungibile).
 */
const DEMO_EMAIL = process.env.SL_TEST_EMAIL;
const DEMO_PASSWORD = process.env.SL_TEST_PASSWORD;

if (!DEMO_EMAIL || !DEMO_PASSWORD) {
  throw new Error(
    "tests/helpers/auth.js: imposta le variabili d'ambiente SL_TEST_EMAIL e " +
      "SL_TEST_PASSWORD (credenziali reali di data/users.json) prima di eseguire " +
      "i test — mai hardcoded nel file versionato."
  );
}

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
