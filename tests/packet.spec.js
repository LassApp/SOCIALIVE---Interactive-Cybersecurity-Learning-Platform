/**
 * packet.spec.js
 * -----------------------------------------------------------------------
 * Scenario "Viaggio dei dati" (type "packet-journey", area Reti), in
 * quattro parti:
 *   1. DATI e UTILITÀ (scenario.json, network.json, voce in modules.json,
 *      packetRoute.js): rete di sicurezza contro un JSON modificato a
 *      mano — un percorso che non segue i collegamenti, un colore non
 *      ammesso, un ordine di arrivo uguale a quello di partenza — prima
 *      che lo scopra la LIM. La logica pura gira nel browser reale
 *      (import dinamico dal server di test).
 *   2. RENDERER con movimento pieno: percorso reale dalla Sidebar
 *      (Scenari → Reti → Viaggio dei dati), i tre passi uno per uno con
 *      OROLOGIO FINTO (page.clock, fermo e fatto avanzare a mano:
 *      nessun controllo dipende dai tempi reali della macchina), l'ordine
 *      di arrivo osservato NEL TEMPO, il riordino, l'anello ricostruito,
 *      "Ricomincia", contrasto numerico dei colori, assenza di overflow
 *      su più larghezze, screenshot Light/Dark.
 *   3. "riduci animazioni": ogni passo salta allo stato finale.
 *   4. Degrado controllato (file mancante o non valido), smontaggio a
 *      metà animazione e assenza di richieste verso l'esterno.
 * Richiede SL_TEST_EMAIL / SL_TEST_PASSWORD come le altre suite.
 *
 * AGGANCI STABILI — la radice espone data-step ("0".."3") e
 * data-animating ("true"/"false"); i pacchetti si leggono dal transform
 * dei gruppi SVG, mai da coordinate scritte nel test.
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
const DATA_DIR = path.join(APP_ROOT, "data", "scenarios", "viaggio-dei-dati");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const SEL = {
  root: ".sl-packet-journey",
  title: ".sl-packet-journey__title",
  proceed: ".sl-packet-journey__proceed",
  restart: ".sl-packet-journey__restart",
  stepperItem: ".sl-packet-journey__stepper-item",
  captionStep: ".sl-packet-journey__caption-step",
  captionTitle: ".sl-packet-journey__caption-title",
  captionText: ".sl-packet-journey__caption-text",
  outcome: ".sl-packet-journey__outcome",
  stage: ".sl-packet-journey__stage",
  svg: ".sl-packet-journey__svg",
};

const MAX_STEP_MS = 8000; // criterio del prompt: nessun passo oltre gli 8 secondi

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
}

// Luminanza relativa e contrasto WCAG tra due colori "rgb(r, g, b)".
function parseRgb(css) {
  return css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
}
function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(parseRgb(a)), luminance(parseRgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pacchetti letti dal DOM, indicizzati per numero d'ordine (seq). */
async function readPackets(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll(".sl-packet-journey__packet-number").forEach((numberNode) => {
      const group = numberNode.parentElement;
      const m = (group.getAttribute("transform") || "").match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
      out[numberNode.textContent.trim()] = {
        seq: Number(numberNode.textContent.trim()),
        x: m ? Number(m[1]) : NaN,
        y: m ? Number(m[2]) : NaN,
        scale: m ? Number(m[3]) : NaN,
        opacity: Number(group.style.opacity),
        stroke: group.querySelector(".sl-packet-journey__packet-body").style.stroke,
      };
    });
    return out;
  });
}

/** Archi dell'anello (nell'ordine del DOM = numero d'ordine crescente). */
async function readArcs(page) {
  return page.evaluate(() => {
    const layer = document.querySelectorAll(".sl-packet-journey__svg > g")[2];
    return Array.from(layer.querySelectorAll(":scope > g > g")).map((group) => ({
      opacity: Number(group.style.opacity),
      transform: group.getAttribute("transform") || "",
      fill: group.querySelector("path").style.fill,
    }));
  });
}

const layerOpacity = (page, index) =>
  page.evaluate((i) => Number(document.querySelectorAll(".sl-packet-journey__svg > g")[i].style.opacity), index);

const dataStep = (page) => page.locator(SEL.root).getAttribute("data-step");
const isAnimating = async (page) => (await page.locator(SEL.root).getAttribute("data-animating")) === "true";

