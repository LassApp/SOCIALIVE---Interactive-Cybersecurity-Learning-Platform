/**
 * token.spec.js
 * -----------------------------------------------------------------------
 * Scenario "Tokenizzazione" (type "token-prediction"), in tre parti:
 *   1. DATI (albero, vocabolario) e UTILITÀ PURE (tokenProbability.js,
 *      tokenText.js, tokenMotion.js): eseguite nel browser reale
 *      (import dinamico dal server di test) e non in Node — sono moduli
 *      ES pensati per il browser, e così il test non dipende dalla
 *      versione di Node di chi lo esegue.
 *   2. RENDERER con movimento pieno: login reale, percorso dalla Sidebar
 *      (Scenari → AI → Tokenizzazione), animazione, Rigenera, Prosegui.
 *   3. RENDERER con "riduci animazioni", mobile 375px, vista token,
 *      tastiera, degrado controllato (file mancanti) e smontaggio.
 * Richiede SL_TEST_EMAIL / SL_TEST_PASSWORD come le altre suite.
 *
 * I controlli sui dati hanno uno scopo preciso, oltre alla correttezza:
 * sono la rete di sicurezza contro un albero modificato a mano che
 * produca frasi che non finiscono, scelte a un solo candidato o parole
 * senza tokenizzazione nel vocabolario (lo stesso principio già
 * applicato altrove: un test fallisce prima che lo scopra la LIM).
 *
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente } = require("./helpers/auth");
const { openScenarioViaSidebar } = require("./helpers/sidebar");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const APP_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(APP_ROOT, "data", "scenarios", "tokenizzazione");
const END_TOKENS = [".", "!", "?"];

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
}

// Tutte le frasi possibili: ogni percorso radice → foglia, come array di token.
function collectPaths(tree) {
  const paths = [];
  (function walk(node, trail) {
    const here = [...trail, node.token];
    if (!node.children) {
      paths.push(here);
      return;
    }
    node.children.forEach((child) => walk(child, here));
  })({ token: tree.root, children: tree.children }, []);
  return paths;
}

// Visita ogni nodo con il proprio livello di profondità (la radice è 0).
function forEachNode(tree, visit) {
  (function walk(node, depth) {
    visit(node, depth);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  })({ token: tree.root, children: tree.children }, 0);
}

async function run() {
  const suite = createSuite("token.spec.js");

  const scenario = readJson("scenario.json");
  const tree = readJson("token-tree.json");
  const vocab = readJson("token-vocab.json");
  const paths = collectPaths(tree);

  // --- scenario.json --------------------------------------------------
  await suite.test("scenario.json: id, type e dataRefs puntano a file esistenti", async () => {
    assert.equal(scenario.id, "tokenizzazione");
    assert.equal(scenario.type, "token-prediction");
    Object.values(scenario.dataRefs).forEach((ref) => {
      assert.ok(fs.existsSync(path.join(APP_ROOT, ref)), `dataRef inesistente: ${ref}`);
    });
  });

  // --- albero ---------------------------------------------------------
  await suite.test("albero: ogni nodo con figli ha almeno 2 candidati, tutti con token diverso", async () => {
    forEachNode(tree, (node) => {
      if (!node.children) return;
      assert.ok(node.children.length >= 2, `"${node.token}" ha un solo candidato: nessuna scelta da mostrare`);
      const tokens = node.children.map((child) => child.token);
      assert.equal(new Set(tokens).size, tokens.length, `candidati duplicati sotto "${node.token}"`);
    });
    assert.ok(tree.children.length >= 2);
  });

  await suite.test("albero: ogni frase finisce con un token finale e i token finali non hanno figli", async () => {
    paths.forEach((trail) => {
      assert.ok(END_TOKENS.includes(trail[trail.length - 1]), `la frase "${trail.join(" ")}" non finisce con un token finale`);
    });
    forEachNode(tree, (node) => {
      if (END_TOKENS.includes(node.token)) {
        assert.ok(!node.children, `il token finale "${node.token}" non può avere figli`);
      }
    });
  });

  await suite.test("albero: nessun token vuoto o con spazi ai bordi (gli spazi li decide tokenText.js)", async () => {
    forEachNode(tree, (node) => {
      assert.ok(node.token.length > 0 && node.token === node.token.trim(), `token non valido: ${JSON.stringify(node.token)}`);
    });
    assert.equal(tree.root, tree.root.trim());
  });

  await suite.test("albero: dinamico — molte frasi, lunghezze e numero di candidati variabili", async () => {
    assert.ok(paths.length >= 100, `solo ${paths.length} frasi possibili`);
    const lengths = new Set(paths.map((trail) => trail.length));
    assert.ok(lengths.size >= 5, `frasi di sole ${lengths.size} lunghezze diverse`);
    assert.ok(tree.children.length >= 4, "la radice dovrebbe offrire almeno 4 strade");
    const branching = new Set();
    forEachNode(tree, (node) => node.children && branching.add(node.children.length));
    assert.ok(branching.size >= 3, "il numero di candidati per step dovrebbe variare");
  });

  // --- vocabolario ----------------------------------------------------
  await suite.test("vocabolario: copre ogni token dell'albero (altrimenti: npm run build:token-vocab in tools/)", async () => {
    const missing = new Set();
    paths.flat().forEach((token) => {
      if (!vocab.tokens[token]) missing.add(token);
    });
    assert.equal(missing.size, 0, `token senza tokenizzazione: ${[...missing].join(", ")}`);
  });

  await suite.test("vocabolario: pezzi ricomponibili nel token (con e senza spazio) e ID interi non negativi", async () => {
    Object.entries(vocab.tokens).forEach(([token, forms]) => {
      [["plain", token], ["spaced", ` ${token}`]].forEach(([formName, expectedText]) => {
        const form = forms[formName];
        assert.equal(form.pieces.join(""), expectedText, `"${token}" (${formName}): i pezzi non ricompongono il testo`);
        assert.equal(form.ids.length, form.pieces.length, `"${token}" (${formName}): ID e pezzi disallineati`);
        form.ids.forEach((id) => assert.ok(Number.isInteger(id) && id >= 0, `ID non valido per "${token}"`));
      });
    });
    assert.equal(vocab.encoding, "o200k_base");
  });

  // --- utility, nel browser reale -------------------------------------
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${server.url}/index.html`, { waitUntil: "domcontentloaded" });

  await suite.test("normalizeToMilli: somma sempre esattamente 100000, interi, minimo rispettato", async () => {
    const result = await page.evaluate(async () => {
      const { normalizeToMilli, TOTAL_MILLI } = await import("/js/utils/tokenProbability.js");
      let bad = 0;
      for (let i = 0; i < 5000; i += 1) {
        const count = 2 + (i % 7);
        const weights = Array.from({ length: count }, () => (Math.random() < 0.2 ? 0 : Math.random() ** 6));
        [0, 1].forEach((minEach) => {
          const out = normalizeToMilli(weights, minEach);
          const sum = out.reduce((a, b) => a + b, 0);
          if (sum !== TOTAL_MILLI || out.length !== count || out.some((v) => !Number.isInteger(v) || v < minEach)) bad += 1;
        });
      }
      return { bad, allZero: normalizeToMilli([0, 0, 0, 0]) };
    });
    assert.equal(result.bad, 0);
    assert.deepEqual(result.allZero, [25000, 25000, 25000, 25000]);
  });

  await suite.test("normalizeToMilli: il resto va ai decimali più grandi ([1,1,1] → 33334/33333/33333)", async () => {
    const out = await page.evaluate(async () => {
      const { normalizeToMilli } = await import("/js/utils/tokenProbability.js");
      return normalizeToMilli([1, 1, 1]);
    });
    assert.deepEqual(out, [33334, 33333, 33333]);
  });

  await suite.test("formatMilliPercent: formato italiano a 3 decimali (0,001% … 100,000%)", async () => {
    const out = await page.evaluate(async () => {
      const { formatMilliPercent } = await import("/js/utils/tokenProbability.js");
      return [87412, 1, 5, 100000, 12000, 999, 50000].map(formatMilliPercent);
    });
    assert.deepEqual(out, ["87,412", "0,001", "0,005", "100,000", "12,000", "0,999", "50,000"]);
  });

  await suite.test("pickWinnerIndex: restituisce il candidato con la percentuale più alta", async () => {
    const out = await page.evaluate(async () => {
      const { pickWinnerIndex } = await import("/js/utils/tokenProbability.js");
      return [pickWinnerIndex([10000, 70000, 20000]), pickWinnerIndex([60000, 30000, 10000]), pickWinnerIndex([5, 5, 99990])];
    });
    assert.deepEqual(out, [1, 0, 2]);
  });

  await suite.test("generateDistribution (20000 estrazioni, 2–6 candidati): somma 100,000%, minimo 0,001%, vincitore netto", async () => {
    const stats = await page.evaluate(async () => {
      const { generateDistribution, TOTAL_MILLI, MIN_MILLI } = await import("/js/utils/tokenProbability.js");
      const stats = { bad: 0, tiny: 0, dominant: 0, modest: 0, minSeen: TOTAL_MILLI };
      for (let i = 0; i < 20000; i += 1) {
        const count = 2 + (i % 5);
        const d = generateDistribution(count);
        const sorted = [...d].sort((a, b) => b - a);
        const ok =
          d.length === count &&
          d.every((v) => Number.isInteger(v) && v >= MIN_MILLI) &&
          d.reduce((a, b) => a + b, 0) === TOTAL_MILLI &&
          sorted[0] - sorted[1] >= 5000;
        if (!ok) stats.bad += 1;
        stats.minSeen = Math.min(stats.minSeen, sorted[sorted.length - 1]);
        if (sorted[sorted.length - 1] <= 10) stats.tiny += 1; // un candidato ≤ 0,010%
        if (sorted[0] >= 90000) stats.dominant += 1; // un candidato ≥ 90%
        if (sorted[0] < 50000) stats.modest += 1; // nessuno oltre il 50%
      }
      return stats;
    });
    assert.equal(stats.bad, 0);
    assert.ok(stats.tiny > 0, "mai comparso un candidato vicino allo 0,001%: la coda lunga manca");
    assert.ok(stats.dominant > 0, "mai comparso un candidato dominante (≥ 90%)");
    assert.ok(stats.modest > 0, "mai comparsa una distribuzione senza candidato oltre il 50%");
    assert.ok(stats.minSeen >= 1);
  });

  await suite.test("Rigenera (5000 coppie): la nuova distribuzione differisce di almeno 1 punto e rispetta i vincoli", async () => {
    const bad = await page.evaluate(async () => {
      const { generateDistribution, TOTAL_MILLI } = await import("/js/utils/tokenProbability.js");
      let bad = 0;
      for (let i = 0; i < 5000; i += 1) {
        const count = 2 + (i % 5);
        const previous = generateDistribution(count);
        const next = generateDistribution(count, { previous });
        const differs = next.some((v, index) => Math.abs(v - previous[index]) >= 1000);
        const sorted = [...next].sort((a, b) => b - a);
        if (!differs || next.reduce((a, b) => a + b, 0) !== TOTAL_MILLI || sorted[0] - sorted[1] < 5000) bad += 1;
      }
      return bad;
    });
    assert.equal(bad, 0);
  });

  await suite.test("generatore iniettabile: stesso seme → stessa distribuzione, semi diversi → diversa", async () => {
    const out = await page.evaluate(async () => {
      const { generateDistribution } = await import("/js/utils/tokenProbability.js");
      const mulberry32 = (seed) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return {
        a: generateDistribution(4, { rng: mulberry32(42) }),
        b: generateDistribution(4, { rng: mulberry32(42) }),
        c: generateDistribution(4, { rng: mulberry32(43) }),
      };
    });
    assert.deepEqual(out.a, out.b);
    assert.notDeepEqual(out.a, out.c);
  });

  await suite.test("rete di sicurezza: con un generatore bloccato il risultato resta valido e 'Rigenera' sposta il vincitore", async () => {
    const out = await page.evaluate(async () => {
      const { generateDistribution, pickWinnerIndex } = await import("/js/utils/tokenProbability.js");
      const stuck = () => 0.5;
      const first = generateDistribution(4, { rng: stuck });
      const previous = [10000, 20000, 50000, 20000];
      const next = generateDistribution(4, { rng: stuck, previous });
      return { first, firstWinner: pickWinnerIndex(first), next, nextWinner: pickWinnerIndex(next) };
    });
    assert.equal(out.first.reduce((a, b) => a + b, 0), 100000);
    assert.equal(out.firstWinner, 0);
    assert.equal(out.next.reduce((a, b) => a + b, 0), 100000);
    assert.equal(out.nextWinner, 3, "il vincitore doveva spostarsi dopo quello precedente (indice 2)");
  });

  await suite.test("generateDistribution: rifiuta un numero di candidati fuori dall'intervallo 2–8", async () => {
    const out = await page.evaluate(async () => {
      const { generateDistribution } = await import("/js/utils/tokenProbability.js");
      return [1, 9, 0, 2.5].map((count) => {
        try {
          generateDistribution(count);
          return "nessun errore";
        } catch (error) {
          return error instanceof RangeError ? "RangeError" : "altro errore";
        }
      });
    });
    assert.deepEqual(out, ["RangeError", "RangeError", "RangeError", "RangeError"]);
  });

  await suite.test("joinTokens: punteggiatura attaccata, date e orari ricomposti", async () => {
    const out = await page.evaluate(async () => {
      const { joinTokens } = await import("/js/utils/tokenText.js");
      return [
        joinTokens(["Oggi", "è", "una", "bella", "giornata", "."]),
        joinTokens(["Oggi", "06", "/", "10", "/", "2026", "."]),
        joinTokens(["Oggi", "06", ":", "30", "!"]),
        joinTokens(["Oggi", "06", "ottobre", "2026", "."]),
        joinTokens(["Oggi"]),
      ];
    });
    assert.deepEqual(out, [
      "Oggi è una bella giornata.",
      "Oggi 06/10/2026.",
      "Oggi 06:30!",
      "Oggi 06 ottobre 2026.",
      "Oggi",
    ]);
  });

  await suite.test("integrazione: per ogni frase dell'albero, i pezzi del vocabolario ricompongono esattamente il testo", async () => {
    const mismatches = await page.evaluate(
      async ({ allPaths, tokens }) => {
        const { joinTokens, needsSpaceBefore } = await import("/js/utils/tokenText.js");
        const bad = [];
        allPaths.forEach((trail) => {
          const rebuilt = trail
            .map((token, index) => {
              const previous = index === 0 ? null : trail[index - 1];
              const form = needsSpaceBefore(previous, token) ? tokens[token].spaced : tokens[token].plain;
              return form.pieces.join("");
            })
            .join("");
          if (rebuilt !== joinTokens(trail)) bad.push(joinTokens(trail));
        });
        return bad;
      },
      { allPaths: paths, tokens: vocab.tokens }
    );
    assert.deepEqual(mismatches, [], `frasi con tokenizzazione incoerente: ${mismatches.slice(0, 3).join(" | ")}`);
  });

  await suite.test("integrazione: nessuna frase duplicata, nessun doppio spazio, tutte terminano con punteggiatura finale", async () => {
    const texts = await page.evaluate(
      async ({ allPaths }) => {
        const { joinTokens } = await import("/js/utils/tokenText.js");
        return allPaths.map(joinTokens);
      },
      { allPaths: paths }
    );
    assert.equal(new Set(texts).size, texts.length, "ci sono frasi identiche");
    texts.forEach((text) => {
      assert.ok(!text.includes("  "), `doppio spazio in "${text}"`);
      assert.ok(/[.!?]$/.test(text), `"${text}" non termina con punteggiatura finale`);
      assert.ok(!/ [.!?]/.test(text), `spazio prima della punteggiatura in "${text}"`);
    });
  });

  // =====================================================================
  // STEP 2–3 — moto, renderer e flusso reale (login + Sidebar, Chromium)
  // =====================================================================

  await suite.test("tokenMotion: ogni fotogramma somma esattamente 100,000%; a progresso 1 è il target esatto", async () => {
    const result = await page.evaluate(async () => {
      const { generateDistribution, TOTAL_MILLI } = await import("/js/utils/tokenProbability.js");
      const { createMotionSeed, distributionAtProgress } = await import("/js/utils/tokenMotion.js");
      let bad = 0;
      let finalMismatch = 0;
      for (let i = 0; i < 3000; i += 1) {
        const count = 2 + (i % 5);
        const target = generateDistribution(count);
        const seed = createMotionSeed(count);
        [false, true].forEach((reducedMotion) => {
          const progress = Math.random();
          const frame = distributionAtProgress(target, progress, seed, { reducedMotion });
          const ok =
            frame.length === count &&
            frame.every((v) => Number.isInteger(v) && v >= 0) &&
            frame.reduce((a, b) => a + b, 0) === TOTAL_MILLI;
          if (!ok) bad += 1;
          const last = distributionAtProgress(target, 1, seed, { reducedMotion });
          if (JSON.stringify(last) !== JSON.stringify(target)) finalMismatch += 1;
        });
      }
      return { bad, finalMismatch };
    });
    assert.equal(result.bad, 0);
    assert.equal(result.finalMismatch, 0);
  });

  await suite.test("tokenMotion: movimento ridotto parte da quote uguali e non oscilla; il movimento pieno sì", async () => {
    const result = await page.evaluate(async () => {
      const { createMotionSeed, distributionAtProgress } = await import("/js/utils/tokenMotion.js");
      const target = [70000, 20000, 9000, 1000];
      const seed = createMotionSeed(4, (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })());
      const reversals = (options) => {
        let count = 0;
        for (let i = 0; i < 4; i += 1) {
          let previous = null;
          let direction = 0;
          for (let step = 0; step <= 100; step += 1) {
            const value = distributionAtProgress(target, step / 100, seed, options)[i];
            if (previous !== null && Math.abs(value - previous) > 2) {
              const next = Math.sign(value - previous);
              if (direction !== 0 && next !== direction) count += 1;
              direction = next;
            }
            previous = value;
          }
        }
        return count;
      };
      return {
        start: distributionAtProgress(target, 0, seed, { reducedMotion: true }),
        reducedReversals: reversals({ reducedMotion: true }),
        fullReversals: reversals({ reducedMotion: false }),
      };
    });
    result.start.forEach((value) => assert.ok(Math.abs(value - 25000) <= 1, `quota di partenza non uguale: ${value}`));
    assert.equal(result.reducedReversals, 0, "con movimento ridotto le barre non devono oscillare");
    assert.ok(result.fullReversals > 0, "con movimento pieno le barre devono contendersi la scelta (inversioni di direzione)");
  });

  // --- Renderer: percorso reale, movimento pieno --------------------------
  const sentenceTexts = await page.evaluate(
    async ({ allPaths }) => {
      const { joinTokens } = await import("/js/utils/tokenText.js");
      return allPaths.map(joinTokens);
    },
    { allPaths: paths }
  );

  const toMilli = (text) => Number(text.replace("%", "").replace(",", ""));
  const waitPhase = (p, phase) =>
    p.waitForFunction((expected) => document.querySelector(".sl-token-prediction")?.dataset.phase === expected, phase, {
      timeout: 10000,
    });
  const readRows = (p) =>
    p.locator(".sl-token-prediction__candidate").evaluateAll((rows) =>
      rows.map((row) => ({
        token: row.dataset.token,
        percent: row.querySelector(".sl-token-prediction__percent").textContent.trim(),
        winner: row.classList.contains("sl-token-prediction__candidate--winner"),
        loser: row.classList.contains("sl-token-prediction__candidate--loser"),
      }))
    );
  const readChips = (p) => p.locator(".sl-token-prediction__chip .sl-token-prediction__chip-word").allTextContents();
  const childrenTokensAfter = (chosenTokens) => {
    let node = { children: tree.children };
    chosenTokens.forEach((token) => {
      node = node.children.find((child) => child.token === token);
    });
    return node.children.map((child) => child.token);
  };
  const sampleCalculation = (p, triggerSelector) =>
    p.evaluate(
      (selector) =>
        new Promise((resolve) => {
          const root = document.querySelector(".sl-token-prediction");
          const frames = [];
          const read = () =>
            Array.from(document.querySelectorAll(".sl-token-prediction__percent")).map((el) => el.textContent.trim());
          if (selector) document.querySelector(selector).click();
          const tick = () => {
            frames.push(read());
            if (root.dataset.phase === "revealed" || frames.length > 900) resolve(frames);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      triggerSelector
    );
  async function playFullSentence(p) {
    const picked = [];
    for (let guard = 0; guard < 20; guard += 1) {
      await waitPhase(p, "revealed");
      const rows = await readRows(p);
      const max = Math.max(...rows.map((row) => toMilli(row.percent)));
      const winners = rows.filter((row) => row.winner);
      assert.equal(winners.length, 1, "deve esserci un solo vincitore");
      assert.equal(toMilli(winners[0].percent), max, "il vincitore non è il candidato con la percentuale più alta");
      picked.push(winners[0].token);
      await p.click(".sl-token-prediction__proceed");
      await p.waitForFunction(() => document.querySelector(".sl-token-prediction").dataset.phase !== "revealed");
      if ((await p.locator(".sl-token-prediction").getAttribute("data-phase")) === "complete") break;
    }
    return picked;
  }

  const requests = [];
  const failedLocal = [];
  const pageErrors = [];
  const fullMotionContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const scenarioPage = await fullMotionContext.newPage();
  scenarioPage.on("request", (request) => requests.push(request.url()));
  scenarioPage.on("response", (response) => {
    if (response.url().startsWith(server.url) && response.status() >= 400) failedLocal.push(`${response.status()} ${response.url()}`);
  });
  scenarioPage.on("pageerror", (error) => pageErrors.push(error.message));
  await loginAsDocente(scenarioPage, server.url);
  await openScenarioViaSidebar(scenarioPage, "AI", "Tokenizzazione");
  await scenarioPage.waitForSelector(".sl-token-prediction");

  await suite.test("apertura: titolo h1 unico, frase = [Oggi] + segnaposto, 5 candidati, comandi disattivi durante il calcolo", async () => {
    assert.equal(await scenarioPage.locator("main h1").count(), 1);
    assert.equal((await scenarioPage.locator("main h1").textContent()).trim(), "Tokenizzazione");
    assert.equal(await scenarioPage.locator(".sl-token-prediction").getAttribute("data-phase"), "calculating");
    assert.deepEqual(await readChips(scenarioPage), ["Oggi"]);
    assert.equal(await scenarioPage.locator(".sl-token-prediction__slot").count(), 1);
    assert.deepEqual((await readRows(scenarioPage)).map((row) => row.token), tree.children.map((child) => child.token));
    assert.equal(await scenarioPage.locator(".sl-token-prediction__proceed").isDisabled(), true);
    assert.equal(await scenarioPage.locator(".sl-token-prediction__regenerate").isDisabled(), true);
    assert.equal(await scenarioPage.locator(".sl-sidebar__link--active").count(), 0);
  });

  await suite.test("calcolo: poi 'rivelato' con un solo vincitore = percentuale più alta, badge 'Scelto', tre decimali, somma 100,000%", async () => {
    await waitPhase(scenarioPage, "revealed");
    const rows = await readRows(scenarioPage);
    rows.forEach((row) => assert.match(row.percent, /^\d{1,3},\d{3}%$/, `formato percentuale errato: ${row.percent}`));
    assert.equal(rows.reduce((sum, row) => sum + toMilli(row.percent), 0), 100000);
    const winners = rows.filter((row) => row.winner);
    assert.equal(winners.length, 1);
    assert.equal(toMilli(winners[0].percent), Math.max(...rows.map((row) => toMilli(row.percent))));
    assert.equal(rows.filter((row) => row.loser).length, rows.length - 1);
    assert.equal((await scenarioPage.locator(".sl-token-prediction__candidate--winner .sl-badge").textContent()).trim(), "Scelto");
    assert.equal(await scenarioPage.locator(".sl-token-prediction__proceed").isDisabled(), false);
    assert.equal(await scenarioPage.locator(".sl-token-prediction__regenerate").isDisabled(), false);
    const announced = await scenarioPage.locator(".sl-token-prediction__status").textContent();
    assert.ok(announced.includes("Percentuali calcolate") && announced.includes("Il più probabile"), `annuncio aria-live: ${announced}`);
  });

  await suite.test("animazione live (movimento pieno): ogni fotogramma somma 100,000%, i valori cambiano e le barre si contendono la scelta", async () => {
    const frames = await sampleCalculation(scenarioPage, ".sl-token-prediction__regenerate");
    assert.ok(frames.length >= 20, `solo ${frames.length} fotogrammi osservati in ~2 secondi`);
    frames.forEach((frame) => {
      assert.equal(frame.reduce((sum, text) => sum + toMilli(text), 0), 100000, `fotogramma che non somma a 100%: ${frame.join(" ")}`);
      frame.forEach((text) => assert.match(text, /^\d{1,3},\d{3}%$/));
    });
    assert.ok(new Set(frames.map((frame) => frame.join("|"))).size >= 10, "i valori non cambiano abbastanza durante il calcolo");
    let reversals = 0;
    for (let i = 0; i < frames[0].length; i += 1) {
      let direction = 0;
      for (let f = 1; f < frames.length; f += 1) {
        const delta = toMilli(frames[f][i]) - toMilli(frames[f - 1][i]);
        if (Math.abs(delta) > 2) {
          if (direction !== 0 && Math.sign(delta) !== direction) reversals += 1;
          direction = Math.sign(delta);
        }
      }
    }
    assert.ok(reversals > 0, "nessuna inversione di direzione: le barre non si 'contendono' la scelta");
    await waitPhase(scenarioPage, "revealed");
  });

  await suite.test("Rigenera: rifà solo il calcolo di questo passo (frase e candidati invariati, percentuali diverse)", async () => {
    await waitPhase(scenarioPage, "revealed");
    const before = await readRows(scenarioPage);
    await scenarioPage.click(".sl-token-prediction__regenerate");
    assert.equal(await scenarioPage.locator(".sl-token-prediction").getAttribute("data-phase"), "calculating");
    assert.equal(await scenarioPage.locator(".sl-token-prediction__proceed").isDisabled(), true);
    assert.equal(await scenarioPage.locator(".sl-token-prediction__regenerate").isDisabled(), true);
    assert.equal(await scenarioPage.locator(".sl-token-prediction__candidate--winner").count(), 0);
    await waitPhase(scenarioPage, "revealed");
    const after = await readRows(scenarioPage);
    assert.deepEqual(after.map((row) => row.token), before.map((row) => row.token));
    assert.deepEqual(await readChips(scenarioPage), ["Oggi"]);
    const differs = after.some((row, i) => Math.abs(toMilli(row.percent) - toMilli(before[i].percent)) >= 1000);
    assert.ok(differs, "le percentuali rigenerate sono praticamente uguali alle precedenti");
  });

  await suite.test("Prosegui: il vincitore entra nella frase e i nuovi candidati sono i figli di quel nodo dell'albero", async () => {
    const rows = await readRows(scenarioPage);
    const winner = rows.find((row) => row.winner).token;
    await scenarioPage.click(".sl-token-prediction__proceed");
    assert.equal(await scenarioPage.locator(".sl-token-prediction").getAttribute("data-phase"), "calculating");
    assert.deepEqual(await readChips(scenarioPage), ["Oggi", winner]);
    assert.deepEqual((await readRows(scenarioPage)).map((row) => row.token), childrenTokensAfter([winner]));
    await waitPhase(scenarioPage, "revealed");
  });

  await suite.test("screenshot — calcolo in corso, risultato del passo, vista token (Light e Dark)", async () => {
    await scenarioPage.click(".sl-token-prediction__regenerate");
    await scenarioPage.waitForTimeout(1100); // a metà animazione
    await scenarioPage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-calculating-light.png") });
    await waitPhase(scenarioPage, "revealed");
    await scenarioPage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-revealed-light.png") });
    await scenarioPage.click(".sl-token-prediction__tokens-toggle");
    await scenarioPage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-tokens-view-light.png") });
    await scenarioPage.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await scenarioPage.waitForTimeout(400); // il cambio tema ha transizioni (body, pulsanti): attendi che si assestino
    await scenarioPage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-tokens-view-dark.png") });
    await scenarioPage.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await scenarioPage.click(".sl-token-prediction__tokens-toggle");
  });

  await suite.test("rete: nessuna richiesta fuori dal server locale, nessun errore HTTP locale, nessun errore JavaScript", async () => {
    assert.ok(requests.some((url) => url.endsWith("token-tree.json")) && requests.some((url) => url.endsWith("token-vocab.json")));
    const external = requests.filter((url) => !url.startsWith(server.url) && !url.startsWith("data:") && !url.startsWith("blob:"));
    assert.deepEqual(external, [], `richieste esterne: ${external.join(", ")}`);
    assert.deepEqual(failedLocal, [], `risposte HTTP in errore: ${failedLocal.join(", ")}`);
    assert.deepEqual(pageErrors, []);
  });

  await fullMotionContext.close();

  // --- Renderer: movimento ridotto (rapido) per i percorsi lunghi ---------
  const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await loginAsDocente(reducedPage, server.url);
  await openScenarioViaSidebar(reducedPage, "AI", "Tokenizzazione");
  await reducedPage.waitForSelector(".sl-token-prediction");

  await suite.test("movimento ridotto: calcolo breve (< 1,5 s), somma sempre 100,000%, nessuna oscillazione", async () => {
    await waitPhase(reducedPage, "revealed");
    const startedAt = Date.now();
    const frames = await sampleCalculation(reducedPage, ".sl-token-prediction__regenerate");
    assert.ok(Date.now() - startedAt < 1500, `il calcolo ha richiesto ${Date.now() - startedAt} ms`);
    frames.forEach((frame) => assert.equal(frame.reduce((sum, text) => sum + toMilli(text), 0), 100000));
    for (let i = 0; i < frames[0].length; i += 1) {
      let direction = 0;
      for (let f = 1; f < frames.length; f += 1) {
        const delta = toMilli(frames[f][i]) - toMilli(frames[f - 1][i]);
        if (Math.abs(delta) > 2) {
          assert.ok(direction === 0 || Math.sign(delta) === direction, "oscillazione con movimento ridotto");
          direction = Math.sign(delta);
        }
      }
    }
  });

  await suite.test("tastiera: il focus segue il ciclo Invio → calcolo → Invio (Prosegui, poi gruppo candidati, poi di nuovo Prosegui)", async () => {
    await waitPhase(reducedPage, "revealed");
    await reducedPage.locator(".sl-token-prediction__proceed").focus();
    await reducedPage.keyboard.press("Enter");
    await reducedPage.waitForFunction(() => document.querySelector(".sl-token-prediction").dataset.phase === "calculating");
    const duringCalc = await reducedPage.evaluate(() => document.activeElement.classList.contains("sl-token-prediction__step"));
    assert.ok(duringCalc, "durante il calcolo il focus dovrebbe stare sul gruppo dei candidati");
    await waitPhase(reducedPage, "revealed");
    const afterReveal = await reducedPage.evaluate(() => document.activeElement.classList.contains("sl-token-prediction__proceed"));
    assert.ok(afterReveal, "a calcolo concluso il focus dovrebbe tornare su Prosegui");
  });

  await suite.test("Rigenera ripetuto (fino a 15 volte sul primo passo): stessi candidati, percentuali sempre diverse, a volte vince un altro candidato", async () => {
    await playFullSentence(reducedPage); // porta a "complete" per poi ricominciare dal primo passo
    await reducedPage.click(".sl-token-prediction__restart");
    await waitPhase(reducedPage, "revealed");
    const tokens = (await readRows(reducedPage)).map((row) => row.token);
    const winners = new Set();
    let previous = await readRows(reducedPage);
    winners.add(previous.find((row) => row.winner).token);
    for (let i = 0; i < 15; i += 1) {
      await reducedPage.click(".sl-token-prediction__regenerate");
      await waitPhase(reducedPage, "revealed");
      const current = await readRows(reducedPage);
      assert.deepEqual(current.map((row) => row.token), tokens);
      assert.ok(current.some((row, index) => Math.abs(toMilli(row.percent) - toMilli(previous[index].percent)) >= 1000));
      winners.add(current.find((row) => row.winner).token);
      previous = current;
    }
    assert.ok(winners.size >= 2, "in 15 rigenerazioni il vincitore non è mai cambiato: il contesto non avrebbe alcun effetto visibile");
    assert.deepEqual(await readChips(reducedPage), ["Oggi"]);
  });

  await suite.test("frase completa: ogni passo sceglie il più probabile, il risultato è una frase dell'albero, chiusa da un token finale", async () => {
    const picked = await playFullSentence(reducedPage);
    assert.equal(await reducedPage.locator(".sl-token-prediction").getAttribute("data-phase"), "complete");
    assert.deepEqual(await readChips(reducedPage), ["Oggi", ...picked]);
    assert.ok(END_TOKENS.includes(picked[picked.length - 1]));
    const result = (await reducedPage.locator(".sl-token-prediction__result-text").textContent()).trim();
    assert.ok(sentenceTexts.includes(result), `la frase "${result}" non è tra quelle generabili dall'albero`);
    assert.match((await reducedPage.locator(".sl-token-prediction__stats").textContent()).trim(), /^\d+ parole · \d+ token reali$/);
    assert.equal(await reducedPage.locator(".sl-token-prediction__slot").count(), 0);
    assert.equal(await reducedPage.locator(".sl-token-prediction__step").isVisible(), false);
    assert.equal(await reducedPage.locator(".sl-token-prediction__result-text").isVisible(), true);
    assert.equal(await reducedPage.locator(".sl-token-prediction__proceed").isVisible(), false);
    assert.equal(await reducedPage.locator(".sl-token-prediction__regenerate").isVisible(), false);
    assert.equal(await reducedPage.locator(".sl-token-prediction__restart").isVisible(), true);
    assert.ok((await reducedPage.locator(".sl-token-prediction__status").textContent()).startsWith("Frase completa"));
    await reducedPage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-complete-light.png") });
  });

  await suite.test("Ricomincia: torna al primo passo (Oggi + 5 candidati), nasconde il risultato, ridà Prosegui/Rigenera", async () => {
    await reducedPage.click(".sl-token-prediction__restart");
    assert.equal(await reducedPage.locator(".sl-token-prediction").getAttribute("data-phase"), "calculating");
    assert.deepEqual(await readChips(reducedPage), ["Oggi"]);
    assert.equal(await reducedPage.locator(".sl-token-prediction__slot").count(), 1);
    assert.deepEqual((await readRows(reducedPage)).map((row) => row.token), tree.children.map((child) => child.token));
    assert.equal(await reducedPage.locator(".sl-token-prediction__result-text").isVisible(), false);
    assert.equal(await reducedPage.locator(".sl-token-prediction__stats").isVisible(), false);
    assert.equal(await reducedPage.locator(".sl-token-prediction__proceed").isVisible(), true);
    assert.equal(await reducedPage.locator(".sl-token-prediction__regenerate").isVisible(), true);
    assert.equal(await reducedPage.locator(".sl-token-prediction__restart").isVisible(), false);
    await waitPhase(reducedPage, "revealed");
  });

  await suite.test("vista token: i pezzi e gli ID mostrati coincidono con token-vocab.json (chip e candidati)", async () => {
    const toggle = reducedPage.locator(".sl-token-prediction__tokens-toggle");
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(await reducedPage.locator(".sl-token-prediction__chip .sl-token-prediction__pieces").first().isVisible(), false);
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    assert.equal(await reducedPage.locator(".sl-token-prediction__legend").isVisible(), true);
    assert.equal(await reducedPage.locator(".sl-token-prediction__chip .sl-token-prediction__chip-word").first().isVisible(), false);

    const chipIds = await reducedPage
      .locator(".sl-token-prediction__chip")
      .first()
      .locator(".sl-token-prediction__piece-id")
      .allTextContents();
    assert.deepEqual(chipIds.map(Number), vocab.tokens["Oggi"].plain.ids);

    const rows = await reducedPage.locator(".sl-token-prediction__candidate").evaluateAll((items) =>
      items.map((item) => ({
        token: item.dataset.token,
        ids: Array.from(item.querySelectorAll(".sl-token-prediction__piece-id")).map((el) => Number(el.textContent)),
        visible: item.querySelector(".sl-token-prediction__pieces").getClientRects().length > 0,
      }))
    );
    rows.forEach((row) => {
      assert.ok(row.visible, `pezzi non visibili per "${row.token}"`);
      assert.deepEqual(row.ids, vocab.tokens[row.token].spaced.ids, `ID diversi dal vocabolario per "${row.token}"`);
    });
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(await reducedPage.locator(".sl-token-prediction__legend").isVisible(), false);
  });

  await reducedContext.close();

  // --- Mobile 375px ----------------------------------------------------------
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 800 }, reducedMotion: "reduce" });
  const mobilePage = await mobileContext.newPage();
  await loginAsDocente(mobilePage, server.url);
  await mobilePage.goto(`${server.url}/#/scenario/tokenizzazione`);
  await mobilePage.waitForSelector(".sl-token-prediction");

  await suite.test("mobile 375px: nessun overflow orizzontale, né a risultato del passo né con la vista token (caso peggiore)", async () => {
    await waitPhase(mobilePage, "revealed");
    const overflows = () => mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(await overflows(), false, "overflow orizzontale a 375px");
    await mobilePage.click(".sl-token-prediction__tokens-toggle");
    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-tokens-view-mobile-375.png"), fullPage: true });
    assert.equal(await overflows(), false, "overflow orizzontale a 375px con la vista token");
    await playFullSentence(mobilePage);
    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "token-complete-mobile-375.png"), fullPage: true });
    assert.equal(await overflows(), false, "overflow orizzontale a 375px a frase completa");
  });

  await mobileContext.close();

  // --- Degrado controllato --------------------------------------------------------
  async function openWithBlocked(blockedSuffix) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const p = await context.newPage();
    await loginAsDocente(p, server.url);
    await p.route(`**/${blockedSuffix}`, (route) => route.fulfill({ status: 404, body: "not found" }));
    await p.goto(`${server.url}/#/scenario/tokenizzazione`);
    return { context, p };
  }

  await suite.test("albero non raggiungibile: messaggio di fallback, nessuna interfaccia a metà", async () => {
    const { context, p } = await openWithBlocked("token-tree.json");
    await p.waitForSelector(".sl-scenario-viewport p");
    assert.equal((await p.locator(".sl-scenario-viewport p").textContent()).trim(), "Questo scenario non è disponibile al momento.");
    assert.equal(await p.locator(".sl-token-prediction").count(), 0);
    await context.close();
  });

  await suite.test("vocabolario non raggiungibile: lo scenario funziona e l'interruttore 'Mostra token' non compare", async () => {
    const { context, p } = await openWithBlocked("token-vocab.json");
    await p.waitForSelector(".sl-token-prediction");
    await waitPhase(p, "revealed");
    assert.equal(await p.locator(".sl-token-prediction__tokens-toggle").isVisible(), false);
    await p.click(".sl-token-prediction__proceed");
    await waitPhase(p, "revealed");
    assert.equal((await readChips(p)).length, 2);
    await context.close();
  });

  await suite.test("smontaggio: lasciare la pagina durante il calcolo non lascia errori né animazioni orfane", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await loginAsDocente(p, server.url);
    await openScenarioViaSidebar(p, "AI", "Tokenizzazione");
    await p.waitForSelector(".sl-token-prediction");
    await p.click(".sl-sidebar__link[href='#/home']");
    await p.waitForSelector(".sl-home-page__content");
    await p.waitForTimeout(2600); // oltre la durata dell'animazione interrotta
    assert.equal(await p.locator(".sl-token-prediction").count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  });

  await browser.close();
  await server.close();
  return suite.summary();
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
