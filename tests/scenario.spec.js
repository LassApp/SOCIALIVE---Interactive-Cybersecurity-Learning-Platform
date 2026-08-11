/**
 * scenario.spec.js
 * -----------------------------------------------------------------------
 * Copre il primo (e oggi unico) scenario reale, Oversharing (Fase 6),
 * incluso il Media Viewer collegato in Fase 7.
 *
 * MODIFICATO (miglioramento incrementale "eliminazione toggle lucchetto"):
 * il precedente blocco dedicato "Toggle pubblico/privato" (icona
 * lucchetto interattiva accanto alle statistiche) è stato RIMOSSO — quel
 * controllo non esiste più nel codice sorgente. La sua copertura è stata
 * fusa nel blocco "Bottone Segui", che oggi è l'UNICO comando responsabile
 * sia dello stato "sto seguendo" sia della visibilità pubblico/privato:
 *   - stato iniziale: "Segui già" (pressed=true), contenuto pubblico
 *     visibile, pannello privato nascosto — esattamente il comportamento
 *     che prima era dato dal "lucchetto aperto";
 *   - click su "Segui già" -> "Segui" (pressed=false), contenuto pubblico
 *     nascosto, pannello privato visibile, statistiche identiche,
 *     annuncio aria-live dedicato — esattamente il comportamento che
 *     prima era dato dal "lucchetto chiuso";
 *   - click di nuovo -> ritorno a "Segui già", nessuna perdita di post,
 *     vista Feed/Archivio preservata.
 * Un test di regressione esplicito verifica che il vecchio selettore
 * ".sl-profile-timeline__privacy-toggle" non esista più nel DOM: non
 * solo "non serve più", ma è stato rimosso come dead code (bottone,
 * listener, classe CSS).
 *
 * L'ultimo test del file chiude l'intervento #9 dell'audit di Fase 9
 * ("percorrere l'intero flusso da tastiera Home→Scenario→MediaViewer").
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

  // --- Flusso completo da tastiera: Home -> Scenario -> MediaViewer ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("flusso da tastiera: Sidebar -> Moduli -> Cybersecurity (Invio) -> selettore", async () => {
      let focused = null;
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
        if (focused === "Apri modulo Cybersecurity") break;
      }
      assert.equal(focused, "Apri modulo Cybersecurity", "il focus non ha raggiunto la card Cybersecurity entro 15 Tab");

      await page.keyboard.press("Enter");
      // Cybersecurity ospita ora 2 scenari (Oversharing, Keylogger): il
      // click/Invio porta al selettore #/modules/cybersecurity, non più
      // direttamente allo scenario.
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
