/**
 * sidebar.spec.js
 * -----------------------------------------------------------------------
 * Sidebar a FISARMONICA (sostituisce il precedente flyout aperto
 * dall'hover): la voce "Scenari" si apre e si chiude IN LINEA per
 * click/Invio/Spazio e contiene le AREE (Cybersecurity, AI, Reti), ciascuna a
 * sua volta a fisarmonica con i propri scenari SOTTO di sé. Le aree sono
 * ESCLUSIVE tra loro (aprirne una chiude le altre). "Scenari" nasce
 * sempre CHIUSA (altrimenti dentro Oversharing la Sidebar mostrerebbe il
 * titolo dello scenario); l'area dello scenario corrente è già aperta
 * quando si apre "Scenari".
 * Include la voce esterna PixelProf (nuova scheda, rel noopener) letta da
 * data/external-links.json.
 *
 * COLONNA RICHIUDIBILE: oltre alla fisarmonica del sottomenu, l'intera
 * Sidebar si chiude e si riapre con il tasto "Menu laterale" della barra
 * superiore (per dare più spazio al contenuto su LIM/proiettore); lo
 * stato è ricordato tra pagine e ricaricamenti.
 *
 * Cambi deliberati rispetto alla versione a flyout (non regressioni): non
 * esiste più l'apertura all'hover né la chiusura con Escape/perdita di
 * focus; le aree non sono più indipendenti ma esclusive.
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

const trim = (list) => list.map((text) => text.trim());

async function waitForSidebar(page) {
  await page.waitForSelector(".sl-sidebar__trigger");
  // La Sidebar nasce con i soli dati iniziali e si ricostruisce quando i
  // JSON risolvono: attendo l'ultima voce di dati per non operare su un
  // nodo destinato a sparire.
  await page.waitForSelector(".sl-sidebar__link--external");
}

async function groupStates(page) {
  return page
    .locator(".sl-sidebar__group-trigger")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-expanded")));
}

async function topLevelLabels(page) {
  return trim(await page.locator(".sl-sidebar__list > .sl-sidebar__item").evaluateAll((els) => els.map((el) => el.querySelector(".sl-sidebar__label").textContent)));
}

async function run() {
  const suite = createSuite("sidebar.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Struttura e comportamento a fisarmonica (da Home) ---------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await waitForSidebar(page);
    const trigger = page.locator(".sl-sidebar__trigger");

    await suite.test("voci di primo livello nell'ordine: Home, Scenari, PixelProf, Impostazioni", async () => {
      assert.deepEqual(await topLevelLabels(page), ["Home", "Scenari", "PixelProf", "Impostazioni"]);
    });

    await suite.test("'Scenari' (mai più 'Moduli') è un bottone a fisarmonica: aria-expanded=false, aria-controls, nessun aria-haspopup", async () => {
      assert.equal((await trigger.textContent()).trim(), "Scenari");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await trigger.getAttribute("aria-haspopup"), null);
      const panelId = await trigger.getAttribute("aria-controls");
      assert.equal(await page.locator(`#${panelId}`).isHidden(), true);
      assert.ok(!(await page.locator(".sl-sidebar").innerText()).includes("Moduli"), "la parola 'Moduli' compare ancora nella Sidebar");
    });

    await suite.test("l'hover NON apre nulla (non è più un flyout)", async () => {
      await page.hover(".sl-sidebar__trigger");
      await page.waitForTimeout(400);
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(".sl-sidebar__panel").isHidden(), true);
      await page.mouse.move(700, 500);
    });

    await suite.test("click su 'Scenari': il pannello si apre IN LINEA — le voci successive scendono e nulla esce dalla Sidebar", async () => {
      const yBefore = (await page.locator(".sl-sidebar__link--external").boundingBox()).y;
      await trigger.click();
      await page.waitForSelector(".sl-sidebar__panel:not([hidden])");
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      const yAfter = (await page.locator(".sl-sidebar__link--external").boundingBox()).y;
      assert.ok(yAfter > yBefore + 40, `PixelProf non è sceso (prima ${yBefore}, dopo ${yAfter})`);
      const panel = await page.locator(".sl-sidebar__panel").boundingBox();
      const sidebar = await page.locator(".sl-sidebar").boundingBox();
      assert.ok(panel.x + panel.width <= sidebar.x + sidebar.width + 1, "il pannello esce dalla colonna della Sidebar (è ancora un flyout?)");
    });

    await suite.test("aperto: mostra le 3 aree reali (Cybersecurity, AI, Reti) nell'ordine di modules.json, tutte chiuse su Home", async () => {
      const groups = await page.locator(".sl-sidebar__group-trigger").allTextContents();
      assert.deepEqual(trim(groups), ["Cybersecurity", "AI", "Reti"]);
      assert.deepEqual(await groupStates(page), ["false", "false", "false"]);
    });

    await suite.test("semantica a lista: i figli diretti del pannello e dei gruppi sono tutti <li>", async () => {
      const tags = await page.evaluate(() => {
        const direct = (selector) =>
          Array.from(document.querySelectorAll(selector)).flatMap((ul) => Array.from(ul.children).map((c) => c.tagName));
        return [...direct(".sl-sidebar__panel"), ...direct(".sl-sidebar__group-list")];
      });
      assert.ok(tags.length >= 7, `attesi almeno 7 elementi di lista, trovati ${tags.length}`);
      assert.ok(tags.every((tag) => tag === "LI"), `figli non-<li> nelle liste: ${tags.join(",")}`);
    });

    await suite.test("ogni area controlla una lista esistente, nascosta finché chiusa (aria-controls)", async () => {
      const checks = await page.locator(".sl-sidebar__group-trigger").evaluateAll((triggers) =>
        triggers.map((el) => {
          const list = document.getElementById(el.getAttribute("aria-controls"));
          return { exists: Boolean(list), hidden: list ? list.hidden : null };
        })
      );
      assert.deepEqual(checks, [
        { exists: true, hidden: true },
        { exists: true, hidden: true },
        { exists: true, hidden: true },
      ]);
      assert.equal(await page.locator(".sl-sidebar__group-list a.sl-sidebar__link").first().isVisible(), false);
    });

    await suite.test("click su Cybersecurity: si apre SOTTO di sé con i 4 scenari nell'ordine di modules.json; AI e Reti restano chiuse", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*Cybersecurity\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["true", "false", "false"]);
      const visible = await page
        .locator("#sl-sidebar-group-cybersecurity a.sl-sidebar__link")
        .evaluateAll((els) => els.map((el) => el.textContent.trim()));
      assert.deepEqual(visible, ["Oversharing", "Keylogger", "Phishing", "Evil Twin Wi-Fi"]);
      const boxes = await page.evaluate(() => {
        const group = document.querySelector(".sl-sidebar__group-trigger").getBoundingClientRect();
        const list = document.getElementById("sl-sidebar-group-cybersecurity").getBoundingClientRect();
        return { groupBottom: group.bottom, listTop: list.top };
      });
      assert.ok(boxes.listTop >= boxes.groupBottom - 1, "la lista degli scenari non è sotto l'area");
      assert.equal(await page.locator("#sl-sidebar-group-ai").isVisible(), false);
    });

    await suite.test("FISARMONICA ESCLUSIVA: aprire AI chiude Cybersecurity; AI ha 2 voci con i link corretti", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*AI\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["false", "true", "false"]);
      assert.equal(await page.locator("#sl-sidebar-group-cybersecurity").isVisible(), false);
      const aiLinks = page.locator("#sl-sidebar-group-ai a.sl-sidebar__link");
      assert.equal(await aiLinks.count(), 2);
      assert.deepEqual(trim(await aiLinks.allTextContents()), ["Tokenizzazione", "Allucinazioni"]);
      assert.equal(await aiLinks.nth(0).getAttribute("href"), "#/scenario/tokenizzazione");
      assert.equal(await aiLinks.nth(1).getAttribute("href"), "#/scenario/allucinazioni");
    });

    await suite.test("FISARMONICA ESCLUSIVA: aprire Reti chiude AI; Reti ha 1 voce con il link corretto", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*Reti\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["false", "false", "true"]);
      assert.equal(await page.locator("#sl-sidebar-group-ai").isVisible(), false);
      const retiLinks = page.locator("#sl-sidebar-group-reti a.sl-sidebar__link");
      assert.equal(await retiLinks.count(), 1);
      assert.deepEqual(trim(await retiLinks.allTextContents()), ["Viaggio dei dati"]);
      assert.equal(await retiLinks.nth(0).getAttribute("href"), "#/scenario/viaggio-dei-dati");
      // Rimette AI aperta: i test successivi partono da "AI aperta, le altre chiuse".
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*AI\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["false", "true", "false"]);
    });

    await suite.test("un secondo click sull'area aperta la richiude (tutte chiuse)", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*AI\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["false", "false", "false"]);
      assert.equal(await page.locator("#sl-sidebar-group-ai").isVisible(), false);
    });

    await suite.test("tastiera: Invio e Spazio sul trigger di un'area la aprono e la chiudono", async () => {
      const group = page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*Cybersecurity\s*$/ });
      await group.focus();
      await page.keyboard.press("Enter");
      assert.equal(await group.getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Space");
      assert.equal(await group.getAttribute("aria-expanded"), "false");
    });

    await suite.test("tastiera: Invio e Spazio sul trigger 'Scenari' lo chiudono e riaprono", async () => {
      await trigger.focus();
      await page.keyboard.press("Enter");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      await page.keyboard.press("Space");
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    });

    await suite.test("chevron: '>' (0°) da chiuso, 'v' (90°) da aperto — sia 'Scenari' sia le aree", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*AI\s*$/ }).click(); // AI aperta, Cybersecurity chiusa
      await page.waitForTimeout(300); // transizione di rotazione conclusa
      const rotation = (selector) =>
        page.locator(selector).evaluateAll((els) =>
          els.map((el) => {
            const matrix = new DOMMatrix(getComputedStyle(el).transform);
            return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
          })
        );
      assert.deepEqual(await rotation(".sl-sidebar__group-trigger .sl-sidebar__chevron"), [0, 90, 0]);
      assert.deepEqual(await rotation(".sl-sidebar__trigger .sl-sidebar__chevron"), [90]);
    });

    await suite.test("il pannello NON si chiude da solo: né quando il mouse esce, né quando il focus passa altrove", async () => {
      await page.mouse.move(900, 600);
      await page.focus(SEARCH);
      await page.waitForTimeout(500);
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      assert.equal(await page.locator(".sl-sidebar__panel").isVisible(), true);
      assert.deepEqual(await groupStates(page), ["false", "true", "false"]);
    });

    await suite.test("chiudere 'Scenari' nasconde tutto (anche l'area aperta): i link escono dall'ordine di tabulazione", async () => {
      await trigger.click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(".sl-sidebar__panel").isHidden(), true);
      assert.equal(await page.locator(".sl-sidebar__group-list a.sl-sidebar__link").first().isVisible(), false);
      await trigger.click(); // riapre: lo stato interno delle aree è conservato
      assert.deepEqual(await groupStates(page), ["false", "true", "false"]);
    });

    await suite.test("screenshot — fisarmonica con Cybersecurity aperta (Light e Dark)", async () => {
      await expandSidebarGroup(page, "Cybersecurity");
      await page.waitForTimeout(350); // animazione di apertura e rotazione del chevron concluse
      await page.mouse.move(900, 700);
      await page.waitForTimeout(300); // fine della transizione di hover (--sl-duration-fast) sulla riga appena cliccata
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "sidebar-accordion-light.png"), clip: { x: 0, y: 0, width: 640, height: 520 } });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "sidebar-accordion-dark.png"), clip: { x: 0, y: 0, width: 640, height: 520 } });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      await page.waitForTimeout(350);
    });

    await context.close();
  }

  // --- Voce esterna PixelProf ---------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Nessuna richiesta reale verso l'host esterno: le risposte si simulano.
    const externalRequests = [];
    await context.route("https://lassapp.github.io/**", (route) => {
      externalRequests.push(route.request().url());
      return route.fulfill({ contentType: "text/html", body: "<title>PixelProf</title><p>simulato</p>" });
    });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await waitForSidebar(page);
    const link = page.locator(".sl-sidebar__link--external");

    await suite.test("PixelProf: link a https://lassapp.github.io/PixelProf/ in nuova scheda con rel noopener noreferrer", async () => {
      assert.equal(await link.count(), 1);
      assert.equal(await link.getAttribute("href"), "https://lassapp.github.io/PixelProf/");
      assert.equal(await link.getAttribute("target"), "_blank");
      const rel = await link.getAttribute("rel");
      assert.ok(rel.includes("noopener") && rel.includes("noreferrer"), `rel = ${rel}`);
    });

    await suite.test("PixelProf: nome accessibile onesto ('… si apre in una nuova scheda'), icona decorativa, mai 'pagina corrente'", async () => {
      assert.equal(await page.getByRole("link", { name: /PixelProf.*si apre in una nuova scheda/ }).count(), 1);
      assert.equal(await link.locator(".sl-sidebar__external-icon").getAttribute("aria-hidden"), "true");
      assert.equal(await link.getAttribute("aria-current"), null);
      assert.equal(await link.locator(".sl-visually-hidden").evaluate((el) => getComputedStyle(el).position), "absolute");
    });

    await suite.test("PixelProf: nessuna richiesta verso l'host esterno finché non viene cliccato", async () => {
      assert.deepEqual(externalRequests, []);
    });

    await suite.test("click: si apre una NUOVA scheda sull'URL esterno; l'app resta sulla Home; la nuova scheda non ha window.opener", async () => {
      const hashBefore = await page.evaluate(() => window.location.hash);
      const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
      await popup.waitForLoadState();
      assert.equal(popup.url(), "https://lassapp.github.io/PixelProf/");
      assert.equal(await popup.evaluate(() => window.opener), null, "window.opener non è null: manca noopener");
      assert.equal(await page.evaluate(() => window.location.hash), hashBefore);
      assert.equal(await page.locator(".sl-home-page__content").count(), 1);
      await popup.close();
    });

    await suite.test("la voce non emette 'sl:navigate' (non è una rotta dell'app)", async () => {
      const emitted = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let fired = false;
            document.addEventListener("sl:navigate", () => (fired = true), { once: true });
            window.open = () => null; // il click non deve aprire altre schede in questo controllo
            document.querySelector(".sl-sidebar__link--external").addEventListener("click", (e) => e.preventDefault(), { once: true });
            document.querySelector(".sl-sidebar__link--external").click();
            setTimeout(() => resolve(fired), 100);
          })
      );
      assert.equal(emitted, false);
    });

    await context.close();
  }

  // --- external-links.json: dati non sicuri o non disponibili ------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/data/external-links.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          links: [
            { id: "xss", label: "Script", url: "javascript:alert(1)" },
            { id: "insicuro", label: "Senza https", url: "http://example.org/" },
            { id: "dati", label: "Dati", url: "data:text/html,x" },
            { id: "valido", label: "Strumento valido", url: "https://example.org/strumento" },
          ],
        }),
      })
    );
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-sidebar__link--external");

    await suite.test("un file di dati non è fidato: solo gli URL https compaiono (javascript:, data: e http: scartati)", async () => {
      assert.deepEqual(await topLevelLabels(page), ["Home", "Scenari", "Strumento valido", "Impostazioni"]);
      assert.equal(await page.locator(".sl-sidebar__link--external").getAttribute("href"), "https://example.org/strumento");
    });

    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/data/external-links.json", (route) => route.fulfill({ status: 500, body: "errore" }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-sidebar__group-trigger, .sl-sidebar__trigger");

    await suite.test("external-links.json non raggiungibile: nessun PixelProf, ma 'Scenari' funziona e nessun errore di pagina", async () => {
      await page.waitForSelector(".sl-sidebar__trigger");
      assert.deepEqual(await topLevelLabels(page), ["Home", "Scenari", "Impostazioni"]);
      await openScenariosMenu(page);
      assert.equal(await page.locator(".sl-sidebar__group-trigger").count(), 3);
      assert.deepEqual(errors, []);
    });

    await context.close();
  }

  // --- Dentro uno scenario: "Scenari" chiusa, area corrente già aperta --------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("su #/scenario/oversharing: 'Scenari' nasce CHIUSA e il titolo dello scenario non è visibile nella Sidebar (nessun elemento didattico)", async () => {
      await page.goto(`${server.url}/#/scenario/oversharing`);
      await page.waitForSelector(".sl-profile-timeline");
      await waitForSidebar(page);
      assert.equal(await page.locator(".sl-sidebar__trigger").getAttribute("aria-expanded"), "false");
      assert.ok(!(await page.locator(".sl-sidebar").innerText()).includes("Oversharing"), "il titolo dello scenario è visibile in Sidebar");
      assert.ok(!(await page.evaluate(() => document.body.innerText)).toLowerCase().includes("oversharing"));
    });

    await suite.test("aprendo 'Scenari' da Oversharing l'area di appartenenza è GIÀ aperta (Cybersecurity), AI e Reti chiuse; nessuna voce 'attiva'", async () => {
      await openScenariosMenu(page);
      assert.deepEqual(await groupStates(page), ["true", "false", "false"]);
      assert.equal(await page.locator(".sl-sidebar__link--active").count(), 0);
    });

    await suite.test("dalla Sidebar: AI → Tokenizzazione porta a #/scenario/tokenizzazione; riaprendo 'Scenari' c'è già AI aperta", async () => {
      await expandSidebarGroup(page, "AI");
      assert.deepEqual(await groupStates(page), ["false", "true", "false"], "aprire AI deve chiudere Cybersecurity");
      await page.locator("#sl-sidebar-group-ai a.sl-sidebar__link", { hasText: /^\s*Tokenizzazione\s*$/ }).click();
      await page.waitForFunction(() => window.location.hash === "#/scenario/tokenizzazione");
      await page.waitForSelector(".sl-token-prediction");
      await waitForSidebar(page);
      assert.equal(await page.locator(".sl-sidebar__trigger").getAttribute("aria-expanded"), "false");
      await openScenariosMenu(page);
      assert.deepEqual(await groupStates(page), ["false", "true", "false"]);
    });

    await context.close();
  }

  // --- Menu laterale richiudibile (l'intera colonna) ---------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await waitForSidebar(page);
    const toggle = page.locator(".sl-app-header__sidebar-toggle");
    const sidebar = page.locator(".sl-sidebar");
    const mainWidth = async () => (await page.locator("main.sl-page-container__main").boundingBox()).width;
    const storedState = () => page.evaluate(() => window.localStorage.getItem("sl-sidebar-collapsed"));

    await suite.test("tastiera: subito dopo lo skip-link arriva il tasto 'Menu laterale'", async () => {
      await page.keyboard.press("Tab"); // skip-link
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.className), "sl-app-header__sidebar-toggle");
    });

    await suite.test("tasto 'Menu laterale': a sinistra del marchio, aria-expanded=true, aria-controls verso la Sidebar, icona decorativa, bersaglio ≥ 44px", async () => {
      assert.equal(await toggle.count(), 1);
      assert.equal(await toggle.getAttribute("aria-label"), "Menu laterale");
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      const controlled = await toggle.getAttribute("aria-controls");
      assert.equal(await page.locator(`#${controlled}`).evaluate((el) => el.classList.contains("sl-sidebar")), true);
      assert.equal(await toggle.locator("svg").getAttribute("aria-hidden"), "true");
      const box = await toggle.boundingBox();
      const brand = await page.locator(".sl-app-header__brand").boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      assert.ok(box.x + box.width <= brand.x + 1, "il tasto non sta a sinistra del marchio");
    });

    await suite.test("senza sfondo: trasparente a riposo e al passaggio del mouse (cambia solo il colore dell'icona)", async () => {
      const read = () => toggle.evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
      const rest = await read();
      assert.equal(rest.background, "rgba(0, 0, 0, 0)");
      await toggle.hover();
      await page.waitForTimeout(300);
      const hover = await read();
      assert.equal(hover.background, "rgba(0, 0, 0, 0)");
      assert.notEqual(hover.color, rest.color);
      await page.mouse.move(900, 700);
    });

    await suite.test("per la prova successiva: apro 'Scenari' e Cybersecurity, poi chiudo l'intera colonna", async () => {
      await openScenariosMenu(page);
      await expandSidebarGroup(page, "Cybersecurity");
      assert.equal(await sidebar.isVisible(), true);
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    });

    const widthOpen = await mainWidth();

    await suite.test("click: la colonna si chiude (non visibile), aria-expanded=false, il contenuto guadagna lo spazio della Sidebar (≥ 230px)", async () => {
      await toggle.click();
      assert.equal(await sidebar.isHidden(), true);
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.ok((await mainWidth()) >= widthOpen + 230, "il contenuto non si è allargato");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    });

    await suite.test("a colonna chiusa nessun elemento della Sidebar è raggiungibile con Tab", async () => {
      await toggle.focus();
      const visited = [];
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press("Tab");
        visited.push(await page.evaluate(() => !!document.activeElement.closest(".sl-sidebar")));
      }
      assert.ok(visited.every((insideSidebar) => !insideSidebar), "il focus è entrato nella Sidebar chiusa");
    });

    await suite.test("lo stato è ricordato: la chiave 'sl-sidebar-collapsed' vale 'true' e il tasto resta in primo piano", async () => {
      assert.equal(await storedState(), "true");
      assert.equal(await toggle.isVisible(), true);
    });

    await suite.test("riaprendo la colonna, la fisarmonica è com'era (Scenari e Cybersecurity ancora aperte): nessuna ricostruzione", async () => {
      await toggle.click();
      assert.equal(await sidebar.isVisible(), true);
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.equal(await page.locator(".sl-sidebar__trigger").getAttribute("aria-expanded"), "true");
      assert.deepEqual(await groupStates(page), ["true", "false", "false"]);
      assert.equal(await storedState(), "false");
    });

    await suite.test("tastiera: Invio e Spazio sul tasto chiudono e riaprono, e il focus resta sul tasto", async () => {
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await sidebar.isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement.className), "sl-app-header__sidebar-toggle");
      await page.keyboard.press("Space");
      assert.equal(await sidebar.isVisible(), true);
      assert.equal(await page.evaluate(() => document.activeElement.className), "sl-app-header__sidebar-toggle");
    });

    await suite.test("chiusa, resta chiusa passando a uno scenario (la shell si ricostruisce) e dopo un ricaricamento", async () => {
      await toggle.click();
      assert.equal(await sidebar.isHidden(), true);
      await page.evaluate(() => {
        window.location.hash = "#/scenario/oversharing";
      });
      await page.waitForSelector(".sl-profile-timeline");
      assert.equal(await page.locator(".sl-app-header__sidebar-toggle").getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(".sl-sidebar").isHidden(), true);
      await page.reload();
      await page.waitForSelector(".sl-profile-timeline");
      assert.equal(await page.locator(".sl-sidebar").isHidden(), true);
      assert.equal(await page.locator(".sl-app-header__sidebar-toggle").getAttribute("aria-expanded"), "false");
    });

    await suite.test("riaperta dallo scenario, resta aperta anche dopo il ricaricamento", async () => {
      await page.locator(".sl-app-header__sidebar-toggle").click();
      assert.equal(await page.locator(".sl-sidebar").isVisible(), true);
      await page.reload();
      await page.waitForSelector(".sl-profile-timeline");
      await page.waitForSelector(".sl-sidebar__trigger");
      assert.equal(await page.locator(".sl-sidebar").isVisible(), true);
      assert.equal(await storedState(), "false");
    });

    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.waitForSelector(".sl-area-card");

    await suite.test("375px: Sidebar già nascosta, quindi il tasto 'Menu laterale' non compare (nulla da chiudere)", async () => {
      assert.equal(await page.locator(".sl-sidebar").isVisible(), false);
      assert.equal(await page.locator(".sl-app-header__sidebar-toggle").isVisible(), false);
      assert.equal(await page.locator(".sl-app-header__home").isVisible(), true);
    });

    await context.close();
  }

  await browser.close();
  await server.close();
  return suite.summary();
}

const SEARCH = ".sl-app-header__search input";

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
