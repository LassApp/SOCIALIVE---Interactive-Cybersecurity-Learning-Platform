/**
 * llm.spec.js
 * -----------------------------------------------------------------------
 * Scenario "Allucinazioni" (type "llm-response-cycle"), in quattro parti:
 *   1. DATI (scenario, domande, esiti, voce in modules.json): sono la
 *      rete di sicurezza contro un JSON modificato a mano — domande
 *      senza punto interrogativo, risposta esatta uguale a quella
 *      allucinata, una spiegazione mancante — prima che lo scopra la LIM.
 *   2. UTILITÀ (questionDeck.js) e COMPONENTE Dropdown, nel browser
 *      reale (import dinamico dal server di test).
 *   3. RENDERER con movimento pieno: percorso reale dalla Sidebar
 *      (Scenari → AI → Allucinazioni), i tre esiti passo per passo, il
 *      ciclo a RELOGIO FINTO (page.clock, fermo e fatto avanzare a mano:
 *      nessun controllo dipende dai tempi reali della macchina), il
 *      cambio di switch/domanda a metà corsa, "Casuale", la tastiera del
 *      menu, l'ingombro dei testi su più larghezze, screenshot.
 *   4. "riduci animazioni", degrado controllato (file mancanti o non
 *      validi), smontaggio e assenza di richieste verso l'esterno.
 * Richiede SL_TEST_EMAIL / SL_TEST_PASSWORD come le altre suite.
 *
 * REGOLA CENTRALE verificata ad ogni passo: si accende UNA sola parte
 * alla volta — quando se ne accende una, la precedente si spegne — e il
 * testo della risposta compare solo a cerchio chiuso.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente } = require("./helpers/auth");
const { openScenarioViaSidebar } = require("./helpers/sidebar");

const APP_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(APP_ROOT, "data", "scenarios", "allucinazioni");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const PARTS = ["request", "process", "answer", "generate"];
const SELECTOR = {
  root: ".sl-llm-cycle",
  trigger: ".sl-dropdown__trigger",
  list: ".sl-dropdown__list",
  option: ".sl-dropdown__option",
  random: ".sl-llm-cycle__random",
  explanation: ".sl-llm-cycle__explanation",
  status: ".sl-llm-cycle__status",
  requestText: ".sl-llm-cycle__node--request .sl-llm-cycle__node-text",
  answerText: ".sl-llm-cycle__node--answer .sl-llm-cycle__node-text",
  processLabel: ".sl-llm-cycle__side--right .sl-llm-cycle__arrow-label",
};

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
}

// Lo spazio non separabile dell'etichetta ("in corso…") si confronta come spazio normale.
const plain = (text) => text.replace(/\u00a0/g, " ").trim();

const mode = (id) => `.sl-llm-cycle__mode[data-mode="${id}"]`;

async function partStates(page) {
  return page.evaluate(
    (parts) =>
      Object.fromEntries(parts.map((part) => [part, document.querySelector(`.sl-llm-cycle [data-part="${part}"]`).dataset.state])),
    PARTS
  );
}

function expectedStates(overrides) {
  return { request: "off", process: "off", answer: "off", generate: "off", ...overrides };
}

async function pressedModes(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".sl-llm-cycle__mode"))
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.dataset.mode)
  );
}

async function chooseQuestion(page, index) {
  await page.click(SELECTOR.trigger);
  await page.locator(SELECTOR.option).nth(index).click();
}

async function run() {
  const suite = createSuite("llm.spec.js");

  const scenario = readJson("scenario.json");
  const { questions } = readJson("questions.json");
  const { modes } = readJson("outcomes.json");
  const outcome = Object.fromEntries(modes.map((m) => [m.id, m]));
  const STEP = scenario.stepMs;
  const modulesJson = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "modules.json"), "utf8"));

  // --- Dati -------------------------------------------------------------
  await suite.test("scenario.json: id, type, stepMs e dataRefs che puntano a file esistenti", async () => {
    assert.equal(scenario.id, "allucinazioni");
    assert.equal(scenario.type, "llm-response-cycle");
    assert.ok(Number.isFinite(STEP) && STEP >= 300 && STEP <= 10000, `stepMs fuori dai limiti: ${STEP}`);
    Object.values(scenario.dataRefs).forEach((ref) => {
      assert.ok(fs.existsSync(path.join(APP_ROOT, ref)), `dataRef inesistente: ${ref}`);
    });
  });

  await suite.test("modules.json: Allucinazioni è nella categoria AI, dopo Tokenizzazione, disponibile", async () => {
    const ai = modulesJson.modules.find((m) => m.id === "ai");
    assert.deepEqual(
      ai.scenarios.map((s) => s.id),
      ["tokenizzazione", "allucinazioni"]
    );
    assert.equal(ai.scenarios[1].title, "Allucinazioni");
    assert.equal(ai.scenarios[1].available, true);
  });

  await suite.test("domande: almeno 8, id unici, testo che finisce con '?', risposte non vuote e diverse tra loro", async () => {
    assert.ok(questions.length >= 8, `servono almeno 8 domande, trovate ${questions.length}`);
    assert.equal(new Set(questions.map((q) => q.id)).size, questions.length, "id duplicati");
    assert.equal(new Set(questions.map((q) => q.text)).size, questions.length, "testi duplicati");
    questions.forEach((q) => {
      assert.match(q.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id non kebab-case: ${q.id}`);
      assert.ok(q.text.trim().endsWith("?"), `la domanda non finisce con '?': ${q.text}`);
      assert.ok(q.exact.trim().endsWith(".") && q.hallucinated.trim().endsWith("."), `risposta senza punto finale: ${q.id}`);
      assert.notEqual(q.exact, q.hallucinated, `risposta esatta uguale a quella allucinata: ${q.id}`);
    });
  });

  await suite.test("domanda d'esempio su Gerry Scotti: esatta 1956, allucinata 1920", async () => {
    const gerry = questions.find((q) => q.id === "gerry-scotti");
    assert.ok(gerry, "manca la domanda su Gerry Scotti");
    assert.ok(gerry.exact.includes("1956"));
    assert.ok(gerry.hallucinated.includes("1920"));
  });

  await suite.test("esiti: tre modalità (exact, silence, hallucination), ciascuna con etichetta e spiegazione", async () => {
    assert.deepEqual(modes.map((m) => m.id), ["exact", "silence", "hallucination"]);
    modes.forEach((m) => {
      assert.ok(m.label.trim() && m.explanation.trim(), `esito incompleto: ${m.id}`);
    });
  });

  await suite.test("spiegazioni: il cerchio si chiude (esatta), è impossibile il silenzio, tocca all'utente verificare (allucinata)", async () => {
    assert.ok(outcome.exact.explanation.includes("come un cerchio che si chiude"));
    assert.ok(outcome.silence.explanation.includes("è impossibile che non generi una risposta"));
    assert.ok(outcome.silence.explanation.includes("Il cerchio si deve sempre chiudere."));
    assert.ok(outcome.hallucination.explanation.includes("A un LLM non importa che sia vera o falsa"));
    assert.ok(outcome.hallucination.explanation.includes("Sta all'utente verificare l'autenticità dei fatti."));
    assert.ok(outcome.hallucination.explanation.includes("Il cerchio si deve sempre chiudere."));
  });

  // --- Utilità e componente, nel browser reale ------------------------------
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const utilPage = await (await browser.newContext()).newPage();
  await utilPage.goto(`${server.url}/index.html`, { waitUntil: "domcontentloaded" });

  await suite.test("questionDeck: ogni giro di N estrazioni contiene tutte le domande esattamente una volta", async () => {
    const result = await utilPage.evaluate(async () => {
      const { createQuestionDeck } = await import("/js/utils/questionDeck.js");
      let seed = 7;
      const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const count = 10;
      const deck = createQuestionDeck(count, rng);
      const rounds = [];
      for (let r = 0; r < 20; r += 1) {
        const round = [];
        for (let i = 0; i < count; i += 1) round.push(deck.next(-1));
        rounds.push([...round].sort((a, b) => a - b).join(","));
      }
      return rounds.every((round) => round === "0,1,2,3,4,5,6,7,8,9");
    });
    assert.equal(result, true);
  });

  await suite.test("questionDeck: con 'avoid' non restituisce mai l'indice da evitare, nemmeno al cambio di giro", async () => {
    const bad = await utilPage.evaluate(async () => {
      const { createQuestionDeck } = await import("/js/utils/questionDeck.js");
      let violations = 0;
      [2, 3, 10].forEach((count) => {
        const deck = createQuestionDeck(count);
        let current = deck.next(-1);
        for (let i = 0; i < 3000; i += 1) {
          const next = deck.next(current);
          if (next === current || next < 0 || next >= count) violations += 1;
          current = next;
        }
      });
      return violations;
    });
    assert.equal(bad, 0);
  });

  await suite.test("questionDeck: con una sola domanda restituisce sempre 0 (nessun ciclo infinito)", async () => {
    const values = await utilPage.evaluate(async () => {
      const { createQuestionDeck } = await import("/js/utils/questionDeck.js");
      const deck = createQuestionDeck(1);
      return [deck.next(-1), deck.next(0), deck.next(0)];
    });
    assert.deepEqual(values, [0, 0, 0]);
  });

  await suite.test("Dropdown: mostra il valore, emette sl:change solo se la scelta cambia, update() ridisegna, destroy() rimuove", async () => {
    const result = await utilPage.evaluate(async () => {
      const { create } = await import("/js/components/Dropdown.js");
      const dropdown = create({
        label: "Scelta",
        options: [
          { value: "a", label: "Alfa" },
          { value: "b", label: "Beta" },
          { value: "c", label: "Gamma" },
        ],
        value: "b",
      });
      document.body.appendChild(dropdown.element);
      const events = [];
      dropdown.element.addEventListener("sl:change", (event) => events.push(event.detail.value));
      const trigger = dropdown.element.querySelector(".sl-dropdown__trigger");
      const options = () => Array.from(dropdown.element.querySelectorAll(".sl-dropdown__option"));
      const out = {};

      out.initialText = trigger.textContent.trim();
      out.selectedInitially = options().map((o) => o.getAttribute("aria-selected"));

      trigger.click();
      out.openedExpanded = trigger.getAttribute("aria-expanded");
      options()[2].click();
      out.afterChoice = { text: trigger.textContent.trim(), expanded: trigger.getAttribute("aria-expanded"), events: [...events] };

      trigger.click();
      options()[2].click(); // stessa scelta: nessun evento
      out.eventsAfterSame = [...events];

      dropdown.update({ options: [{ value: "x", label: "Xeno" }, { value: "y", label: "Ypsilon" }], value: "y" });
      out.afterUpdate = { text: trigger.textContent.trim(), count: options().length };

      dropdown.destroy();
      out.removed = !document.body.contains(dropdown.element);
      return out;
    });
    assert.equal(result.initialText, "Beta");
    assert.deepEqual(result.selectedInitially, ["false", "true", "false"]);
    assert.equal(result.openedExpanded, "true");
    assert.deepEqual(result.afterChoice, { text: "Gamma", expanded: "false", events: ["c"] });
    assert.deepEqual(result.eventsAfterSame, ["c"]);
    assert.deepEqual(result.afterUpdate, { text: "Ypsilon", count: 2 });
    assert.equal(result.removed, true);
  });

  await utilPage.context().close();

  // --- Renderer, movimento pieno ---------------------------------------------
  const requests = [];
  const failedLocal = [];
  const pageErrors = [];
  const consoleErrors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.url().startsWith(server.url) && response.status() >= 400) failedLocal.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await loginAsDocente(page, server.url);
  await openScenarioViaSidebar(page, "AI", "Allucinazioni");
  await page.waitForSelector(SELECTOR.root);
  await page.waitForTimeout(150); // lascia esaurire il doppio rAF del fade-in di pagina

  // Orologio finto, FERMO: i passi avanzano solo con runFor().
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);

  await suite.test("apertura dalla Sidebar: #/scenario/allucinazioni, h1 'Allucinazioni', Sidebar presente (chrome standard)", async () => {
    assert.equal(await page.evaluate(() => window.location.hash), "#/scenario/allucinazioni");
    assert.equal((await page.locator(`${SELECTOR.root} h1`).textContent()).trim(), "Allucinazioni");
    assert.equal(await page.locator(".sl-sidebar").count(), 1);
    assert.equal(await page.locator(".sl-llm-cycle__title").count(), 1);
  });

  await suite.test("stato a riposo: 3 switch con le etichette di outcomes.json, nessuno premuto; cerchio spento; spiegazione nascosta", async () => {
    const labels = await page.locator(".sl-llm-cycle__mode").allTextContents();
    assert.deepEqual(labels.map((t) => t.trim()), modes.map((m) => m.label));
    assert.deepEqual(await pressedModes(page), []);
    assert.deepEqual(await partStates(page), expectedStates({}));
    assert.equal(await page.locator(SELECTOR.root).getAttribute("data-step"), "idle");
    assert.equal(await page.locator(SELECTOR.explanation).isHidden(), true);
    assert.equal((await page.locator(SELECTOR.answerText).textContent()).trim(), "—");
  });

  await suite.test("la Richiesta mostra la domanda scelta nel menu (anche all'apertura, estratta a caso)", async () => {
    const triggerText = (await page.locator(".sl-dropdown__value").textContent()).trim();
    const requestText = (await page.locator(SELECTOR.requestText).textContent()).trim();
    assert.equal(requestText, triggerText);
    assert.ok(questions.some((q) => q.text === requestText));
  });

  await suite.test("etichette delle frecce: 'Elaborazione' (andata) e 'genera risposta' (ritorno)", async () => {
    assert.equal(plain(await page.locator(SELECTOR.processLabel).textContent()), "Elaborazione");
    assert.equal(plain(await page.locator(".sl-llm-cycle__side--left .sl-llm-cycle__arrow-label").textContent()), "genera risposta");
  });

  await suite.test("nome accessibile del menu: etichetta + domanda corrente; gruppo degli switch; regione di stato aria-live", async () => {
    const name = await page.evaluate(() => {
      const trigger = document.querySelector(".sl-dropdown__trigger");
      return trigger
        .getAttribute("aria-labelledby")
        .split(" ")
        .map((id) => document.getElementById(id).textContent.trim())
        .join(" ");
    });
    const current = (await page.locator(SELECTOR.requestText).textContent()).trim();
    assert.equal(name, `Domanda ${current}`);
    assert.equal(await page.locator(".sl-llm-cycle__modes").getAttribute("role"), "group");
    assert.equal(await page.locator(SELECTOR.status).getAttribute("aria-live"), "polite");
  });

  // Da qui si lavora sulla domanda 0 (Gerry Scotti), la stessa dell'esempio.
  await chooseQuestion(page, 0);
  const gerry = questions[0];

  async function stepBy(ms) {
    await page.clock.runFor(ms);
  }

  async function expectOnlyLit(part, message) {
    assert.deepEqual(await partStates(page), expectedStates({ [part]: "lit" }), message);
  }

  for (const [modeId, answerKey] of [
    ["exact", "exact"],
    ["hallucination", "hallucinated"],
  ]) {
    await suite.test(`${modeId}: ogni passo accende UNA parte e spegne la precedente (richiesta → elaborazione → risposta → genera risposta)`, async () => {
      await page.click(mode(modeId));
      await expectOnlyLit("request", "all'inizio solo la Richiesta è accesa");
      await stepBy(STEP - 1);
      await expectOnlyLit("request", "prima di stepMs non cambia nulla");
      await stepBy(1);
      await expectOnlyLit("process", "la freccia Elaborazione si accende e la Richiesta si spegne");
      await stepBy(STEP);
      await expectOnlyLit("answer", "la Risposta si accende e la freccia di andata si spegne");
      await stepBy(STEP);
      await expectOnlyLit("generate", "la freccia 'genera risposta' si accende e la Risposta si spegne");
    });

    await suite.test(`${modeId}: etichetta 'Elaborazione in corso…' solo nel passo di elaborazione; la risposta NON compare prima del cerchio chiuso`, async () => {
      await page.click(mode(modeId));
      const seen = [];
      for (let i = 0; i < 4; i += 1) {
        seen.push({
          label: plain(await page.locator(SELECTOR.processLabel).textContent()),
          answer: (await page.locator(SELECTOR.answerText).textContent()).trim(),
          explanationHidden: await page.locator(SELECTOR.explanation).isHidden(),
        });
        await stepBy(STEP);
      }
      assert.deepEqual(
        seen.map((s) => s.label),
        ["Elaborazione", "Elaborazione in corso…", "Elaborazione", "Elaborazione"]
      );
      seen.forEach((s) => {
        assert.equal(s.answer, "—", "il testo della risposta è comparso prima della chiusura del cerchio");
        assert.equal(s.explanationHidden, true, "la spiegazione è comparsa prima della chiusura del cerchio");
      });
    });

    await suite.test(`${modeId}: a cerchio chiuso le quattro parti sono 'done', compaiono la risposta giusta e la spiegazione di outcomes.json`, async () => {
      await page.click(mode(modeId));
      await stepBy(STEP * 4 - 1);
      assert.equal(await page.locator(SELECTOR.explanation).isHidden(), true, "spiegazione visibile un istante prima della chiusura");
      await stepBy(1);
      assert.deepEqual(await partStates(page), { request: "done", process: "done", answer: "done", generate: "done" });
      assert.equal(await page.locator(SELECTOR.root).getAttribute("data-step"), "complete");
      assert.equal((await page.locator(SELECTOR.answerText).textContent()).trim(), gerry[answerKey]);
      assert.equal(await page.locator(SELECTOR.explanation).isVisible(), true);
      assert.equal((await page.locator(".sl-llm-cycle__explanation-text").textContent()).trim(), outcome[modeId].explanation);
      assert.deepEqual(await pressedModes(page), [modeId]);
    });

    await suite.test(`${modeId}: la regione di stato annuncia la risposta e la spiegazione a cerchio chiuso`, async () => {
      const status = (await page.locator(SELECTOR.status).textContent()).trim();
      assert.ok(status.includes(gerry[answerKey]), `annuncio senza la risposta: ${status}`);
      assert.ok(status.includes(outcome[modeId].explanation));
    });

    await suite.test(`${modeId}: dopo la chiusura non succede più nulla (nessun passo in più)`, async () => {
      await stepBy(STEP * 5);
      assert.equal(await page.locator(SELECTOR.root).getAttribute("data-step"), "complete");
    });
  }

  await suite.test("silence: Richiesta → freccia Elaborazione, poi il cerchio resta aperto (Risposta vuota, ritorno interrotto)", async () => {
    await page.click(mode("silence"));
    await expectOnlyLit("request");
    await stepBy(STEP);
    await expectOnlyLit("process");
    assert.equal(plain(await page.locator(SELECTOR.processLabel).textContent()), "Elaborazione in corso…");
    assert.equal(await page.locator(SELECTOR.explanation).isHidden(), true, "spiegazione prima del tempo");
    await stepBy(STEP);
    assert.deepEqual(await partStates(page), { request: "off", process: "lit", answer: "empty", generate: "broken" });
    assert.equal(await page.locator(SELECTOR.root).getAttribute("data-step"), "stalled");
  });

  await suite.test("silence: mostra 'Nessun output', la spiegazione del silenzio e NESSUNA risposta (né esatta né allucinata)", async () => {
    assert.equal((await page.locator(SELECTOR.answerText).textContent()).trim(), "Nessun output");
    assert.equal((await page.locator(".sl-llm-cycle__explanation-text").textContent()).trim(), outcome.silence.explanation);
    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(!bodyText.includes(gerry.exact) && !bodyText.includes(gerry.hallucinated), "una risposta è comparsa nel caso 'nessuna risposta'");
    const status = (await page.locator(SELECTOR.status).textContent()).trim();
    assert.ok(status.startsWith("Nessuna risposta generata."));
  });

  await suite.test("silence: resta fermo anche con molto tempo in più (il cerchio non si chiude mai)", async () => {
    await stepBy(STEP * 10);
    assert.deepEqual(await partStates(page), { request: "off", process: "lit", answer: "empty", generate: "broken" });
  });

  await suite.test("click su un altro switch a metà corsa: ricomincia dalla Richiesta e il vecchio timer non scatta più", async () => {
    await page.click(mode("exact"));
    await stepBy(STEP); // elaborazione
    await expectOnlyLit("process");
    await page.click(mode("hallucination"));
    await expectOnlyLit("request", "il nuovo percorso riparte dalla Richiesta");
    assert.equal(await page.locator(SELECTOR.explanation).isHidden(), true);
    assert.deepEqual(await pressedModes(page), ["hallucination"]);
    await stepBy(STEP - 1);
    await expectOnlyLit("request", "è scattato il timer del percorso precedente");
    await stepBy(1);
    await expectOnlyLit("process");
  });

  await suite.test("click di nuovo sullo switch già premuto, a cerchio chiuso: l'animazione ricomincia da capo", async () => {
    await stepBy(STEP * 4);
    assert.equal(await page.locator(SELECTOR.root).getAttribute("data-step"), "complete");
    await page.click(mode("hallucination"));
    await expectOnlyLit("request");
    assert.equal((await page.locator(SELECTOR.answerText).textContent()).trim(), "—");
    assert.equal(await page.locator(SELECTOR.explanation).isHidden(), true);
  });

  await suite.test("cambiare domanda a metà corsa riporta tutto a riposo: nessuno switch premuto, niente timer residui", async () => {
    await stepBy(STEP); // in corso
    await chooseQuestion(page, 4);
    assert.deepEqual(await pressedModes(page), []);
    assert.deepEqual(await partStates(page), expectedStates({}));
    assert.equal(await page.locator(SELECTOR.root).getAttribute("data-step"), "idle");
    assert.equal((await page.locator(SELECTOR.requestText).textContent()).trim(), questions[4].text);
    await stepBy(STEP * 10);
    assert.deepEqual(await partStates(page), expectedStates({}), "un timer vecchio ha riacceso qualcosa");
  });

  await suite.test("la risposta mostrata è quella della domanda scelta (non quella della precedente)", async () => {
    await page.click(mode("exact"));
    await stepBy(STEP * 4);
    assert.equal((await page.locator(SELECTOR.answerText).textContent()).trim(), questions[4].exact);
    await chooseQuestion(page, 7);
    await page.click(mode("hallucination"));
    await stepBy(STEP * 4);
    assert.equal((await page.locator(SELECTOR.answerText).textContent()).trim(), questions[7].hallucinated);
  });

  await suite.test("'Casuale': la domanda cambia sempre, ogni giro di 10 le tocca tutte, e riporta il cerchio a riposo", async () => {
    await page.click(mode("exact"));
    let previous = (await page.locator(SELECTOR.requestText).textContent()).trim();
    const seen = new Set([previous]);
    for (let i = 0; i < 40; i += 1) {
      await page.click(SELECTOR.random);
      const current = (await page.locator(SELECTOR.requestText).textContent()).trim();
      assert.notEqual(current, previous, `la domanda è rimasta uguale al click ${i + 1}`);
      assert.equal((await page.locator(".sl-dropdown__value").textContent()).trim(), current, "il menu non segue la domanda casuale");
      seen.add(current);
      previous = current;
    }
    assert.equal(seen.size, questions.length, "in 40 estrazioni non sono uscite tutte le domande");
    assert.deepEqual(await pressedModes(page), []);
    assert.deepEqual(await partStates(page), expectedStates({}));
  });

  // --- Menu da tastiera ------------------------------------------------------
  await chooseQuestion(page, 0);

  const listState = () =>
    page.evaluate(() => {
      const list = document.querySelector(".sl-dropdown__list");
      return {
        expanded: document.querySelector(".sl-dropdown__trigger").getAttribute("aria-expanded"),
        hidden: list.hidden,
        active: list.getAttribute("aria-activedescendant"),
        focusOnList: document.activeElement === list,
        focusOnTrigger: document.activeElement === document.querySelector(".sl-dropdown__trigger"),
      };
    });

  await suite.test("tastiera: Invio sul trigger apre la lista, focus sulla lista, opzione attiva = quella scelta", async () => {
    await page.focus(SELECTOR.trigger);
    await page.keyboard.press("Enter");
    const state = await listState();
    assert.equal(state.expanded, "true");
    assert.equal(state.hidden, false);
    assert.equal(state.focusOnList, true);
    assert.ok(state.active.endsWith("-option-0"), `opzione attiva iniziale: ${state.active}`);
    assert.equal(await page.locator(`${SELECTOR.option}[aria-selected="true"]`).count(), 1);
  });

  await suite.test("tastiera: frecce, Home e End spostano l'opzione attiva (senza uscire dai limiti)", async () => {
    const active = async () => (await listState()).active.match(/option-(\d+)$/)[1];
    await page.keyboard.press("ArrowDown");
    assert.equal(await active(), "1");
    await page.keyboard.press("End");
    assert.equal(await active(), String(questions.length - 1));
    await page.keyboard.press("ArrowDown");
    assert.equal(await active(), String(questions.length - 1), "ArrowDown oltre l'ultima");
    await page.keyboard.press("Home");
    assert.equal(await active(), "0");
    await page.keyboard.press("ArrowUp");
    assert.equal(await active(), "0", "ArrowUp prima della prima");
  });

  await suite.test("tastiera: Invio sceglie l'opzione attiva, chiude e riporta il focus sul trigger; la domanda cambia", async () => {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const state = await listState();
    assert.equal(state.expanded, "false");
    assert.equal(state.focusOnTrigger, true);
    assert.equal((await page.locator(".sl-dropdown__value").textContent()).trim(), questions[2].text);
    assert.equal((await page.locator(SELECTOR.requestText).textContent()).trim(), questions[2].text);
  });

  await suite.test("tastiera: Escape chiude senza cambiare la scelta e restituisce il focus al trigger; ArrowDown sul trigger apre", async () => {
    await page.focus(SELECTOR.trigger);
    await page.keyboard.press("ArrowDown");
    assert.equal((await listState()).expanded, "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    const state = await listState();
    assert.equal(state.expanded, "false");
    assert.equal(state.focusOnTrigger, true);
    assert.equal((await page.locator(".sl-dropdown__value").textContent()).trim(), questions[2].text);
  });

  await suite.test("mouse: un click fuori chiude la lista senza rubare il focus al punto in cui si è cliccato", async () => {
    await page.click(SELECTOR.trigger);
    assert.equal((await listState()).expanded, "true");
    await page.mouse.click(1250, 700); // sfondo vuoto, a destra del contenuto
    const state = await listState();
    assert.equal(state.expanded, "false");
    assert.equal(state.focusOnTrigger, false);
  });

  await suite.test("spazio e Tab: Spazio sceglie; Tab chiude la lista e lascia proseguire il focus", async () => {
    await page.focus(SELECTOR.trigger);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home");
    await page.keyboard.press("Space");
    assert.equal((await page.locator(".sl-dropdown__value").textContent()).trim(), questions[0].text);
    await page.keyboard.press("Enter");
    assert.equal((await listState()).expanded, "true");
    await page.keyboard.press("Tab");
    assert.equal((await listState()).expanded, "false");
  });

  // --- Colori e transizioni: gli stati CSS si applicano davvero ----------------
  await suite.test("stili: nodo acceso, spento e 'done' hanno bordi diversi; la freccia accesa cambia colore", async () => {
    await page.click(mode("exact"));
    await page.waitForTimeout(450); // fine transizioni (200ms)
    const styleOf = (selector) =>
      page.evaluate((sel) => {
        const style = getComputedStyle(document.querySelector(sel));
        return { border: style.borderTopColor, shadow: style.boxShadow, background: style.backgroundColor };
      }, selector);
    const litRequest = await styleOf('.sl-llm-cycle [data-part="request"]');
    const offAnswer = await styleOf('.sl-llm-cycle [data-part="answer"]');
    assert.notEqual(litRequest.border, offAnswer.border, "bordo uguale tra nodo acceso e spento");
    assert.notEqual(litRequest.shadow, offAnswer.shadow, "manca l'alone sul nodo acceso");
    assert.notEqual(litRequest.background, offAnswer.background, "manca la tinta sul nodo acceso");

    await stepBy(STEP);
    await page.waitForTimeout(450);
    const litArrow = await styleOf('.sl-llm-cycle [data-part="process"]');
    const offArrow = await styleOf('.sl-llm-cycle [data-part="generate"]');
    assert.notEqual(litArrow.border, offArrow.border, "colore uguale tra freccia accesa e spenta");

    await stepBy(STEP * 3);
    await page.waitForTimeout(450);
    const doneRequest = await styleOf('.sl-llm-cycle [data-part="request"]');
    assert.equal(doneRequest.border, litArrow.border, "il bordo 'done' non usa lo stesso primary-500 del passo acceso");
    assert.notEqual(doneRequest.shadow, litRequest.shadow, "il nodo 'done' non dovrebbe avere l'alone");
  });

  await suite.test("tratteggi: Risposta vuota e freccia di ritorno interrotta nel caso 'nessuna risposta'", async () => {
    await page.click(mode("silence"));
    await stepBy(STEP * 2);
    await page.waitForTimeout(450);
    const styles = await page.evaluate(() => ({
      answer: getComputedStyle(document.querySelector('.sl-llm-cycle [data-part="answer"]')).borderTopStyle,
      generate: getComputedStyle(document.querySelector('.sl-llm-cycle [data-part="generate"]')).borderTopStyle,
      process: getComputedStyle(document.querySelector('.sl-llm-cycle [data-part="process"]')).borderTopStyle,
    }));
    assert.deepEqual(styles, { answer: "dashed", generate: "dashed", process: "solid" });
  });

  // --- Ingombro dei testi su più larghezze --------------------------------------
  async function measureLayout() {
    return page.evaluate(() => {
      const problems = [];
      document.querySelectorAll(".sl-llm-cycle__node").forEach((node) => {
        if (node.scrollHeight > node.clientHeight + 1) problems.push(`testo tagliato in ${node.dataset.part}`);
        if (node.scrollWidth > node.clientWidth + 1) problems.push(`testo troppo largo in ${node.dataset.part}`);
      });
      const ring = document.querySelector(".sl-llm-cycle__ring").getBoundingClientRect();
      document.querySelectorAll(".sl-llm-cycle__arrow-label").forEach((label) => {
        const rect = label.getBoundingClientRect();
        if (rect.left < ring.left - 1 || rect.right > ring.right + 1) problems.push("etichetta fuori dal cerchio");
      });
      const nodeRects = Array.from(document.querySelectorAll(".sl-llm-cycle__node")).map((n) => n.getBoundingClientRect());
      document.querySelectorAll(".sl-llm-cycle__arrow-label").forEach((label) => {
        const rect = label.getBoundingClientRect();
        nodeRects.forEach((n) => {
          const overlapX = rect.left < n.right && rect.right > n.left;
          const overlapY = rect.top < n.bottom && rect.bottom > n.top;
          if (overlapX && overlapY) problems.push("etichetta sovrapposta a un nodo");
        });
      });
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) problems.push("overflow orizzontale della pagina");
      return problems;
    });
  }

  for (const width of [1280, 768, 375]) {
    await suite.test(`larghezza ${width}px: tutte le ${questions.length} domande, con risposta esatta e allucinata, entrano nei nodi senza tagli né sovrapposizioni`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const all = [];
      for (let i = 0; i < questions.length; i += 1) {
        await chooseQuestion(page, i);
        for (const modeId of ["exact", "hallucination", "silence"]) {
          await page.click(mode(modeId));
          await stepBy(STEP * 4);
          (await measureLayout()).forEach((problem) => all.push(`${questions[i].id}/${modeId}: ${problem}`));
        }
      }
      assert.deepEqual(all, []);
    });
  }

  // --- Screenshot (Light, Dark, mobile) ------------------------------------------
  await page.setViewportSize({ width: 1280, height: 900 });
  await chooseQuestion(page, 0);
  await suite.test("screenshot — a riposo, passo di elaborazione, cerchio chiuso, nessuna risposta (Light)", async () => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-idle-light.png"), fullPage: true });
    await page.click(mode("exact"));
    await stepBy(STEP);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-process-light.png"), fullPage: true });
    await stepBy(STEP * 3);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-exact-light.png"), fullPage: true });
    await page.click(mode("silence"));
    await stepBy(STEP * 2);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-silence-light.png"), fullPage: true });
  });

  await suite.test("screenshot — risposta allucinata a cerchio chiuso e menu aperto (Dark)", async () => {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.click(mode("hallucination"));
    await stepBy(STEP * 4);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-hallucination-dark.png"), fullPage: true });
    await page.click(SELECTOR.trigger);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-dropdown-dark.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  });

  await suite.test("screenshot — mobile 375px con la domanda più lunga, nessun overflow orizzontale", async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    const longest = questions.reduce((best, q, i) => (q.exact.length > questions[best].exact.length ? i : best), 0);
    await chooseQuestion(page, longest);
    await page.click(mode("exact"));
    await stepBy(STEP * 4);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "llm-mobile-375.png"), fullPage: true });
    assert.deepEqual(await measureLayout(), []);
  });

  await suite.test("console e rete: nessun errore JS, nessuna risposta HTTP ≥400 locale durante tutto il percorso", async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedLocal, []);
  });

  await suite.test("nessuna richiesta verso l'esterno: solo i tre JSON locali dello scenario", async () => {
    assert.ok(requests.some((url) => url.endsWith("questions.json")) && requests.some((url) => url.endsWith("outcomes.json")));
    assert.ok(requests.some((url) => url.endsWith("allucinazioni/scenario.json")));
    const external = requests.filter((url) => !url.startsWith(server.url) && !url.startsWith("data:") && !url.startsWith("blob:"));
    assert.deepEqual(external, []);
  });

  await context.close();

  // --- "riduci animazioni" -----------------------------------------------------------
  const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await loginAsDocente(reducedPage, server.url);
  await openScenarioViaSidebar(reducedPage, "AI", "Allucinazioni");
  await reducedPage.waitForSelector(SELECTOR.root);
  await reducedPage.waitForTimeout(150);
  await reducedPage.clock.install({ time: 1_000_000 });
  await reducedPage.clock.pauseAt(1_001_000);

  await suite.test("riduci animazioni: le transizioni CSS spariscono ma i passi durano uguale (sono narrazione, non decorazione)", async () => {
    await chooseQuestion(reducedPage, 0);
    const duration = await reducedPage.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sl-llm-cycle [data-part="request"]')).transitionDuration));
    assert.ok(duration <= 0.001, `transizione ancora attiva: ${duration}s`);
    await reducedPage.click(mode("exact"));
    await reducedPage.clock.runFor(STEP - 1);
    assert.deepEqual(await partStates(reducedPage), expectedStates({ request: "lit" }));
    await reducedPage.clock.runFor(1);
    assert.deepEqual(await partStates(reducedPage), expectedStates({ process: "lit" }));
    await reducedPage.clock.runFor(STEP * 3);
    assert.deepEqual(await partStates(reducedPage), { request: "done", process: "done", answer: "done", generate: "done" });
  });

  await reducedContext.close();

  // --- Degrado controllato -------------------------------------------------------------
  async function openWith(routeSuffix, body) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await loginAsDocente(p, server.url);
    await p.route(`**/${routeSuffix}`, (route) =>
      body === undefined
        ? route.fulfill({ status: 404, body: "not found" })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
    );
    await p.goto(`${server.url}/#/scenario/allucinazioni`);
    await p.waitForSelector(".sl-scenario-viewport p");
    return { ctx, p, errors };
  }

  const FALLBACK = "Questo scenario non è disponibile al momento.";

  await suite.test("questions.json non raggiungibile: messaggio di fallback, nessuna interfaccia a metà", async () => {
    const { ctx, p, errors } = await openWith("questions.json");
    assert.equal((await p.locator(".sl-scenario-viewport p").textContent()).trim(), FALLBACK);
    assert.equal(await p.locator(SELECTOR.root).count(), 0);
    assert.ok(errors.length > 0, "il guasto non è stato segnalato in console");
    await ctx.close();
  });

  await suite.test("outcomes.json non raggiungibile: messaggio di fallback", async () => {
    const { ctx, p } = await openWith("outcomes.json");
    assert.equal((await p.locator(".sl-scenario-viewport p").textContent()).trim(), FALLBACK);
    assert.equal(await p.locator(SELECTOR.root).count(), 0);
    await ctx.close();
  });

  await suite.test("outcomes.json senza uno dei tre esiti (silence): fallback invece di uno scenario che si rompe a metà", async () => {
    const incomplete = { modes: modes.filter((m) => m.id !== "silence") };
    const { ctx, p, errors } = await openWith("outcomes.json", incomplete);
    assert.equal((await p.locator(".sl-scenario-viewport p").textContent()).trim(), FALLBACK);
    assert.equal(await p.locator(SELECTOR.root).count(), 0);
    assert.ok(errors.some((text) => text.includes("Dati non validi")), "manca l'errore di validazione in console");
    await ctx.close();
  });

  await suite.test("questions.json con una domanda priva della risposta allucinata: fallback", async () => {
    const broken = { questions: [{ id: "x", text: "Domanda?", exact: "Risposta." }] };
    const { ctx, p } = await openWith("questions.json", broken);
    assert.equal((await p.locator(".sl-scenario-viewport p").textContent()).trim(), FALLBACK);
    await ctx.close();
  });

  await suite.test("una sola domanda nei dati: lo scenario funziona e 'Casuale' non si blocca", async () => {
    const single = { questions: [questions[0]] };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await loginAsDocente(p, server.url);
    await p.route("**/questions.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single) }));
    await p.goto(`${server.url}/#/scenario/allucinazioni`);
    await p.waitForSelector(SELECTOR.root);
    await p.click(SELECTOR.random);
    assert.equal((await p.locator(SELECTOR.requestText).textContent()).trim(), questions[0].text);
    await ctx.close();
  });

  // --- Smontaggio -------------------------------------------------------------------------
  await suite.test("smontaggio: lasciare la pagina a metà corsa, o con il menu aperto, non lascia errori né timer orfani", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await loginAsDocente(p, server.url);
    await openScenarioViaSidebar(p, "AI", "Allucinazioni");
    await p.waitForSelector(SELECTOR.root);
    await p.waitForTimeout(150);
    await p.click(mode("exact"));
    await p.click(SELECTOR.trigger); // menu aperto mentre si naviga via
    await p.click(".sl-sidebar__link[href='#/home']");
    await p.waitForSelector(".sl-home-page__content");
    await p.mouse.click(1250, 700); // pointerdown dopo lo smontaggio: nessun listener orfano
    await p.waitForTimeout(STEP * 5 + 200); // oltre l'intera sequenza interrotta
    assert.equal(await p.locator(SELECTOR.root).count(), 0);
    assert.equal(await p.locator(".sl-dropdown").count(), 0);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await browser.close();
  await server.close();
  return suite.summary();
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
