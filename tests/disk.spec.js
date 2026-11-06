/**
 * disk.spec.js
 * -----------------------------------------------------------------------
 * Scenario "HDD vs SSD" (type "disk-compare", area Computer Essentials),
 * in quattro parti:
 *   1. DATI e MODELLO (disk.json, modules.json, diskModel.js): rete di
 *      sicurezza contro un JSON modificato a mano — conteggio dei cluster
 *      per file (5/3/12/8), i due gruppi di foto_sushi.jpeg (3 + 5), la
 *      stessa sequenza su HDD e SSD, validazione degli errori — prima che
 *      lo scopra la LIM. La logica pura gira nel browser reale (import
 *      dinamico dal server di test).
 *   2. RENDERER con movimento pieno: percorso reale dalla Sidebar, layout,
 *      barra dei passaggi e le sue regole di sblocco, Procedi, coerenza
 *      dei colori, camera 3D (zoom in/out), ingrandimento manuale, lettura
 *      e ricomposizione, SSD, confronto affiancato, velocità, tastiera,
 *      tema Light/Dark, 375px e 768-1024px.
 *      OROLOGIO FINTO (page.clock, fermo e fatto avanzare a mano): nessun
 *      test dipende dai tempi reali della macchina. Il clock viene
 *      installato DOPO l'apertura dello scenario e la scena riparte con
 *      "Ricomincia", così ogni attesa del motore è sull'orologio finto.
 *   3. MOVIMENTO RIDOTTO: tempi drasticamente ridotti, stesse regole.
 *   4. DEGRADO, SMONTAGGIO, RICHIESTE ESTERNE.
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
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const DATA_DIR = path.join(APP_ROOT, "data", "scenarios", "hdd-vs-ssd");
const SEL = {
  root: ".sl-disk-compare",
  step: (i) => `.sl-disk-compare__step[data-index="${i}"]`,
  proceed: ".sl-disk-compare__actions .sl-button--primary",
  replay: ".sl-disk-compare__actions .sl-button--secondary >> nth=0",
  restart: ".sl-disk-compare__actions .sl-button--secondary >> nth=1",
  scenario: (i) => `.sl-disk-compare__scenario-button >> nth=${i}`,
  scene: ".sl-disk-compare__scene",
  cam: ".sl-disk-compare__scene .sl-disk-scene__cam",
  cells: ".sl-disk-compare__panel--grid .sl-disk-compare__cell",
  strip: ".sl-disk-compare__strip",
  settings: ".sl-disk-compare__settings-trigger",
};

const disk = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "disk.json"), "utf8"));
const attr = (page, name) => page.locator(SEL.root).getAttribute(name);
const animating = async (page) => (await attr(page, "data-animating")) === "true";

function parseRgb(css) {
  return css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
}
function luminance(c) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Avanza l'orologio finto finché il passaggio corrente non è concluso. */
async function finish(page, maxIterations = 600) {
  for (let i = 0; i < maxIterations && (await animating(page)); i += 1) await page.clock.runFor(250);
  assert.equal(await animating(page), false, "il passaggio non si conclude entro il limite");
}

/** Completa i passaggi da quello corrente fino all'indice "last" (incluso), con Procedi. */
async function playTo(page, last) {
  await finish(page);
  while (Number(await attr(page, "data-step")) < last) {
    await page.locator(SEL.proceed).click();
    await finish(page);
  }
}

const fileCells = (page, id) => page.evaluate((f) => Array.from(document.querySelectorAll(".sl-disk-compare__panel--grid .sl-disk-compare__cell")).map((el, i) => (el.dataset.file === f ? i : -1)).filter((i) => i >= 0), id);

/** Elementi che sporgono dalla viewport (esclusi la barra dei passaggi, che scorre di proposito, e la scena 3D, che ritaglia il proprio contenuto con overflow:hidden). */
const overflowing = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll("body *").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && !e.closest(".sl-disk-compare__steps") && !e.closest(".sl-disk-scene")) out.push(`${e.tagName}.${String(e.className.baseVal ?? e.className).slice(0, 50)}@${Math.round(r.right)}`);
    });
    return out.slice(0, 6);
  });
const camTransform = (page) => page.locator(SEL.cam).evaluate((el) => el.style.transform);

/** Campiona una grandezza ogni "stepMs" di tempo finto finché il passaggio è in corso. */
async function sample(page, read, stepMs = 100, max = 1500) {
  const out = [];
  for (let i = 0; i < max && (await animating(page)); i += 1) {
    out.push(await read());
    await page.clock.runFor(stepMs);
  }
  return out;
}

async function openScenario(page) {
  await openScenarioViaSidebar(page, "Computer Essentials", "HDD vs SSD");
  await page.waitForSelector(SEL.root);
}

async function installClock(page) {
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);
  await page.locator(SEL.restart).click(); // riparte sull'orologio finto
}

