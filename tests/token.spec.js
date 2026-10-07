/**
 * token.spec.js
 * -----------------------------------------------------------------------
 * Scenario "Tokenizzazione" (type "token-prediction") — STEP 1: dati e
 * logica pura. Nessun login e nessuna credenziale: non c'è ancora una
 * pagina da raggiungere, si verificano i DATI (albero, vocabolario) e le
 * utility (tokenProbability.js, tokenText.js). Le utility sono eseguite
 * nel browser reale (import dinamico dal server di test) e non in Node:
 * sono moduli ES pensati per il browser, e così il test non dipende
 * dalla versione di Node di chi lo esegue.
 *
 * I controlli sui dati hanno uno scopo preciso, oltre alla correttezza:
 * sono la rete di sicurezza contro un albero modificato a mano che
 * produca frasi che non finiscono, scelte a un solo candidato o parole
 * senza tokenizzazione nel vocabolario (lo stesso principio già
 * applicato altrove: un test fallisce prima che lo scopra la LIM).
 *
 * Gli step successivi (renderer, animazione, sidebar) aggiungeranno qui
 * i propri blocchi, che useranno il login reale come le altre suite.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");

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

  await browser.close();
  await server.close();
  return suite.summary();
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
