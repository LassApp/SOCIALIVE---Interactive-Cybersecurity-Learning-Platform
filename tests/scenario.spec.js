/**
 * scenario.spec.js
 * -----------------------------------------------------------------------
 * Copre gli scenari reali del progetto: Oversharing (Fase 6, incluso il
 * Media Viewer di Fase 7), Keylogger (fake-login-capture) ed Evil Twin
 * Wi-Fi (fake-captive-portal, NUOVO — vedi blocco dedicato più sotto).
 *
 * MODIFICATO (Evil Twin Wi-Fi): aggiunto un blocco dedicato al terzo
 * scenario reale, type "fake-captive-portal" — seconda vera prova (dopo
 * il Keylogger) del pattern Registry di scenarioEngine.js con un type
 * diverso da "profile-timeline". Aggiunto anche un controllo di
 * regressione esplicito sul login reale ("strict"), dato che
 * LoginForm.js ha ricevuto due nuove prop additive (showBrand/
 * showForgotLink) proprio per servire il portale captive di questo
 * scenario.
 *
 * NOTA D'ONESTÀ DI PROCESSO: il blocco Evil Twin Wi-Fi è stato scritto
 * in una sessione priva di accesso a un ambiente Playwright reale — non
 * è mai stato eseguito. Va verificato per primo, con la stessa
 * disciplina "mai fidarsi della narrazione" già consolidata nel
 * progetto, prima di considerarlo parte della baseline "nota buona".
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

async function gotoScenario(page, baseUrl) {
  await loginAsDocente(page, baseUrl);
  await page.goto(`${baseUrl}/#/scenario/oversharing`);
  await page.waitForSelector(".sl-profile-timeline");
}

async function run() {
  const suite = createSuite("scenario.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Profilo, storie, feed -------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("nessuna voce Sidebar risulta attiva sulla pagina di scenario", async () => {
      const activeLinks = await page.locator(".sl-sidebar__link--active").count();
      assert.equal(activeLinks, 0);
    });

    await suite.test("header profilo: username, bio, statistiche derivate da posts.length", async () => {
      const username = await page.locator(".sl-profile-timeline__username").textContent();
      assert.equal(username.trim(), "marti.travel");
      const statValues = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      const expectedPosts = await page.evaluate(() => (12).toLocaleString("it-IT"));
      const expectedFollowers = await page.evaluate(() => (2450).toLocaleString("it-IT"));
      const expectedFollowing = await page.evaluate(() => (587).toLocaleString("it-IT"));
      assert.deepEqual(
        statValues.map((v) => v.trim()),
        [expectedPosts, expectedFollowers, expectedFollowing]
      );
    });

    await suite.test("scenario.title/description NON vengono mai renderizzati", async () => {
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(!bodyText.includes("Un profilo social realistico"), "trovata la description dello scenario nel DOM visibile");
    });

    await suite.test("StoriesBar: 5 storie renderizzate", async () => {
      assert.equal(await page.locator(".sl-stories-bar__item").count(), 5);
    });

    await suite.test("Feed di default: 12 PostCard, vista Archivio nascosta", async () => {
      assert.equal(await page.locator(".sl-feed .sl-post-card").count(), 12);
      assert.equal(await page.locator(".sl-timeline").isHidden(), true);
    });

    await suite.test("nessun elemento didattico visibile (sensitive/insightNote/scenarioId)", async () => {
      const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      ["sensibile", "insight", "oversharing"].forEach((term) => {
        assert.ok(!bodyText.includes(term), `trovato il termine didattico "${term}" nel testo visibile`);
      });
    });

    await context.close();
  }

  // --- Toggle Post/Archivio ---------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("toggle su Archivio: Timeline visibile, Feed nascosto, annuncio aria-live", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Archivio");
      await page.waitForSelector(".sl-timeline:not([hidden])");
      assert.equal(await page.locator(".sl-feed").isHidden(), true);
      const status = await page.locator(".sl-profile-timeline__view-status").textContent();
      assert.equal(status.trim(), "Vista: Archivio");
      assert.equal(await page.locator(".sl-timeline__tile").count(), 12);
    });

    await suite.test("post-004 (solo testo) ha un riquadro di fallback testuale in Archivio", async () => {
      assert.equal(await page.locator(".sl-timeline__tile--text").count(), 1);
    });

    await suite.test("torna su Post: Feed di nuovo visibile", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Post");
      await page.waitForSelector(".sl-feed:not([hidden])");
      assert.equal(await page.locator(".sl-timeline").isHidden(), true);
    });

    await context.close();
  }

  // --- Bottone "Segui" — unico comando anche della visibilità ----------
  // (fonde la copertura del precedente toggle lucchetto, ora eliminato)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const headerFollow = () => page.locator(".sl-profile-timeline__follow-button");
    const privateFollow = () => page.locator(".sl-profile-timeline__private-follow");
    const publicContent = () => page.locator(".sl-profile-timeline__public-content");
    const privateNotice = () => page.locator(".sl-profile-timeline__private-notice");

    await suite.test("regressione: il vecchio bottone lucchetto non esiste più nel DOM", async () => {
      assert.equal(await page.locator(".sl-profile-timeline__privacy-toggle").count(), 0);
    });

    await suite.test("Segui: presente PRIMA del conteggio post nella riga statistiche", async () => {
      const order = await page
        .locator(".sl-profile-timeline__stats-row")
        .evaluate((row) => Array.from(row.children).map((c) => c.className));
      assert.ok(order[0].includes("follow-button"), `il bottone Segui non è il primo figlio: ${order.join(" | ")}`);
    });

    await suite.test("stato iniziale: 'Segui già', aria-pressed=true — profilo aperto già seguito", async () => {
      assert.equal((await headerFollow().textContent()).trim(), "Segui già");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "true");
    });

    await suite.test("stato iniziale: contenuto pubblico visibile, pannello privato nascosto", async () => {
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    let statsBefore;
    await suite.test("3 statistiche leggibili prima del click (baseline per il confronto)", async () => {
      statsBefore = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      assert.equal(statsBefore.length, 3);
    });

    await suite.test("click su 'Segui già' -> 'Segui', aria-pressed=false, evento sl:profile-follow-toggle", async () => {
      const detail = await page.evaluate(
        () =>
          new Promise((resolve) => {
            document
              .querySelector(".sl-profile-timeline")
              .addEventListener("sl:profile-follow-toggle", (e) => resolve(e.detail), { once: true });
            document.querySelector(".sl-profile-timeline__follow-button").click();
          })
      );
      assert.deepEqual(detail, { following: false });
      assert.equal((await headerFollow().textContent()).trim(), "Segui");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "false");
    });

    await suite.test("dopo il click: contenuto pubblico nascosto, pannello privato visibile", async () => {
      assert.equal(await publicContent().isHidden(), true);
      assert.equal(await privateNotice().isVisible(), true);
    });

    await suite.test("pannello privato: titolo 'Questo profilo è privato'", async () => {
      const title = await page.locator(".sl-profile-timeline__private-title").textContent();
      assert.equal(title.trim(), "Questo profilo è privato");
    });

    await suite.test("pannello privato: descrizione contiene il nome utente reale (da profile.json)", async () => {
      const description = await page.locator(".sl-profile-timeline__private-description").textContent();
      assert.ok(description.includes("marti.travel"), "il nome utente non compare nella descrizione");
    });

    await suite.test("pannello privato: il bottone riflette lo stesso stato 'Segui' dell'header", async () => {
      assert.equal((await privateFollow().textContent()).trim(), "Segui");
      assert.equal(await privateFollow().getAttribute("aria-pressed"), "false");
    });

    await suite.test("statistiche IDENTICHE dopo il click (stessi valori di prima)", async () => {
      const statsAfter = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      assert.deepEqual(statsAfter, statsBefore);
    });

    await suite.test("annuncio aria-live: 'Non segui più questo profilo: contenuti nascosti.'", async () => {
      const status = await page.locator(".sl-profile-timeline__follow-status").textContent();
      assert.equal(status.trim(), "Non segui più questo profilo: contenuti nascosti.");
    });

    await suite.test("click nel pannello privato su 'Segui' -> torna 'Segui già', si riflette sull'header", async () => {
      await privateFollow().click();
      await page.waitForTimeout(30);
      assert.equal((await headerFollow().textContent()).trim(), "Segui già");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "true");
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    await suite.test("dopo il ritorno a 'Segui già': ancora 12 post (nessun duplicato/perdita)", async () => {
      assert.equal(await page.locator(".sl-feed .sl-post-card").count(), 12);
    });

    await suite.test("annuncio aria-live: 'Ora segui questo profilo: contenuti visibili.'", async () => {
      const status = await page.locator(".sl-profile-timeline__follow-status").textContent();
      assert.equal(status.trim(), "Ora segui questo profilo: contenuti visibili.");
    });

    await suite.test("la vista Archivio selezionata prima di smettere di seguire viene preservata", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Archivio");
      await page.waitForSelector(".sl-timeline:not([hidden])");
      await headerFollow().click(); // -> Segui (non seguo più)
      await page.waitForTimeout(30);
      await headerFollow().click(); // -> Segui già (seguo di nuovo)
      await page.waitForTimeout(30);
      assert.equal(await page.locator(".sl-timeline").isHidden(), false, "l'Archivio non è più visibile dopo il round-trip Segui/Segui già");
      assert.equal(await page.locator(".sl-feed").isHidden(), true, "il Feed è tornato visibile invece dell'Archivio (reset non richiesto)");
      // Ripristina la vista Post per non alterare lo stato dei blocchi successivi.
      await page.click(".sl-profile-timeline__tabs >> text=Post");
    });

    await context.close();
  }

  // --- MediaViewer: avatar, copertina, storie ---------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("click sull'avatar -> MediaViewer con 1 solo item, nessuna navigazione", async () => {
      await page.click(".sl-profile-timeline__avatar-trigger");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 1");
      assert.equal(await page.locator(".sl-media-viewer__nav--prev").isDisabled(), true);
      assert.equal(await page.locator(".sl-media-viewer__nav--next").isDisabled(), true);
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("click sulla copertina -> MediaViewer con 1 item, autore = marti.travel", async () => {
      await page.click(".sl-profile-timeline__cover-trigger");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const author = await page.locator(".sl-media-viewer__author-name").textContent();
      assert.equal(author.trim(), "marti.travel");
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("click su una storia -> MediaViewer con 5 item, didascalia = etichetta della storia", async () => {
      await page.click(".sl-stories-bar__item >> nth=2");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "3 di 5");
      const caption = await page.locator(".sl-media-viewer__caption").textContent();
      assert.equal(caption.trim(), "Food");
    });

    await suite.test("navigazione tra storie con freccia destra, poi chiusura", async () => {
      await page.click(".sl-media-viewer__nav--next");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "4 di 5");
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("dopo le nuove interazioni: profilo ancora integro (12 post, nessun residuo)", async () => {
      assert.equal(await page.locator(".sl-feed .sl-post-card").count(), 12);
      assert.equal(await page.locator(".sl-media-viewer-overlay").count(), 0);
    });

    await context.close();
  }

  // --- MediaViewer -------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("apertura da Feed: MediaViewer mostra il post corretto (1 di 12)", async () => {
      await page.click(".sl-feed .sl-post-card >> nth=0 >> .sl-post-card__media");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 12");
    });

    await suite.test("navigazione successiva: prev disabilitato, next abilitato", async () => {
      assert.equal(await page.locator(".sl-media-viewer__nav--prev").isDisabled(), true);
      assert.equal(await page.locator(".sl-media-viewer__nav--next").isDisabled(), false);
      await page.click(".sl-media-viewer__nav--next");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "2 di 12");
    });

    await suite.test("navigazione da tastiera (ArrowLeft) torna al post precedente", async () => {
      await page.keyboard.press("ArrowLeft");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 12");
    });

    await suite.test("zoom: click sull'immagine attiva lo stato zoomato", async () => {
      await page.click(".sl-media-viewer__zoom-trigger");
      const zoomed = await page.locator(".sl-media-viewer__stage").evaluate((el) =>
        el.classList.contains("sl-media-viewer__stage--zoomed")
      );
      assert.ok(zoomed);
    });

    await suite.test("chiusura con Escape: overlay rimosso", async () => {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await context.close();
  }

  // --- Screenshot Light/Dark/mobile/breakpoint intermedio ---------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("screenshot scenario — desktop Light (vista Post)", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-desktop-light.png"), fullPage: true });
    });

    await suite.test("screenshot scenario — desktop Dark", async () => {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-desktop-dark.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    });

    await suite.test("screenshot scenario — breakpoint 900px, nessun overflow orizzontale", async () => {
      await page.setViewportSize({ width: 900, height: 900 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-900.png"), fullPage: true });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false);
    });

    await suite.test("screenshot scenario — mobile 375px, vista Archivio", async () => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.click(".sl-profile-timeline__tabs >> text=Archivio");
      await page.waitForSelector(".sl-timeline:not([hidden])");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-archive-mobile-375.png"), fullPage: true });
    });

    await suite.test("screenshot scenario — mobile 375px, pannello privato (non seguo)", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Post");
      await page.click(".sl-profile-timeline__follow-button");
      await page.waitForSelector(".sl-profile-timeline__private-notice:not([hidden])");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-private-mobile-375.png"), fullPage: true });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false, "overflow orizzontale rilevato nel pannello privato a 375px");
      // Ripristina lo stato "seguo" per non alterare eventuali blocchi successivi.
      await page.click(".sl-profile-timeline__follow-button");
    });

    await context.close();
  }

  // --- Evil Twin Wi-Fi (scenario "fake-captive-portal") -----------------
  // NUOVO — vedi rationale completo in fakeCaptivePortalRenderer.js.
  // acceptDownloads:true esplicito, stesso principio già seguito per il
  // Keylogger: intercettare un download REALE (page.waitForEvent), non
  // solo asserire che il click non lanci errori.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("selettore Cybersecurity mostra 3 scenari (Oversharing, Keylogger, Evil Twin Wi-Fi)", async () => {
      await page.click(".sl-home-page__modules-grid .sl-module-card >> nth=4");
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
      assert.equal(await page.locator(".sl-module-scenarios-page__grid .sl-module-card").count(), 3);
    });

    await suite.test("click su Evil Twin Wi-Fi -> #/scenario/evil-twin-wifi, chrome:none rispettato", async () => {
      await page.click(".sl-module-scenarios-page__grid .sl-module-card >> nth=2");
      await page.waitForFunction(() => window.location.hash === "#/scenario/evil-twin-wifi");
      await page.waitForSelector(".sl-fake-captive-portal");
      assert.equal(await page.locator(".sl-app-header").count(), 0);
      assert.equal(await page.locator(".sl-sidebar").count(), 0);
    });

    await suite.test("elenco reti: 4 voci, 1 sola apribile (aperta), 3 protette non interattive", async () => {
      assert.equal(await page.locator(".sl-fake-captive-portal__network-item").count(), 4);
      assert.equal(await page.locator(".sl-fake-captive-portal__network-button").count(), 1);
      assert.equal(await page.locator(".sl-fake-captive-portal__network-item--secured").count(), 3);
    });

    await suite.test("rete protetta non è un elemento interattivo (nessun <button>)", async () => {
      const tagName = await page
        .locator(".sl-fake-captive-portal__network-item--secured")
        .first()
        .locator(":scope > *")
        .first()
        .evaluate((el) => el.tagName);
      assert.notEqual(tagName, "BUTTON");
    });

    await suite.test("click sulla rete aperta -> vista 'connessione in corso'", async () => {
      await page.click(".sl-fake-captive-portal__network-button");
      await page.waitForSelector(".sl-fake-captive-portal__connecting");
    });

    await suite.test("dopo la connessione: transizione automatica al portale captive", async () => {
      await page.waitForSelector(".sl-fake-captive-portal__portal-headline", { timeout: 3000 });
      const headline = await page.locator(".sl-fake-captive-portal__portal-headline").textContent();
      assert.equal(headline.trim(), "Accedi per continuare a navigare");
      assert.equal(await page.locator(".sl-fake-captive-portal__social-button").count(), 2);
    });

    await suite.test("il portale NON mostra brand/tagline di SocialAlive (showBrand:false)", async () => {
      assert.equal(await page.locator(".sl-fake-captive-portal .sl-login-form__brand").isVisible(), false);
    });

    await suite.test("il portale NON mostra 'Password dimenticata?' (showForgotLink:false)", async () => {
      assert.equal(await page.locator(".sl-fake-captive-portal .sl-login-form__forgot").isVisible(), false);
    });

    let downloadedContent = "";
    await suite.test("submit con email 'loose' (senza dominio) -> download reale del file di log", async () => {
      await page.fill(".sl-fake-captive-portal .sl-login-form__form input[type='email']", "ospite@wifi");
      await page.fill(".sl-fake-captive-portal .sl-login-form__form input[type='password']", "prova123");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click(".sl-fake-captive-portal .sl-login-form__submit"),
      ]);
      const filePath = await download.path();
      downloadedContent = fs.readFileSync(filePath, "utf-8");
      assert.ok(downloadedContent.length > 0, "il file scaricato è vuoto");
    });

    await suite.test("il file contiene fedelmente username/password digitati", async () => {
      assert.ok(downloadedContent.includes('username="ospite@wifi"'), "username non trovato fedelmente nel file");
      assert.ok(downloadedContent.includes('password="prova123"'), "password non trovata fedelmente nel file");
    });

    await suite.test("il file contiene una sola occorrenza di '@', sulla riga di cattura", async () => {
      const atCount = (downloadedContent.match(/@/g) || []).length;
      assert.equal(atCount, 1, `attese 1 occorrenza di "@", trovate ${atCount}`);
    });

    await suite.test("disclaimer finale presente, rivela la natura didattica", async () => {
      assert.ok(downloadedContent.includes("SocialAlive"), "riferimento a SocialAlive non trovato nel disclaimer");
      assert.ok(downloadedContent.includes("scopo didattico"), "testo del disclaimer non trovato");
    });

    await suite.test("dopo il download: nessuna rivelazione in-app, messaggio neutro 'Connesso a Internet.'", async () => {
      const message = await page.locator(".sl-fake-captive-portal__completed").textContent();
      assert.equal(message.trim(), "Connesso a Internet.");
      const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      ["evil twin", "clonata", "attacco"].forEach((term) => {
        assert.ok(!bodyText.includes(term), `trovato il termine rivelatore "${term}" nel testo visibile`);
      });
    });

    await suite.test("nessun redirect forzato dopo il download (hash invariato)", async () => {
      assert.equal(await page.evaluate(() => window.location.hash), "#/scenario/evil-twin-wifi");
    });

    await context.close();
  }

  // --- Screenshot Evil Twin Wi-Fi ----------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.goto(`${server.url}/#/scenario/evil-twin-wifi`);
    await page.waitForSelector(".sl-fake-captive-portal");

    await suite.test("screenshot Evil Twin Wi-Fi — elenco reti, Light", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "evil-twin-networks-light.png") });
    });

    await suite.test("screenshot Evil Twin Wi-Fi — portale captive, mobile 375px", async () => {
      await page.click(".sl-fake-captive-portal__network-button");
      await page.waitForSelector(".sl-fake-captive-portal__portal-headline", { timeout: 3000 });
      await page.setViewportSize({ width: 375, height: 800 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "evil-twin-portal-mobile-375.png") });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false, "overflow orizzontale rilevato nel portale a 375px");
    });

    await context.close();
  }

  // --- Regressione: login reale ('strict') invariato dopo l'aggiunta ----
  // di showBrand/showForgotLink e dell'estrazione di textDownload.js
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await suite.test("regressione: login reale rifiuta ancora un'email senza dominio valido (strict)", async () => {
      await page.goto(`${server.url}/#/login`);
      await page.waitForSelector(".sl-login-form");
      await page.fill(".sl-login-form__form input[type='email']", "docente@scuola");
      await page.fill(".sl-login-form__form input[type='password']", "password123");
      await page.click(".sl-login-form__submit");
      const helperText = await page
        .locator(".sl-login-form__form input[type='email']")
        .locator("xpath=..")
        .locator(".sl-input__helper")
        .textContent();
      assert.equal(helperText.trim(), "Inserisci un indirizzo email valido.");
    });

    await suite.test("regressione: login reale mostra ancora brand/tagline SocialAlive (showBrand default true)", async () => {
      assert.equal(await page.locator(".sl-login-form__brand").isVisible(), true);
      assert.equal(await page.locator(".sl-login-form__forgot").isVisible(), true);
    });

    await context.close();
  }

  // --- Regressione: Keylogger invariato dopo l'estrazione di textDownload.js ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("regressione: Keylogger genera ancora un download reale dopo l'estrazione di textDownload.js", async () => {
      await page.goto(`${server.url}/#/scenario/keylogger`);
      await page.waitForSelector(".sl-fake-login-capture");
      await page.fill(".sl-fake-login-capture .sl-login-form__form input[type='email']", "prof@scuola");
      await page.fill(".sl-fake-login-capture .sl-login-form__form input[type='password']", "test123");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click(".sl-fake-login-capture .sl-login-form__submit"),
      ]);
      const filePath = await download.path();
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(content.includes('username="prof@scuola"'), "il Keylogger non genera più un download fedele dopo il refactor");
    });

    await context.close();
  }

  // --- Flusso completo da tastiera: Home -> Scenario -> MediaViewer ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    // FIX (scoperto eseguendo davvero la suite per la prima volta in questa
    // sessione): homePageController.js popola la griglia moduli in modo
    // asincrono (Promise.all su modules.json/feed.json) — senza attendere
    // esplicitamente il suo rendering, il ciclo di Tab qui sotto può
    // eseguirsi PRIMA che la card Cybersecurity esista nel DOM, producendo
    // un fallimento a cascata su tutti i controlli successivi del blocco.
    // Stesso principio di attesa già applicato altrove nel file (es. dopo
    // ogni navigazione che monta contenuto asincrono).
    await page.waitForSelector(".sl-home-page__modules-grid");

    await suite.test("flusso da tastiera: Sidebar -> Moduli -> Cybersecurity (Invio) -> selettore", async () => {
      let focused = null;
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
        if (focused === "Apri modulo Cybersecurity") break;
      }
      assert.equal(focused, "Apri modulo Cybersecurity", "il focus non ha raggiunto la card Cybersecurity entro 15 Tab");

      await page.keyboard.press("Enter");
      // Cybersecurity ospita ora 3 scenari (Oversharing, Keylogger, Evil
      // Twin Wi-Fi): il click/Invio porta al selettore
      // #/modules/cybersecurity, non più direttamente allo scenario.
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
    });

    await suite.test("flusso da tastiera: dal selettore raggiunge Oversharing (Invio)", async () => {
      let focused = null;
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
        if (focused === "Apri modulo Oversharing") break;
      }
      assert.equal(focused, "Apri modulo Oversharing", "il focus non ha raggiunto la card Oversharing entro 15 Tab");

      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.location.hash === "#/scenario/oversharing");
      await page.waitForSelector(".sl-profile-timeline");
    });

    await suite.test("flusso da tastiera: raggiunge il primo post del Feed e lo apre con Invio", async () => {
      let focused = null;
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label") || "");
        if (focused.startsWith("Apri immagine del post di")) break;
      }
      assert.ok(focused && focused.startsWith("Apri immagine del post di"), "il focus non ha raggiunto l'immagine di un post entro 25 Tab");

      await page.keyboard.press("Enter");
      await page.waitForSelector(".sl-media-viewer-overlay");
    });

    await suite.test("flusso da tastiera: naviga con le frecce e chiude con Escape", async () => {
      await page.keyboard.press("ArrowRight");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "2 di 12");

      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("flusso da tastiera: torna alla Home cliccando 'Home' in Sidebar", async () => {
      await page.click(".sl-sidebar__link[href='#/home']");
      await page.waitForFunction(() => window.location.hash === "#/home");
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
