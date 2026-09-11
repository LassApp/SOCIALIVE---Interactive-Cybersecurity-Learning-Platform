/**
 * phishing.spec.js
 * -----------------------------------------------------------------------
 * Copre il terzo scenario reale del progetto, Phishing (type
 * "phishing-simulation"), attraverso l'index.html reale — non un harness
 * isolato: login reale, Home reale, selettore moduli reale (ora con 3
 * scenari sotto Cybersecurity), flusso completo a 5 viste, regressione
 * sui due scenari precedenti (Oversharing, Keylogger) per confermare che
 * l'aggiunta del terzo type non li abbia toccati.
 *
 * ESTESO (revisione post-produzione, richieste del docente dopo il primo
 * uso reale): bottone di uscita in-app dalla modalità immersiva (condiviso
 * con Keylogger, verificato qui perché Phishing è lo scenario con più
 * viste in cui testarlo); layout full-screen su tutte e 5 le viste
 * (prima: card centrata 640px); cartelle email (schema "folders" in
 * inbox.json + tab "Posta in arrivo"/"Spam", quest'ultima vuota); stato
 * "letta" aggiornato realmente all'apertura (bug segnalato dal docente:
 * prima restava "non letta" anche dopo l'apertura).
 *
 * ESTESO ULTERIORMENTE (seconda revisione post-produzione): bottone di
 * uscita riposizionato a destra — test di regressione dedicato che
 * verifica geometricamente l'assenza di sovrapposizione col titolo
 * "MailTime" (bug reale trovato leggendo il CSS, non solo la posizione
 * dichiarata); riquadro "Rispondi" inline su ogni email della cartella
 * attiva (non solo quella target), stessa finzione end-to-end già
 * verificata per i form del finto sito bancario (nessuna richiesta di
 * rete, validazione minima, conferma neutra).
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

  // --- Selettore Cybersecurity: ora con 4 scenari (dopo Evil Twin Wi-Fi) -
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-home-page__modules-grid");

    await suite.test("click su Cybersecurity -> selettore con 4 scenari, tutti disponibili", async () => {
      await page.click(".sl-home-page__modules-grid .sl-module-card >> nth=4");
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
      const cards = page.locator(".sl-module-scenarios-page__grid .sl-module-card");
      assert.equal(await cards.count(), 4);
      const badges = await page.locator(".sl-module-scenarios-page__grid .sl-badge").allTextContents();
      assert.deepEqual(badges.map((b) => b.trim()), ["Disponibile", "Disponibile", "Disponibile", "Disponibile"]);
    });

    await suite.test("terza card è 'Phishing' e naviga a #/scenario/phishing", async () => {
      const titles = await page.locator(".sl-module-scenarios-page__grid .sl-module-card__title").allTextContents();
      assert.deepEqual(titles.map((t) => t.trim()), ["Oversharing", "Keylogger", "Phishing", "Evil Twin Wi-Fi"]);
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

  // --- Revisione post-produzione: uscita, full-screen, cartelle, letta --
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.goto(`${server.url}/#/scenario/phishing`);
    await page.waitForSelector(".sl-phishing");

    await suite.test("bottone di uscita: ancorato a destra, nessuna sovrapposizione col titolo 'MailTime' (bug segnalato dal docente)", async () => {
      const exitBox = await page.locator(".sl-scenario-page__immersive-exit").boundingBox();
      const brandBox = await page.locator(".sl-phishing__brand").boundingBox();
      assert.ok(
        exitBox.x > brandBox.x + brandBox.width,
        "il bottone di uscita si sovrappone ancora al titolo MailTime"
      );
    });

    await suite.test("bottone di uscita: presente, aria-label onesto, riporta a #/home", async () => {
      const exitButton = page.locator(".sl-scenario-page__immersive-exit");
      assert.equal(await exitButton.count(), 1);
      assert.equal(await exitButton.getAttribute("aria-label"), "Torna alla Home");
      await exitButton.click();
      await page.waitForFunction(() => window.location.hash === "#/home");
    });

    await page.goto(`${server.url}/#/scenario/phishing`);
    await page.waitForSelector(".sl-phishing");

    await suite.test("full-screen: .sl-phishing riempie l'intera viewport (non più una card)", async () => {
      const box = await page.locator(".sl-phishing").boundingBox();
      const viewport = page.viewportSize();
      assert.equal(box.width, viewport.width);
      assert.equal(box.height, viewport.height);
    });

    await suite.test("cartelle: 2 tab, 'Posta in arrivo' attiva di default", async () => {
      const tabs = page.locator(".sl-phishing__folder-tab");
      assert.equal(await tabs.count(), 2);
      assert.equal((await tabs.nth(0).textContent()).trim(), "Posta in arrivo");
      assert.equal(await tabs.nth(0).getAttribute("aria-pressed"), "true");
      assert.equal((await tabs.nth(1).textContent()).trim(), "Spam");
      assert.equal(await tabs.nth(1).getAttribute("aria-pressed"), "false");
    });

    await suite.test("click su 'Spam': 0 email, stato vuoto esplicito, tab sincronizzate", async () => {
      await page.click(".sl-phishing__folder-tab >> nth=1");
      assert.equal(await page.locator(".sl-phishing__email-row").count(), 0);
      const empty = await page.locator(".sl-phishing__email-empty").textContent();
      assert.equal(empty.trim(), "Nessuna email in questa cartella.");
      assert.equal(await page.locator(".sl-phishing__folder-tab >> nth=1").getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator(".sl-phishing__folder-tab >> nth=0").getAttribute("aria-pressed"), "false");
    });

    await suite.test("torna su 'Posta in arrivo': 5 email di nuovo visibili", async () => {
      await page.click(".sl-phishing__folder-tab >> nth=0");
      assert.equal(await page.locator(".sl-phishing__email-row").count(), 5);
    });

    await suite.test("stato letta: apertura di un'email non letta aggiorna aria-label E peso tipografico al ritorno", async () => {
      // La prima riga (ConnectWork) è unread:true nei dati demo.
      const firstRow = page.locator(".sl-phishing__email-row").nth(0);
      const beforeLabel = await firstRow.getAttribute("aria-label");
      assert.ok(beforeLabel.startsWith("Non letta."), "l'email non risulta 'non letta' prima dell'apertura");

      await firstRow.click();
      await page.waitForSelector(".sl-phishing__detail");
      await page.click(".sl-phishing__back");
      await page.waitForSelector(".sl-phishing__email-row");

      const afterRow = page.locator(".sl-phishing__email-row").nth(0);
      assert.ok(
        !(await afterRow.getAttribute("aria-label")).startsWith("Non letta."),
        "l'email risulta ancora 'non letta' dopo l'apertura — bug segnalato dal docente"
      );
      assert.equal(
        await afterRow.locator(".sl-phishing__email-sender--unread").count(),
        0,
        "la classe --unread è ancora presente dopo l'apertura"
      );
    });

    await suite.test("screenshot — Phishing full-screen, Inbox con tab cartelle", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phishing-fullscreen-inbox.png"), fullPage: true });
    });

    await context.close();
  }

  // --- "Rispondi" inline (revisione post-produzione #2) -------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    const externalRequests = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.hostname !== "127.0.0.1") externalRequests.push(req.url());
    });

    await loginAsDocente(page, server.url);
    await page.goto(`${server.url}/#/scenario/phishing`);
    await page.waitForSelector(".sl-phishing");

    await suite.test("'Rispondi' presente sull'email target, insieme al CTA (i due non si escludono)", async () => {
      // CORRETTO: l'email target (campo "isTarget"/"ctaLabel" in
      // inbox.json) è la SECONDA riga (indice 1, "Banca Centrale
      // Sicura") nell'ordine reale dei dati — non la quarta come
      // affermava un commento precedente, disallineato dai dati veri.
      // Verificato leggendo data/scenarios/phishing/inbox.json: il
      // codice sorgente del renderer era già corretto (CTA e Rispondi
      // coesistono sempre, senza alcuna esclusione reciproca), era solo
      // questo test a puntare alla riga sbagliata.
      await page.click(".sl-phishing__email-row >> nth=1");
      await page.waitForSelector(".sl-phishing__detail");
      assert.equal(await page.locator(".sl-phishing__cta").count(), 1);
      assert.equal(await page.locator(".sl-phishing__reply-toggle").count(), 1);
      await page.click(".sl-phishing__back");
      await page.waitForSelector(".sl-phishing__email-row");
    });

    await suite.test("'Rispondi' presente anche su un'email di riempimento (senza CTA) — richiesta 'su tutte'", async () => {
      await page.click(".sl-phishing__email-row >> nth=0");
      await page.waitForSelector(".sl-phishing__detail");
      assert.equal(await page.locator(".sl-phishing__cta").count(), 0);
      assert.equal(await page.locator(".sl-phishing__reply-toggle").count(), 1);
    });

    await suite.test("click su 'Rispondi': il toggle sparisce, il riquadro appare, focus sulla textarea", async () => {
      await page.click(".sl-phishing__reply-toggle");
      await page.waitForSelector(".sl-phishing__reply-form");
      assert.equal(await page.locator(".sl-phishing__reply-toggle").count(), 0);
      const isFieldFocused = await page.evaluate(
        () => document.activeElement.classList.contains("sl-phishing__reply-field")
      );
      assert.ok(isFieldFocused, "il focus non si sposta sulla textarea alla rivelazione del riquadro");
    });

    await suite.test("invio vuoto -> 'Campo obbligatorio.', nessun invio simulato", async () => {
      await page.click(".sl-phishing__reply-form button[type='submit']");
      const helperText = await page.locator(".sl-phishing__reply-form .sl-input__helper").textContent();
      assert.equal(helperText.trim(), "Campo obbligatorio.");
      assert.equal(await page.locator(".sl-phishing__reply-field").getAttribute("aria-invalid"), "true");
    });

    await suite.test("invio con testo -> stato 'Invio in corso…', poi conferma neutra e annuncio aria-live", async () => {
      await page.fill(".sl-phishing__reply-field", "Grazie per l'informazione, controllo subito.");
      await page.click(".sl-phishing__reply-form button[type='submit']");
      assert.equal(
        (await page.locator(".sl-phishing__reply-form button[type='submit']").textContent()).trim(),
        "Invio in corso…"
      );
      await page.waitForSelector(".sl-phishing__reply-confirmation");
      assert.equal((await page.locator(".sl-phishing__reply-confirmation").textContent()).trim(), "Risposta inviata.");
      assert.equal(await page.locator(".sl-phishing__reply-form").count(), 0, "il form resta nel DOM dopo l'invio");
      assert.equal(await page.locator(".sl-phishing__reply-status").textContent(), "Risposta inviata.");
    });

    await suite.test("VINCOLO ETICO: 'Rispondi' non genera alcuna richiesta verso un host esterno (nessun testo mai inviato in rete)", async () => {
      assert.deepEqual(externalRequests, []);
    });

    await context.close();
  }
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

    await suite.test("screenshot — selettore Cybersecurity con 4 scenari", async () => {
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
