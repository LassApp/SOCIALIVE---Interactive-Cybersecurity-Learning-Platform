/**
 * scenario.spec.js
 * -----------------------------------------------------------------------
 * Copre il primo (e oggi unico) scenario reale, Oversharing (Fase 6),
 * incluso il Media Viewer collegato in Fase 7.
 *
 * ESTESO (post Fase 10) con i controlli sul toggle pubblico/privato del
 * profilo (icona lucchetto accanto alle statistiche post/follower/
 * seguiti): stato iniziale pubblico, transizione a privato (contenuto
 * pubblico nascosto, pannello "Questo profilo è privato" visibile,
 * statistiche identiche, annuncio aria-live), transizione di ritorno a
 * pubblico (nessuna perdita di post, vista Feed/Archivio preservata),
 * nessuna regressione sul toggle Post/Archivio esistente. Prima di
 * questa estensione, la verifica era stata eseguita solo su un harness
 * Playwright isolato (non persistito) — vedi
 * handover-toggle-privacy-profilo.md per il dettaglio dell'intervento
 * originario. Questo file la rende parte della regressione automatica
 * di "npm test", chiudendo il gap di copertura segnalato in quell'
 * handover (§9).
 *
 * L'ultimo test del file chiude l'intervento #9 dell'audit di Fase 9
 * ("percorrere l'intero flusso da tastiera Home→Scenario→MediaViewer").
 *
 * ESTESO ULTERIORMENTE (post Fase 10, intervento "MediaViewer generico e
 * migliorie realismo profilo") con: apertura di avatar/copertina/storie
 * nel MediaViewer (in precedenza solo i post erano apribili); pan/drag
 * durante lo zoom (in precedenza solo click-to-toggle, nessun modo di
 * spostarsi dentro la foto ingrandita); bottone "Segui" prima del
 * conteggio post, con toggle visivo condiviso fra header pubblico e
 * pannello privato. Prima di questa estensione, ciascuna delle tre
 * funzionalità era stata verificata solo con script Playwright ad-hoc
 * non persistiti — vedi il documento di handover dedicato per il
 * dettaglio completo dell'intervento.
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

  // --- Toggle pubblico/privato (nuovo, post Fase 10) --------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const toggle = () => page.locator(".sl-profile-timeline__privacy-toggle");
    const publicContent = () => page.locator(".sl-profile-timeline__public-content");
    const privateNotice = () => page.locator(".sl-profile-timeline__private-notice");

    await suite.test("privacy: bottone lucchetto presente accanto alle statistiche", async () => {
      assert.equal(await toggle().count(), 1);
    });

    await suite.test("privacy: stato iniziale pubblico (aria-pressed=false, aria-label corretto)", async () => {
      assert.equal(await toggle().getAttribute("aria-pressed"), "false");
      assert.equal(await toggle().getAttribute("aria-label"), "Rendi il profilo privato");
    });

    await suite.test("privacy: contenuto pubblico visibile, pannello privato nascosto all'apertura", async () => {
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    let statsBefore;
    await suite.test("privacy: 3 statistiche leggibili prima del toggle (baseline per il confronto)", async () => {
      statsBefore = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      assert.equal(statsBefore.length, 3);
    });

    await suite.test("privacy: click sul lucchetto -> aria-pressed=true, aria-label invertito", async () => {
      await toggle().click();
      await page.waitForTimeout(30);
      assert.equal(await toggle().getAttribute("aria-pressed"), "true");
      assert.equal(await toggle().getAttribute("aria-label"), "Rendi il profilo pubblico");
    });

    await suite.test("privacy: contenuto pubblico nascosto, pannello privato visibile", async () => {
      assert.equal(await publicContent().isHidden(), true);
      assert.equal(await privateNotice().isVisible(), true);
    });

    await suite.test("privacy: titolo del pannello 'Questo profilo è privato'", async () => {
      const title = await page.locator(".sl-profile-timeline__private-title").textContent();
      assert.equal(title.trim(), "Questo profilo è privato");
    });

    await suite.test("privacy: descrizione contiene il nome utente reale (da profile.json)", async () => {
      const description = await page.locator(".sl-profile-timeline__private-description").textContent();
      assert.ok(description.includes("marti.travel"), "il nome utente non compare nella descrizione");
    });

    await suite.test("privacy: bottone 'Segui' presente", async () => {
      const label = await page.locator(".sl-profile-timeline__private-follow").textContent();
      assert.equal(label.trim(), "Segui");
    });

    await suite.test("privacy: statistiche IDENTICHE in stato privato (stessi valori del pubblico)", async () => {
      const statsAfter = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      assert.deepEqual(statsAfter, statsBefore);
    });

    await suite.test("privacy: annuncio aria-live 'Profilo impostato su privato.'", async () => {
      const status = await page.locator(".sl-profile-timeline__privacy-status").textContent();
      assert.equal(status.trim(), "Profilo impostato su privato.");
    });

    await suite.test("privacy: click su 'Segui' non genera errori (evento fittizio)", async () => {
      let errored = false;
      page.once("pageerror", () => { errored = true; });
      await page.click(".sl-profile-timeline__private-follow");
      await page.waitForTimeout(30);
      assert.equal(errored, false);
    });

    await suite.test("privacy: click di nuovo -> torna pubblico (aria-pressed=false)", async () => {
      await toggle().click();
      await page.waitForTimeout(30);
      assert.equal(await toggle().getAttribute("aria-pressed"), "false");
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    await suite.test("privacy: dopo il ritorno a pubblico, ancora 12 post (nessun duplicato/perdita)", async () => {
      assert.equal(await page.locator(".sl-feed .sl-post-card").count(), 12);
    });

    await suite.test("privacy: annuncio aria-live 'Profilo impostato su pubblico.'", async () => {
      const status = await page.locator(".sl-profile-timeline__privacy-status").textContent();
      assert.equal(status.trim(), "Profilo impostato su pubblico.");
    });

    await suite.test("privacy: la vista Archivio selezionata prima del privato viene preservata", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Archivio");
      await page.waitForSelector(".sl-timeline:not([hidden])");
      await toggle().click(); // -> privato
      await page.waitForTimeout(30);
      await toggle().click(); // -> pubblico
      await page.waitForTimeout(30);
      assert.equal(await page.locator(".sl-timeline").isHidden(), false, "l'Archivio non è più visibile dopo il round-trip privato/pubblico");
      assert.equal(await page.locator(".sl-feed").isHidden(), true, "il Feed è tornato visibile invece dell'Archivio (reset non richiesto)");
      // Ripristina la vista Post per non alterare lo stato dei blocchi successivi.
      await page.click(".sl-profile-timeline__tabs >> text=Post");
    });

    await context.close();
  }

  // --- Bottone "Segui" (nuovo, post Fase 10) ----------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const headerFollow = () => page.locator(".sl-profile-timeline__follow-button");
    const privateFollow = () => page.locator(".sl-profile-timeline__private-follow");

    await suite.test("Segui: presente PRIMA del conteggio post nella riga statistiche", async () => {
      const order = await page
        .locator(".sl-profile-timeline__stats-row")
        .evaluate((row) => Array.from(row.children).map((c) => c.className));
      assert.ok(order[0].includes("follow-button"), `il bottone Segui non è il primo figlio: ${order.join(" | ")}`);
    });

    await suite.test("Segui: stato iniziale 'Segui', aria-pressed=false", async () => {
      assert.equal((await headerFollow().textContent()).trim(), "Segui");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "false");
    });

    await suite.test("Segui: click -> 'Segui già', aria-pressed=true, evento sl:profile-follow-toggle", async () => {
      const detail = await page.evaluate(
        () =>
          new Promise((resolve) => {
            document
              .querySelector(".sl-profile-timeline")
              .addEventListener("sl:profile-follow-toggle", (e) => resolve(e.detail), { once: true });
            document.querySelector(".sl-profile-timeline__follow-button").click();
          })
      );
      assert.deepEqual(detail, { following: true });
      assert.equal((await headerFollow().textContent()).trim(), "Segui già");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "true");
    });

    await suite.test("Segui: passando a profilo privato, il bottone del pannello riflette lo stesso stato", async () => {
      await page.click(".sl-profile-timeline__privacy-toggle");
      await page.waitForSelector(".sl-profile-timeline__private-notice:not([hidden])");
      assert.equal((await privateFollow().textContent()).trim(), "Segui già");
    });

    await suite.test("Segui: click nel pannello privato -> torna 'Segui', si riflette anche sull'header", async () => {
      await privateFollow().click();
      await page.click(".sl-profile-timeline__privacy-toggle"); // torna pubblico
      await page.waitForSelector(".sl-profile-timeline__public-content:not([hidden])");
      assert.equal((await headerFollow().textContent()).trim(), "Segui");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "false");
    });

    await context.close();
  }

  // --- MediaViewer: avatar, copertina, storie (nuovo, post Fase 10) -----
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
      await page.click(".sl-stories-bar__item >> nth=2"); // "Food", terza storia
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

    await suite.test("pan/drag: cursore 'grab' da zoomato", async () => {
      const cursor = await page
        .locator(".sl-media-viewer__zoom-trigger")
        .evaluate((el) => getComputedStyle(el).cursor);
      assert.equal(cursor, "grab");
    });

    await suite.test("pan/drag: trascinare da zoomato sposta l'immagine (transform aggiornato)", async () => {
      const box = await page.locator(".sl-media-viewer__zoom-trigger").boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 60, cy - 40, { steps: 10 });
      const transform = await page.locator(".sl-media-viewer__image").evaluate((el) => el.style.transform);
      assert.ok(
        transform.includes("scale(1.8)") && !transform.includes("translate(0px, 0px)"),
        `il pan non risulta applicato al transform: "${transform}"`
      );
      await page.mouse.up();
    });

    await suite.test("pan/drag: dopo il rilascio lo zoom resta attivo (click sintetico post-drag ignorato)", async () => {
      const zoomed = await page.locator(".sl-media-viewer__stage").evaluate((el) =>
        el.classList.contains("sl-media-viewer__stage--zoomed")
      );
      assert.ok(zoomed, "lo zoom si è chiuso per errore dopo un trascinamento reale");
    });

    await suite.test("pan/drag: un click (senza drag) da zoomato esce dallo zoom e azzera il pan", async () => {
      const box = await page.locator(".sl-media-viewer__zoom-trigger").boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(250);
      const transform = await page.locator(".sl-media-viewer__image").evaluate((el) => el.style.transform);
      assert.equal(transform, "", "l'immagine dovrebbe tornare senza transform inline dopo l'uscita dallo zoom");
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

    // Screenshot dedicato al pannello privato a 375px (Fase toggle privacy):
    // colmava una lacuna già segnalata nell'handover originario dell'
    // intervento ("Screenshot a viewport mobile del pannello privato — non
    // eseguito in questo giro").
    await suite.test("screenshot scenario — mobile 375px, pannello privato", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Post");
      await page.click(".sl-profile-timeline__privacy-toggle");
      await page.waitForSelector(".sl-profile-timeline__private-notice:not([hidden])");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-private-mobile-375.png"), fullPage: true });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false, "overflow orizzontale rilevato nel pannello privato a 375px");
    });

    await context.close();
  }

  // --- Flusso completo da tastiera: Home -> Scenario -> MediaViewer ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("flusso da tastiera: Sidebar -> Moduli -> Cybersecurity (Invio)", async () => {
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
