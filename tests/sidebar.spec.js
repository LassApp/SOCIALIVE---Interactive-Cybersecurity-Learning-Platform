/**
 * sidebar.spec.js
 * -----------------------------------------------------------------------
 * Sidebar a due livelli (intervento "Scenario Tokenizzazione"): la voce
 * "Scenari" (ex "Moduli") apre un flyout con le CATEGORIE (Cybersecurity,
 * AI), ciascuna a disclosure con i propri scenari SOTTO di sé. Le
 * categorie si aprono per click/Invio/Spazio, mai all'hover; quella che
 * contiene lo scenario della pagina corrente nasce aperta.
 *
 * Il test del flyout a un livello (4 scenari piatti) viveva sparso in
 * home/phishing/scenario.spec.js: lì sono stati aggiornati per il nuovo
 * percorso (helpers/sidebar.js); qui sta la copertura specifica del
 * nuovo comportamento a gruppi.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente } = require("./helpers/auth");
const { openScenariosFlyout, expandSidebarGroup } = require("./helpers/sidebar");

const APP_ROOT = path.join(__dirname, "..");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const trim = (list) => list.map((text) => text.trim());

async function waitForSidebar(page) {
  await page.waitForSelector(".sl-sidebar__trigger");
}

async function groupStates(page) {
  return page
    .locator(".sl-sidebar__group-trigger")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-expanded")));
}

async function run() {
  const suite = createSuite("sidebar.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Struttura e apertura delle categorie (da Home) -------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await waitForSidebar(page);

    await suite.test("la voce si chiama 'Scenari' (mai più 'Moduli'), trigger con aria-haspopup e flyout chiuso", async () => {
      const trigger = page.locator(".sl-sidebar__trigger");
      assert.equal((await trigger.textContent()).trim(), "Scenari");
      assert.equal(await trigger.getAttribute("aria-haspopup"), "true");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      const sidebarText = await page.locator(".sl-sidebar").innerText();
      assert.ok(!sidebarText.includes("Moduli"), "la parola 'Moduli' compare ancora nella Sidebar");
    });

    await suite.test("hover: il flyout mostra 2 categorie (Cybersecurity, AI), entrambe chiuse su Home", async () => {
      await openScenariosFlyout(page);
      const groups = await page.locator(".sl-sidebar__group-trigger").allTextContents();
      assert.deepEqual(trim(groups), ["Cybersecurity", "AI"]);
      assert.deepEqual(await groupStates(page), ["false", "false"]);
    });

    await suite.test("semantica a lista: i figli diretti del flyout e dei gruppi sono tutti <li>", async () => {
      const tags = await page.evaluate(() => {
        const direct = (selector) =>
          Array.from(document.querySelectorAll(selector)).flatMap((ul) => Array.from(ul.children).map((c) => c.tagName));
        return [...direct(".sl-sidebar__flyout"), ...direct(".sl-sidebar__group-list")];
      });
      assert.ok(tags.length >= 7, `attesi almeno 7 elementi di lista, trovati ${tags.length}`);
      assert.ok(tags.every((tag) => tag === "LI"), `figli non-<li> nelle liste: ${tags.join(",")}`);
    });

    await suite.test("ogni categoria controlla una lista esistente, nascosta finché chiusa (aria-controls)", async () => {
      const checks = await page.locator(".sl-sidebar__group-trigger").evaluateAll((triggers) =>
        triggers.map((trigger) => {
          const list = document.getElementById(trigger.getAttribute("aria-controls"));
          return { exists: Boolean(list), hidden: list ? list.hidden : null };
        })
      );
      assert.deepEqual(checks, [
        { exists: true, hidden: true },
        { exists: true, hidden: true },
      ]);
      const firstLink = page.locator(".sl-sidebar__group-list a.sl-sidebar__link").first();
      assert.equal(await firstLink.isVisible(), false);
    });

    await suite.test("click su Cybersecurity: si apre SOTTO di sé con i 4 scenari nell'ordine di modules.json; AI resta chiusa", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*Cybersecurity\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["true", "false"]);
      const visible = await page
        .locator("#sl-sidebar-group-cybersecurity a.sl-sidebar__link")
        .evaluateAll((els) => els.map((el) => el.textContent.trim()));
      assert.deepEqual(visible, ["Oversharing", "Keylogger", "Phishing", "Evil Twin Wi-Fi"]);
      const boxes = await page.evaluate(() => {
        const trigger = document.querySelector(".sl-sidebar__group-trigger").getBoundingClientRect();
        const list = document.getElementById("sl-sidebar-group-cybersecurity").getBoundingClientRect();
        return { triggerBottom: trigger.bottom, listTop: list.top };
      });
      assert.ok(boxes.listTop >= boxes.triggerBottom - 1, "la lista degli scenari non è sotto la categoria");
      assert.equal(await page.locator("#sl-sidebar-group-ai").isVisible(), false);
    });

    await suite.test("le categorie sono indipendenti: aprire AI non chiude Cybersecurity; AI ha 1 sola voce, Tokenizzazione", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*AI\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["true", "true"]);
      const aiLinks = page.locator("#sl-sidebar-group-ai a.sl-sidebar__link");
      assert.equal(await aiLinks.count(), 1);
      assert.equal((await aiLinks.textContent()).trim(), "Tokenizzazione");
      assert.equal(await aiLinks.getAttribute("href"), "#/scenario/tokenizzazione");
    });

    await suite.test("un secondo click richiude la categoria", async () => {
      await page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*Cybersecurity\s*$/ }).click();
      assert.deepEqual(await groupStates(page), ["false", "true"]);
      assert.equal(await page.locator("#sl-sidebar-group-cybersecurity").isVisible(), false);
    });

    await suite.test("tastiera: Invio e Spazio sul trigger di una categoria la aprono e la chiudono", async () => {
      const trigger = page.locator(".sl-sidebar__group-trigger", { hasText: /^\s*Cybersecurity\s*$/ });
      await trigger.focus();
      await page.keyboard.press("Enter");
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Space");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    });

    await suite.test("chevron delle categorie: '>' da chiusa (0°), 'v' da aperta (90°), come il trigger principale", async () => {
      // Stato a questo punto: Cybersecurity chiusa, AI aperta. L'attesa lascia
      // finire la transizione di rotazione prima di leggere lo stile calcolato.
      await page.waitForTimeout(300);
      const rotations = await page.locator(".sl-sidebar__group-trigger .sl-sidebar__chevron").evaluateAll((els) =>
        els.map((el) => {
          const matrix = new DOMMatrix(getComputedStyle(el).transform);
          return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
        })
      );
      assert.deepEqual(await groupStates(page), ["false", "true"]);
      assert.deepEqual(rotations, [0, 90]);
    });

    await suite.test("Escape chiude l'intero flyout e riporta il focus sul trigger 'Scenari'", async () => {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-sidebar__flyout", { state: "hidden" });
      const focusedIsTrigger = await page.evaluate(() => document.activeElement.classList.contains("sl-sidebar__trigger"));
      assert.ok(focusedIsTrigger);
    });

    await suite.test("screenshot — flyout con Cybersecurity aperta (Light e Dark)", async () => {
      await openScenariosFlyout(page);
      await expandSidebarGroup(page, "Cybersecurity");
      await page.waitForTimeout(300); // transizione del chevron conclusa
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "sidebar-flyout-light.png"), clip: { x: 0, y: 0, width: 640, height: 420 } });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "sidebar-flyout-dark.png"), clip: { x: 0, y: 0, width: 640, height: 420 } });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    });

    await context.close();
  }

  // --- La categoria dello scenario corrente nasce aperta -----------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("su #/scenario/oversharing: Cybersecurity nasce aperta, AI chiusa; nessuna voce risulta 'attiva'", async () => {
      await page.goto(`${server.url}/#/scenario/oversharing`);
      await page.waitForSelector(".sl-profile-timeline");
      await waitForSidebar(page);
      await openScenariosFlyout(page);
      assert.deepEqual(await groupStates(page), ["true", "false"]);
      assert.equal(await page.locator(".sl-sidebar__link--active").count(), 0);
    });

    await suite.test("dalla Sidebar: Scenari → AI → Tokenizzazione porta a #/scenario/tokenizzazione, con AI già aperta", async () => {
      await expandSidebarGroup(page, "AI");
      await page.locator("#sl-sidebar-group-ai a.sl-sidebar__link").click();
      await page.waitForFunction(() => window.location.hash === "#/scenario/tokenizzazione");
      await page.waitForSelector(".sl-token-prediction");
      await waitForSidebar(page);
      await openScenariosFlyout(page);
      assert.deepEqual(await groupStates(page), ["false", "true"]);
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
