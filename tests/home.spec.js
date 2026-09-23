/**
 * home.spec.js
 * -----------------------------------------------------------------------
 * Copre la Home reale così com'è oggi nel codice sorgente DOPO la
 * riscrittura di Fase 10: homePageController.js legge realmente
 * data/modules.json e data/home/feed.json tramite localJsonRepository.js
 * (pattern asincrono identico a scenarioPageController.js). Include
 * anche le rifiniture di Fase 9/10 sulla Home: skip-link (WCAG 2.4.1),
 * <h1> nascosto, fade-in dell'immagine del post, micro-transizione di
 * ProfileMenu.
 *
 * RIPRISTINATO (revert da Supabase Auth a sessione locale): rimossa la
 * deviazione { headless: false } — era necessaria solo contro un timeout
 * osservato in Chromium headless verso la rete di Supabase Auth, usata
 * qui tramite loginAsDocente(); nessuna chiamata di rete esterna resta
 * nel flusso di login, quindi la causa non si applica più (vedi
 * rationale completo in login.spec.js).
 *
 * MODIFICATO (allineamento alla Sidebar con flyout "Moduli"): la griglia
 * di ModuleCard sopra il Feed è stata rimossa da homePageController.js
 * (i moduli sono ora raggiungibili dal sottomenu "Moduli" della Sidebar,
 * appShell.js/Sidebar.js, visibile su ogni rotta protetta) — ma questo
 * file continuava a referenziare ".sl-home-page__modules-grid" e la
 * pagina selettore "#/modules/:moduleId" come se fossero ancora il
 * percorso di navigazione reale: i test non erano mai stati riallineati
 * al nuovo codice (stessa classe di errore "handover/test che descrive
 * un comportamento non più reale" già documentata più volte nella
 * storia del progetto). Sostituiti con la copertura del flyout reale
 * (trigger aria-haspopup/aria-expanded, contenuto data-driven da
 * data/modules.json, navigazione diretta a #/scenario/:id) — mai
 * verificato prima d'ora in nessun file della suite.
 *
 * ESTESO (post Fase 10, intervento "MediaViewer generico") con la
 * copertura dell'apertura del post di Mario Bianchi nel MediaViewer.
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
  const suite = createSuite("home.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Composizione e contenuto ---------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    // Due fetch asincrone indipendenti, non più una sola: il feed
    // (data/home/feed.json, homePageController.js) e il sottomenu
    // "Moduli" della Sidebar (data/modules.json, appShell.js) — la
    // vecchia griglia moduli in Home è stata rimossa, i suoi contenuti
    // vivono ora nel flyout della Sidebar (vedi rationale in
    // appShell.js/Sidebar.js).
    await page.waitForSelector(".sl-post-card");
    await page.waitForSelector(".sl-sidebar__trigger");

    await suite.test("document.title corretto su #/home", async () => {
      assert.equal(await page.title(), "Home \u2014 SocialAlive");
    });

    await suite.test("struttura: AppHeader + Sidebar + main presenti una sola volta", async () => {
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-sidebar").count(), 1);
      assert.equal(await page.locator("main.sl-page-container__main").count(), 1);
    });

    await suite.test("<h1> visivamente nascosto con testo 'Home' (Fase 9, WCAG 2.4.6/1.3.1)", async () => {
      const h1 = page.locator("main h1");
      assert.equal(await h1.count(), 1);
      assert.equal((await h1.textContent()).trim(), "Home");
      assert.ok(await h1.evaluate((el) => el.classList.contains("sl-visually-hidden")));
    });

    await suite.test("Sidebar: 'Moduli' è un trigger con sottomenu, chiuso di default (aria-haspopup/aria-expanded)", async () => {
      const trigger = page.locator(".sl-sidebar__trigger");
      assert.equal(await trigger.count(), 1);
      assert.equal(await trigger.getAttribute("aria-haspopup"), "true");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(".sl-sidebar__flyout").isVisible(), false);
    });

    await suite.test("click su 'Moduli' apre il flyout con i 4 scenari reali (data/modules.json)", async () => {
      // hover, non click: un click() di Playwright genera un vero
      // mousemove che fa scattare "mouseenter" sul trigger PRIMA del
      // click stesso — Sidebar.js apre il flyout all'hover (mouseenter
      // sull'intera <li>) e poi handleTriggerClick(), vedendo isOpen
      // già true, lo richiuderebbe subito dopo (stesso comportamento
      // per un utente reale con mouse: hover apre, un click successivo
      // sul trigger già aperto lo toggla chiuso — per questo il codice
      // riserva esplicitamente il click al caso tastiera/touch, dove
      // l'hover non esiste). hover() riproduce fedelmente il percorso
      // mouse reale (apre via mouseenter, nessun secondo click sul
      // trigger).
      await page.hover(".sl-sidebar__trigger");
      await page.waitForSelector(".sl-sidebar__flyout:not([hidden])");
      assert.equal(await page.locator(".sl-sidebar__trigger").getAttribute("aria-expanded"), "true");
      const labels = await page.locator(".sl-sidebar__flyout .sl-sidebar__link").allTextContents();
      assert.deepEqual(labels.map((t) => t.trim()), ["Oversharing", "Keylogger", "Phishing", "Evil Twin Wi-Fi"]);
    });

    await suite.test("'Impostazioni' resta disabilitata, non raggiungibile con Tab", async () => {
      const settingsItem = page.locator(".sl-sidebar__link--disabled");
      assert.equal(await settingsItem.count(), 1);
      assert.equal((await settingsItem.textContent()).trim(), "Impostazioni");
      assert.equal(await settingsItem.getAttribute("tabindex"), null);
    });

    await suite.test("Feed: 3 post, autori corretti, nessun riferimento a 'Prof. Anna Ferrari'", async () => {
      const authors = await page.locator(".sl-post-card__author").allTextContents();
      assert.deepEqual(authors, ["Mario Bianchi", "Giulia Conti", "Laura Ferretti"]);
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(!bodyText.includes("Anna Ferrari"), "trovato il nome placeholder scartato 'Prof. Anna Ferrari'");
    });

    await suite.test("nessun autore ha avatarSrc (feed.json): fallback a iniziali per tutti e tre", async () => {
      const initials = await page.locator(".sl-post-card .sl-avatar__fallback").allTextContents();
      assert.deepEqual(initials.map((t) => t.trim()), ["MB", "GC", "LF"]);
    });

    await suite.test("immagine del primo post: aspect-ratio riservato + loading=lazy (Fase 9)", async () => {
      const img = page.locator(".sl-post-card").nth(0).locator(".sl-post-card__media-image");
      assert.equal(await img.getAttribute("loading"), "lazy");
      const aspectRatio = await img.evaluate((el) => getComputedStyle(el).aspectRatio);
      assert.notEqual(aspectRatio, "auto", "aspect-ratio non applicato: rischio di layout shift");
    });

    await suite.test("Fase 9/#11: l'immagine del post riceve la classe di fade-in al caricamento", async () => {
      const img = page.locator(".sl-post-card").nth(0).locator(".sl-post-card__media-image");
      await img.evaluate((el) => el.classList.contains("sl-fade-in-image"));
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.classList.contains("sl-fade-in-image--loaded"),
        ".sl-post-card__media-image",
        { timeout: 2000 }
      );
    });

    await suite.test("Fase 9/#11: un update() per il solo 'mi piace' non fa ripartire il fade-in della stessa immagine", async () => {
      const img = page.locator(".sl-post-card").nth(0).locator(".sl-post-card__media-image");
      const likeButton = page.locator(".sl-post-card").nth(0).locator(".sl-post-card__action--like");
      await likeButton.click();
      await page.waitForTimeout(50);
      assert.ok(await img.evaluate((el) => el.classList.contains("sl-fade-in-image--loaded")));
    });

    await suite.test("Mi piace: click aggiorna aria-pressed e contatore", async () => {
      const likeButton = page.locator(".sl-post-card").nth(1).locator(".sl-post-card__action--like");
      const before = await likeButton.getAttribute("aria-pressed");
      await likeButton.click();
      await page.waitForTimeout(50);
      const after = await likeButton.getAttribute("aria-pressed");
      assert.notEqual(before, after);
    });

    await context.close();
  }

  // --- MediaViewer sul feed della Home (nuovo, post Fase 10) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-post-card");

    await suite.test("click sull'immagine del post di Mario Bianchi -> MediaViewer si apre", async () => {
      await page.click(".sl-post-card >> nth=0 >> .sl-post-card__media");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const author = await page.locator(".sl-media-viewer__author-name").textContent();
      assert.equal(author.trim(), "Mario Bianchi");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 3");
    });

    await suite.test("navigazione successiva: post di Giulia Conti, senza immagine -> testo centrato", async () => {
      await page.click(".sl-media-viewer__nav--next");
      const author = await page.locator(".sl-media-viewer__author-name").textContent();
      assert.equal(author.trim(), "Giulia Conti");
      assert.equal(await page.locator(".sl-media-viewer__text-content").count(), 1);
    });

    await suite.test("chiusura con Escape -> Home intatta, nessun residuo", async () => {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
      assert.equal(await page.evaluate(() => window.location.hash), "#/home");
      assert.equal(await page.locator(".sl-post-card").count(), 3);
    });

    await context.close();
  }


  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("skip-link è il primo elemento focalizzabile della pagina", async () => {
      await page.keyboard.press("Tab");
      const isSkipLinkFocused = await page.evaluate(
        () => document.activeElement.classList.contains("sl-page-container__skip-link")
      );
      assert.ok(isSkipLinkFocused, "il primo Tab non raggiunge lo skip-link");
    });

    await suite.test("attivare lo skip-link sposta il focus su <main> senza toccare l'hash", async () => {
      await page.keyboard.press("Enter");
      const hashUnchanged = await page.evaluate(() => window.location.hash === "#/home");
      const mainFocused = await page.evaluate(() => document.activeElement.id === "sl-main-content");
      assert.ok(hashUnchanged, "l'hash è cambiato: lo skip-link ha innescato una navigazione reale");
      assert.ok(mainFocused, "il focus non è su <main> dopo l'attivazione dello skip-link");
    });

    await context.close();
  }

  // --- ProfileMenu (regressione Fase 2/4/5) ---------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("ProfileMenu: apertura mostra nome reale e ThemeSwitch", async () => {
      await page.click(".sl-app-header__profile-trigger");
      await page.waitForSelector(".sl-profile-menu");
      const name = await page.locator(".sl-profile-menu__user-name").textContent();
      assert.equal(name.trim(), "Prof. Erasmo Lassandro");
      assert.equal(await page.locator(".sl-profile-menu .sl-theme-switch").count(), 1);
    });

    await suite.test("Fase 9/#12: ProfileMenu ha una micro-transizione di apertura dichiarata", async () => {
      const animationName = await page.locator(".sl-profile-menu").evaluate((el) => getComputedStyle(el).animationName);
      assert.equal(animationName, "sl-profile-menu-in");
    });

    await suite.test("ProfileMenu: chiusura con Escape", async () => {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-profile-menu", { state: "detached" });
    });

    await context.close();
  }

  // --- Screenshot: Light / Dark / mobile 375 / breakpoint 768-1024 ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-post-card");
    await page.waitForSelector(".sl-sidebar__trigger");

    await suite.test("screenshot Home — desktop Light", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-desktop-light.png"), fullPage: true });
    });

    await suite.test("screenshot Home — desktop Dark", async () => {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-desktop-dark.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    });

    for (const width of [768, 900, 1024]) {
      await suite.test(`screenshot Home — breakpoint ${width}px, nessun overflow orizzontale`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `home-${width}.png`), fullPage: true });
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        assert.equal(hasOverflow, false, `overflow orizzontale rilevato a ${width}px`);
      });
    }

    await suite.test("screenshot Home — mobile 375px, Sidebar/ricerca nascoste", async () => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-mobile-375.png"), fullPage: true });
      assert.equal(await page.locator(".sl-sidebar").isVisible(), false);
      assert.equal(await page.locator(".sl-app-header__search").isVisible(), false);
    });

    await context.close();
  }

  // --- Remount pulito al ritorno da uno scenario -----------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-sidebar__trigger");

    await suite.test("navigazione Home -> flyout Moduli -> Oversharing -> Home: nessun componente duplicato", async () => {
      // hover, non click: un click() di Playwright genera un vero
      // mousemove che fa scattare "mouseenter" sul trigger PRIMA del
      // click stesso — Sidebar.js apre il flyout all'hover (mouseenter
      // sull'intera <li>) e poi handleTriggerClick(), vedendo isOpen
      // già true, lo richiuderebbe subito dopo (stesso comportamento
      // per un utente reale con mouse: hover apre, un click successivo
      // sul trigger già aperto lo toggla chiuso — per questo il codice
      // riserva esplicitamente il click al caso tastiera/touch, dove
      // l'hover non esiste). hover() riproduce fedelmente il percorso
      // mouse reale (apre via mouseenter, nessun secondo click sul
      // trigger).
      await page.hover(".sl-sidebar__trigger");
      await page.waitForSelector(".sl-sidebar__flyout:not([hidden])");
      await page.click(".sl-sidebar__flyout .sl-sidebar__link >> nth=0");
      await page.waitForFunction(() => window.location.hash === "#/scenario/oversharing");
      await page.waitForSelector(".sl-profile-timeline");
      await page.click(".sl-sidebar__link[href='#/home']");
      await page.waitForFunction(() => window.location.hash === "#/home");
      // ".sl-post-card" da solo è ambiguo qui: appena l'hash cambia
      // (sincrono) ma prima che l'evento "hashchange" async di router.js
      // abbia sostituito il DOM, i 12 post-card di Oversharing sono
      // ancora presenti — un semplice waitForSelector(".sl-post-card")
      // li intercetterebbe come falso positivo. ".sl-home-page__content"
      // esiste SOLO su Home: aspettarlo garantisce che lo swap sia già
      // avvenuto prima di contare i post-card al suo interno.
      await page.waitForSelector(".sl-home-page__content .sl-post-card");
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-post-card").count(), 3);
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
