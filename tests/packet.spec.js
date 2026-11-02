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
 *      di arrivo osservato NEL TEMPO, il riordino, il tesseratto ricostruito,
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
  review: ".sl-packet-journey__review",
  settings: ".sl-packet-journey__settings-trigger",
  panel: ".sl-packet-journey__settings-panel",
  refresh: ".sl-packet-journey__refresh",
  hint: ".sl-packet-journey__hint",
  packet: ".sl-packet-journey__packet",
  trail: ".sl-packet-journey__trail",
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

/** Parti del tesseratto (una per asse, nell'ordine del DOM = numero d'ordine crescente). */
async function readParts(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".sl-packet-journey__part")).map((group) => ({
      opacity: Number(group.style.opacity),
      transform: group.getAttribute("transform") || "",
      fill: group.querySelector(".sl-packet-journey__edge").style.stroke,
      edges: group.querySelectorAll(".sl-packet-journey__edge").length,
    }))
  );
}

/** Coordinate di tutti gli spigoli del tesseratto: cambiano nel tempo solo se il dato ruota. */
async function readEdgeCoordinates(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".sl-packet-journey__edge")).map((el) =>
      ["x1", "y1", "x2", "y2"].map((name) => Number(el.getAttribute(name)))
    )
  );
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

/** Sceglie una velocità dal pannello impostazioni (lo apre se serve) e lo richiude con Esc. */
async function chooseSpeed(page, label) {
  if ((await page.locator(SEL.settings).getAttribute("aria-expanded")) !== "true") await page.locator(SEL.settings).click();
  await page.locator(".sl-packet-journey__speed-chip", { hasText: label }).click();
  await page.keyboard.press("Escape");
}

/** Stato delle scie: ordine nel DOM, classi, colore e spessore calcolati. */
async function readTrails(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".sl-packet-journey__trail")).map((trail) => {
      const style = getComputedStyle(trail);
      return {
        color: trail.style.getPropertyValue("--packet-color"),
        muted: trail.classList.contains("sl-packet-journey__trail--muted"),
        selected: trail.classList.contains("sl-packet-journey__trail--selected"),
        stroke: style.stroke,
        width: parseFloat(style.strokeWidth),
      };
    })
  );
}

