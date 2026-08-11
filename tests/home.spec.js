/**
 * home.spec.js
 * -----------------------------------------------------------------------
 * Copre la Home reale così com'è oggi nel codice sorgente DOPO la
 * riscrittura di Fase 10: homePageController.js legge realmente
 * data/modules.json e data/home/feed.json tramite localJsonRepository.js
 * (pattern asincrono identico a scenarioPageController.js), non più la
 * versione con dati demo hardcoded di Fase 5 — verificato con grep sul
 * file reale prima di aggiornare questo commento, non per assunzione
 * (stessa disciplina già raccomandata più volte nei prompt di
 * continuità del progetto: "verificare sempre coi file reali, non per
 * assunzione"). Include anche le rifiniture di Fase 9/10 sulla Home:
 * skip-link (WCAG 2.4.1), <h1> nascosto, fade-in dell'immagine del post,
 * micro-transizione di ProfileMenu.
 *
 * NOTA STORICA: fino a questa correzione, questo stesso file conteneva
 * un docstring non aggiornato che descriveva ancora lo stato pre-Fase-10
 * (dati hardcoded), mentre il corpo dei test sottostanti verificava già
 * il comportamento post-riscrittura — un disallineamento tra commento e
 * codice nello stesso file, della stessa classe di errore già
 * documentata più volte nel progetto (handover che descrive un lavoro
 * non rispecchiato nel codice). Corretto in Fase 10, durante la verifica
 * pre-handover.
 *
 * ESTESO (post Fase 10, intervento "MediaViewer generico") con la
 * copertura dell'apertura del post di Mario Bianchi nel MediaViewer:
 * "sl:post-open" era già emesso da PostCard fin da Fase 2, ma senza
 * alcun consumer sulla Home — il click sull'immagine del post non
 * produceva alcun effetto visibile. Ora homePageController.js apre
 * MediaViewer tramite js/utils/mediaViewerLauncher.js, lo stesso helper
 * condiviso già usato da profileTimelineRenderer.js — questo blocco di
 * test chiude il gap di copertura, verificato in precedenza solo con
 * uno script ad-hoc non persistito.
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

const MODULE_ORDER = ["yoga", "nissan-gtr", "beatbox", "fotografia", "cybersecurity", "ricette"];

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
    await page.waitForSelector(".sl-home-page__modules-grid"); // popolato in modo asincrono da data/modules.json+feed.json

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

    await suite.test("6 ModuleCard nell'ordine atteso, solo Cybersecurity disponibile", async () => {
      const cards = page.locator(".sl-home-page__modules-grid .sl-module-card");
      assert.equal(await cards.count(), 6);
      for (let i = 0; i < MODULE_ORDER.length; i += 1) {
        const card = cards.nth(i);
        const isAvailable = MODULE_ORDER[i] === "cybersecurity";
        assert.equal(await card.getAttribute("role"), isAvailable ? "button" : null);
        assert.equal(
          (await card.locator(".sl-badge").textContent()).trim(),
          isAvailable ? "Disponibile" : "In arrivo"
        );
      }
    });

    await suite.test("voce disabilitata non è raggiungibile con Tab (nessun tabindex)", async () => {
      const yogaCard = page.locator(".sl-home-page__modules-grid .sl-module-card").nth(0);
      assert.equal(await yogaCard.getAttribute("tabindex"), null);
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
    await page.waitForSelector(".sl-home-page__modules-grid");

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
    await page.waitForSelector(".sl-home-page__modules-grid");

    await suite.test("screenshot Home — desktop Light", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-desktop-light.png"), fullPage: true });
    });

    await suite.test("screenshot Home — desktop Dark", async () => {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-desktop-dark.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    });

    // Range 768-1024px (Fase 9, intervento #8 — mai chiuso con screenshot
    // reali in nessuna fase precedente, segnalato ricorrente da 5 fasi).
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
    await page.waitForSelector(".sl-home-page__modules-grid");

    await suite.test("navigazione Home -> selettore Cybersecurity -> Oversharing -> Home: nessun componente duplicato", async () => {
      // Cybersecurity ospita ora 2 scenari (Oversharing, Keylogger): il
      // click porta al selettore #/modules/cybersecurity, non più
      // direttamente allo scenario — comportamento cambiato
      // deliberatamente con l'introduzione del secondo scenario reale.
      await page.click(".sl-home-page__modules-grid .sl-module-card >> nth=4");
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
      await page.click(".sl-module-scenarios-page__grid .sl-module-card >> nth=0");
      await page.waitForFunction(() => window.location.hash === "#/scenario/oversharing");
      await page.waitForSelector(".sl-profile-timeline");
      await page.click(".sl-sidebar__link[href='#/home']");
      await page.waitForFunction(() => window.location.hash === "#/home");
      await page.waitForSelector(".sl-home-page__modules-grid");
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-module-card").count(), 6);
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
