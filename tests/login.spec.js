/**
 * login.spec.js
 * -----------------------------------------------------------------------
 * Copre il flusso di autenticazione (Fase 3) e le rifiniture di Fase 9
 * che lo toccano trasversalmente (document.title per rotta, transizione
 * di rotta, messaggio "Pagina non trovata" centralizzato). Punto
 * d'ingresso di tutto il resto della suite: home.spec.js e
 * scenario.spec.js riusano loginAsDocente() da helpers/auth.js per
 * partire da una sessione autenticata reale, non un bypass.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente, DEMO_EMAIL, DEMO_PASSWORD } = require("./helpers/auth");

const APP_ROOT = path.join(__dirname, "..");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

async function run() {
  const suite = createSuite("login.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Bootstrap e guardie di sessione -------------------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await suite.test("bootstrap senza sessione -> #/login", async () => {
      await page.goto(server.url);
      await page.waitForFunction(() => window.location.hash === "#/login");
      await page.waitForSelector(".sl-login-form");
    });

    await suite.test("document.title corretto su #/login", async () => {
      const title = await page.title();
      assert.equal(title, "Accedi \u2014 SocialAlive");
    });

    await suite.test("#app-root ha la classe di transizione, non nascosta a riposo", async () => {
      await page.waitForTimeout(100); // lascia esaurire il doppio rAF del fade-in
      const classes = await page.evaluate(() => document.getElementById("app-root").className);
      assert.ok(classes.includes("sl-route-transition"));
      assert.ok(!classes.includes("sl-route-transition--hidden"));
    });

    await suite.test("accesso diretto a #/home senza sessione -> redirect a #/login", async () => {
      await page.goto(`${server.url}/#/home`);
      await page.waitForFunction(() => window.location.hash === "#/login");
    });

    await suite.test("rotta inesistente -> messaggio 'Pagina non trovata.' con stile coerente", async () => {
      await page.goto(`${server.url}/#/questa-rotta-non-esiste`);
      const message = await page.waitForSelector("#app-root p");
      assert.equal((await message.textContent()).trim(), "Pagina non trovata.");
      // Bug reale di Fase 9: questo file un tempo impostava solo
      // "padding" (colore/dimensione ereditati di default) mentre gli
      // altri due fallback ne impostavano anche colore e font-size —
      // verifica diretta che lo stile inline sia ora completo.
      const inlineStyle = await message.getAttribute("style");
      assert.ok(inlineStyle.includes("color"), "manca 'color' nello stile inline");
      assert.ok(inlineStyle.includes("font-size"), "manca 'font-size' nello stile inline");
      const title = await page.title();
      assert.equal(title, "Pagina non trovata \u2014 SocialAlive");
    });

    await context.close();
  }

  // --- Validazione di formato (solo UI, Fase 2) -----------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${server.url}/#/login`);
    await page.waitForSelector(".sl-login-form");

    await suite.test("submit vuoto -> entrambi i campi in errore, focus sul primo (email)", async () => {
      await page.click(".sl-login-form__submit");
      const emailField = page.locator(".sl-login-form__form input[type='email']");
      const passwordField = page.locator(".sl-login-form__form input[type='password']");
      await assert_ariaInvalid(emailField, "true");
      await assert_ariaInvalid(passwordField, "true");
      const isEmailFocused = await emailField.evaluate((el) => el === document.activeElement);
      assert.ok(isEmailFocused, "il focus non è sul campo email dopo un submit vuoto");
    });

    await suite.test("email malformata -> messaggio di errore specifico", async () => {
      await page.fill(".sl-login-form__form input[type='email']", "non-una-email");
      await page.fill(".sl-login-form__form input[type='password']", "qualcosa");
      await page.click(".sl-login-form__submit");
      const helperText = await page
        .locator(".sl-login-form__form input[type='email']")
        .locator("xpath=..")
        .locator(".sl-input__helper")
        .textContent();
      assert.equal(helperText.trim(), "Inserisci un indirizzo email valido.");
    });

    await context.close();
  }

  // --- Credenziali errate / corrette ----------------------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${server.url}/#/login`);
    await page.waitForSelector(".sl-login-form");

    await suite.test("credenziali errate -> banner 'Credenziali non valide.'", async () => {
      await page.fill(".sl-login-form__form input[type='email']", DEMO_EMAIL);
      await page.fill(".sl-login-form__form input[type='password']", "password-sbagliata");
      await page.click(".sl-login-form__submit");
      const banner = page.locator(".sl-login-form__error-banner");
      await banner.waitFor({ state: "visible" });
      assert.equal((await banner.textContent()).trim(), "Credenziali non valide.");
      assert.equal(page.url().includes("#/login"), true);
    });

    await suite.test("credenziali corrette -> naviga a #/home, sessione persistita", async () => {
      await page.fill(".sl-login-form__form input[type='email']", DEMO_EMAIL);
      await page.fill(".sl-login-form__form input[type='password']", DEMO_PASSWORD);
      await page.click(".sl-login-form__submit");
      await page.waitForFunction(() => window.location.hash === "#/home");
      const session = await page.evaluate(() => window.localStorage.getItem("sl-session"));
      assert.ok(session, "sl-session non trovato in localStorage dopo il login");
      const parsed = JSON.parse(session);
      assert.equal(parsed.user.displayName, "Prof. Erasmo Lassandro");
    });

    await suite.test("reload con sessione valida -> resta su #/home", async () => {
      await page.reload();
      await page.waitForFunction(() => window.location.hash === "#/home");
      await page.waitForSelector(".sl-page-container");
    });

    await suite.test("redirect simmetrico: #/login con sessione valida -> #/home", async () => {
      await page.goto(`${server.url}/#/login`);
      await page.waitForFunction(() => window.location.hash === "#/home");
    });

    await suite.test("logout da ProfileMenu -> #/login, sessione rimossa", async () => {
      await page.click(".sl-app-header__profile-trigger");
      await page.waitForSelector(".sl-profile-menu");
      await page.click(".sl-profile-menu__item--danger");
      await page.waitForFunction(() => window.location.hash === "#/login");
      const session = await page.evaluate(() => window.localStorage.getItem("sl-session"));
      assert.equal(session, null);
    });

    await context.close();
  }

  // --- Screenshot: Light / Dark / mobile 375px ------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${server.url}/#/login`);
    await page.waitForSelector(".sl-login-form");

    await suite.test("screenshot login — desktop Light", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "login-desktop-light.png") });
    });

    await suite.test("screenshot login — desktop Dark", async () => {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "login-desktop-dark.png") });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    });

    await suite.test("screenshot login — mobile 375px, nessun overflow orizzontale", async () => {
      await page.setViewportSize({ width: 375, height: 720 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "login-mobile-375.png") });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false, "overflow orizzontale rilevato a 375px");
    });

    await context.close();
  }

  await browser.close();
  await server.close();
  return suite.summary();
}

/** Asserzione ripetuta 2 volte sopra: estratta per leggibilità del test. */
async function assert_ariaInvalid(locator, expected) {
  const value = await locator.getAttribute("aria-invalid");
  assert.equal(value, expected);
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
