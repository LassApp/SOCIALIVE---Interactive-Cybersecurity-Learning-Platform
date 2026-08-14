/**
 * login.spec.js
 * -----------------------------------------------------------------------
 * Copre il flusso di autenticazione — dalla migrazione a Supabase Auth,
 * un vero servizio esterno, non più un file JSON locale — e le rifiniture
 * di Fase 9 che lo toccano trasversalmente (document.title per rotta,
 * transizione di rotta, messaggio "Pagina non trovata" centralizzato).
 * Punto d'ingresso di tutto il resto della suite: home.spec.js e
 * scenario.spec.js riusano loginAsDocente() da helpers/auth.js per
 * partire da una sessione autenticata reale, non un bypass.
 *
 * chromium.launch({ headless: false }) — DEVIAZIONE DOCUMENTATA dalla
 * modalità headless di default, necessaria e non opzionale: verificato
 * empiricamente che, in questo ambiente, un Chromium headless non riesce
 * mai a completare la richiesta verso Supabase Auth (timeout di 30s
 * superato, nessun errore esplicito) mentre lo stesso identico flusso
 * funziona correttamente sia in un browser reale sia in Chromium headed
 * lanciato da Playwright. La causa profonda (con ipotesi più probabile:
 * risoluzione IPv6/proxy diversa tra le due modalità, o un
 * antivirus/EDR che tratta diversamente un processo headless) NON è
 * stata isolata ulteriormente — non bloccante per procedere, ma
 * segnalata esplicitamente come debito da approfondire (vedi handover).
 * "slowMo" NON è stato mantenuto: serviva solo per l'osservazione visiva
 * durante la diagnosi, nessun beneficio a regime.
 *
 * DUE ASSERZIONI CORRETTE in questo stesso intervento (non riscritture
 * cosmetiche: la vecchia versione testava un dettaglio implementativo
 * dell'architettura precedente, ormai inesistente):
 *   - "credenziali corrette": non cerca più la chiave localStorage
 *     "sl-session" (rimossa con la migrazione — la sessione vive ora in
 *     una chiave interna di Supabase, formato di una libreria terza, non
 *     nostro da testare) ma verifica che l'header mostri il nome reale
 *     arrivato da Supabase (aria-label del trigger profilo) — prova
 *     comportamentale che l'intera catena login→sessione→UI funzioni.
 *   - "logout da ProfileMenu": la versione precedente verificava la
 *     stessa chiave "sl-session" — che, non esistendo più, restituisce
 *     sempre null: un FALSO POSITIVO silenzioso (il test sarebbe
 *     risultato verde anche con un logout completamente rotto). Corretto
 *     con una verifica comportamentale reale: dopo il logout, una rotta
 *     protetta deve tornare a reindirizzare al login.
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
  const browser = await chromium.launch({ headless: false });
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
      // Attesa POLLING (non un waitForTimeout fisso): più robusta a
      // variazioni di timing — inclusa la latenza di rete reale che il
      // bootstrap ora attraversa (initSession() verso Supabase) prima
      // del primo mount, assente nell'architettura precedente.
      await page.waitForFunction(
        () => {
          const el = document.getElementById("app-root");
          return Boolean(
            el &&
              el.classList.contains("sl-route-transition") &&
              !el.classList.contains("sl-route-transition--hidden")
          );
        },
        { timeout: 5000 }
      );
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

  // --- Credenziali errate / corrette (rete reale verso Supabase Auth) -
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
      await banner.waitFor({ state: "visible", timeout: 15000 });
      assert.equal((await banner.textContent()).trim(), "Credenziali non valide.");
      assert.equal(page.url().includes("#/login"), true);
    });

    await suite.test("credenziali corrette -> naviga a #/home con l'utente reale da Supabase", async () => {
      await page.fill(".sl-login-form__form input[type='email']", DEMO_EMAIL);
      await page.fill(".sl-login-form__form input[type='password']", DEMO_PASSWORD);
      await page.click(".sl-login-form__submit");
      await page.waitForFunction(() => window.location.hash === "#/home", null, { timeout: 15000 });
      await page.waitForSelector(".sl-app-header__profile-trigger");
      // Verifica comportamentale: il nome mostrato deve essere quello
      // REALE arrivato da Supabase (user_metadata.displayName), non un
      // valore fisso — prova end-to-end dell'intera catena
      // login -> buildAppUser() -> AppHeader, non solo del redirect.
      const ariaLabel = await page.locator(".sl-app-header__profile-trigger").getAttribute("aria-label");
      assert.ok(
        ariaLabel && ariaLabel.includes("Prof. Erasmo Lassandro"),
        `aria-label del trigger profilo inatteso: "${ariaLabel}"`
      );
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

    await suite.test("logout da ProfileMenu -> #/login, sessione effettivamente rimossa", async () => {
      await page.click(".sl-app-header__profile-trigger");
      await page.waitForSelector(".sl-profile-menu");
      await page.click(".sl-profile-menu__item--danger");
      await page.waitForFunction(() => window.location.hash === "#/login");
      // Verifica COMPORTAMENTALE, non l'esistenza di una chiave di
      // storage specifica (vedi rationale in testa al file): la prova
      // reale che il logout abbia funzionato è che una rotta protetta
      // torni a reindirizzare al login, non che una chiave che non
      // possediamo più sia assente.
      await page.goto(`${server.url}/#/home`);
      await page.waitForFunction(() => window.location.hash === "#/login");
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
