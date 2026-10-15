/**
 * home.spec.js
 * -----------------------------------------------------------------------
 * Copre la Home come PIATTAFORMA DIDATTICA (redesign): intestazione di
 * benvenuto + una card per ogni area di data/modules.json (icona,
 * descrizione, badge, scenari come link) e la ricerca che filtra aree e
 * scenari. Include le regressioni sulle funzioni della shell che la Home
 * monta: Sidebar a fisarmonica "Scenari", tasto Home nella barra, skip-link (WCAG 2.4.1),
 * ProfileMenu.
 *
 * RISCRITTO per il redesign: la Home non è più un finto feed social (il
 * finto social vive solo nello scenario Oversharing). I controlli su
 * post, "mi piace", fade-in dell'immagine e MediaViewer del feed della
 * Home sono stati RIMOSSI perché quel comportamento non esiste più —
 * cambio deliberato, non regressione. I quattro controlli che
 * esercitavano codice ancora vivo (aspect-ratio/lazy, fade-in e sua
 * idempotenza, "mi piace" di PostCard) sono stati MIGRATI in
 * scenario.spec.js sul feed di Oversharing; l'apertura di MediaViewer è
 * già coperta lì (post, avatar, copertina, storie).
 *
 * DATA-DRIVEN: le aree/scenari attesi si leggono da data/modules.json
 * (stesso file della Home) — i test non ripetono i nomi, così
 * aggiungere uno scenario al JSON non rompe la suite; i pochi test che
 * usano query concrete ("phish", "tokeniz", ...) sono legati ai titoli
 * attuali e lo dichiarano.
 *
 * "Raggiungibilità": ogni scenario disponibile viene aperto davvero
 * cliccando il suo link in Home, e si verifica che il wrapper
 * dell'engine non mostri stati di errore ("Impossibile caricare",
 * "in preparazione") — criterio di accettazione "nessuno scenario
 * escluso".
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente } = require("./helpers/auth");
const { openScenariosMenu, expandSidebarGroup } = require("./helpers/sidebar");

const APP_ROOT = path.join(__dirname, "..");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

// Fonte dei dati attesi: lo stesso data/modules.json letto dalla Home.
const MODULES = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "modules.json"), "utf8")).modules;
const isArea = (moduleRecord) => moduleRecord.available && Array.isArray(moduleRecord.scenarios);
const AREAS = MODULES.filter(isArea);

const SEARCH_INPUT = ".sl-app-header__search input";
const VISIBLE_ITEM = ".sl-home-page__area-item:not([hidden])";

async function visibleAreaTitles(page) {
  return (await page.locator(`${VISIBLE_ITEM} .sl-area-card__title`).allTextContents()).map((t) => t.trim());
}

async function visibleScenarioTitles(page) {
  return (await page.locator(`${VISIBLE_ITEM} .sl-area-card__scenario`).allTextContents()).map((t) => t.trim());
}

async function visibleBadges(page) {
  return (await page.locator(`${VISIBLE_ITEM} .sl-badge`).allTextContents()).map((t) => t.trim());
}

async function goHome(page) {
  await page.evaluate(() => {
    window.location.hash = "#/home";
  });
  await page.waitForSelector(".sl-home-page__content .sl-area-card");
}

async function run() {
  const suite = createSuite("home.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Composizione e contenuto ---------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const externalRequests = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
    page.on("request", (request) => {
      if (!request.url().startsWith(server.url) && !request.url().startsWith("data:")) {
        externalRequests.push(request.url());
      }
    });
    await loginAsDocente(page, server.url);
    // Due fetch indipendenti sullo stesso file (cache condivisa): le card
    // della Home e il sottomenu "Scenari" della Sidebar (appShell.js).
    await page.waitForSelector(".sl-area-card");
    await page.waitForSelector(".sl-sidebar__trigger");

    await suite.test("document.title corretto su #/home", async () => {
      assert.equal(await page.title(), "Home \u2014 SocialAlive");
    });

    await suite.test("struttura: AppHeader + Sidebar + main presenti una sola volta", async () => {
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-sidebar").count(), 1);
      assert.equal(await page.locator("main.sl-page-container__main").count(), 1);
    });

    await suite.test("<h1> unico e VISIBILE: saluto con il nome dalla sessione (WCAG 2.4.6/1.3.1)", async () => {
      const h1 = page.locator("main h1");
      assert.equal(await h1.count(), 1);
      assert.equal(await h1.isVisible(), true);
      assert.equal((await h1.textContent()).trim(), "Benvenuto, Prof. Erasmo Lassandro");
      assert.equal(await h1.evaluate((el) => el.classList.contains("sl-visually-hidden")), false);
    });

    await suite.test("gerarchia delle intestazioni: h1 → h2 'Aree di formazione' → un h3 per area", async () => {
      const levels = await page.locator("main h1, main h2, main h3").evaluateAll((els) => els.map((el) => el.tagName));
      assert.deepEqual(levels, ["H1", "H2", ...AREAS.map(() => "H3")]);
      assert.equal((await page.locator("main h2").textContent()).trim(), "Aree di formazione");
    });

    await suite.test("Sidebar: 'Scenari' è un bottone a fisarmonica, chiuso di default (aria-expanded=false + aria-controls, nessun aria-haspopup)", async () => {
      const trigger = page.locator(".sl-sidebar__trigger");
      assert.equal(await trigger.count(), 1);
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await trigger.getAttribute("aria-haspopup"), null, "non è più un flyout");
      assert.equal(await page.locator(`#${await trigger.getAttribute("aria-controls")}`).isVisible(), false);
    });

    await suite.test("click su 'Scenari' apre in linea le aree reali (Cybersecurity, AI) di data/modules.json, chiuse di default", async () => {
      await openScenariosMenu(page);
      assert.equal(await page.locator(".sl-sidebar__trigger").getAttribute("aria-expanded"), "true");
      const groups = await page.locator(".sl-sidebar__group-trigger").allTextContents();
      assert.deepEqual(groups.map((t) => t.trim()), AREAS.map((area) => area.title));
      const states = await page
        .locator(".sl-sidebar__group-trigger")
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-expanded")));
      assert.deepEqual(states, AREAS.map(() => "false"));
    });

    await suite.test("'Impostazioni' resta disabilitata, non raggiungibile con Tab", async () => {
      const settingsItem = page.locator(".sl-sidebar__link--disabled");
      assert.equal(await settingsItem.count(), 1);
      assert.equal((await settingsItem.textContent()).trim(), "Impostazioni");
      assert.equal(await settingsItem.getAttribute("tabindex"), null);
    });


    await suite.test("nessun contenuto da social network in Home: né feed, né post, né storie, né profilo", async () => {
      for (const selector of [".sl-feed", ".sl-post-card", ".sl-stories-bar", ".sl-profile-timeline", ".sl-timeline", ".sl-media-viewer-overlay"]) {
        assert.equal(await page.locator(selector).count(), 0, `trovato "${selector}" nella Home`);
      }
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(!bodyText.includes("Anna Ferrari"), "trovato il nome placeholder scartato 'Prof. Anna Ferrari'");
    });

    await suite.test("una card per ogni area di modules.json, nell'ordine del file", async () => {
      assert.deepEqual(
        (await page.locator(".sl-area-card__title").allTextContents()).map((t) => t.trim()),
        AREAS.map((area) => area.title)
      );
    });

    await suite.test("ogni card: descrizione e badge con il numero di scenari letti dal JSON", async () => {
      for (const area of AREAS) {
        const item = page.locator(`.sl-home-page__area-item[data-area-id="${area.id}"]`);
        const description = item.locator(".sl-area-card__description");
        if (area.description) {
          assert.equal((await description.textContent()).trim(), area.description);
        } else {
          assert.equal(await description.isHidden(), true);
        }
        const noun = area.scenarios.length === 1 ? "scenario" : "scenari";
        assert.equal((await item.locator(".sl-badge").textContent()).trim(), `${area.scenarios.length} ${noun}`);
      }
    });

    await suite.test("ogni scenario è un vero link <a href='#/scenario/:id'> con il titolo come nome accessibile, nell'ordine del JSON", async () => {
      for (const area of AREAS) {
        const links = page.locator(`.sl-home-page__area-item[data-area-id="${area.id}"] a.sl-area-card__scenario`);
        const expected = area.scenarios.filter((scenario) => scenario.available);
        assert.equal(await links.count(), expected.length);
        for (let i = 0; i < expected.length; i += 1) {
          assert.equal(await links.nth(i).getAttribute("href"), `#/scenario/${expected[i].id}`);
          assert.equal((await links.nth(i).textContent()).trim(), expected[i].title);
        }
        const list = page.locator(`.sl-home-page__area-item[data-area-id="${area.id}"] .sl-area-card__scenarios`);
        assert.equal(await list.getAttribute("aria-label"), `Scenari di ${area.title}`);
      }
    });

    await suite.test("icone: ogni area con 'icon' mostra il glifo come maschera (file SVG realmente servito, 32x32)", async () => {
      for (const area of AREAS.filter((a) => a.icon)) {
        const glyph = page.locator(`.sl-home-page__area-item[data-area-id="${area.id}"] .sl-area-card__glyph`);
        assert.equal(await glyph.count(), 1, `nessun glifo per "${area.title}"`);
        const mask = await glyph.evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
        assert.ok(mask.includes(area.icon), `mask-image non punta a ${area.icon}: ${mask}`);
        const response = await page.request.get(`${server.url}/${area.icon}`);
        assert.equal(response.status(), 200, `${area.icon} non raggiungibile`);
        const box = await glyph.boundingBox();
        assert.equal(Math.round(box.width), 32);
        assert.equal(Math.round(box.height), 32);
      }
    });

    await suite.test("l'icona è decorativa (aria-hidden) e ha colore diverso dallo sfondo del cerchio", async () => {
      const icon = page.locator(".sl-area-card__icon").first();
      assert.equal(await icon.getAttribute("aria-hidden"), "true");
      const colors = await icon.evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        glyph: getComputedStyle(el.querySelector(".sl-area-card__glyph")).backgroundColor,
      }));
      assert.notEqual(colors.background, colors.glyph);
    });

    await suite.test("nessun overflow orizzontale a 1280px", async () => {
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
        false
      );
    });

    await suite.test("etica: nessuna richiesta di rete verso host esterni durante il caricamento della Home", async () => {
      assert.deepEqual(externalRequests, []);
    });

    await suite.test("console priva di errori durante il caricamento della Home", async () => {
      assert.deepEqual(consoleErrors, []);
    });

    await context.close();
  }

  // --- Raggiungibilità: ogni scenario di ogni area si apre dalla Home ------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");

    for (const area of AREAS) {
      for (const scenario of area.scenarios.filter((s) => s.available)) {
        await suite.test(`scenario "${scenario.title}" (${area.title}): raggiungibile dalla Home e si apre senza stati di errore`, async () => {
          await goHome(page);
          await page.click(`.sl-area-card__scenario[href="#/scenario/${scenario.id}"]`);
          await page.waitForFunction((id) => window.location.hash === `#/scenario/${id}`, scenario.id);
          const wrapper = `.sl-scenario-viewport[data-scenario-id="${scenario.id}"]:not([aria-busy])`;
          // "attached", non "visible": gli scenari immersivi (es. Phishing)
          // posizionano il proprio contenuto fuori dal flusso, quindi il
          // wrapper dell'engine ha dimensioni nulle pur essendo montato.
          await page.waitForSelector(wrapper, { state: "attached" });
          const state = await page.locator(wrapper).evaluate((el) => ({ children: el.childElementCount, text: el.innerText }));
          assert.ok(state.children > 0, "il wrapper dello scenario è vuoto");
          assert.ok(
            !/Impossibile caricare|in preparazione|non è disponibile/i.test(state.text),
            `lo scenario mostra uno stato di errore: ${state.text.slice(0, 80)}`
          );
        });
      }
    }

    await context.close();
  }

  // --- Ricerca: filtro per nome di area o di scenario -----------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");
    const status = page.locator(".sl-home-page__areas-section p[role='status']");
    const emptyMessage = page.locator(".sl-home-page__dynamic > p");

    // Le query concrete di questo blocco sono legate ai titoli attuali di
    // data/modules.json (Cybersecurity/AI e i loro scenari).
    await suite.test("stato iniziale: tutte le aree e tutti gli scenari visibili, nessun messaggio", async () => {
      assert.deepEqual(await visibleAreaTitles(page), AREAS.map((a) => a.title));
      assert.equal(await page.locator(`${VISIBLE_ITEM} .sl-area-card__scenario`).count(), AREAS.reduce((n, a) => n + a.scenarios.length, 0));
      assert.equal(await emptyMessage.isHidden(), true);
      assert.equal(((await status.textContent()) || "").trim(), "", "l'annuncio non deve parlare prima di una ricerca");
    });

    await suite.test("nome di scenario: 'phish' mostra solo l'area che lo contiene, con il solo scenario, badge '1 di 4 scenari'", async () => {
      await page.fill(SEARCH_INPUT, "phish");
      assert.deepEqual(await visibleAreaTitles(page), ["Cybersecurity"]);
      assert.deepEqual(await visibleScenarioTitles(page), ["Phishing"]);
      assert.deepEqual(await visibleBadges(page), ["1 di 4 scenari"]);
      assert.equal(await page.locator(".sl-home-page__area-item[data-area-id='ai']").isHidden(), true);
    });

    await suite.test("scenario di un'altra area: 'tokeniz' porta all'area AI, badge '1 di 2 scenari'", async () => {
      await page.fill(SEARCH_INPUT, "tokeniz");
      assert.deepEqual(await visibleAreaTitles(page), ["AI"]);
      assert.deepEqual(await visibleScenarioTitles(page), ["Tokenizzazione"]);
      assert.deepEqual(await visibleBadges(page), ["1 di 2 scenari"]);
    });

    await suite.test("nome di area: 'cyber' mostra Cybersecurity con TUTTI i suoi scenari, badge '4 scenari'", async () => {
      await page.fill(SEARCH_INPUT, "cyber");
      assert.deepEqual(await visibleAreaTitles(page), ["Cybersecurity"]);
      assert.equal((await visibleScenarioTitles(page)).length, 4);
      assert.deepEqual(await visibleBadges(page), ["4 scenari"]);
    });

    await suite.test("nome d'area corto: 'AI' mostra l'area AI con i suoi 2 scenari", async () => {
      await page.fill(SEARCH_INPUT, "AI");
      assert.deepEqual(await visibleAreaTitles(page), ["AI"]);
      assert.deepEqual(await visibleScenarioTitles(page), ["Tokenizzazione", "Allucinazioni"]);
    });

    await suite.test("ignora maiuscole, accenti, spazi e punteggiatura: 'WIFI', 'wi-fi', 'Evil  Twin' → Evil Twin Wi-Fi", async () => {
      for (const query of ["WIFI", "wi-fi", "Evil  Twin"]) {
        await page.fill(SEARCH_INPUT, query);
        const scenarios = await visibleScenarioTitles(page);
        assert.equal(scenarios.length, 1, `la query "${query}" ha prodotto ${scenarios.length} scenari`);
      }
      await page.fill(SEARCH_INPUT, "wi-fi");
      assert.deepEqual(await visibleScenarioTitles(page), ["Evil Twin Wi-Fi"]);
      await page.fill(SEARCH_INPUT, "àllucinazioni");
      assert.deepEqual(await visibleScenarioTitles(page), ["Allucinazioni"], "un accento in più nella query non deve impedire la corrispondenza");
    });

    await suite.test("più scenari della stessa area: 'ing' mostra Oversharing e Phishing sotto Cybersecurity", async () => {
      await page.fill(SEARCH_INPUT, "ing");
      assert.deepEqual(await visibleAreaTitles(page), ["Cybersecurity"]);
      assert.deepEqual(await visibleScenarioTitles(page), ["Oversharing", "Phishing"]);
      assert.deepEqual(await visibleBadges(page), ["2 di 4 scenari"]);
    });

    await suite.test("annuncio aria-live: area/i e scenario/i trovati, con singolari e plurali corretti", async () => {
      await page.fill(SEARCH_INPUT, "phish");
      assert.equal((await status.textContent()).trim(), "1 area e 1 scenario trovati");
      await page.fill(SEARCH_INPUT, "cyber");
      assert.equal((await status.textContent()).trim(), "1 area e 4 scenari trovati");
    });

    await suite.test("nessun risultato: messaggio visibile col testo cercato, griglia nascosta, annuncio coerente", async () => {
      await page.fill(SEARCH_INPUT, "zzzz");
      assert.deepEqual(await visibleAreaTitles(page), []);
      assert.equal(await emptyMessage.isVisible(), true);
      assert.equal((await emptyMessage.textContent()).trim(), "Nessun risultato per \u00abzzzz\u00bb.");
      assert.equal(await page.locator(".sl-home-page__areas-grid").isHidden(), true);
      assert.equal((await status.textContent()).trim(), "Nessun risultato per \u00abzzzz\u00bb.");
    });

    await suite.test("il testo cercato è inserito come testo, mai come HTML (nessuna iniezione dal campo di ricerca)", async () => {
      await page.fill(SEARCH_INPUT, "<img src=x onerror=window.__xss=1>");
      assert.equal(await emptyMessage.locator("img").count(), 0);
      assert.equal(await page.evaluate(() => window.__xss), undefined);
    });

    await suite.test("svuotare la ricerca ripristina aree, scenari e badge; messaggio nascosto; annuncio 'Tutte le aree mostrate'", async () => {
      await page.fill(SEARCH_INPUT, "");
      assert.deepEqual(await visibleAreaTitles(page), AREAS.map((a) => a.title));
      assert.equal(await page.locator(`${VISIBLE_ITEM} .sl-area-card__scenario`).count(), AREAS.reduce((n, a) => n + a.scenarios.length, 0));
      assert.deepEqual(await visibleBadges(page), AREAS.map((a) => (a.scenarios.length === 1 ? "1 scenario" : `${a.scenarios.length} scenari`)));
      assert.equal(await emptyMessage.isHidden(), true);
      assert.equal(await page.locator(".sl-home-page__areas-grid").isVisible(), true);
      assert.equal((await status.textContent()).trim(), "Tutte le aree mostrate");
    });

    await suite.test("digitare non sposta il focus dalla barra di ricerca", async () => {
      await page.fill(SEARCH_INPUT, "phish");
      assert.equal(await page.evaluate(() => document.activeElement.type), "search");
    });

    await suite.test("un risultato filtrato è cliccabile: 'phish' → Phishing → #/scenario/phishing", async () => {
      await page.click(`${VISIBLE_ITEM} a.sl-area-card__scenario`);
      await page.waitForFunction(() => window.location.hash === "#/scenario/phishing");
      await page.waitForSelector(".sl-scenario-viewport[data-scenario-id='phishing']:not([aria-busy])", { state: "attached" });
    });

    await suite.test("tornando alla Home la ricerca riparte da zero (barra vuota, tutte le aree)", async () => {
      await goHome(page);
      assert.equal(await page.inputValue(SEARCH_INPUT), "");
      assert.deepEqual(await visibleAreaTitles(page), AREAS.map((a) => a.title));
    });

    await context.close();
  }

  // --- Ricerca digitata PRIMA che modules.json risolva ----------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/data/modules.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("una ricerca digitata prima del caricamento si applica al primo render delle card", async () => {
      assert.equal(await page.locator(".sl-area-card").count(), 0, "le card non dovrebbero esistere prima della risposta");
      assert.equal(await page.locator(".sl-home-page__dynamic").getAttribute("aria-busy"), "true");
      await page.fill(SEARCH_INPUT, "tokeniz");
      await page.waitForSelector(".sl-home-page__dynamic:not([aria-busy])");
      assert.deepEqual(await visibleAreaTitles(page), ["AI"]);
      assert.equal(await page.locator(".sl-home-page__dynamic").getAttribute("aria-busy"), null);
    });

    await context.close();
  }

  // --- Dati diversi → Home diversa, senza toccare il codice -----------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const requested = [];
    const customModules = {
      modules: [
        ...MODULES,
        {
          id: "cyberbullismo",
          title: "Cyberbullismo",
          available: true,
          scenarios: [
            { id: "chat-demo", title: "Chat di classe", available: true },
            { id: "prossimo", title: "Prossimo scenario", available: false },
          ],
        },
        {
          id: "area-non-pronta",
          title: "Area non pronta",
          available: false,
          scenarios: [{ id: "x-non-pronto", title: "Scenario non pronto", available: true }],
        },
        {
          id: "icona-esterna",
          title: "Esterna",
          available: true,
          description: "Area con icona non valida",
          icon: "https://evil.example/x.svg",
          scenarios: [{ id: "s-esterno", title: "Scenario esterno", available: true }],
        },
      ],
    };
    await context.route("**/data/modules.json", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(customModules) })
    );
    const page = await context.newPage();
    page.on("request", (request) => requested.push(request.url()));
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");

    await suite.test("un'area aggiunta al JSON compare in Home senza modifiche al codice (4 card)", async () => {
      assert.deepEqual(await visibleAreaTitles(page), [...AREAS.map((a) => a.title), "Cyberbullismo", "Esterna"]);
    });

    await suite.test("area senza icona né descrizione: ripiega sulle iniziali, descrizione nascosta, scenari corretti", async () => {
      const item = page.locator(".sl-home-page__area-item[data-area-id='cyberbullismo']");
      assert.equal((await item.locator(".sl-area-card__icon").textContent()).trim(), "CY");
      assert.equal(await item.locator(".sl-area-card__glyph").count(), 0);
      assert.equal(await item.locator(".sl-area-card__description").isHidden(), true);
      assert.equal((await item.locator(".sl-badge").textContent()).trim(), "2 scenari");
    });

    await suite.test("scenario non disponibile: riga non cliccabile (aria-disabled, nessun href), mai un link", async () => {
      const item = page.locator(".sl-home-page__area-item[data-area-id='cyberbullismo']");
      assert.equal(await item.locator("a.sl-area-card__scenario").count(), 1);
      assert.equal(await item.locator("a.sl-area-card__scenario").getAttribute("href"), "#/scenario/chat-demo");
      const disabled = item.locator(".sl-area-card__scenario--disabled");
      assert.equal(await disabled.count(), 1);
      assert.equal(await disabled.getAttribute("aria-disabled"), "true");
      assert.equal(await disabled.getAttribute("href"), null);
      assert.equal(await disabled.getAttribute("tabindex"), null);
    });

    await suite.test("percorso icona non sicuro (URL esterno): ignorato, nessuna richiesta verso quell'host, iniziali al suo posto", async () => {
      const item = page.locator(".sl-home-page__area-item[data-area-id='icona-esterna']");
      assert.equal((await item.locator(".sl-area-card__icon").textContent()).trim(), "ES");
      assert.equal(await item.locator(".sl-area-card__glyph").count(), 0);
      assert.deepEqual(requested.filter((url) => url.includes("evil.example")), []);
    });

    await suite.test("un'area con available:false non compare né in Home né nella Sidebar, e non è cercabile", async () => {
      assert.ok(!(await visibleAreaTitles(page)).includes("Area non pronta"));
      await openScenariosMenu(page);
      const groups = (await page.locator(".sl-sidebar__group-trigger").allTextContents()).map((t) => t.trim());
      assert.ok(!groups.includes("Area non pronta"));
      await page.fill(SEARCH_INPUT, "non pronto");
      assert.deepEqual(await visibleAreaTitles(page), []);
      await page.fill(SEARCH_INPUT, "");
    });

    await suite.test("Sidebar e Home condividono lo stesso catalogo: la fisarmonica elenca le stesse aree (stesso ordine)", async () => {
      await openScenariosMenu(page);
      const groups = (await page.locator(".sl-sidebar__group-trigger").allTextContents()).map((t) => t.trim());
      assert.deepEqual(groups, [...AREAS.map((a) => a.title), "Cyberbullismo", "Esterna"]);
    });

    await suite.test("la ricerca trova anche scenari di aree aggiunte: 'chat' → Cyberbullismo, badge '1 di 2 scenari'", async () => {
      await page.fill(SEARCH_INPUT, "chat");
      assert.deepEqual(await visibleAreaTitles(page), ["Cyberbullismo"]);
      assert.deepEqual(await visibleBadges(page), ["1 di 2 scenari"]);
    });

    await context.close();
  }

  // --- Errore di rete su modules.json ---------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/data/modules.json", (route) => route.fulfill({ status: 500, body: "errore" }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-home-page__dynamic:not([aria-busy])");

    await suite.test("modules.json non raggiungibile: saluto presente, messaggio di errore condiviso, nessun crash", async () => {
      assert.equal((await page.locator("main h1").textContent()).trim(), "Benvenuto, Prof. Erasmo Lassandro");
      assert.equal(await page.locator(".sl-area-card").count(), 0);
      assert.equal(
        (await page.locator(".sl-home-page__dynamic").innerText()).trim(),
        "Impossibile caricare le aree. Riprova più tardi."
      );
      assert.deepEqual(errors, []);
    });

    await context.close();
  }

  // --- Navigazione via prima che modules.json risolva (race condition) -----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/data/modules.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loginAsDocente(page, server.url);

    await suite.test("navigare via prima della risposta: nessun componente orfano, nessun errore, un solo AppHeader", async () => {
      await page.evaluate(() => {
        window.location.hash = "#/scenario/oversharing";
      });
      await page.waitForSelector(".sl-profile-timeline", { timeout: 8000 });
      await page.waitForTimeout(1500); // oltre il ritardo: la risposta tardiva non deve costruire nulla
      assert.equal(await page.locator(".sl-area-card").count(), 0);
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.deepEqual(errors, []);
    });

    await context.close();
  }

  // --- Tasto Home nella barra superiore --------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");
    const homeButton = page.locator(".sl-app-header__home");
    const chromeOf = (scenarioId) =>
      JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "scenarios", scenarioId, "scenario.json"), "utf8")).chrome;
    const scenarios = AREAS.flatMap((area) => area.scenarios).filter((scenario) => scenario.available);

    await suite.test("tasto Home accanto al marchio: <a href='#/home'> con nome accessibile, DOPO il marchio nello stesso gruppo", async () => {
      assert.equal(await homeButton.count(), 1);
      assert.equal(await homeButton.getAttribute("href"), "#/home");
      assert.equal(await homeButton.getAttribute("aria-label"), "Vai alla Home");
      const order = await page.locator(".sl-app-header__brand-group").evaluate((el) => Array.from(el.children).map((c) => c.className));
      assert.deepEqual(order, ["sl-app-header__sidebar-toggle", "sl-app-header__brand", "sl-app-header__home"]);
      const brand = await page.locator(".sl-app-header__brand").boundingBox();
      const home = await homeButton.boundingBox();
      assert.ok(home.x >= brand.x + brand.width - 1, "il tasto Home non sta a destra del marchio");
    });

    await suite.test("il tasto è una casa (icona SVG 24px, decorativa), ha un bersaglio ≥ 44px e sulla Home è 'pagina corrente'", async () => {
      const box = await homeButton.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `bersaglio ${box.width}x${box.height}`);
      const icon = homeButton.locator("svg");
      assert.equal(await icon.getAttribute("aria-hidden"), "true");
      const iconBox = await icon.boundingBox();
      assert.equal(Math.round(iconBox.width), 24);
      assert.equal(await homeButton.getAttribute("aria-current"), "page");
    });

    await suite.test("il tasto Home è SOLO icona: nessuno sfondo a riposo (neanche da pagina corrente) né al passaggio del mouse; cambia solo il colore", async () => {
      const readStyle = () => homeButton.evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
      const rest = await readStyle();
      assert.equal(rest.background, "rgba(0, 0, 0, 0)", "sfondo a riposo");
      await homeButton.hover();
      await page.waitForTimeout(300); // transizione di colore (--sl-duration-fast) conclusa
      const hover = await readStyle();
      assert.equal(hover.background, "rgba(0, 0, 0, 0)", "sfondo all'hover");
      assert.notEqual(hover.color, rest.color, "l'hover deve almeno cambiare il colore dell'icona");
      await page.mouse.move(700, 600);
    });

    await suite.test("tastiera: dopo lo skip-link vengono il tasto Menu laterale e poi il tasto Home, con focus visibile", async () => {
      await page.keyboard.press("Tab"); // skip-link
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.className), "sl-app-header__sidebar-toggle");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.className), "sl-app-header__home");
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      assert.notEqual(outline, "none");
    });

    for (const scenario of scenarios.filter((s) => chromeOf(s.id) !== "none")) {
      await suite.test(`scenario "${scenario.title}": il tasto Home è presente (non 'corrente') e riporta alla Home`, async () => {
        await page.evaluate((id) => {
          window.location.hash = `#/scenario/${id}`;
        }, scenario.id);
        await page.waitForSelector(`.sl-scenario-viewport[data-scenario-id="${scenario.id}"]:not([aria-busy])`, { state: "attached" });
        assert.equal(await homeButton.count(), 1);
        assert.equal(await homeButton.getAttribute("aria-current"), null);
        await homeButton.click();
        await page.waitForFunction(() => window.location.hash === "#/home");
        await page.waitForSelector(".sl-home-page__content .sl-area-card");
      });
    }

    for (const scenario of scenarios.filter((s) => chromeOf(s.id) === "none")) {
      await suite.test(`scenario immersivo "${scenario.title}": nessuna barra (realismo), ma l'uscita "×" verso la Home è sempre presente`, async () => {
        await page.evaluate((id) => {
          window.location.hash = `#/scenario/${id}`;
        }, scenario.id);
        await page.waitForSelector(`.sl-scenario-viewport[data-scenario-id="${scenario.id}"]:not([aria-busy])`, { state: "attached" });
        assert.equal(await page.locator(".sl-app-header").count(), 0);
        const exit = page.locator(".sl-scenario-page__immersive-exit");
        assert.equal(await exit.count(), 1);
        assert.ok(/Home/.test(await exit.getAttribute("aria-label")));
        await exit.click();
        await page.waitForFunction(() => window.location.hash === "#/home");
        await page.waitForSelector(".sl-home-page__content .sl-area-card");
      });
    }

    await context.close();
  }

  // --- Tastiera ---------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");

    await suite.test("tastiera: il primo scenario della prima area è raggiungibile con Tab, ha il focus visibile e Invio lo apre", async () => {
      const firstScenario = AREAS[0].scenarios.find((s) => s.available);
      let focusedHref = null;
      for (let i = 0; i < 20; i += 1) {
        await page.keyboard.press("Tab");
        focusedHref = await page.evaluate(() => document.activeElement.getAttribute("href"));
        if (focusedHref && focusedHref.startsWith("#/scenario/")) break;
      }
      assert.equal(focusedHref, `#/scenario/${firstScenario.id}`, "il Tab non ha raggiunto il primo scenario entro 20 pressioni");
      const outline = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      assert.notEqual(outline.style, "none", "nessun outline sul link focalizzato");
      assert.ok(outline.width > 0);
      await page.keyboard.press("Enter");
      await page.waitForFunction((id) => window.location.hash === `#/scenario/${id}`, firstScenario.id);
    });

    await context.close();
  }

  // --- Mobile 375px: la Home è l'UNICO accesso agli scenari ------------------
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");

    await suite.test("375px: Sidebar e ricerca sono nascoste ma ogni scenario resta raggiungibile dalle card", async () => {
      assert.equal(await page.locator(".sl-sidebar").isVisible(), false);
      assert.equal(await page.locator(".sl-app-header__search").isVisible(), false);
      const visibleLinks = await page.locator("a.sl-area-card__scenario").evaluateAll(
        (els) => els.filter((el) => el.offsetParent !== null).length
      );
      assert.equal(visibleLinks, AREAS.flatMap((a) => a.scenarios).filter((s) => s.available).length);
    });

    await suite.test("375px: nessun overflow orizzontale, card a colonna unica a tutta larghezza", async () => {
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
        false
      );
      const lefts = await page.locator(".sl-area-card").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
      assert.equal(new Set(lefts).size, 1, "le card non sono incolonnate");
    });

    await suite.test("375px: il tasto Home resta visibile accanto al marchio (la barra superiore non perde nulla)", async () => {
      const box = await page.locator(".sl-app-header__home").boundingBox();
      const brand = await page.locator(".sl-app-header__brand").boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44);
      assert.ok(box.x >= brand.x + brand.width - 1, "il tasto Home non sta dopo il marchio");
      assert.ok(box.x + box.width <= 375, "il tasto Home esce dalla viewport");
    });

    await suite.test("375px: target di tocco degli scenari ≥ 44px (WCAG 2.5.5)", async () => {
      const heights = await page.locator("a.sl-area-card__scenario").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
      heights.forEach((h) => assert.ok(h >= 44, `target alto solo ${h}px`));
    });

    await suite.test("375px: toccare uno scenario apre lo scenario", async () => {
      await page.click("a.sl-area-card__scenario >> nth=0");
      await page.waitForFunction(() => window.location.hash.startsWith("#/scenario/"));
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
    await page.waitForSelector(".sl-area-card");
    await page.waitForSelector(".sl-sidebar__trigger");

    await suite.test("screenshot Home — desktop Light", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-desktop-light.png"), fullPage: true });
    });

    await suite.test("screenshot Home — desktop Dark", async () => {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(350); // body ha una transizione di 200ms sul cambio tema: evita screenshot a metà
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-desktop-dark.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      await page.waitForTimeout(350);
    });

    await suite.test("screenshot Home — desktop Light con ricerca attiva ('phish')", async () => {
      await page.fill(SEARCH_INPUT, "phish");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-search-light.png"), fullPage: true });
      await page.fill(SEARCH_INPUT, "");
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

    await suite.test("screenshot Home — mobile 375px (Light e Dark), Sidebar/ricerca nascoste", async () => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-mobile-375.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home-mobile-375-dark.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
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
    await page.waitForSelector(".sl-area-card");

    await suite.test("Home -> Scenari (fisarmonica) -> Cybersecurity -> Oversharing -> Home: nessun componente duplicato, nessun feed", async () => {
      await openScenariosMenu(page);
      await expandSidebarGroup(page, "Cybersecurity");
      await page.click(".sl-sidebar__group-list .sl-sidebar__link >> nth=0");
      await page.waitForFunction(() => window.location.hash === "#/scenario/oversharing");
      await page.waitForSelector(".sl-profile-timeline");
      await page.click(".sl-sidebar__link[href='#/home']");
      await page.waitForFunction(() => window.location.hash === "#/home");
      // ".sl-home-page__content" esiste SOLO su Home: aspettarlo
      // garantisce che lo swap async di router.js sia avvenuto prima di
      // contare le card (l'hash cambia in modo sincrono, il DOM no).
      await page.waitForSelector(".sl-home-page__content .sl-area-card");
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-area-card").count(), AREAS.length);
      assert.equal(await page.locator(".sl-post-card").count(), 0, "il feed di Oversharing non deve restare in Home");
    });

    await suite.test("Home -> card (link diretto) -> scenario -> Home: ancora una card per area, nessun duplicato", async () => {
      await page.click("a.sl-area-card__scenario >> nth=0");
      await page.waitForFunction(() => window.location.hash.startsWith("#/scenario/"));
      await goHome(page);
      assert.equal(await page.locator(".sl-app-header").count(), 1);
      assert.equal(await page.locator(".sl-area-card").count(), AREAS.length);
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
