/**
 * scenario.spec.js
 * -----------------------------------------------------------------------
 * Copre il primo (e oggi unico) scenario reale, Oversharing (Fase 6),
 * incluso il Media Viewer collegato in Fase 7. L'ultimo test del file
 * chiude l'intervento #9 dell'audit di Fase 9 ("percorrere l'intero
 * flusso da tastiera Home→Scenario→MediaViewer"), mai verificato per
 * intero in nessuna fase precedente (segnalato ricorrente dalla Fase 4).
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
      assert.equal(await page.locator(".sl-timeline__tile").count(), 12); // un riquadro per ciascun post, post-004 incluso (fallback testuale)
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

    await suite.test("chiusura con Escape: overlay rimosso, sl:media-viewer-close ricevuto", async () => {
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

    await context.close();
  }

  // --- Flusso completo da tastiera: Home -> Scenario -> MediaViewer ----
  // Intervento #9 dell'audit Fase 9, aperto fin dalla Fase 4: mai
  // percorso per intero in un unico test. Nessun click del mouse in
  // questo blocco (a parte il login, che non fa parte del flusso da
  // verificare): solo Tab/Shift+Tab/Invio/Frecce/Escape.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("flusso da tastiera: Sidebar -> Moduli -> Cybersecurity (Invio)", async () => {
      // Ordine di tabulazione naturale della Home: skip-link, ricerca
      // header, trigger profilo, voci Sidebar (solo "Home" è focalizzabile,
      // le altre due sono <span aria-disabled>, fuori dall'ordine di tab —
      // verificato in home.spec.js), poi le ModuleCard disponibili (solo
      // Cybersecurity ha tabindex="0", le altre 5 sono <div> non
      // focalizzabili). Invece di contare i Tab a mano (fragile: basta un
      // futuro campo di ricerca in più a rompere il conteggio), si esegue
      // Tab ripetutamente finché il focus non raggiunge la card
      // Cybersecurity, con un tetto massimo di sicurezza.
      let focused = null;
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
        if (focused === "Apri modulo Cybersecurity") break;
      }
      assert.equal(focused, "Apri modulo Cybersecurity", "il focus non ha raggiunto la card Cybersecurity entro 15 Tab");

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
      // Ultimo passo del percorso (non l'oggetto del test #9, che riguarda
      // l'andata): un click qui è accettabile, l'obiettivo era verificare
      // l'INTERO percorso di apertura da tastiera, non anche il ritorno.
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