async function run() {
  const suite = createSuite("disk.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- 1. Dati e modello -----------------------------------------------------
  const modelContext = await browser.newContext();
  const modelPage = await modelContext.newPage();
  await modelPage.goto(`${server.url}/#/login`);
  const model = (fn, arg) => modelPage.evaluate(`(async()=>{const m=await import('/js/utils/diskModel.js');return (${fn.toString()})(m,${JSON.stringify(arg ?? null)})})()`);

  await suite.test("dati: 4 file con dimensioni 5/3/12/8 MB, nomi e colori della consegna", async () => {
    assert.deepEqual(disk.files.map((f) => [f.name, f.mb, f.colorName]), [["selfie.jpeg", 5, "blu"], ["foto_pizza.jpeg", 3, "rosso"], ["selfie_di_coppia.jpeg", 12, "verde"], ["foto_sushi.jpeg", 8, "giallo"]]);
    assert.deepEqual(disk.settings.speeds.map((s) => s.value), [0.5, 1, 2]);
    assert.equal(disk.settings.defaultSpeed, 1);
    assert.equal(disk.timing.ratio, 5, "il rapporto dei tempi vive nel JSON");
  });

  await suite.test("dati: l'area è nel catalogo con l'icona e lo scenario collegato", async () => {
    const modules = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "modules.json"), "utf8")).modules;
    const area = modules.find((m) => m.id === "computer-essentials");
    assert.ok(area && area.available && area.title === "Computer Essentials");
    assert.deepEqual(area.scenarios.map((s) => s.id), ["hdd-vs-ssd"]);
    assert.ok(fs.existsSync(path.join(APP_ROOT, area.icon)), "icona dell'area mancante");
    const scenario = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "scenario.json"), "utf8"));
    assert.equal(scenario.type, "disk-compare");
    assert.ok(fs.existsSync(path.join(APP_ROOT, scenario.dataRefs.disk)));
  });

  await suite.test("modello: la configurazione consegnata è valida e il disco ha 48 cluster", async () => {
    const cfg = disk;
    const r = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      m.validateDiskConfig(c);
      return m.CLUSTERS;
    }, cfg);
    assert.equal(r, 48);
  });

  await suite.test("modello HDD vergine: dopo l'ultimo passaggio 5/12/8 cluster (selfie, coppia, sushi), pizza 0", async () => {
    const counts = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const end = m.buildScript(c.scenarios[0], c.files).at(-1).end.g;
      return Object.fromEntries(["b", "r", "g", "y"].map((k) => [k, end.filter((v) => v === k).length]));
    }, disk);
    assert.deepEqual(counts, { b: 5, r: 0, g: 12, y: 8 });
  });

  await suite.test("modello: ogni file occupa esattamente 5/3/12/8 cluster dopo la sua scrittura (HDD vergine, HDD usato, SSD)", async () => {
    const results = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      return c.scenarios.map((sc) => {
        const script = m.buildScript(sc, c.files);
        const out = {};
        sc.steps.forEach((step, i) => step.ops.forEach(([op, id]) => { if (op === "w") out[id] = script[i].end.g.filter((v) => v === id).length; }));
        return out;
      });
    }, disk);
    results.forEach((r) => assert.deepEqual(r, { b: 5, r: 3, g: 12, y: 8 }));
  });

  await suite.test("modello HDD vergine: foto_sushi in DUE gruppi (3 + 5) dopo la cancellazione della pizza", async () => {
    const r = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const script = m.buildScript(c.scenarios[0], c.files);
      const end = script.at(-1).end.g;
      const idx = end.map((v, i) => (v === "y" ? i : -1)).filter((i) => i >= 0);
      return { groups: m.groupCount(end, "y"), idx, pizzaFreed: script[3].end.g.filter((v) => v === "r").length };
    }, disk);
    assert.equal(r.groups, 2);
    assert.deepEqual(r.idx, [5, 6, 7, 20, 21, 22, 23, 24], "3 cluster liberati dalla pizza + 5 consecutivi altrove");
    assert.equal(r.pizzaFreed, 0);
  });

  await suite.test("modello HDD usato: 20 cluster preesistenti, 28 liberi non contigui; foto_sushi frammentata", async () => {
    const r = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const sc = c.scenarios[1];
      const script = m.buildScript(sc, c.files);
      const g0 = script[0].prev.g;
      return { n: g0.filter((v) => v === "n").length, free: g0.filter((v) => v === ".").length, fragmented: m.groupCount(script.at(-1).end.g, "y") > 1, full: script.at(-1).end.g.filter((v) => v === ".").length };
    }, disk);
    assert.deepEqual([r.n, r.free, r.fragmented, r.full], [20, 28, true, 0]);
  });

  await suite.test("modello SSD: stessa sequenza dell'HDD vergine, stesso stato finale", async () => {
    const same = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const a = m.buildScript(c.scenarios[0], c.files).at(-1).end.g.join("");
      const b = m.buildScript(c.scenarios[2], c.files).at(-1).end.g.join("");
      return a === b;
    }, disk);
    assert.ok(same);
  });

  await suite.test("modello: scrittura e cancellazione dello stesso file sono due fasi distinte (nessuna compensazione)", async () => {
    const r = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const sc = structuredClone(c.scenarios[0]);
      sc.steps[2].ops = [["w", "r"], ["d", "r"]];
      const step = m.buildScript(sc, c.files)[2];
      return { phases: step.phases.map((p) => [p.op, p.cells.length]), net: step.end.g.filter((v) => v === "r").length };
    }, disk);
    assert.deepEqual(r.phases, [["w", 3], ["d", 3]]);
    assert.equal(r.net, 0);
  });

  await suite.test("modello: l'ordine di lettura di foto_sushi NON è crescente ma contiene tutti gli 8 cluster", async () => {
    const r = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const phase = m.buildScript(c.scenarios[1], c.files)[5].phases[0];
      return { op: phase.op, cells: phase.cells, nn: phase.nn };
    }, disk);
    assert.equal(r.op, "read");
    assert.deepEqual([...r.nn].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.notDeepEqual(r.nn, [1, 2, 3, 4, 5, 6, 7, 8], "la lettura non è disordinata");
  });

  await suite.test("validazione: init di lunghezza errata, operazione sconosciuta e file ignoto vengono rifiutati con un messaggio", async () => {
    const messages = await modelPage.evaluate(async (c) => {
      const m = await import("/js/utils/diskModel.js");
      const tryIt = (mutate) => {
        const copy = structuredClone(c);
        mutate(copy);
        try { m.validateDiskConfig(copy); return "accettato"; } catch (e) { return e.message; }
      };
      return [
        tryIt((x) => { x.scenarios[0].init = ["...."]; }),
        tryIt((x) => { x.scenarios[0].steps[1].ops = [["x", "b"]]; }),
        tryIt((x) => { x.scenarios[0].steps[1].ops = [["w", "z"]]; }),
        tryIt((x) => { x.scenarios[1].init[0] = "q..."; }),
        tryIt((x) => { x.timing.ratio = 0; }),
      ];
    }, disk);
    messages.forEach((msg) => assert.ok(msg.startsWith("disk.json non valido"), msg));
  });

  await suite.test("colori: testo di ogni file su colore di base ≥ 4.5:1 e su accento ≥ 3:1; file distinguibili per trama oltre che per colore", async () => {
    disk.files.forEach((f) => {
      assert.ok(contrast(hexToRgb(f.textColor), hexToRgb(f.color)) >= 4.5, `${f.name}: testo/colore ${contrast(hexToRgb(f.textColor), hexToRgb(f.color)).toFixed(2)}`);
      assert.ok(contrast(hexToRgb(f.textColor), hexToRgb(f.accent)) >= 3, `${f.name}: testo/accento`);
    });
    assert.equal(new Set(disk.files.map((f) => f.pattern)).size, 4, "ogni file ha una trama diversa");
    assert.notEqual(disk.existing.pattern, "solid");
  });
  await modelContext.close();

  // --- 2. Renderer, movimento pieno ---------------------------------------------
  const requests = [];
  const failedLocal = [];
  const pageErrors = [];
  const consoleErrors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("request", (r) => requests.push(r.url()));
  page.on("response", (r) => {
    if (r.url().startsWith(server.url) && r.status() >= 400) failedLocal.push(`${r.status()} ${r.url()}`);
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await loginAsDocente(page, server.url);
  await openScenario(page);
  await installClock(page);

  await suite.test("apertura dalla Sidebar: #/scenario/hdd-vs-ssd, h1, badge area, chrome standard", async () => {
    assert.equal(await page.evaluate(() => window.location.hash), "#/scenario/hdd-vs-ssd");
    assert.equal((await page.locator(`${SEL.root} h1`).textContent()).trim(), "HDD vs SSD");
    assert.equal(await page.locator(`${SEL.root} h1`).count(), 1);
    assert.equal((await page.locator(`${SEL.root} .sl-badge`).textContent()).trim(), "Computer Essentials");
    assert.equal(await page.locator(".sl-sidebar").count(), 1);
    assert.equal(await page.title(), "Scenario \u2014 SocialAlive");
  });

  await suite.test("layout: griglia dei cluster a DESTRA dell'animazione; legenda dei file e comandi SOTTO", async () => {
    const box = (sel) => page.locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
    const scene = await box(".sl-disk-compare__panel--scene");
    const grid = await box(".sl-disk-compare__panel--grid");
    const files = await box(".sl-disk-compare__panel--files");
    const explain = await box(".sl-disk-compare__panel--explain");
    assert.ok(grid.l >= scene.r - 1, `la griglia non è a destra (${grid.l} < ${scene.r})`);
    assert.ok(Math.abs(grid.t - scene.t) < 4, "griglia e animazione non sono sulla stessa riga");
    assert.ok(files.t >= Math.max(scene.b, grid.b) - 1, "la legenda dei file non è sotto");
    assert.ok(explain.t >= Math.max(scene.b, grid.b) - 1, "i comandi non sono sotto");
    assert.ok(await page.locator(`.sl-disk-compare__panel--explain ${SEL.proceed}`).count() === 1, "Procedi non è sotto, nel pannello dei comandi");
    assert.equal(await page.locator(".sl-disk-compare__panel--explain .sl-button").count(), 3);
  });

  await suite.test("avvio: selettore con 3 scenari, passaggio 1 di 6, SOLO il primo selezionabile, gli altri bloccati con lucchetto e testo", async () => {
    assert.deepEqual((await page.locator(".sl-disk-compare__scenario-button").allTextContents()).map((t) => t.trim()), ["HDD vergine", "HDD già utilizzato", "SSD"]);
    assert.equal((await page.locator(".sl-disk-compare__counter").textContent()).trim(), "Passaggio 1 di 6");
    assert.equal(await page.locator(SEL.step(0)).getAttribute("aria-current"), "step");
    for (let i = 1; i < 6; i += 1) {
      const step = page.locator(SEL.step(i));
      assert.equal(await step.getAttribute("aria-disabled"), "true");
      assert.equal(await step.getAttribute("title"), "Completa prima il passaggio precedente");
      assert.equal(await step.locator("svg").count(), 1, `passaggio ${i + 1} senza lucchetto`);
      assert.match(await step.textContent(), /bloccato\. Completa prima il passaggio precedente/);
    }
  });

  await suite.test("Procedi è DISABILITATO mentre il passaggio anima e si riabilita solo a fine animazione", async () => {
    assert.equal(await animating(page), true);
    assert.equal(await page.locator(SEL.proceed).isDisabled(), true);
    await page.clock.runFor(1000);
    assert.equal(await page.locator(SEL.proceed).isDisabled(), true);
    await finish(page);
    assert.equal(await page.locator(SEL.proceed).isDisabled(), false);
    assert.equal(await attr(page, "data-done"), "1");
  });

  await suite.test("a passaggio 1 completato: spunta sul 1, il 2 si sblocca, il 3 resta bloccato", async () => {
    assert.equal(await page.locator(`${SEL.step(0)} svg`).count(), 1, "manca la spunta");
    assert.equal(await page.locator(SEL.step(1)).getAttribute("aria-disabled"), null);
    assert.equal(await page.locator(SEL.step(2)).getAttribute("aria-disabled"), "true");
  });

  await suite.test("passaggio 2: la camera si avvicina (zoom in) e le due modalità logico/fisico si accendono una alla volta", async () => {
    await page.locator(SEL.proceed).click();
    const seen = new Set();
    const modes = await sample(page, async () => {
      seen.add(await camTransform(page));
      return page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__mode")).map((m) => m.classList.contains("is-on")));
    }, 60);
    assert.ok([...seen].some((t) => t.includes("rotateX(36deg)")), "la camera non si è mai avvicinata");
    assert.ok([...seen].some((t) => t.includes("rotateX(58deg)")), "manca la vista d'insieme");
    assert.ok(modes.every(([l, p]) => !(l && p)), "le due modalità sono accese insieme");
    assert.ok(modes.some(([l]) => l) && modes.some(([, p]) => p), "una delle due modalità non si è mai accesa");
  });

  await suite.test("selfie.jpeg: 5 cluster blu numerati 1..5 nei primi 5 cluster, legenda '5/5'", async () => {
    assert.deepEqual(await fileCells(page, "b"), [0, 1, 2, 3, 4]);
    const nums = await page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__cell[data-file='b']")).map((e) => e.textContent.trim()));
    assert.deepEqual(nums, ["1", "2", "3", "4", "5"]);
    assert.match(await page.locator(".sl-disk-compare__files li[data-file='b']").textContent(), /5 MB = 5 cluster · scritti 5\/5/);
  });

  await suite.test("passaggio 3 (altri due file): pizza 3 cluster rossi, coppia 12 verdi; blu invariati; zoom OUT tra settori diversi", async () => {
    await page.locator(SEL.proceed).click();
    const transforms = await sample(page, () => camTransform(page), 50);
    await finish(page);
    assert.equal((await fileCells(page, "r")).length, 3);
    assert.equal((await fileCells(page, "g")).length, 12);
    assert.deepEqual(await fileCells(page, "b"), [0, 1, 2, 3, 4]);
    // zoom in → zoom out → zoom in: la camera esce dal settore quando serve un altro settore
    const kinds = transforms.map((t) => (t.includes("rotateX(36deg)") ? "in" : "out"));
    const collapsed = kinds.filter((k, i) => i === 0 || k !== kinds[i - 1]).join(",");
    assert.ok(/in,out,in/.test(collapsed), `nessuna uscita dal settore osservata: ${collapsed}`);
  });

  await suite.test("regole di sblocco: durante il passaggio 4 si scelgono 1-3, non il 5; interrotto il 4 non risulta completato", async () => {
    await page.locator(SEL.proceed).click(); // passaggio 4 (indice 3): cancella pizza
    await page.clock.runFor(300);
    assert.equal(await animating(page), true);
    for (const i of [0, 1, 2]) assert.equal(await page.locator(SEL.step(i)).getAttribute("aria-disabled"), null, `il passaggio ${i + 1} non è selezionabile`);
    assert.equal(await page.locator(SEL.step(4)).getAttribute("aria-disabled"), "true");
    await page.locator(SEL.step(1)).click(); // salto indietro: interrompe in modo pulito
    assert.equal(await attr(page, "data-step"), "1");
    assert.equal(await attr(page, "data-done"), "3", "il passaggio interrotto risulta completato");
    assert.equal(await page.locator(SEL.step(3)).getAttribute("aria-disabled"), null, "il 4 resta selezionabile (non lo è mai stato completato ma è il successivo)");
    assert.equal(await page.locator(SEL.step(4)).getAttribute("aria-disabled"), "true");
  });

  await suite.test("salto indietro: lo stato del disco è quello di FINE passaggio 1 e poi si anima il 2 (nessun residuo dei passaggi successivi)", async () => {
    const atStart = await fileCells(page, "g");
    assert.deepEqual(atStart, [], "i cluster verdi del passaggio 3 sono ancora visibili tornando al 2");
    assert.deepEqual(await fileCells(page, "b"), [], "il blu compare prima che il passaggio 2 lo scriva");
    await finish(page);
    assert.deepEqual(await fileCells(page, "b"), [0, 1, 2, 3, 4]);
    assert.equal(await attr(page, "data-done"), "3", "riprodurre un passaggio già raggiunto non deve cambiare lo storico");
  });

  await suite.test("dopo aver rivisto il 2, Procedi porta al 3 (successivo nella sequenza) senza ripetere i già completati; il 3 resta sbloccato", async () => {
    assert.equal(await page.locator(SEL.step(2)).getAttribute("aria-disabled"), null);
    await page.locator(SEL.proceed).click();
    assert.equal(await attr(page, "data-step"), "2");
    await finish(page);
    assert.equal((await fileCells(page, "g")).length, 12);
    assert.equal(await attr(page, "data-done"), "3");
  });

  await suite.test("passaggio 4 (cancella pizza): i cluster mostrano × e tornano liberi; i dati non sono 'cancellati fisicamente' nel testo", async () => {
    await page.locator(SEL.proceed).click();
    const ghosts = await sample(page, () => page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__cell")).filter((e) => e.textContent === "×").length), 40);
    assert.ok(ghosts.some((n) => n > 0), "il simbolo × non è mai comparso");
    assert.equal((await fileCells(page, "r")).length, 0);
    assert.match(await page.locator(".sl-disk-compare__text").textContent(), /i dati possono restare sul supporto finché non vengono sovrascritti/);
    assert.doesNotMatch(await page.locator(".sl-disk-compare__text").textContent(), /cancellat[oi] fisicamente/);
  });

  await suite.test("passaggio 5 (sushi): 8 cluster gialli in DUE gruppi (3 + 5), blu e verde invariati, liberi distinguibili", async () => {
    await page.locator(SEL.proceed).click();
    await finish(page);
    assert.deepEqual(await fileCells(page, "y"), [5, 6, 7, 20, 21, 22, 23, 24]);
    assert.deepEqual(await fileCells(page, "b"), [0, 1, 2, 3, 4]);
    assert.equal((await fileCells(page, "g")).length, 12);
    assert.match(await page.locator(".sl-disk-compare__files li[data-file='y']").textContent(), /frammentato in 2 gruppi/);
    const freeStyle = await page.locator(`${SEL.cells}[data-file="."] >> nth=0`).evaluate((el) => getComputedStyle(el).borderTopStyle);
    assert.equal(freeStyle, "dashed");
  });

  await suite.test("coerenza dei colori: ogni file ha lo stesso colore di base nella griglia, nella legenda e nelle altre viste", async () => {
    const result = await page.evaluate((files) => {
      const out = {};
      files.forEach((f) => {
        const cell = document.querySelector(`.sl-disk-compare__cell[data-file="${f.id}"]`) || document.querySelector(`.sl-disk-compare__files li[data-file="${f.id}"] .sl-disk-compare__swatch`); // pizza: già cancellata, resta la legenda
        const swatch = document.querySelector(`.sl-disk-compare__files li[data-file="${f.id}"] .sl-disk-compare__swatch`);
        const hex = (v) => v.toLowerCase();
        out[f.id] = [hex(cell.style.background).includes(hexToRgbStr(f.color)), hex(swatch.style.background).includes(hexToRgbStr(f.color))];
      });
      function hexToRgbStr(h) {
        return `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
      }
      return out;
    }, disk.files);
    Object.entries(result).forEach(([id, [cell, swatch]]) => assert.ok(cell && swatch, `colore incoerente per il file ${id}`));
  });

  await suite.test("riepilogo (passaggio 6): conteggi coerenti e nessuna affermazione generalizzata", async () => {
    await page.locator(SEL.proceed).click();
    await finish(page);
    const text = await page.locator(".sl-disk-compare__text").textContent();
    assert.match(text, /Cluster dei file: 25, preesistenti: 0, liberi: 23/);
    assert.match(text, /Non ogni scrittura su un HDD vergine si comporta così/);
    assert.equal(await page.locator(SEL.proceed).isDisabled(), true, "all'ultimo passaggio Procedi deve essere disabilitato");
    assert.match(await page.locator(".sl-disk-compare__cells").getAttribute("aria-label"), /Cluster dei file: 25/);
  });

  await suite.test("ingrandimento manuale: a passaggio concluso il clic su un settore avvicina la camera, il secondo clic la riporta indietro", async () => {
    assert.equal(await animating(page), false);
    await page.locator(".sl-disk-scene__sector[data-s='1']").dispatchEvent("click");
    assert.equal(await attr(page, "data-zoomed"), "true");
    assert.ok((await camTransform(page)).includes("rotateX(36deg)"));
    assert.match(await page.locator(".sl-disk-scene__lens-note").textContent(), /non divisioni fisiche del disco/);
    await page.locator(SEL.scene).dispatchEvent("click");
    assert.equal(await attr(page, "data-zoomed"), "false");
    assert.ok((await camTransform(page)).includes("rotateX(58deg)"));
  });

  await suite.test("ingrandimento manuale: da tastiera Invio ingrandisce e Esc riduce", async () => {
    await page.locator(SEL.scene).focus();
    await page.keyboard.press("Enter");
    assert.equal(await attr(page, "data-zoomed"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await attr(page, "data-zoomed"), "false");
  });

  await suite.test("ingrandimento manuale: NON disponibile durante l'animazione (nessun effetto, scena aria-disabled, suggerimento dedicato)", async () => {
    await page.locator(SEL.step(4)).click(); // rianima il passaggio 5
    assert.equal(await animating(page), true);
    await page.clock.runFor(100);
    assert.equal(await page.locator(SEL.scene).getAttribute("aria-disabled"), "true");
    assert.match(await page.locator(".sl-disk-compare__hint").textContent(), /disponibile a fine animazione/);
    const before = await camTransform(page);
    await page.locator(".sl-disk-scene__sector[data-s='0']").dispatchEvent("click");
    assert.equal(await attr(page, "data-zoomed"), String((await camTransform(page)).includes("rotateX(36deg)") && before.includes("rotateX(36deg)")));
    await finish(page);
    assert.equal(await page.locator(SEL.scene).getAttribute("aria-disabled"), "false");
  });

  await suite.test("ingrandimento manuale: ogni nuovo passaggio riparte dalla vista d'insieme", async () => {
    await page.locator(".sl-disk-scene__sector[data-s='2']").dispatchEvent("click");
    assert.equal(await attr(page, "data-zoomed"), "true");
    await page.locator(SEL.replay).click();
    await page.clock.runFor(50);
    assert.equal(await attr(page, "data-zoomed"), "false");
    await finish(page);
  });

  await suite.test("Ricomincia: azzera disco, storico e passaggio; il disco torna vuoto e solo il passaggio 1 è selezionabile", async () => {
    await page.locator(SEL.restart).click();
    assert.equal(await attr(page, "data-step"), "0");
    assert.equal(await attr(page, "data-done"), "0");
    assert.deepEqual(await fileCells(page, "y"), []);
    assert.equal(await page.locator(SEL.step(1)).getAttribute("aria-disabled"), "true");
    assert.equal(await page.locator(SEL.proceed).isDisabled(), true);
    await finish(page);
  });

  await suite.test("cambio scenario: HDD già utilizzato riparte da zero con 20 cluster preesistenti a trama neutra e 28 liberi", async () => {
    await playTo(page, 2); // storico non vuoto prima del cambio
    await page.locator(SEL.scenario(1)).click();
    assert.equal(await attr(page, "data-scenario"), "hdd-usato");
    assert.equal(await attr(page, "data-step"), "0");
    assert.equal(await attr(page, "data-done"), "0", "lo storico del precedente non è stato azzerato");
    assert.equal(await page.locator(`${SEL.scenario(1)}`).getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(`${SEL.scenario(0)}`).getAttribute("aria-pressed"), "false");
    assert.equal((await fileCells(page, "n")).length, 20);
    assert.equal((await fileCells(page, ".")).length, 28);
    assert.equal(await page.locator(".sl-disk-compare__step").count(), 7);
    assert.deepEqual([(await fileCells(page, "b")).length, (await fileCells(page, "g")).length], [0, 0], "residui del disco precedente");
    const neutral = await page.locator(`${SEL.cells}[data-file="n"] >> nth=0`).evaluate((el) => el.style.background);
    assert.match(neutral, /repeating-linear-gradient/);
  });

  await suite.test("HDD usato: la testina si sposta almeno una volta tra tracce (il braccio cambia posizione) già nella scrittura di selfie e pizza", async () => {
    await finish(page);
    await page.locator(SEL.proceed).click();
    const tips = new Set();
    await sample(page, async () => tips.add(await page.locator(".sl-disk-scene__tip").evaluate((el) => el.style.transform)), 100);
    await page.locator(SEL.proceed).click();
    await sample(page, async () => tips.add(await page.locator(".sl-disk-scene__tip").evaluate((el) => el.style.transform)), 100);
    assert.ok(tips.size >= 4, `solo ${tips.size} posizioni distinte della testina`);
  });

  await suite.test("HDD usato: i 3 cluster di pizza e i 12 di coppia riempiono lo spazio libero residuo; sushi riempie i restanti 8", async () => {
    await playTo(page, 4);
    assert.deepEqual([5, 3, 12, 8].map(() => 0).length, 4);
    const counts = await page.evaluate(() => {
      const c = (f) => Array.from(document.querySelectorAll(".sl-disk-compare__cell[data-file='" + f + "']")).length;
      return [c("b"), c("r"), c("g"), c("y"), c(".")];
    });
    assert.deepEqual(counts, [5, 3, 12, 8, 0]);
  });

  await suite.test("HDD usato, lettura: porzioni mostrate PRIMA disordinate, poi ricomposte in ordine e fuse in un'immagine ricostruita", async () => {
    await page.locator(SEL.proceed).click();
    const seen = [];
    await sample(page, async () => {
      seen.push(await page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__tile")).map((t) => Number(t.dataset.n)).join(",")));
    }, 50);
    const full = seen.filter((s) => s.split(",").length === 8);
    const sorted = "1,2,3,4,5,6,7,8";
    assert.ok(full.length > 0 && full[0] !== sorted, `le porzioni non risultano disordinate: ${full[0]}`);
    assert.equal(full.at(-1), sorted, "alla fine le porzioni non sono in ordine");
    assert.equal(await page.locator(`${SEL.strip}.is-joined`).count(), 1);
    assert.match(await page.locator(SEL.strip).textContent(), /foto_sushi\.jpeg ricostruita/);
    assert.match(await page.locator(".sl-disk-compare__text").textContent(), /testina legge le porzioni/);
    assert.doesNotMatch(await page.locator(".sl-disk-compare__text").textContent(), /rallent\w+ sempre/);
  });

  await suite.test("HDD usato, riepilogo: tutti i 48 cluster assegnati (20 preesistenti + 28 dei file)", async () => {
    await page.locator(SEL.proceed).click();
    await finish(page);
    assert.match(await page.locator(".sl-disk-compare__text").textContent(), /Cluster dei file: 28, preesistenti: 20, liberi: 0/);
  });

  await suite.test("SSD: nessun piatto né testina (nessuna scena a piatto, nessuna rotazione), chip e controller con 'accesso elettronico'", async () => {
    await page.locator(SEL.scenario(2)).click();
    assert.equal(await attr(page, "data-scenario"), "ssd");
    assert.equal(await page.locator(".sl-disk-scene__spin").count(), 0, "l'SSD mostra un disco che gira");
    assert.equal(await page.locator(".sl-disk-scene__arm, .sl-disk-scene__tip").count(), 0);
    assert.equal(await page.locator("[data-k]").count(), 6);
    assert.match(await page.locator(".sl-disk-compare__mode >> nth=1").textContent(), /Accesso elettronico/);
    assert.equal(await page.locator(".sl-disk-compare__step").count(), 6);
    assert.match(await page.locator(".sl-disk-compare__text").textContent(), /nessun piatto, nessuna testina, nessuna parte mobile/);
    await finish(page);
  });

  await suite.test("SSD: l'accesso elettronico è mostrato in 3D (camera sul chip, bus acceso) e la scrittura di selfie colora 5 cluster blu", async () => {
    await page.locator(SEL.proceed).click();
    const traces = new Set();
    const cams = new Set();
    await sample(page, async () => {
      traces.add(await page.locator(".sl-disk-scene__trace.is-on").count());
      cams.add((await camTransform(page)).includes("rotateX(40deg)"));
    }, 60);
    assert.ok(traces.has(1), "nessun bus elettrico acceso durante la scrittura");
    assert.ok(cams.has(true), "la camera non si avvicina al chip");
    assert.equal((await fileCells(page, "b")).length, 5);
  });

  await suite.test("SSD: scrittura E cancellazione di foto_pizza vengono mostrate (rosso compare, poi × e libero)", async () => {
    await page.locator(SEL.proceed).click();
    const reds = [];
    await sample(page, async () => reds.push((await fileCells(page, "r")).length), 50);
    assert.ok(reds.includes(3), "i 3 cluster rossi non sono mai stati scritti sull'SSD");
    await page.locator(SEL.proceed).click();
    const ghost = await sample(page, () => page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__cell")).filter((e) => e.textContent === "×").length), 40);
    assert.ok(ghost.some((n) => n > 0), "la cancellazione non è mostrata");
    assert.equal((await fileCells(page, "r")).length, 0);
  });

  await suite.test("SSD, sushi: stessi due gruppi 3 + 5 dell'HDD, senza spostamenti meccanici", async () => {
    await page.locator(SEL.proceed).click();
    await finish(page);
    assert.deepEqual(await fileCells(page, "y"), [5, 6, 7, 20, 21, 22, 23, 24]);
  });

  await suite.test("confronto affiancato: HDD a sinistra, SSD a destra; stesso comando di avvio; tabella con le 6 righe richieste", async () => {
    await page.locator(SEL.proceed).click();
    await page.clock.runFor(50);
    assert.equal(await attr(page, "data-compare"), "running");
    const boxes = await page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__compare-grid > .sl-card")).map((c) => c.getBoundingClientRect().left));
    assert.ok(boxes[0] < boxes[1], "HDD non è a sinistra");
    assert.equal(await page.locator(".sl-disk-compare__panel--scene").isHidden(), true);
    const rows = await page.locator(".sl-disk-compare__table tbody tr").evaluateAll((trs) => trs.map((tr) => Array.from(tr.children).map((c) => c.textContent.trim())));
    assert.deepEqual(rows.map((r) => r[0]), ["Tecnologia", "Parti meccaniche", "Accesso ai dati", "Tempi di accesso", "Effetti della frammentazione", "Rumore"]);
    assert.deepEqual(rows[1], ["Parti meccaniche", "Sì", "No"]);
    assert.equal(await page.locator(".sl-disk-compare__compare .sl-disk-scene__spin").count(), 1, "solo l'HDD ruota");
    assert.match(await page.locator(".sl-disk-compare__compare .sl-disk-compare__note").textContent(), /Non vale per ogni SSD in ogni operazione/);
  });

  await suite.test("confronto: sincronizzato — l'SSD avanza 5 volte più rapido dell'HDD in ogni istante (rapporto dal JSON), mai istantaneo", async () => {
    const read = () => page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__bar")).map((b) => Number(b.getAttribute("aria-valuenow"))));
    const [h0, s0] = await read();
    assert.ok(s0 < 100, "l'SSD è già al 100% all'avvio");
    await page.clock.runFor(800); // 10% del tempo totale dell'HDD
    const [h1, s1] = await read();
    assert.ok(Math.abs(s1 - h1 * disk.timing.ratio) <= disk.timing.ratio + 1, `HDD ${h1}% / SSD ${s1}%: rapporto non ${disk.timing.ratio}:1`);
    assert.ok(h1 > 0 && h1 < 100);
    void h0;
  });

  await suite.test("confronto: a fine corsa HDD 8,0 s e SSD 1,6 s simulati, stessa disposizione finale, SSD finisce prima", async () => {
    await page.clock.runFor(1000);
    assert.equal((await page.locator(".sl-disk-compare__bar >> nth=1").getAttribute("aria-valuenow")), "100");
    assert.notEqual(await page.locator(".sl-disk-compare__bar >> nth=0").getAttribute("aria-valuenow"), "100", "l'HDD è finito insieme all'SSD");
    assert.equal(await attr(page, "data-compare"), "running");
    await finish(page);
    assert.equal(await attr(page, "data-compare"), "done");
    const times = (await page.locator(".sl-disk-compare__time").allTextContents()).map((t) => t.trim());
    assert.deepEqual(times, ["8,0 s simulati", "1,6 s simulati"]);
    const finals = await page.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__compare-grid > .sl-card")).map((c) => Array.from(c.querySelectorAll(".sl-disk-compare__cell")).map((e) => e.dataset.file).join("")));
    assert.equal(finals[0], finals[1], "le disposizioni finali di HDD e SSD differiscono");
    assert.equal(finals[0].replace(/\./g, "").length, 25);
  });

  await suite.test("velocità: ingranaggio con 0.5x / 1x / 2x, default 1x; cambia solo i tempi, mai la sequenza né lo stato finale", async () => {
    await page.locator(SEL.scenario(0)).click();
    await finish(page); // passaggio 1 (1200 ms) a 1x
    await page.locator(SEL.settings).click();
    assert.deepEqual((await page.locator(".sl-disk-compare__speed-label").allTextContents()).map((t) => t.trim()), ["0.5x", "1x", "2x"]);
    assert.equal(await page.locator(".sl-disk-compare__speed-input:checked").getAttribute("value"), "1");
    await page.locator(".sl-disk-compare__speed-input[value=\"2\"]").check({ force: true });
    assert.equal(await attr(page, "data-speed"), "2");
    assert.equal(await page.locator(SEL.root).evaluate((el) => el.style.getPropertyValue("--k")), "0.5");
    await page.locator(SEL.restart).click();
    await page.clock.runFor(700);
    assert.equal(await animating(page), false, "a 2x il passaggio 1 (1200 ms) non è concluso entro 700 ms");
    await page.locator(SEL.proceed).click();
    await finish(page);
    assert.deepEqual(await fileCells(page, "b"), [0, 1, 2, 3, 4], "la velocità ha cambiato lo stato finale");
  });

  await suite.test("velocità 0.5x: il passaggio dura il doppio; l'ingranaggio è accessibile da tastiera e Esc lo chiude restituendo il focus", async () => {
    await page.locator(SEL.settings).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(SEL.settings).getAttribute("aria-expanded"), "true");
    await page.locator(".sl-disk-compare__speed-input[value=\"0.5\"]").check({ force: true });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(SEL.settings).getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement.className.includes("settings-trigger")), true);
    await page.locator(SEL.restart).click();
    await page.clock.runFor(1500);
    assert.equal(await animating(page), true, "a 0.5x il passaggio 1 non può essere concluso a 1500 ms");
    await page.clock.runFor(1200);
    assert.equal(await animating(page), false);
    // ripristina 1x per il resto del percorso
    await page.locator(SEL.settings).click();
    await page.locator(".sl-disk-compare__speed-input[value=\"1\"]").check({ force: true });
    await page.locator(SEL.settings).click();
  });

  await suite.test("tastiera: la barra dei passaggi è raggiungibile con Tab, Invio apre un passaggio sbloccato, un passaggio bloccato non reagisce", async () => {
    await page.locator(SEL.restart).click();
    await finish(page);
    await page.locator(SEL.step(0)).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.index), "1", "il passaggio 2 sbloccato non è nell'ordine di tabulazione");
    await page.locator(SEL.step(3)).focus();
    await page.keyboard.press("Enter");
    assert.equal(await attr(page, "data-step"), "0", "un passaggio bloccato ha reagito alla tastiera");
    await page.locator(SEL.step(1)).focus();
    await page.keyboard.press("Enter");
    assert.equal(await attr(page, "data-step"), "1");
    await finish(page);
    await page.locator(SEL.proceed).focus();
    await page.keyboard.press("Space");
    assert.equal(await attr(page, "data-step"), "2", "Procedi non si attiva con Spazio");
    await finish(page);
  });

  await suite.test("accessibilità: aria-current sul corrente, annuncio vocale del cambio passaggio, spunte e nomi leggibili", async () => {
    const current = await page.locator(`${SEL.root} [aria-current="step"]`).count();
    assert.equal(current, 1);
    const live = await page.locator(`${SEL.root} > .sl-visually-hidden[role="status"]`).textContent();
    assert.match(live, /Passaggio 3 di 6: Altri due file completato/);
    assert.equal(await page.locator("nav[aria-label='Passaggi dello scenario']").count(), 1);
    assert.match(await page.locator(SEL.step(0)).textContent(), /completato/);
  });

  await suite.test("tema: in Dark la barra dei passaggi e i file restano leggibili (corrente: text-inverse su primary-600)", async () => {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const res = await page.evaluate(() => {
      const el = document.querySelector(".sl-disk-compare__step--current");
      const cs = getComputedStyle(el);
      return [cs.color, cs.backgroundColor];
    });
    assert.ok(contrast(parseRgb(res[0]), parseRgb(res[1])) >= 4.5, `contrasto corrente in Dark ${contrast(parseRgb(res[0]), parseRgb(res[1])).toFixed(2)}`);
    await page.waitForTimeout(500); // attesa REALE: le transizioni CSS di tema non seguono l'orologio finto
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "disk-desktop-dark.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "disk-desktop-light.png"), fullPage: true });
  });

  for (const width of [768, 900, 1024]) {
    await suite.test(`responsive ${width}px: nessun overflow orizzontale`, async () => {
      await page.setViewportSize({ width, height: 900 });
      assert.deepEqual(await overflowing(page), []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `disk-${width}.png`), fullPage: true });
    });
  }

  await suite.test("responsive 375px: una colonna (animazione, griglia, legenda, comandi), barra passaggi scorrevole, nessun overflow", async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    const metrics = await page.evaluate(() => {
      const top = (sel) => document.querySelector(sel).getBoundingClientRect().top;
      const steps = document.querySelector(".sl-disk-compare__steps");
      return {
        order: [top(".sl-disk-compare__panel--scene"), top(".sl-disk-compare__panel--grid"), top(".sl-disk-compare__panel--files"), top(".sl-disk-compare__panel--explain")],
        scrolls: steps.scrollWidth > steps.clientWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        stepHeight: document.querySelector(".sl-disk-compare__step").getBoundingClientRect().height,
        procH: document.querySelector(".sl-disk-compare__actions .sl-button").getBoundingClientRect().height,
      };
    });
    assert.deepEqual([...metrics.order].sort((a, b) => a - b), metrics.order, "ordine delle sezioni non rispettato");
    assert.equal(metrics.scrolls, true, "la barra dei passaggi non scorre orizzontalmente");
    assert.deepEqual(await overflowing(page), []);
    assert.equal(metrics.overflow, false);
    assert.ok(metrics.stepHeight >= 44 && metrics.procH >= 44, "target di tocco sotto 44px");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "disk-mobile-375.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  // --- 3. Movimento ridotto ------------------------------------------------------
  const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await loginAsDocente(reducedPage, server.url);
  await openScenario(reducedPage);
  await installClock(reducedPage);

  await suite.test("riduci animazioni: i tempi sono ridotti (fattore 0.1), la rotazione del piatto è ferma", async () => {
    assert.equal(await reducedPage.locator(SEL.root).evaluate((el) => el.style.getPropertyValue("--k")), "0.1");
    const anim = await reducedPage.locator(".sl-disk-scene__spin").evaluate((el) => getComputedStyle(el).animationName);
    assert.equal(anim, "none");
    await reducedPage.clock.runFor(200);
    assert.equal(await animating(reducedPage), false, "il passaggio 1 (1200 ms) non è concluso entro 200 ms ridotti");
  });

  await suite.test("riduci animazioni: Procedi funziona con le stesse regole e porta a termine l'intera scrittura nello stesso stato finale", async () => {
    await reducedPage.locator(SEL.proceed).click();
    assert.equal(await reducedPage.locator(SEL.proceed).isDisabled(), true, "Procedi non si disabilita durante l'animazione ridotta");
    for (let i = 0; i < 400 && (await animating(reducedPage)); i += 1) await reducedPage.clock.runFor(100);
    assert.equal(await reducedPage.locator(SEL.step(2)).getAttribute("aria-disabled"), null);
    assert.equal(await reducedPage.locator(SEL.step(3)).getAttribute("aria-disabled"), "true");
    const blue = await reducedPage.evaluate(() => Array.from(document.querySelectorAll(".sl-disk-compare__cell[data-file='b']")).length);
    assert.equal(blue, 5);
  });
  await reducedContext.close();

  // --- 4. Degrado, smontaggio, richieste esterne --------------------------------------
  await suite.test("smontaggio a metà animazione: tornando alla Home nessun errore e nessun fotogramma in ritardo", async () => {
    await page.locator(SEL.restart).click();
    await page.locator(SEL.proceed).waitFor();
    await finish(page);
    await page.locator(SEL.proceed).click();
    await page.clock.runFor(500);
    assert.equal(await animating(page), true);
    await page.locator(".sl-app-header__home, .sl-sidebar__link[href='#/home']").first().click();
    await page.waitForFunction(() => window.location.hash === "#/home");
    await page.clock.runFor(4000);
    assert.equal(await page.locator(SEL.root).count(), 0);
    assert.deepEqual(pageErrors, []);
  });

  const degradeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const degradePage = await degradeContext.newPage();
  const degradeConsole = [];
  degradePage.on("console", (m) => {
    if (m.type() === "error") degradeConsole.push(m.text());
  });
  await loginAsDocente(degradePage, server.url);

  await suite.test("degrado: disk.json mancante → messaggio condiviso, nessuna scena, errore in console", async () => {
    await degradePage.route("**/data/scenarios/hdd-vs-ssd/disk.json", (route) => route.fulfill({ status: 404, body: "" }));
    await degradePage.goto(`${server.url}/#/scenario/hdd-vs-ssd`);
    await degradePage.reload();
    await degradePage.waitForFunction(() => document.querySelector(".sl-scenario-viewport")?.textContent.includes("non è disponibile"));
    assert.equal(await degradePage.locator(SEL.root).count(), 0);
    assert.ok(degradeConsole.length > 0);
    await degradePage.unroute("**/data/scenarios/hdd-vs-ssd/disk.json");
  });

  await suite.test("degrado: disk.json non valido (init di lunghezza errata) → messaggio condiviso e motivo in console", async () => {
    degradeConsole.length = 0;
    await degradePage.route("**/data/scenarios/hdd-vs-ssd/disk.json", (route) => {
      const broken = structuredClone(disk);
      broken.scenarios[0].init = ["...."];
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(broken) });
    });
    await degradePage.reload();
    await degradePage.waitForFunction(() => document.querySelector(".sl-scenario-viewport")?.textContent.includes("non è disponibile"));
    assert.equal(await degradePage.locator(SEL.root).count(), 0);
    assert.ok(degradeConsole.some((t) => t.includes("init deve avere 48 cluster")), JSON.stringify(degradeConsole));
    await degradePage.unroute("**/data/scenarios/hdd-vs-ssd/disk.json");
  });
  await degradeContext.close();

  await suite.test("nessun errore JS, nessuna risorsa locale mancante, nessuna richiesta verso l'esterno durante tutto il percorso", async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedLocal, []);
    const external = requests.filter((url) => !url.startsWith(server.url) && !url.startsWith("data:") && !url.startsWith("blob:"));
    assert.deepEqual(external, [], `richieste esterne: ${external.join(", ")}`);
  });

  await context.close();
  await browser.close();
  await server.close();
  return suite.summary();
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
