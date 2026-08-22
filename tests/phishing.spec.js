/**
 * phishing.spec.js
 * -----------------------------------------------------------------------
 * Copre il terzo scenario reale del progetto, Phishing (type
 * "phishing-simulation"), attraverso l'index.html reale — non un harness
 * isolato: login reale, Home reale, selettore moduli reale (ora con 3
 * scenari sotto Cybersecurity), flusso completo a 5 viste, regressione
 * sui due scenari precedenti (Oversharing, Keylogger) per confermare che
 * l'aggiunta del terzo type non li abbia toccati.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente } = require("./helpers/auth");

const APP_ROOT = path.join(__dirname, "..");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

async function run() {
  const suite = createSuite("phishing.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Selettore Cybersecurity: ora con 3 scenari -----------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-home-page__modules-grid");

    await suite.test("click su Cybersecurity -> selettore con 3 scenari, tutti disponibili", async () => {
      await page.click(".sl-home-page__modules-grid .sl-module-card >> nth=4");
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
      const cards = page.locator(".sl-module-scenarios-page__grid .sl-module-card");
      assert.equal(await cards.count(), 3);
      const badges = await page.locator(".sl-module-scenarios-page__grid .sl-badge").allTextContents();
      assert.deepEqual(badges.map((b) => b.trim()), ["Disponibile", "Disponibile", "Disponibile"]);
    });

    await suite.test("terza card è 'Phishing' e naviga a #/scenario/phishing", async () => {
      const titles = await page.locator(".sl-module-scenarios-page__grid .sl-module-card__title").allTextContents();
      assert.deepEqual(titles.map((t) => t.trim()), ["Oversharing", "Keylogger", "Phishing"]);
      await page.click(".sl-module-scenarios-page__grid .sl-module-card >> nth=2");
      await page.waitForFunction(() => window.location.hash === "#/scenario/phishing");
      await page.waitForSelector(".sl-phishing");
    });

    await suite.test("chrome:\"none\" rispettato: nessun AppHeader/Sidebar di SocialAlive", async () => {
      assert.equal(await page.locator(".sl-app-header").count(), 0);
      assert.equal(await page.locator(".sl-sidebar").count(), 0);
    });

    await context.close();
  }

  // --- Flusso completo a 5 viste, attraverso l'app reale -----------------
  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();

    const externalRequests = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.hostname !== "127.0.0.1") externalRequests.push(req.url());
    });

    await loginAsDocente(page, server.url);
    await page.goto(`${server.url}/#/scenario/phishing`);
    await page.waitForSelector(".sl-phishing");

    await suite.test("Inbox: 5 email, apertura email target mostra il CTA", async () => {
      assert.equal(await page.locator(".sl-phishing__email-row").count(), 5);
      await page.click(".sl-phishing__email-row >> nth=1");
      await page.waitForSelector(".sl-phishing__detail");
      const cta = await page.locator(".sl-phishing__cta").textContent();
      assert.equal(cta.trim(), "Verifica il pagamento");
    });

    await suite.test("CTA -> finto sito (Accesso): nome banca e barra indirizzo corretti", async () => {
      await page.click(".sl-phishing__cta");
      await page.waitForSelector(".sl-phishing__browser");
      const bankName = await page.locator(".sl-phishing__bank-name").textContent();
      assert.equal(bankName.trim(), "Banca Centrale Sicura");
    });

    await suite.test("submit Accesso con dati di fantasia -> vista Pagamento", async () => {
      await page.fill(".sl-phishing__bank-form input >> nth=0", "chiunque@esempio.test");
      await page.fill(".sl-phishing__bank-form input >> nth=1", "password-inventata");
      await page.click(".sl-phishing__bank-submit");
      await page.waitForSelector(".sl-phishing__bank-step-title:has-text('pagamento')", { timeout: 3000 });
    });

    await suite.test("submit Pagamento con dati di fantasia -> Rivelazione", async () => {
      await page.fill(".sl-phishing__bank-form input >> nth=0", "4111 1111 1111 1111");
      await page.fill(".sl-phishing__bank-form input >> nth=1", "01/30");
      await page.fill(".sl-phishing__bank-form input >> nth=2", "123");
      await page.fill(".sl-phishing__bank-form input >> nth=3", "Erasmo");
      await page.fill(".sl-phishing__bank-form input >> nth=4", "Lassandro");
      await page.click(".sl-phishing__bank-submit");
      await page.waitForSelector(".sl-phishing__reveal", { timeout: 3000 });
    });

    await suite.test("Rivelazione: 5 segnali d'allarme presenti", async () => {
      assert.equal(await page.locator(".sl-phishing__reveal-flag").count(), 5);
    });

    await suite.test("VINCOLO ETICO: nessuna richiesta è uscita verso un host esterno in tutto il flusso", async () => {
      assert.deepEqual(externalRequests, []);
    });

    await context.close();
  }

  // --- Regressione: Oversharing e Keylogger invariati ---------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("regressione: Oversharing ancora raggiungibile, AppHeader/Sidebar presenti (chrome standard)", async () => {
      await page.goto(`${server.url}/#/scenario/oversharing`);
      await page.waitForSelector(".sl-profile-timeline");
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-sidebar").count(), 1);
      const username = await page.locator(".sl-profile-timeline__username").textContent();
      assert.equal(username.trim(), "marti.travel");
    });

    await suite.test("regressione: Keylogger ancora raggiungibile, chrome immersivo invariato", async () => {
      await page.goto(`${server.url}/#/scenario/keylogger`);
      await page.waitForSelector(".sl-fake-login-capture");
      assert.equal(await page.locator(".sl-app-header").count(), 0);
      assert.equal(await page.locator(".sl-login-form__brand").textContent(), "SocialAlive");
    });

    await context.close();
  }

  // --- Screenshot ----------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.goto(`${server.url}/#/modules/cybersecurity`);
    await page.waitForSelector(".sl-module-scenarios-page__grid");

    await suite.test("screenshot — selettore Cybersecurity con 3 scenari", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cybersecurity-selector-3-scenari.png") });
    });

    await context.close();
  }

  await browser.close();
  await server.close();
  return suite.summary();
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