/** Avanza l'orologio finto a piccoli passi finché il passo termina; restituisce i ms trascorsi. */
async function runUntilIdle(page, { stepMs = 50, limitMs = 12000, onTick } = {}) {
  let elapsed = 0;
  while ((await isAnimating(page)) && elapsed < limitMs) {
    await page.clock.runFor(stepMs);
    elapsed += stepMs;
    if (onTick) await onTick(elapsed);
  }
  return elapsed;
}

const orderByX = (packets) =>
  Object.values(packets)
    .sort((a, b) => a.x - b.x)
    .map((p) => p.seq);

async function openScenario(page) {
  await openScenarioViaSidebar(page, "Reti", "Viaggio dei dati");
  await page.waitForSelector(SEL.root);
  await page.waitForTimeout(150); // lascia esaurire il doppio rAF del fade-in di pagina
}

async function run() {
  const suite = createSuite("packet.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const scenario = readJson("scenario.json");
  const network = readJson("network.json");
  const modules = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "modules.json"), "utf8")).modules;

  // --- 1. Dati e utilità ---------------------------------------------------
  await suite.test("scenario.json: id, type 'packet-journey', titolo e riferimento ai dati esistente", async () => {
    assert.equal(scenario.id, "viaggio-dei-dati");
    assert.equal(scenario.type, "packet-journey");
    assert.equal(scenario.title, "Viaggio dei dati");
    assert.ok(fs.existsSync(path.join(APP_ROOT, scenario.dataRefs.network)), "dataRefs.network non punta a un file esistente");
  });

  await suite.test("modules.json: area 'reti' con icona esistente, descrizione e lo scenario disponibile", async () => {
    const area = modules.find((m) => m.id === "reti");
    assert.ok(area, "area 'reti' assente");
    assert.equal(area.title, "Reti");
    assert.equal(area.available, true);
    assert.ok(area.description && area.description.length > 10);
    assert.ok(fs.existsSync(path.join(APP_ROOT, area.icon)), "icona dell'area non trovata");
    assert.deepEqual(area.scenarios.map((s) => [s.id, s.available]), [["viaggio-dei-dati", true]]);
  });

  await suite.test("modules.json: l'area 'reti' si aggiunge in coda, le aree esistenti restano al loro posto", async () => {
    assert.deepEqual(modules.map((m) => m.id), ["cybersecurity", "ai", "reti"]);
  });

  const utilPage = await (await browser.newContext()).newPage();
  await utilPage.goto(`${server.url}/index.html`);
  const inBrowser = (fn, arg) =>
    utilPage.evaluate(
      async ({ source, arg: a }) => {
        const route = await import("/js/utils/packetRoute.js");
        // eslint-disable-next-line no-new-func
        return new Function("route", "arg", `return (${source})(route, arg);`)(route, a);
      },
      { source: fn.toString(), arg }
    );

  await suite.test("network.json supera validatePacketNetwork (nessun errore)", async () => {
    assert.deepEqual(await inBrowser((r, n) => r.validatePacketNetwork(n), network), []);
  });

  let expectedRanks;
  await suite.test("l'ordine di ARRIVO dai dati non coincide con quello di partenza, con intervalli leggibili (≥ 500 ms)", async () => {
    const arrivals = await inBrowser((r, n) => {
      const byId = Object.fromEntries(n.nodes.map((node) => [node.id, node]));
      return [...n.packets]
        .sort((a, b) => a.seq - b.seq)
        .map((p) => p.departMs + r.buildTimeline(p.route.map((id) => byId[id]), p.speed, n.timing.dwellMs).totalMs);
    }, network);
    expectedRanks = await inBrowser((r, a) => r.computeArrivalRanks(a), arrivals);
    assert.deepEqual([...expectedRanks].sort(), [0, 1, 2, 3], "i ranghi non sono una permutazione");
    assert.notDeepEqual(expectedRanks, [0, 1, 2, 3], "ordine di arrivo = ordine di partenza");
    const sorted = [...arrivals].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) assert.ok(sorted[i] - sorted[i - 1] >= 500, `due arrivi a meno di 500 ms (${sorted})`);
  });

  await suite.test("validatePacketNetwork: percorso che non segue i collegamenti → errore", async () => {
    const errors = await inBrowser((r, n) => {
      const bad = structuredClone(n);
      bad.packets[0].route = ["P", "a", "A"];
      return r.validatePacketNetwork(bad);
    }, network);
    assert.ok(errors.some((e) => e.includes("non è un collegamento")), JSON.stringify(errors));
  });

  await suite.test("validatePacketNetwork: colore non ammesso, 3 pacchetti, nodo di arrivo mancante → errori distinti", async () => {
    const result = await inBrowser((r, n) => {
      const color = structuredClone(n);
      color.packets[1].color = "#ff0000";
      const count = structuredClone(n);
      count.packets.pop();
      const noEnd = structuredClone(n);
      noEnd.nodes = noEnd.nodes.map((node) => (node.role === "end" ? { ...node, role: "hop" } : node));
      return [r.validatePacketNetwork(color), r.validatePacketNetwork(count), r.validatePacketNetwork(noEnd)];
    }, network);
    assert.ok(result[0].some((e) => e.includes("color non ammesso")), JSON.stringify(result[0]));
    assert.ok(result[1].some((e) => e.includes("esattamente 4 pacchetti")), JSON.stringify(result[1]));
    assert.ok(result[2].some((e) => e.includes("role \"end\"")), JSON.stringify(result[2]));
  });

  await suite.test("validatePacketNetwork: ordine di arrivo = ordine di partenza → errore didattico", async () => {
    const errors = await inBrowser((r, n) => {
      const same = structuredClone(n);
      // stessa velocità e stesso percorso per tutti, partenze scaglionate: arrivano come sono partiti
      same.packets.forEach((p, i) => {
        p.route = ["P", "N", "d", "f", "A"];
        p.speed = 300;
        p.departMs = i * 800;
      });
      return r.validatePacketNetwork(same);
    }, network);
    assert.ok(errors.some((e) => e.includes("scopo didattico")), JSON.stringify(errors));
  });

  await suite.test("offsetPolyline: su un tratto orizzontale le corsie restano parallele alla distanza richiesta", async () => {
    const lanes = await inBrowser((r) => {
      const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      return [-9, -3, 3, 9].map((d) => r.offsetPolyline(line, d).map((p) => [p.x, p.y]));
    });
    lanes.forEach((points, i) => {
      const d = [-9, -3, 3, 9][i];
      points.forEach(([x, y], j) => {
        assert.equal(x, j === 0 ? 0 : 100);
        assert.ok(Math.abs(Math.abs(y) - Math.abs(d)) < 1e-9, `corsia ${d}: y=${y}`);
      });
    });
    assert.ok(lanes[0][0][1] * lanes[3][0][1] < 0, "le corsie estreme dovrebbero stare da lati opposti");
  });

  await suite.test("buildTimeline/sampleTimeline: tempi coerenti, sosta nei soli nodi intermedi, estremi esatti", async () => {
    const r = await inBrowser((route) => {
      const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
      const tl = route.buildTimeline(pts, 200, 150); // 100px a 200px/s = 500ms per tratto
      return {
        total: tl.totalMs,
        length: tl.length,
        arrivals: tl.arrivals.map((a) => a.t),
        start: route.sampleTimeline(tl, 0),
        dwell: route.sampleTimeline(tl, 550),
        end: route.sampleTimeline(tl, 99999),
      };
    });
    assert.equal(r.total, 500 + 150 + 500);
    assert.equal(r.length, 200);
    assert.deepEqual(r.arrivals, [500, 1150]);
    assert.deepEqual([r.start.x, r.start.y, r.start.distance], [0, 0, 0]);
    assert.deepEqual([r.dwell.x, r.dwell.y, r.dwell.distance], [100, 0, 100]);
    assert.deepEqual([r.end.x, r.end.y, r.end.distance], [100, 100, 200]);
  });
  await utilPage.context().close();

  // --- 2. Renderer, movimento pieno ----------------------------------------
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
  await openScenario(page);

  // Orologio finto, FERMO: i passi avanzano solo con runFor().
  await page.clock.install({ time: 1_000_000 });
  await page.clock.pauseAt(1_001_000);

  await suite.test("apertura dalla Sidebar: #/scenario/viaggio-dei-dati, h1, badge area 'Reti', chrome standard", async () => {
    assert.equal(await page.evaluate(() => window.location.hash), "#/scenario/viaggio-dei-dati");
    assert.equal((await page.locator(SEL.title).textContent()).trim(), "Viaggio dei dati");
    assert.equal(await page.locator(SEL.root).locator("h1").count(), 1);
    assert.equal((await page.locator(`${SEL.root} .sl-badge`).textContent()).trim(), "Reti");
    assert.equal(await page.locator(".sl-sidebar").count(), 1);
    assert.equal(await page.locator(".sl-scenario-viewport").getAttribute("aria-busy"), null);
  });

  await suite.test("scena: 12 nodi, 23 collegamenti, etichette Partenza / Nodo / Arrivo, titolo accessibile della scena", async () => {
    assert.equal(await page.locator(".sl-packet-journey__node").count(), network.nodes.length);
    assert.equal(await page.locator(".sl-packet-journey__link").count(), network.links.length);
    const labels = (await page.locator(".sl-packet-journey__node-label").allTextContents()).map((t) => t.trim());
    assert.deepEqual(labels.sort(), ["Arrivo", "Nodo", "Partenza"]);
    assert.equal(await page.locator(SEL.svg).getAttribute("role"), "img");
    assert.equal(await page.locator(SEL.svg).getAttribute("aria-label"), network.labels.stage);
  });

  await suite.test("stato a riposo: passo 0, Prosegui attivo, Ricomincia nascosto, anello intero, pacchetti e mappa spenti", async () => {
    assert.equal(await dataStep(page), "0");
    assert.equal(await isAnimating(page), false);
    assert.equal((await page.locator(SEL.proceed).textContent()).trim(), "Prosegui");
    assert.equal(await page.locator(SEL.proceed).isEnabled(), true);
    assert.equal(await page.locator(SEL.restart).isHidden(), true);
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Punto di partenza");
    assert.equal((await page.locator(SEL.captionTitle).textContent()).trim(), network.steps[0].title);
    assert.equal((await page.locator(SEL.captionText).textContent()).trim(), network.steps[0].text);
    const arcs = await readArcs(page);
    assert.equal(arcs.length, 4);
    arcs.forEach((arc) => assert.equal(arc.opacity, 1));
    const packets = await readPackets(page);
    Object.values(packets).forEach((p) => assert.equal(p.opacity, 0));
    assert.equal(await layerOpacity(page, 0), 0, "la mappa dovrebbe essere spenta");
  });

  await suite.test("stepper: 4 voci con i testi di network.json, solo la prima è 'corrente' (aria-current='step')", async () => {
    const items = (await page.locator(SEL.stepperItem).allTextContents()).map((t) => t.trim());
    assert.deepEqual(items, network.steps.map((s) => s.stepper));
    assert.equal(await page.locator(`${SEL.stepperItem}[aria-current="step"]`).count(), 1);
    assert.equal((await page.locator(`${SEL.stepperItem}[aria-current="step"]`).textContent()).trim(), network.steps[0].stepper);
  });

  await suite.test("a11y: Prosegui è un <button> reale; didascalia in regione 'status'; riquadro scena focalizzabile da codice", async () => {
    assert.equal(await page.locator(SEL.proceed).evaluate((el) => el.tagName), "BUTTON");
    assert.equal(await page.locator(".sl-packet-journey__caption").getAttribute("role"), "status");
    assert.equal(await page.locator(SEL.stage).getAttribute("tabindex"), "-1");
  });

  // Passo 1 ------------------------------------------------------------------
  await suite.test("passo 1: all'avvio Prosegui si disabilita, il focus passa alla scena, la didascalia cambia", async () => {
    await page.locator(SEL.proceed).focus();
    await page.locator(SEL.proceed).click();
    assert.equal(await dataStep(page), "1");
    assert.equal(await isAnimating(page), true);
    assert.equal(await page.locator(SEL.proceed).isDisabled(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__stage")), true);
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Passo 1 di 3");
    assert.equal((await page.locator(SEL.captionTitle).textContent()).trim(), network.steps[1].title);
    assert.equal(await page.locator(`${SEL.stepperItem}[aria-current="step"]`).textContent().then((t) => t.trim()), network.steps[1].stepper);
  });

  await suite.test("passo 1: un click forzato mentre l'animazione corre non avanza al passo successivo", async () => {
    await page.locator(SEL.proceed).evaluate((el) => el.click());
    await page.clock.runFor(100);
    assert.equal(await dataStep(page), "1");
  });

  await suite.test("passo 1, a metà: gli archi si stanno staccando e compaiono i primi pacchetti", async () => {
    await page.clock.runFor(900); // ~1000 ms dall'avvio
    const packets = await readPackets(page);
    assert.ok(Object.values(packets).some((p) => p.opacity > 0), "nessun pacchetto visibile a metà del passo 1");
    const arcs = await readArcs(page);
    assert.ok(arcs.some((a) => a.opacity < 1), "gli archi non hanno iniziato a trasformarsi in pacchetti");
  });

  await suite.test("passo 1, fine: 4 pacchetti numerati 1..4 a ventaglio da sinistra a destra, anello scomposto, Prosegui di nuovo attivo col focus", async () => {
    const elapsed = await runUntilIdle(page);
    assert.ok(elapsed + 1000 <= MAX_STEP_MS, `il passo 1 dura troppo (${elapsed + 1000} ms)`);
    assert.equal(await dataStep(page), "1");
    const packets = await readPackets(page);
    assert.deepEqual(Object.keys(packets).sort(), ["1", "2", "3", "4"]);
    Object.values(packets).forEach((p) => {
      assert.equal(p.opacity, 1);
      assert.equal(p.scale, 1);
    });
    assert.deepEqual(orderByX(packets), [1, 2, 3, 4], "il ventaglio non è ordinato da sinistra a destra");
    (await readArcs(page)).forEach((arc) => assert.equal(arc.opacity, 0));
    assert.equal(await page.locator(SEL.proceed).isEnabled(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__proceed")), true);
  });

  await suite.test("passo 1: ogni pacchetto ha un colore diverso (stroke) e lo stesso colore del proprio arco", async () => {
    const packets = await readPackets(page);
    const strokes = [1, 2, 3, 4].map((s) => packets[s].stroke);
    assert.equal(new Set(strokes).size, 4, `colori dei pacchetti non distinti: ${strokes}`);
    strokes.forEach((stroke, i) => assert.equal(stroke, `var(--sl-color-${network.packets.find((p) => p.seq === i + 1).color}-500)`));
  });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-step1-light.png"), fullPage: true });

  // Passo 2 ------------------------------------------------------------------
  const arrivalSeen = [];
  let step2Ms = 0;
  await suite.test("passo 2: dopo il click la mappa si accende e i pacchetti non sono ancora tutti partiti", async () => {
    await page.locator(SEL.proceed).click();
    assert.equal(await dataStep(page), "2");
    assert.equal((await page.locator(SEL.captionTitle).textContent()).trim(), network.steps[2].title);
    await page.clock.runFor(1500);
    assert.ok((await layerOpacity(page, 0)) > 0.9, "la mappa non è comparsa");
    const packets = await readPackets(page);
    assert.ok(Object.values(packets).every((p) => p.scale < 1), "i pacchetti dovrebbero essere già rimpiccioliti sulla mappa");
  });

  await suite.test("passo 2: i pacchetti arrivano in TEMPI diversi, nell'ordine previsto dai dati e diverso da quello di partenza", async () => {
    step2Ms = 1500;
    const trayY = 560; // il vassoio sta sotto la mappa: il nodo più basso è a y=520, le caselle a y=576
    step2Ms += await runUntilIdle(page, {
      stepMs: 25,
      onTick: async () => {
        const packets = await readPackets(page);
        Object.values(packets).forEach((p) => {
          if (p.y > trayY && !arrivalSeen.includes(p.seq)) arrivalSeen.push(p.seq);
        });
      },
    });
    assert.equal(arrivalSeen.length, 4, `arrivati nel vassoio: ${arrivalSeen}`);
    assert.notDeepEqual(arrivalSeen, [1, 2, 3, 4], "ordine di arrivo = ordine di partenza");
    const expected = [1, 2, 3, 4].sort((a, b) => expectedRanks[a - 1] - expectedRanks[b - 1]);
    assert.deepEqual(arrivalSeen, expected, "l'ordine osservato nel tempo non corrisponde a quello calcolato dai dati");
  });

  await suite.test("passo 2: durata entro gli 8 secondi e ordine di arrivo annunciato agli screen reader", async () => {
    assert.ok(step2Ms <= MAX_STEP_MS, `il passo 2 dura ${step2Ms} ms`);
    assert.equal(await dataStep(page), "2");
    const order = arrivalSeen.join(", ");
    assert.equal((await page.locator(SEL.outcome).textContent()).trim(), `Pacchetti arrivati nell'ordine: ${order}.`);
  });

  await suite.test("passo 2, fine: mappa visibile, 4 scie complete di colori diversi, pacchetti nelle caselle del vassoio secondo l'ordine di arrivo", async () => {
    assert.equal(await layerOpacity(page, 0), 1);
    const trails = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".sl-packet-journey__trail")).map((t) => ({
        offset: Number(t.style.strokeDashoffset),
        opacity: Number(t.style.opacity),
        color: t.style.stroke,
      }))
    );
    assert.equal(trails.length, 4);
    trails.forEach((t) => {
      assert.ok(Math.abs(t.offset) < 0.5, `scia non completa (offset ${t.offset})`);
      assert.equal(t.opacity, 1);
    });
    assert.equal(new Set(trails.map((t) => t.color)).size, 4, "le scie non hanno 4 colori distinti");
    const packets = await readPackets(page);
    const slots = await page.evaluate(() => Array.from(document.querySelectorAll(".sl-packet-journey__tray-slot")).map((c) => Number(c.getAttribute("cx"))));
    arrivalSeen.forEach((seq, rank) => assert.ok(Math.abs(packets[seq].x - slots[rank]) < 0.5, `il pacchetto ${seq} non è nella casella ${rank + 1}`));
    const ordinals = await page.evaluate(() => Array.from(document.querySelectorAll(".sl-packet-journey__tray-ordinal")).map((o) => Number(o.style.opacity)));
    assert.deepEqual(ordinals, [1, 1, 1, 1]);
  });

  await suite.test("passo 2: le scie percorrono solo collegamenti reali (le polilinee passano per i nodi del percorso)", async () => {
    const result = await page.evaluate(() => {
      const trails = Array.from(document.querySelectorAll(".sl-packet-journey__trail"));
      return trails.map((trail) => (trail.getAttribute("d").match(/[\d.]+ [\d.-]+/g) || []).length);
    });
    const expected = [...network.packets].sort((a, b) => a.seq - b.seq).map((p) => p.route.length);
    assert.deepEqual(result, expected);
  });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-step2-light.png"), fullPage: true });

  // Passo 3 ------------------------------------------------------------------
  await suite.test("passo 3, all'inizio i pacchetti salgono in riga NELL'ORDINE DI ARRIVO", async () => {
    await page.locator(SEL.proceed).click();
    assert.equal(await dataStep(page), "3");
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Passo 3 di 3");
    await page.clock.runFor(800);
    const packets = await readPackets(page);
    assert.deepEqual(orderByX(packets), arrivalSeen, "la riga non rispetta l'ordine di arrivo");
    assert.ok((await layerOpacity(page, 0)) < 0.2, "la mappa dovrebbe essere quasi dissolta");
  });

  await suite.test("passo 3, dopo il riordino i pacchetti stanno in riga nell'ORDINE CORRETTO 1,2,3,4", async () => {
    await page.clock.runFor(1450); // ~2250 ms dall'avvio: riordino concluso, fusione non ancora iniziata (2300 ms)
    const packets = await readPackets(page);
    assert.deepEqual(orderByX(packets), [1, 2, 3, 4]);
  });

  await suite.test("passo 3, fine: anello ricostruito (4 archi uniti, stessa sequenza di colori di prima), pacchetti assorbiti, spunta visibile", async () => {
    const elapsed = await runUntilIdle(page);
    assert.ok(2250 + elapsed <= MAX_STEP_MS, `il passo 3 dura troppo (${2250 + elapsed} ms)`);
    assert.equal(await dataStep(page), "3");
    const arcs = await readArcs(page);
    assert.equal(arcs.length, 4);
    arcs.forEach((arc, i) => {
      assert.equal(arc.opacity, 1, `arco ${i + 1} non visibile`);
      assert.ok(/^translate\(-?0 -?0\)$/.test(arc.transform), `arco ${i + 1} non riunito: ${arc.transform}`);
    });
    const colors = [...network.packets].sort((a, b) => a.seq - b.seq).map((p) => `var(--sl-color-${p.color}-500)`);
    assert.deepEqual(arcs.map((a) => a.fill), colors, "i colori dell'anello non sono nell'ordine originale");
    Object.values(await readPackets(page)).forEach((p) => assert.equal(p.opacity, 0));
    const check = await page.evaluate(() => {
      const el = document.querySelector(".sl-packet-journey__check");
      return { opacity: Number(el.style.opacity), offset: Number(el.style.strokeDashoffset) };
    });
    assert.equal(check.opacity, 1);
    assert.ok(Math.abs(check.offset) < 0.5);
    assert.equal(await layerOpacity(page, 0), 0);
  });

  await suite.test("passo 3, fine: Prosegui nascosto, Ricomincia visibile col focus, esito annunciato, stepper al quarto passo", async () => {
    assert.equal(await page.locator(SEL.proceed).isHidden(), true);
    assert.equal(await page.locator(SEL.restart).isVisible(), true);
    assert.equal((await page.locator(SEL.restart).textContent()).trim(), "Ricomincia");
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__restart")), true);
    assert.equal((await page.locator(SEL.outcome).textContent()).trim(), network.announcements.rebuilt);
    assert.equal((await page.locator(`${SEL.stepperItem}[aria-current="step"]`).textContent()).trim(), network.steps[3].stepper);
    assert.equal(await page.locator(".sl-packet-journey__stepper-item--done").count(), 3);
  });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-step3-light.png"), fullPage: true });

  await suite.test("Dark: stesso stato finale, contrasto grafico dei 4 colori sulla superficie ≥ 3:1 in Light e in Dark", async () => {
    const measure = () =>
      page.evaluate(() => {
        const surface = getComputedStyle(document.querySelector(".sl-packet-journey__stage")).backgroundColor;
        const colors = Array.from(document.querySelectorAll(".sl-packet-journey__packet-body")).map((b) => getComputedStyle(b).stroke);
        return { surface, colors };
      });
    const light = await measure();
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const dark = await measure();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-step3-dark.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    [["Light", light], ["Dark", dark]].forEach(([name, m]) => {
      assert.equal(m.colors.length, 4);
      m.colors.forEach((c) => assert.ok(contrast(c, m.surface) >= 3, `${name}: ${c} su ${m.surface} = ${contrast(c, m.surface).toFixed(2)}:1`));
    });
    assert.notEqual(light.surface, dark.surface, "il tema scuro non cambia la superficie");
  });

  await suite.test("Ricomincia: ritorno al passo 0 (anello intero, Prosegui attivo col focus, esito azzerato) e secondo giro possibile", async () => {
    await page.locator(SEL.restart).click();
    assert.equal(await dataStep(page), "0");
    assert.equal(await isAnimating(page), false);
    assert.equal(await page.locator(SEL.proceed).isVisible(), true);
    assert.equal(await page.locator(SEL.restart).isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__proceed")), true);
    assert.equal((await page.locator(SEL.outcome).textContent()).trim(), "");
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Punto di partenza");
    (await readArcs(page)).forEach((arc) => assert.equal(arc.opacity, 1));
    Object.values(await readPackets(page)).forEach((p) => assert.equal(p.opacity, 0));
    await page.locator(SEL.proceed).click();
    await runUntilIdle(page);
    assert.equal(await dataStep(page), "1");
    assert.deepEqual(orderByX(await readPackets(page)), [1, 2, 3, 4]);
  });

  await suite.test("larghezze 900 e 375 px: nessun overflow orizzontale, scena 16:9, controlli impilati su mobile", async () => {
    for (const width of [900, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(50);
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ratio: document.querySelector(".sl-packet-journey__svg").getBoundingClientRect().width / document.querySelector(".sl-packet-journey__svg").getBoundingClientRect().height,
        rowColumns: getComputedStyle(document.querySelector(".sl-packet-journey__control-row")).gridTemplateColumns.split(" ").length,
      }));
      assert.equal(m.overflow, false, `overflow orizzontale a ${width}px`);
      assert.ok(Math.abs(m.ratio - 1120 / 630) < 0.02, `scena non 16:9 a ${width}px (${m.ratio})`);
      if (width === 375) assert.equal(m.rowColumns, 1, "i controlli non si impilano su mobile");
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-mobile-375.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  // --- 3. Movimento ridotto -------------------------------------------------
  const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await loginAsDocente(reducedPage, server.url);
  await openScenario(reducedPage);
  await reducedPage.clock.install({ time: 1_000_000 });
  await reducedPage.clock.pauseAt(1_001_000);

  await suite.test("riduci animazioni: ogni 'Prosegui' salta subito allo stato finale del passo, senza far avanzare il tempo", async () => {
    await reducedPage.locator(SEL.proceed).click();
    assert.equal(await dataStep(reducedPage), "1");
    assert.equal(await isAnimating(reducedPage), false, "il passo 1 non è concluso subito");
    assert.deepEqual(orderByX(await readPackets(reducedPage)), [1, 2, 3, 4]);

    await reducedPage.locator(SEL.proceed).click();
    assert.equal(await dataStep(reducedPage), "2");
    assert.equal(await isAnimating(reducedPage), false, "il passo 2 non è concluso subito");
    assert.equal(await layerOpacity(reducedPage, 0), 1);
    const packets = await readPackets(reducedPage);
    assert.ok(Object.values(packets).every((p) => p.y > 560), "i pacchetti non sono tutti nel vassoio");
    assert.match((await reducedPage.locator(SEL.outcome).textContent()).trim(), /^Pacchetti arrivati nell'ordine: \d(, \d){3}\.$/);

    await reducedPage.locator(SEL.proceed).click();
    assert.equal(await dataStep(reducedPage), "3");
    assert.equal(await isAnimating(reducedPage), false, "il passo 3 non è concluso subito");
    (await readArcs(reducedPage)).forEach((arc) => assert.equal(arc.opacity, 1));
    assert.equal(await reducedPage.locator(SEL.restart).isVisible(), true);
  });
  await reducedContext.close();

  // --- 4. Degrado, smontaggio, richieste esterne -----------------------------
  await suite.test("smontaggio a metà animazione: tornando alla Home la scena sparisce, nessun errore e nessun fotogramma in ritardo", async () => {
    await page.locator(SEL.proceed).click(); // passo 2 in corso (il passo 1 era già concluso)
    assert.equal(await isAnimating(page), true);
    await page.clock.runFor(1200);
    const errorsBefore = pageErrors.length;
    await page.locator(".sl-app-header__home, .sl-sidebar__link[href='#/home']").first().click();
    await page.waitForFunction(() => window.location.hash === "#/home");
    await page.waitForSelector(".sl-home-page__area-item");
    await page.clock.runFor(3000);
    assert.equal(await page.locator(SEL.root).count(), 0);
    assert.equal(pageErrors.length, errorsBefore, `errori JS dopo lo smontaggio: ${pageErrors.slice(errorsBefore)}`);
  });

  await suite.test("Home: l'area 'Reti' compare con il suo scenario come link, e la ricerca 'viaggio' la individua", async () => {
    const card = page.locator(".sl-home-page__area-item", { hasText: "Reti" });
    assert.equal(await card.count(), 1);
    assert.equal((await card.locator(".sl-area-card__scenario").textContent()).trim(), "Viaggio dei dati");
    assert.equal(await card.locator(".sl-area-card__scenario").getAttribute("href"), "#/scenario/viaggio-dei-dati");
    await page.fill(".sl-app-header__search input", "viaggio");
    await page.waitForTimeout(200);
    const visible = (await page.locator(".sl-home-page__area-item:not([hidden]) .sl-area-card__title").allTextContents()).map((t) => t.trim());
    assert.deepEqual(visible, ["Reti"]);
    await page.fill(".sl-app-header__search input", "");
  });

  const degradeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const degradePage = await degradeContext.newPage();
  const degradeConsole = [];
  degradePage.on("console", (m) => {
    if (m.type() === "error") degradeConsole.push(m.text());
  });
  await loginAsDocente(degradePage, server.url);

  await suite.test("degrado: network.json mancante → messaggio condiviso, nessuna scena, errore in console", async () => {
    await degradePage.route("**/data/scenarios/viaggio-dei-dati/network.json", (route) => route.fulfill({ status: 404, body: "" }));
    await degradePage.goto(`${server.url}/#/scenario/viaggio-dei-dati`);
    await degradePage.reload();
    await degradePage.waitForSelector(".sl-scenario-viewport");
    await degradePage.waitForFunction(() => document.querySelector(".sl-scenario-viewport")?.textContent.includes("non è disponibile"));
    assert.equal(await degradePage.locator(SEL.root).count(), 0);
    assert.ok(degradeConsole.length > 0, "nessun errore in console per il file mancante");
    await degradePage.unroute("**/data/scenarios/viaggio-dei-dati/network.json");
  });

  await suite.test("degrado: network.json con un percorso non valido → messaggio condiviso e motivo in console", async () => {
    degradeConsole.length = 0;
    await degradePage.route("**/data/scenarios/viaggio-dei-dati/network.json", (route) => {
      const broken = structuredClone(network);
      broken.packets[2].route = ["P", "d", "A"]; // P–d e d–A non sono collegamenti
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(broken) });
    });
    await degradePage.reload();
    await degradePage.waitForFunction(() => document.querySelector(".sl-scenario-viewport")?.textContent.includes("non è disponibile"));
    assert.equal(await degradePage.locator(SEL.root).count(), 0);
    assert.ok(degradeConsole.some((t) => t.includes("non è un collegamento")), JSON.stringify(degradeConsole));
    await degradePage.unroute("**/data/scenarios/viaggio-dei-dati/network.json");
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