async function readTrayButtons(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".sl-packet-journey__packet")).map((node) => ({
      seq: Number(node.getAttribute("data-seq")),
      role: node.getAttribute("role"),
      tabindex: node.getAttribute("tabindex"),
      pressed: node.getAttribute("aria-pressed"),
      label: node.getAttribute("aria-label"),
      hidden: node.getAttribute("aria-hidden"),
      dimmed: node.classList.contains("sl-packet-journey__packet--dimmed"),
    }))
  );
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

  await suite.test("validatePacketNetwork: velocità iniziale non elencata o elenco vuoto → errori", async () => {
    const result = await inBrowser((r, n) => {
      const notListed = structuredClone(n);
      notListed.settings.defaultSpeed = 3;
      const empty = structuredClone(n);
      empty.settings.speeds = [];
      const badValue = structuredClone(n);
      badValue.settings.speeds[0].value = 0;
      return [r.validatePacketNetwork(notListed), r.validatePacketNetwork(empty), r.validatePacketNetwork(badValue)];
    }, network);
    assert.ok(result[0].some((e) => e.includes("defaultSpeed")), JSON.stringify(result[0]));
    assert.ok(result[1].some((e) => e.includes("settings.speeds")), JSON.stringify(result[1]));
    assert.ok(result[2].some((e) => e.includes("value non valido")), JSON.stringify(result[2]));
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
  const inTesseract = (fn, arg) =>
    utilPage.evaluate(
      async ({ source, arg: a }) => {
        const mod = await import("/js/utils/tesseract.js");
        // eslint-disable-next-line no-new-func
        return new Function("tess", "arg", `return (${source})(tess, arg);`)(mod, a);
      },
      { source: fn.toString(), arg }
    );

  await suite.test("tesseract.js: 16 vertici, 32 spigoli (8 per ciascuno dei 4 assi), ogni vertice ha 4 spigoli", async () => {
    const r = await inTesseract((t) => {
      const perAxis = [0, 1, 2, 3].map((axis) => t.TESSERACT_EDGES.filter((e) => e.axis === axis).length);
      const degree = t.TESSERACT_VERTICES.map((_, i) => t.TESSERACT_EDGES.filter((e) => e.a === i || e.b === i).length);
      // ogni spigolo collega due vertici che differiscono in UNA sola coordinata, quella dell'asse
      const oneCoordinate = t.TESSERACT_EDGES.every((e) => {
        const diff = t.TESSERACT_VERTICES[e.a].map((c, k) => (c !== t.TESSERACT_VERTICES[e.b][k] ? k : -1)).filter((k) => k >= 0);
        return diff.length === 1 && diff[0] === e.axis;
      });
      return { vertices: t.TESSERACT_VERTICES.length, edges: t.TESSERACT_EDGES.length, perAxis, degree, oneCoordinate, axes: t.TESSERACT_AXES };
    });
    assert.equal(r.vertices, 16);
    assert.equal(r.edges, 32);
    assert.equal(r.axes, 4);
    assert.deepEqual(r.perAxis, [8, 8, 8, 8]);
    assert.deepEqual(r.degree, new Array(16).fill(4));
    assert.equal(r.oneCoordinate, true);
  });

  await suite.test("tesseract.js: idlePose(0) è la posa canonica; settlePose raggiunge la canonica (modulo 2π) senza tornare indietro", async () => {
    const r = await inTesseract((t) => {
      const TAU = Math.PI * 2;
      const canon = t.CANONICAL_POSE;
      const from = t.idlePose(7300);
      const mid = t.settlePose(from, 0.5);
      const end = t.settlePose(from, 1);
      const start = t.settlePose(from, 0);
      const mod = (v) => ((v % TAU) + TAU) % TAU;
      return {
        idle0: t.idlePose(0),
        canon,
        fromAy: from.ay,
        midAy: mid.ay,
        endAy: end.ay,
        endDelta: [end.ay - canon.ay, end.a1 - canon.a1, end.a2 - canon.a2].map((d) => Math.min(mod(d), TAU - mod(d))),
        endAx: end.ax,
        startSame: ["ay", "ax", "a1", "a2"].every((k) => Math.abs(start[k] - from[k]) < 1e-12),
      };
    });
    ["ay", "ax", "a1", "a2"].forEach((k) => assert.ok(Math.abs(r.idle0[k] - r.canon[k]) < 1e-12, `idlePose(0).${k}`));
    r.endDelta.forEach((d) => assert.ok(d < 1e-9, `angolo non riportato alla canonica (${d})`));
    assert.ok(Math.abs(r.endAx - r.canon.ax) < 1e-12);
    assert.ok(r.midAy >= r.fromAy && r.endAy >= r.fromAy, "la rotazione non deve mai tornare indietro");
    assert.equal(r.startSame, true, "settlePose(…, 0) deve coincidere con la posa di partenza");
  });

  await suite.test("tesseract.js: la proiezione è finita e deterministica; ogni parte è distesa (non un punto), i baricentri cadono vicino al centro e i vertici, in tutte le pose della rotazione, restano nella zona centrale della scena", async () => {
    const r = await inTesseract((t) => {
      // stessi parametri di LAYOUT.shape in packetJourneyRenderer.js
      const view = { center: { x: 560, y: 340 }, radius: 46, hyperDistance: 2.4, focal: 620, cameraZ: 620 };
      const a = t.projectTesseract(t.CANONICAL_POSE, view);
      const b = t.projectTesseract(t.CANONICAL_POSE, view);
      // l'ingombro vale per TUTTE le pose della rotazione libera: si campiona un minuto di rotazione
      const all = [...a.points];
      for (let ms = 0; ms < 60000; ms += 100) all.push(...t.projectTesseract(t.idlePose(ms), view).points);
      // I 4 gruppi di spigoli sono simmetrici rispetto al centro dell'ipercubo: i loro baricentri
      // coincidono (quasi) con il centro della scena. Per questo il perno di riduzione/spostamento di
      // ogni parte è il centro, e la parte si distingue dalle altre per DIREZIONE di allontanamento.
      const centreOffset = a.centres.map((c) => Math.hypot(c.x - view.center.x, c.y - view.center.y));
      const spread = [0, 1, 2, 3].map((axis) =>
        Math.max(...t.TESSERACT_EDGES.filter((e) => e.axis === axis).map((e) => Math.hypot((a.points[e.a].x + a.points[e.b].x) / 2 - a.centres[axis].x, (a.points[e.a].y + a.points[e.b].y) / 2 - a.centres[axis].y)))
      );
      return {
        same: JSON.stringify(a) === JSON.stringify(b),
        finite: all.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)),
        count: [a.points.length, a.centres.length],
        maxCentreOffset: Math.max(...centreOffset),
        minSpread: Math.min(...spread),
        bounds: [Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x)), Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))],
      };
    });
    assert.equal(r.same, true);
    assert.equal(r.finite, true);
    assert.deepEqual(r.count, [16, 4]);
    assert.ok(r.maxCentreOffset < 15, `un baricentro è lontano dal centro (${r.maxCentreOffset})`);
    assert.ok(r.minSpread > 20, `una parte è quasi un punto (${r.minSpread}): non si distinguerebbe come fascio di spigoli`);
    assert.ok(r.bounds[0] > 420 && r.bounds[1] < 700 && r.bounds[2] > 160 && r.bounds[3] < 520, `fuori dalla zona centrale: ${r.bounds}`);
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
    assert.equal(await page.locator(SEL.svg).getAttribute("role"), "group", "con role=img i pacchetti-bottone sarebbero presentazionali");
    assert.equal(await page.locator(SEL.svg).getAttribute("aria-label"), network.labels.stage);
  });

  await suite.test("tesseratto: 4 parti da 8 spigoli, un colore per parte (token dei pacchetti), sagoma tratteggiata di 32 spigoli", async () => {
    const info = await page.evaluate(() => ({
      parts: Array.from(document.querySelectorAll(".sl-packet-journey__part")).map((g) =>
        Array.from(g.querySelectorAll(".sl-packet-journey__edge")).map((e) => e.style.stroke)
      ),
      ghost: document.querySelectorAll(".sl-packet-journey__ghost").length,
      label: document.querySelector(".sl-packet-journey__data-label").textContent.trim(),
    }));
    const colors = [...network.packets].sort((a, b) => a.seq - b.seq).map((p) => `var(--sl-color-${p.color}-500)`);
    assert.equal(info.parts.length, 4);
    info.parts.forEach((edges, k) => {
      assert.equal(edges.length, 8, `la parte ${k + 1} non ha 8 spigoli`);
      edges.forEach((stroke) => assert.equal(stroke, colors[k]));
    });
    assert.equal(info.ghost, 32);
    assert.equal(info.label, network.data.label);
  });

  await suite.test("tesseratto: a riposo ruota (le coordinate degli spigoli cambiano nel tempo)", async () => {
    const before = await readEdgeCoordinates(page);
    await page.clock.runFor(600);
    const after = await readEdgeCoordinates(page);
    const moved = after.filter((c, i) => c.some((v, j) => Math.abs(v - before[i][j]) > 0.5)).length;
    assert.ok(moved >= 24, `solo ${moved}/32 spigoli si sono mossi in 600 ms`);
  });

  await suite.test("stato a riposo: passo 0, Prosegui attivo, Ricomincia nascosto, tesseratto intero, pacchetti e mappa spenti", async () => {
    assert.equal(await dataStep(page), "0");
    assert.equal(await isAnimating(page), false);
    assert.equal((await page.locator(SEL.proceed).textContent()).trim(), "Prosegui");
    assert.equal(await page.locator(SEL.proceed).isEnabled(), true);
    assert.equal(await page.locator(SEL.restart).isHidden(), true);
    assert.equal(await page.locator(SEL.review).isHidden(), true, "Rivedi non ha senso prima del primo passo");
    assert.equal(await page.locator(SEL.panel).isHidden(), true);
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Punto di partenza");
    assert.equal((await page.locator(SEL.captionTitle).textContent()).trim(), network.steps[0].title);
    assert.equal((await page.locator(SEL.captionText).textContent()).trim(), network.steps[0].text);
    const parts = await readParts(page);
    assert.equal(parts.length, 4);
    parts.forEach((part) => {
      assert.equal(part.opacity, 1);
      assert.equal(part.transform, "", "a riposo le parti stanno al loro posto");
    });
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

  // Impostazioni e comandi della riga del titolo ---------------------------------
  await suite.test("impostazioni: ingranaggio con nome accessibile, pannello chiuso; aperto offre 0,5× / 1× / 2×, default 1× e focus sulla scelta attiva", async () => {
    assert.equal(await page.locator(SEL.settings).getAttribute("aria-label"), network.labels.settings);
    assert.equal(await page.locator(SEL.settings).getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "1");
    await page.locator(SEL.settings).click();
    assert.equal(await page.locator(SEL.settings).getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator(SEL.panel).isVisible(), true);
    const labels = (await page.locator(".sl-packet-journey__speed-label").allTextContents()).map((t) => t.trim());
    assert.deepEqual(labels, network.settings.speeds.map((o) => o.label));
    assert.deepEqual(labels, ["0,5×", "1×", "2×"]);
    const checked = await page.locator(".sl-packet-journey__speed-input:checked").evaluate((el) => el.nextElementSibling.textContent.trim());
    assert.equal(checked, "1×");
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__speed-input")), true);
    assert.equal(await page.locator("fieldset.sl-packet-journey__speed-group legend").textContent().then((t) => t.trim()), network.labels.speedGroup);
  });

  await suite.test("impostazioni: frecce cambiano velocità (radio nativi), Esc chiude e restituisce il focus all'ingranaggio", async () => {
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "2");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "0.5");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "1");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(SEL.panel).isHidden(), true);
    assert.equal(await page.locator(SEL.settings).getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__settings-trigger")), true);
  });

  await suite.test("impostazioni: un click fuori chiude il pannello senza cambiare la velocità; un secondo click sull'ingranaggio lo richiude", async () => {
    await page.locator(SEL.settings).click();
    assert.equal(await page.locator(SEL.panel).isVisible(), true);
    await page.locator(SEL.title).click();
    assert.equal(await page.locator(SEL.panel).isHidden(), true);
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "1");
    await page.locator(SEL.settings).click();
    await page.locator(SEL.settings).click();
    assert.equal(await page.locator(SEL.panel).isHidden(), true);
  });

  await suite.test("riga del titolo: ingranaggio e refresh stanno al margine destro, dopo il titolo, con nome accessibile", async () => {
    const boxes = await page.evaluate(() => {
      const box = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return {
        title: box(".sl-packet-journey__title"),
        gear: box(".sl-packet-journey__settings-trigger"),
        refresh: box(".sl-packet-journey__refresh"),
        stage: box(".sl-packet-journey__stage"),
      };
    });
    assert.ok(boxes.gear.left > boxes.title.right, "l'ingranaggio dovrebbe stare dopo il titolo");
    assert.ok(boxes.refresh.left >= boxes.gear.right - 1, "il refresh dovrebbe stare dopo l'ingranaggio");
    assert.ok(Math.abs(boxes.refresh.right - boxes.stage.right) <= 2, "il refresh dovrebbe allinearsi al margine destro della scena");
    assert.ok(boxes.gear.bottom <= boxes.stage.top, "i comandi stanno sopra la scena");
    assert.equal(await page.locator(SEL.refresh).getAttribute("aria-label"), network.labels.refresh);
    assert.equal(await page.locator(SEL.refresh).getAttribute("title"), network.labels.refresh);
  });

  // Passo 1 ------------------------------------------------------------------
  await suite.test("passo 1: all'avvio Prosegui si disabilita, il focus passa alla scena, la didascalia cambia, il tesseratto non salta di posa", async () => {
    const beforeClick = await readEdgeCoordinates(page);
    await page.locator(SEL.proceed).focus();
    await page.locator(SEL.proceed).click();
    await page.clock.runFor(16); // primo fotogramma del passo: la posa riparte da dove stava ruotando
    const firstFrame = await readEdgeCoordinates(page);
    const maxJump = Math.max(...firstFrame.flatMap((c, i) => c.map((v, j) => Math.abs(v - beforeClick[i][j]))));
    assert.ok(maxJump < 4, `salto di ${maxJump.toFixed(1)} px al primo fotogramma del passo 1`);
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

  await suite.test("passo 1, a metà: il tesseratto si è aperto e le parti diventano i primi pacchetti", async () => {
    await page.clock.runFor(1400); // ~1500 ms dall'avvio: apertura conclusa (1200 ms), i pacchetti nascono da 1250 ms
    const packets = await readPackets(page);
    assert.ok(Object.values(packets).some((p) => p.opacity > 0), "nessun pacchetto visibile a metà del passo 1");
    const parts = await readParts(page);
    assert.ok(parts.some((p) => p.opacity < 1), "le parti non hanno iniziato a trasformarsi in pacchetti");
    assert.ok(parts.some((p) => p.transform !== ""), "il tesseratto non si è aperto");
  });

  await suite.test("passo 1, fine: 4 pacchetti numerati 1..4 a ventaglio da sinistra a destra, tesseratto aperto (parti spente), Prosegui di nuovo attivo col focus", async () => {
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
    (await readParts(page)).forEach((arc) => assert.equal(arc.opacity, 0));
    assert.equal(await page.locator(SEL.proceed).isEnabled(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__proceed")), true);
  });

  await suite.test("passo 1: i pacchetti sono solo decorazione (nessun ruolo bottone, nascosti agli screen reader) e il suggerimento non c'è", async () => {
    (await readTrayButtons(page)).forEach((b) => {
      assert.equal(b.role, null);
      assert.equal(b.tabindex, null);
      assert.equal(b.hidden, "true");
    });
    assert.equal(await page.locator(SEL.hint).isHidden(), true);
    assert.equal(await page.locator(SEL.review).isVisible(), true, "Rivedi dovrebbe comparire dal passo 1");
  });

  await suite.test("passo 1: resta la sagoma tratteggiata del tesseratto (guida alla ricomposizione) e compare l'etichetta 'Pacchetti'", async () => {
    const info = await page.evaluate(() => ({
      ghost: Array.from(document.querySelectorAll(".sl-packet-journey__ghost")).map((l) => Number(l.style.opacity)),
      label: Number(document.querySelectorAll(".sl-packet-journey__label")[0].style.opacity),
    }));
    assert.equal(info.ghost.length, 32);
    info.ghost.forEach((o) => assert.ok(Math.abs(o - 0.4) < 0.01, `opacità sagoma ${o}`));
    assert.equal(info.label, 1);
  });

  await suite.test("passo 1: ogni pacchetto ha un colore diverso (stroke) e lo stesso colore del proprio arco", async () => {
    const packets = await readPackets(page);
    const strokes = [1, 2, 3, 4].map((s) => packets[s].stroke);
    assert.equal(new Set(strokes).size, 4, `colori dei pacchetti non distinti: ${strokes}`);
    strokes.forEach((stroke, i) => assert.equal(stroke, `var(--sl-color-${network.packets.find((p) => p.seq === i + 1).color}-500)`));
  });

  await suite.test("Rivedi (passo 1 concluso): ricomincia lo STESSO passo — al primo istante tesseratto intero e pacchetti spenti, Prosegui disattivato, poi si ripete fino alla fine", async () => {
    assert.equal((await page.locator(SEL.review).textContent()).trim(), "Rivedi");
    await page.locator(SEL.review).click();
    assert.equal(await dataStep(page), "1", "Rivedi non deve cambiare passo");
    assert.equal(await isAnimating(page), true);
    assert.equal(await page.locator(SEL.proceed).isDisabled(), true);
    await page.clock.runFor(20);
    (await readParts(page)).forEach((part) => assert.equal(part.opacity, 1, "il tesseratto non è tornato intero al primo istante"));
    Object.values(await readPackets(page)).forEach((p) => assert.equal(p.opacity, 0, "i pacchetti dovrebbero essere spenti al primo istante"));
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Passo 1 di 3");
    await runUntilIdle(page);
    assert.deepEqual(orderByX(await readPackets(page)), [1, 2, 3, 4]);
    assert.equal(await page.locator(SEL.proceed).isEnabled(), true);
  });

  await suite.test("velocità: a 2× il passo dura la metà, a 0,5× il doppio", async () => {
    await chooseSpeed(page, "2×");
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "2");
    await page.locator(SEL.review).click();
    const fast = await runUntilIdle(page, { stepMs: 25 });
    assert.ok(fast >= 1450 && fast <= 1900, `a 2× il passo 1 dovrebbe durare ~1650 ms (${fast})`);

    await chooseSpeed(page, "0,5×");
    await page.locator(SEL.review).click();
    await page.clock.runFor(3000);
    assert.equal(await isAnimating(page), true, "a 0,5× dopo 3 s il passo (6,6 s) dovrebbe essere ancora in corso");
    const rest = await runUntilIdle(page, { stepMs: 25 });
    assert.ok(3000 + rest >= 6300 && 3000 + rest <= 6900, `a 0,5× il passo 1 dovrebbe durare ~6600 ms (${3000 + rest})`);
  });

  await suite.test("velocità: cambiarla a passo in corso non fa saltare la scena (tempo accumulato)", async () => {
    await page.locator(SEL.review).click(); // sempre a 0,5×
    await page.clock.runFor(1000); // = 500 ms di scena
    await chooseSpeed(page, "2×");
    const before = await readParts(page);
    assert.ok(before.some((p) => p.opacity === 1), "a 500 ms di scena le parti non dovrebbero essere ancora sparite");
    const rest = await runUntilIdle(page, { stepMs: 25 });
    assert.ok(rest >= 1200 && rest <= 1600, `restano ~2800 ms di scena a 2× = ~1400 ms (${rest})`);
    await chooseSpeed(page, "1×");
    assert.equal(await page.locator(SEL.root).getAttribute("data-speed"), "1");
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
        color: getComputedStyle(t).stroke,
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

  // Percorso in evidenza ------------------------------------------------------
  const rankOf = (seq) => arrivalSeen.indexOf(seq) + 1;
  const sortedPackets = [...network.packets].sort((a, b) => a.seq - b.seq);

  await suite.test("vassoio: a fine passo 2 i 4 pacchetti diventano bottoni (nome con numero e ordine di arrivo, aria-pressed=false) e compare il suggerimento", async () => {
    const buttons = await readTrayButtons(page);
    assert.equal(buttons.length, 4);
    buttons.forEach((b) => {
      assert.equal(b.role, "button");
      assert.equal(b.tabindex, "0");
      assert.equal(b.pressed, "false");
      assert.equal(b.hidden, null);
      assert.ok(b.label.includes(`Pacchetto ${b.seq}`) && b.label.includes(`arrivato ${rankOf(b.seq)}°`), b.label);
    });
    assert.equal(await page.locator(SEL.hint).isVisible(), true);
    assert.equal((await page.locator(SEL.hint).textContent()).trim(), network.labels.routeHint);
  });

  await suite.test("clic sul pacchetto 1: solo il suo percorso resta colorato (e più spesso, in primo piano), le altre scie diventano grigie, esito annunciato", async () => {
    await page.locator(`${SEL.packet}[data-seq="1"]`).click();
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), "1");
    const trails = await readTrails(page);
    const selected = trails.filter((t) => t.selected);
    const muted = trails.filter((t) => t.muted);
    assert.equal(selected.length, 1);
    assert.equal(muted.length, 3);
    assert.equal(selected[0].muted, false);
    assert.equal(new Set(muted.map((t) => t.stroke)).size, 1, "le scie spente dovrebbero avere tutte lo stesso grigio");
    assert.notEqual(muted[0].stroke, selected[0].stroke);
    assert.ok(selected[0].width > muted[0].width, "la scia in evidenza dovrebbe essere più spessa");
    assert.equal(trails[trails.length - 1].selected, true, "la scia in evidenza dovrebbe stare sopra le altre nel DOM");
    // il grigio non coincide con nessuno dei 4 colori dei pacchetti
    const packetStrokes = Object.values(await readPackets(page)).map((p) => p.stroke);
    assert.ok(!packetStrokes.includes(muted[0].stroke));
    const buttons = await readTrayButtons(page);
    assert.deepEqual(buttons.map((b) => b.pressed), ["true", "false", "false", "false"]);
    assert.deepEqual(buttons.map((b) => b.dimmed), [false, true, true, true]);
    const route = sortedPackets[0].route;
    assert.equal(
      (await page.locator(SEL.outcome).textContent()).trim(),
      `Percorso del pacchetto 1 in evidenza: ${route.length - 2} nodi intermedi attraversati, arrivato ${rankOf(1)}°.`
    );
  });

  await suite.test("clic su un altro pacchetto sposta l'evidenza; clic sullo stesso la toglie e ripristina colori, ordine e annuncio", async () => {
    await page.locator(`${SEL.packet}[data-seq="3"]`).click();
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), "3");
    let trails = await readTrails(page);
    assert.deepEqual(trails.map((t) => t.selected).filter(Boolean).length, 1);
    assert.equal(trails.find((t) => t.selected).color, "var(--sl-color-success-500)", "la scia selezionata non è quella del pacchetto 3");
    assert.equal((await readTrayButtons(page)).find((b) => b.seq === 1).dimmed, true);

    await page.locator(`${SEL.packet}[data-seq="3"]`).click();
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), null);
    trails = await readTrails(page);
    trails.forEach((t) => assert.ok(!t.muted && !t.selected));
    assert.deepEqual(trails.map((t) => t.color), sortedPackets.map((p) => `var(--sl-color-${p.color}-500)`), "l'ordine originale delle scie non è stato ripristinato");
    assert.equal(new Set(trails.map((t) => t.stroke)).size, 4);
    (await readTrayButtons(page)).forEach((b) => {
      assert.equal(b.pressed, "false");
      assert.equal(b.dimmed, false);
    });
    assert.equal((await page.locator(SEL.outcome).textContent()).trim(), network.announcements.routeCleared);
  });

  await suite.test("tastiera: Tab dal refresh raggiunge i pacchetti (anello di focus visibile); Invio e Spazio alternano l'evidenza", async () => {
    await page.locator(SEL.refresh).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("data-seq")), "1");
    const ring = await page.evaluate(() => Number(getComputedStyle(document.activeElement.querySelector(".sl-packet-journey__packet-focus")).opacity));
    assert.equal(ring, 1, "anello di focus non visibile da tastiera");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("data-seq")), "2");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), "2");
    await page.keyboard.press("Space");
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), null);
    await page.keyboard.press("Enter"); // lascia una selezione attiva: il passo 3 deve azzerarla
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), "2");
  });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-step2-selected-light.png"), fullPage: true });
  await page.locator(`${SEL.packet}[data-seq="2"]`).click(); // deseleziona per lo screenshot successivo
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "packet-step2-light.png"), fullPage: true });

  // Passo 3 ------------------------------------------------------------------
  await suite.test("passo 3, all'inizio i pacchetti salgono in riga NELL'ORDINE DI ARRIVO (e l'evidenza di un percorso viene azzerata)", async () => {
    await page.locator(`${SEL.packet}[data-seq="4"]`).click(); // evidenza attiva prima di proseguire
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), "4");
    await page.locator(SEL.proceed).click();
    assert.equal(await page.locator(SEL.root).getAttribute("data-selected"), null);
    (await readTrails(page)).forEach((t) => assert.ok(!t.muted && !t.selected));
    (await readTrayButtons(page)).forEach((b) => {
      assert.equal(b.role, null, "i pacchetti non devono restare bottoni fuori dal passo 2");
      assert.equal(b.hidden, "true");
    });
    assert.equal(await page.locator(SEL.hint).isHidden(), true);
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

  await suite.test("passo 3, fine: tesseratto ricostruito (4 parti riunite e al loro posto, stessa sequenza di colori di prima), pacchetti assorbiti, spunta visibile", async () => {
    const elapsed = await runUntilIdle(page);
    assert.ok(2250 + elapsed <= MAX_STEP_MS, `il passo 3 dura troppo (${2250 + elapsed} ms)`);
    assert.equal(await dataStep(page), "3");
    const parts = await readParts(page);
    assert.equal(parts.length, 4);
    parts.forEach((part, i) => {
      assert.equal(part.opacity, 1, `parte ${i + 1} non visibile`);
      assert.equal(part.transform, "", `parte ${i + 1} non riunita: ${part.transform}`);
      assert.equal(part.edges, 8, `la parte ${i + 1} dovrebbe avere 8 spigoli`);
    });
    const colors = [...network.packets].sort((a, b) => a.seq - b.seq).map((p) => `var(--sl-color-${p.color}-500)`);
    assert.deepEqual(parts.map((p) => p.fill), colors, "i colori delle parti non sono nell'ordine originale");
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

  await suite.test("passo 3 concluso: il tesseratto ricostruito riprende a ruotare (e la spunta resta)", async () => {
    const before = await readEdgeCoordinates(page);
    await page.clock.runFor(600);
    const after = await readEdgeCoordinates(page);
    const moved = after.filter((c, i) => c.some((v, j) => Math.abs(v - before[i][j]) > 0.5)).length;
    assert.ok(moved >= 24, `solo ${moved}/32 spigoli si sono mossi dopo la ricostruzione`);
    assert.equal(await page.locator(".sl-packet-journey__check").evaluate((el) => Number(el.style.opacity)), 1);
    assert.equal(await isAnimating(page), false, "la rotazione a riposo non è un passo: data-animating resta false");
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

  await suite.test("passo 3 concluso: Rivedi e Ricomincia insieme (Ricomincia è l'azione principale); Rivedi ripete la ricomposizione senza uscire dal passo 3", async () => {
    assert.equal(await page.locator(SEL.review).isVisible(), true);
    assert.equal(await page.locator(SEL.restart).evaluate((el) => el.classList.contains("sl-button--primary")), true);
    assert.equal(await page.locator(SEL.review).evaluate((el) => el.classList.contains("sl-button--secondary")), true);
    await page.locator(SEL.review).click();
    assert.equal(await dataStep(page), "3");
    assert.equal(await isAnimating(page), true);
    assert.equal(await page.locator(SEL.restart).isHidden(), true, "durante la ripetizione Ricomincia non serve");
    await page.clock.runFor(800);
    assert.deepEqual(orderByX(await readPackets(page)), arrivalSeen, "la ripetizione non riparte dall'ordine di arrivo");
    await runUntilIdle(page);
    assert.equal(await dataStep(page), "3");
    (await readParts(page)).forEach((arc) => assert.equal(arc.opacity, 1));
    assert.equal(await page.locator(SEL.restart).isVisible(), true);
  });

  await suite.test("Ricomincia: ritorno al passo 0 (tesseratto intero, Prosegui attivo col focus, esito azzerato) e secondo giro possibile", async () => {
    await page.locator(SEL.restart).click();
    assert.equal(await dataStep(page), "0");
    assert.equal(await isAnimating(page), false);
    assert.equal(await page.locator(SEL.proceed).isVisible(), true);
    assert.equal(await page.locator(SEL.restart).isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__proceed")), true);
    assert.equal((await page.locator(SEL.outcome).textContent()).trim(), "");
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Punto di partenza");
    (await readParts(page)).forEach((arc) => assert.equal(arc.opacity, 1));
    Object.values(await readPackets(page)).forEach((p) => assert.equal(p.opacity, 0));
    await page.locator(SEL.proceed).click();
    await runUntilIdle(page);
    assert.equal(await dataStep(page), "1");
    assert.deepEqual(orderByX(await readPackets(page)), [1, 2, 3, 4]);
  });

  await suite.test("refresh (icona): riporta al punto di partenza anche a metà animazione, nasconde Rivedi e lascia il focus sul comando; nessun fotogramma in ritardo", async () => {
    // dopo il test precedente la scena è al passo 1 concluso
    await page.locator(SEL.refresh).click();
    assert.equal(await dataStep(page), "0");
    assert.equal(await isAnimating(page), false);
    assert.equal(await page.locator(SEL.review).isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("sl-packet-journey__refresh")), true);
    assert.equal((await page.locator(SEL.captionStep).textContent()).trim(), "Punto di partenza");

    await page.locator(SEL.proceed).click();
    await page.clock.runFor(800);
    assert.equal(await isAnimating(page), true);
    await page.locator(SEL.refresh).click();
    assert.equal(await dataStep(page), "0");
    assert.equal(await isAnimating(page), false);
    await page.clock.runFor(3000); // un fotogramma dell'animazione interrotta riapparirebbe qui
    assert.equal(await dataStep(page), "0");
    (await readParts(page)).forEach((arc) => assert.equal(arc.opacity, 1));
    Object.values(await readPackets(page)).forEach((p) => assert.equal(p.opacity, 0));
    assert.equal(await page.locator(SEL.proceed).isEnabled(), true);
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

  const reducedCoords0 = await readEdgeCoordinates(reducedPage);
  await suite.test("riduci animazioni: a riposo il tesseratto resta fermo", async () => {
    await reducedPage.clock.runFor(600);
    assert.deepEqual(await readEdgeCoordinates(reducedPage), reducedCoords0, "il tesseratto si muove nonostante 'riduci animazioni'");
  });

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
    (await readParts(reducedPage)).forEach((arc) => assert.equal(arc.opacity, 1));
    assert.equal(await reducedPage.locator(SEL.restart).isVisible(), true);
  });
  await suite.test("riduci animazioni: a passo 3 concluso il tesseratto è fermo e nella stessa posa canonica di partenza", async () => {
    await reducedPage.clock.runFor(600);
    assert.deepEqual(await readEdgeCoordinates(reducedPage), reducedCoords0, "a fine corsa la posa non coincide con quella canonica di partenza");
  });
  await reducedContext.close();

  // --- 4. Degrado, smontaggio, richieste esterne -----------------------------
  await suite.test("smontaggio a metà animazione: tornando alla Home la scena sparisce, nessun errore e nessun fotogramma in ritardo", async () => {
    await page.locator(SEL.proceed).click(); // passo 1 in corso (il refresh ha riportato al punto di partenza)
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
