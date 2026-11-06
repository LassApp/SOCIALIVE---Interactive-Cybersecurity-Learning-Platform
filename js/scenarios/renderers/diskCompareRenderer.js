/**
 * diskCompareRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "disk-compare" (scenario "HDD vs SSD",
 * area Computer Essentials): fa capire a studenti principianti la
 * differenza tra HDD (piatti e testina meccanici) e SSD (memoria flash,
 * accesso elettronico) mostrando scrittura, cancellazione, frammentazione
 * e lettura degli stessi quattro file.
 *
 * COMPOSIZIONE — nessuna logica di dominio qui dentro:
 *   - diskModel.js     stato del disco per passaggio (puro, validato);
 *   - diskScene3d.js   scene 3D con camera (HDD e SSD, stessa interfaccia);
 *   - animationTimeline.js  esecuzioni interrompibili + moltiplicatore di
 *                      velocità (un solo punto per velocità e movimento
 *                      ridotto);
 *   - diskPatterns.js  colore + trama dei file.
 * Qui restano il layout della pagina, la macchina a stati dei passaggi e
 * la coreografia (sequenza logico → fisico → scrittura).
 *
 * DATI — file, colori, dimensioni, disposizioni iniziali della griglia,
 * copioni dei passaggi, testi e rapporto dei tempi HDD/SSD arrivano da
 * disk.json (dataRefs.disk), validato da validateDiskConfig(). Nel codice
 * restano solo scelte di resa (geometria della scena, durate della
 * coreografia).
 *
 * DISTINZIONE OBBLIGATORIA — ALLOCAZIONE LOGICA (il sistema operativo e il
 * file system scelgono i cluster) vs ACCESSO FISICO (la testina, o il
 * segnale elettrico, raggiunge le posizioni): due indicatori distinti, uno
 * per volta acceso. La testina non "cerca" i cluster liberi.
 *
 * NAVIGAZIONE DEI PASSAGGI
 *   - all'avvio è selezionabile solo il passaggio 1; il passaggio N+1 si
 *     sblocca solo al COMPLETAMENTO NATURALE del passaggio N (mai per
 *     salto o interruzione); i passaggi sbloccati restano selezionabili;
 *   - lo stato del disco è funzione del numero di passaggio: aprire N
 *     disegna la fine di N-1 e poi anima N (coerenza dopo qualsiasi salto);
 *   - selezionare un passaggio durante un'animazione la interrompe in modo
 *     pulito: il passaggio interrotto NON risulta completato se non lo era;
 *   - Procedi è disabilitato mentre anima e porta al passaggio successivo
 *     nella sequenza; Ripristina rianima il passaggio corrente senza
 *     toccare lo storico; Ricomincia e il cambio scenario azzerano tutto.
 *
 * INGRANDIMENTO MANUALE — a passaggio concluso (mai durante
 * l'animazione) un clic su un settore dell'HDD o su un chip dell'SSD
 * avvicina la camera; un secondo clic (o Esc) la riporta alla vista
 * d'insieme. Da tastiera: Invio/Spazio sulla scena ingrandiscono il
 * settore/chip scritto più di recente. L'ingrandimento si azzera ad
 * ogni nuovo passaggio.
 *
 * STATO ESPOSTO SULLA RADICE per i test, indipendente dai tempi:
 * data-scenario, data-step (indice 0-based del passaggio corrente),
 * data-animating, data-done (passaggi completati), data-speed,
 * data-zoomed, data-compare ("running"|"done").
 *
 * ETICA/RETE — nessuna chiamata di rete oltre al caricamento di disk.json.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement, clearChildren } from "../../utils/dom.js";
import { svgNode } from "../../utils/svg.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { createLocalJsonResource } from "../../repositories/localJsonRepository.js";
import { create as createButton } from "../../components/Button.js";
import { create as createCard } from "../../components/Card.js";
import { create as createBadge } from "../../components/Badge.js";
import { buildSettingsIcon } from "../../utils/settingsIcon.js";
import { createMotion } from "../../utils/animationTimeline.js";
import { cellBackground } from "../../utils/diskPatterns.js";
import { createHddScene, createSsdScene } from "../../utils/diskScene3d.js";
import {
  CLUSTERS,
  buildScript,
  validateDiskConfig,
  groupCount,
  summarize,
  flattenEvents,
  formatTemplate,
} from "../../utils/diskModel.js";

const CLASS = "sl-disk-compare";
let instanceCounter = 0;

function buildInfoIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(svgNode("circle", { cx: "12", cy: "12", r: "9", stroke: "currentColor", "stroke-width": "1.6", fill: "none" }));
  svg.appendChild(svgNode("path", { d: "M12 11v6M12 7.5v.5", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", fill: "none" }));
  return svg;
}

function buildStateIcon(kind) {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" });
  const attrs = { stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" };
  if (kind === "done") {
    svg.appendChild(svgNode("path", { ...attrs, d: "M5 12l5 5 9-10", "stroke-width": "3" }));
  } else {
    svg.appendChild(svgNode("rect", { ...attrs, x: "5", y: "11", width: "14", height: "9", rx: "2", "stroke-width": "2.4" }));
    svg.appendChild(svgNode("path", { ...attrs, d: "M8 11V8a4 4 0 0 1 8 0v3", "stroke-width": "2.4" }));
  }
  return svg;
}

// Griglia logica: 12 settori (3 tracce × 4), ciascuno con 4 cluster (2×2).
function buildGrid(container, mini) {
  clearChildren(container);
  container.className = `${CLASS}__cells${mini ? ` ${CLASS}__cells--mini` : ""}`;
  for (let s = 0; s < 12; s += 1) {
    const sector = createElement("div", { classNames: `${CLASS}__sector` });
    for (let q = 0; q < 4; q += 1) sector.appendChild(createElement("div", { classNames: `${CLASS}__cell` }));
    container.appendChild(sector);
  }
  return Array.from(container.querySelectorAll(`.${CLASS}__cell`));
}

export async function renderDiskCompare(container, scenario) {
  const ref = scenario.dataRefs?.disk;
  if (!ref) {
    console.error(`[diskCompareRenderer] "dataRefs.disk" assente per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let config;
  try {
    config = validateDiskConfig(await createLocalJsonResource({ url: ref }).get());
  } catch (error) {
    console.error(`[diskCompareRenderer] Impossibile caricare i dati di "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  const L = config.labels;
  const text = (key, values) => formatTemplate(L[key], values || {});
  const styles = [...config.files, config.existing];
  const styleById = Object.fromEntries(styles.map((s) => [s.id, s]));
  const textColors = Object.fromEntries(config.files.map((f) => [f.id, f.textColor]));
  const scripts = config.scenarios.map((sc) => buildScript(sc, config.files));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- Stato ---------------------------------------------------------------
  let sIdx = 0;
  let cur = 0;
  let done = new Set();
  let playing = false;
  let destroyed = false;
  let speed = config.settings.defaultSpeed;
  let scene = null;
  let lastCell = -1; // ultimo cluster toccato: bersaglio dell'ingrandimento da tastiera
  let settingsOpen = false;
  let infoOpen = false;
  const motion = createMotion({ getSpeed: () => speed, isReduced: () => reduced.matches });
  const instanceId = `${CLASS}-${(instanceCounter += 1)}`;
  const components = [];
  const make = (component) => {
    components.push(component);
    return component;
  };

  // --- Intestazione -----------------------------------------------------------
  const areaBadge = make(createBadge({ label: config.areaLabel, tone: "neutral" }));
  const heading = createElement("h1", { classNames: `${CLASS}__title`, text: scenario.title || "" });
  const titleBlock = createElement("div", { classNames: `${CLASS}__title-block` }, [areaBadge.element, heading]);

  const settingsButton = make(createButton({ variant: "icon", ariaLabel: L.settings, icon: buildSettingsIcon() }));
  settingsButton.element.classList.add(`${CLASS}__settings-trigger`);
  settingsButton.element.title = L.settings;
  settingsButton.element.setAttribute("aria-haspopup", "true");
  settingsButton.element.setAttribute("aria-expanded", "false");
  settingsButton.element.setAttribute("aria-controls", `${instanceId}-settings`);

  const infoButton = make(createButton({ variant: "icon", ariaLabel: L.info, icon: buildInfoIcon() }));
  infoButton.element.classList.add(`${CLASS}__info-trigger`);
  infoButton.element.title = L.info;
  infoButton.element.setAttribute("aria-expanded", "false");
  infoButton.element.setAttribute("aria-controls", `${instanceId}-info`);

  // Pannello velocità: radio NATIVI (frecce, focus e annuncio gratis dal browser).
  const speedOptions = config.settings.speeds.map((option) => {
    const input = createElement("input", {
      classNames: `${CLASS}__speed-input`,
      attrs: { type: "radio", name: `${instanceId}-speed`, value: String(option.value) },
    });
    input.checked = option.value === speed;
    const chip = createElement("label", { classNames: `${CLASS}__speed-chip` }, [
      input,
      createElement("span", { classNames: `${CLASS}__speed-label`, text: option.label }),
    ]);
    return { input, chip, value: option.value };
  });
  const speedGroup = createElement("fieldset", { classNames: `${CLASS}__speed-group` }, [
    createElement("legend", { classNames: `${CLASS}__speed-legend`, text: L.speedGroup }),
    createElement("div", { classNames: `${CLASS}__speed-options` }, speedOptions.map((o) => o.chip)),
  ]);
  const settingsPanel = createElement("div", { classNames: `${CLASS}__settings-panel`, attrs: { id: `${instanceId}-settings` } }, [speedGroup]);
  settingsPanel.hidden = true;
  const toolbar = createElement("div", { classNames: `${CLASS}__toolbar` }, [
    createElement("div", { classNames: `${CLASS}__toolbar-buttons` }, [settingsButton.element, infoButton.element]),
    settingsPanel,
  ]);
  const header = createElement("header", { classNames: `${CLASS}__header` }, [titleBlock, toolbar]);

  const infoBox = createElement("p", { classNames: `${CLASS}__info`, attrs: { id: `${instanceId}-info` }, text: config.info });
  infoBox.hidden = true;

  // --- Selettore scenario e barra dei passaggi -----------------------------------
  const scenarioButtons = config.scenarios.map((sc) => {
    const button = make(createButton({ variant: "secondary", label: sc.name, pressed: false }));
    button.element.classList.add(`${CLASS}__scenario-button`);
    return button;
  });
  const selector = createElement("div", { classNames: `${CLASS}__selector`, attrs: { role: "group", "aria-label": L.scenarioGroup } }, scenarioButtons.map((b) => b.element));

  const counter = createElement("p", { classNames: `${CLASS}__counter` });
  const stepList = createElement("ol", { classNames: `${CLASS}__steps` });
  const stepNav = createElement("nav", { classNames: `${CLASS}__stepper`, attrs: { "aria-label": L.stepperAria } }, [counter, stepList]);

  // --- Palcoscenico: animazione | griglia ; legenda file | spiegazione e comandi ------
  const modeLogic = createElement("span", { classNames: `${CLASS}__mode`, text: L.modeLogic });
  const modePhysical = createElement("span", { classNames: `${CLASS}__mode` });
  const modeText = createElement("p", { classNames: `${CLASS}__mode-text` });
  const sceneMount = createElement("div", { classNames: `${CLASS}__scene`, attrs: { role: "button", tabindex: "0", "aria-label": L.zoomButtonAria } });
  const caption = createElement("p", { classNames: `${CLASS}__caption` });
  const zoomHint = createElement("p", { classNames: `${CLASS}__hint` });
  const physCard = make(createCard({ content: [createElement("div", { classNames: `${CLASS}__modes` }, [modeLogic, modePhysical]), modeText, sceneMount, caption, zoomHint] }));
  physCard.element.classList.add(`${CLASS}__panel`, `${CLASS}__panel--scene`);
  physCard.element.setAttribute("aria-label", L.stage);

  const cellsMount = createElement("div", { attrs: { role: "img" } });
  const gridWrap = createElement("div", { classNames: `${CLASS}__gridwrap` }, [
    createElement("div"),
    createElement("div", { classNames: `${CLASS}__col-labels` }, [1, 2, 3, 4].map((n) => createElement("span", { text: text("sectorHeader", { n }) }))),
    createElement("div", { classNames: `${CLASS}__row-labels` }, [1, 2, 3].map((n) => createElement("span", { text: text("trackHeader", { n }) }))),
    cellsMount,
  ]);
  const legendSwatch = (id, label) => {
    const swatch = createElement("i", { classNames: `${CLASS}__swatch` });
    if (id) swatch.style.background = cellBackground(styleById[id]);
    else swatch.classList.add(`${CLASS}__swatch--free`);
    return createElement("span", {}, [swatch, document.createTextNode(label)]);
  };
  const legend = createElement("div", { classNames: `${CLASS}__legend` }, [
    legendSwatch(null, L.legendFree),
    legendSwatch(config.existing.id, L.legendExisting),
    createElement("span", { text: L.legendNumbers }),
  ]);
  const reassemblyNote = createElement("p", { classNames: `${CLASS}__note`, text: L.reassemblyNote });
  const strip = createElement("div", { classNames: `${CLASS}__strip`, attrs: { "aria-label": L.reassemblyAria } });
  const logicCard = make(createCard({ content: [createElement("h2", { classNames: `${CLASS}__card-title`, text: L.gridTitle }), gridWrap, legend, reassemblyNote, strip] }));
  logicCard.element.classList.add(`${CLASS}__panel`, `${CLASS}__panel--grid`);

  const filesList = createElement("ul", { classNames: `${CLASS}__files` });
  const filesCard = make(createCard({ content: [createElement("h2", { classNames: `${CLASS}__card-title`, text: L.filesTitle }), filesList] }));
  filesCard.element.classList.add(`${CLASS}__panel`, `${CLASS}__panel--files`);

  const stepHeading = createElement("h2", { classNames: `${CLASS}__card-title` });
  const stepText = createElement("p", { classNames: `${CLASS}__text`, attrs: { role: "status", "aria-live": "polite" } });
  const proceedButton = make(createButton({ variant: "primary", label: config.actions.next }));
  const replayButton = make(createButton({ variant: "secondary", label: config.actions.replay }));
  const restartButton = make(createButton({ variant: "secondary", label: config.actions.restart }));
  const actions = createElement("div", { classNames: `${CLASS}__actions` }, [proceedButton.element, replayButton.element, restartButton.element]);
  const explainCard = make(createCard({ content: [stepHeading, stepText, actions] }));
  explainCard.element.classList.add(`${CLASS}__panel`, `${CLASS}__panel--explain`);

  const stage = createElement("div", { classNames: `${CLASS}__stage` }, [physCard.element, logicCard.element, filesCard.element, explainCard.element]);

  // --- Confronto finale -------------------------------------------------------------
  const compareDevice = (name, barLabel) => {
    const state = createElement("span", { classNames: [`${CLASS}__caption`, `${CLASS}__caption--left`] });
    const sceneSlot = createElement("div");
    const gridSlot = createElement("div", { attrs: { role: "img", "aria-hidden": "true" } });
    const fill = createElement("i");
    const bar = createElement("div", { classNames: `${CLASS}__bar`, attrs: { role: "progressbar", "aria-label": barLabel, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" } }, [fill]);
    const time = createElement("span", { classNames: `${CLASS}__time`, text: text("compareTime", { s: "0,0" }) });
    const card = make(createCard({ content: [createElement("strong", { text: name }), state, sceneSlot, gridSlot, bar, time] }));
    return { card, state, sceneSlot, gridSlot, fill, bar, time };
  };
  const cmpHdd = compareDevice(L.compareHddName, L.compareBarHdd);
  const cmpSsd = compareDevice(L.compareSsdName, L.compareBarSsd);
  const table = createElement("table", { classNames: `${CLASS}__table` }, [
    createElement("thead", {}, [createElement("tr", {}, [L.tableCriterion, L.compareHddName, L.compareSsdName].map((label) => createElement("th", { text: label })))]),
    createElement("tbody", {}, config.comparison.rows.map((row) =>
      createElement("tr", {}, [createElement("th", { text: row.label }), createElement("td", { text: row.hdd }), createElement("td", { text: row.ssd })]))),
  ]);
  const compareBox = createElement("section", { classNames: `${CLASS}__compare`, attrs: { "aria-label": L.compareTitle } }, [
    createElement("h2", { classNames: `${CLASS}__card-title`, text: L.compareTitle }),
    createElement("div", { classNames: `${CLASS}__compare-grid` }, [cmpHdd.card.element, cmpSsd.card.element]),
    table,
    createElement("p", { classNames: `${CLASS}__note`, text: config.comparison.conclusion }),
  ]);
  compareBox.hidden = true;

  const liveStatus = createElement("p", { classNames: "sl-visually-hidden", attrs: { role: "status", "aria-live": "polite" } });
  const root = createElement("div", { classNames: CLASS }, [header, infoBox, selector, stepNav, stage, compareBox, liveStatus]);

  // --- Disegno -----------------------------------------------------------------------
  const cells = buildGrid(cellsMount, false);

  function paintCell(cs, st, c, ghost) {
    const k = st.g[c];
    const el = cs[c];
    const free = ghost || k === ".";
    el.className = `${CLASS}__cell${free ? ` ${CLASS}__cell--free` : ""}`;
    el.dataset.file = free ? "." : k; // leggibile da test e tecnologie assistive: quale file occupa il cluster
    el.style.background = free ? "" : cellBackground(styleById[k]);
    el.style.color = free ? "" : textColors[k] || "#ffffff";
    el.textContent = ghost ? "×" : textColors[k] ? String(st.n[c]) : "";
  }

  function markSector(c) {
    cells.forEach((el) => el.parentNode.classList.remove("is-current"));
    if (c !== null && c >= 0) cells[c].parentNode.classList.add("is-current");
  }

  function drawFiles(g) {
    clearChildren(filesList);
    config.files.forEach((file) => {
      const written = g.filter((v) => v === file.id).length;
      const groups = groupCount(g, file.id);
      const swatch = createElement("i", { classNames: [`${CLASS}__swatch`, `${CLASS}__swatch--big`] });
      swatch.style.background = cellBackground(file);
      const detail = createElement("span", {}, [
        createElement("strong", { text: file.name }),
        createElement("br"),
        document.createTextNode(text("filesCount", { mb: file.mb, done: written })),
      ]);
      if (groups > 1) detail.appendChild(createElement("span", { classNames: `${CLASS}__fragmented`, text: ` ${text("fragmented", { n: groups })}` }));
      filesList.appendChild(createElement("li", { attrs: { "data-file": file.id } }, [swatch, detail]));
    });
  }

  function summaryText(g) {
    const s = summarize(g, config.existing.id);
    return `Cluster dei file: ${s.files}, preesistenti: ${s.existing}, liberi: ${s.free}`;
  }

  function drawState(st) {
    st.g.forEach((_, c) => paintCell(cells, st, c));
    drawFiles(st.g);
    cellsMount.setAttribute("aria-label", text("gridAria", { sum: summaryText(st.g) }));
  }

  function setMode(kind, detail) {
    modeLogic.classList.toggle("is-on", kind === "logic");
    modePhysical.classList.toggle("is-on", kind === "physical");
    modeText.textContent = detail || "";
  }

  function announce(message) {
    liveStatus.textContent = message;
  }

  function currentScenario() {
    return config.scenarios[sIdx];
  }

  function buildScene(medium, mount, options) {
    clearChildren(mount);
    const created =
      medium === "hdd"
        ? createHddScene({ styles, textColors, lensNote: L.lensHdd, ariaLabel: L.stage, ...options })
        : createSsdScene({ styles, textColors, lensNote: L.lensSsd, ariaLabel: L.stage, chipLabel: "Flash", ...options });
    mount.appendChild(created.element);
    return created;
  }

  function setSpeedVar() {
    root.style.setProperty("--k", String(motion.factor()));
  }

  // --- Stato dei controlli ------------------------------------------------------------
  function isLast() {
    return cur === currentScenario().steps.length - 1;
  }

  function applyState() {
    root.dataset.scenario = currentScenario().id;
    root.dataset.step = String(cur);
    root.dataset.animating = String(playing);
    root.dataset.done = String(done.size);
    root.dataset.speed = String(speed);
    root.dataset.zoomed = String(Boolean(scene) && scene.zoomKey() !== null);
    const steps = currentScenario().steps;
    counter.textContent = text("stepCounter", { n: cur + 1, total: steps.length });
    clearChildren(stepList);
    steps.forEach((step, i) => {
      const status = i === cur ? "current" : done.has(i) ? "done" : i <= done.size ? "open" : "locked";
      const badge = createElement("span", { classNames: `${CLASS}__step-icon`, attrs: { "aria-hidden": "true" } });
      if (done.has(i)) badge.appendChild(buildStateIcon("done"));
      else if (status === "locked") badge.appendChild(buildStateIcon("lock"));
      const label = createElement("span", {}, [createElement("b", { text: String(i + 1) }), document.createTextNode(` ${step.title}`)]);
      if (status === "locked") label.appendChild(createElement("span", { classNames: "sl-visually-hidden", text: `, ${L.stepLockedSr}. ${L.stepLocked}` }));
      if (done.has(i) && status !== "locked") label.appendChild(createElement("span", { classNames: "sl-visually-hidden", text: `, ${L.stepDone}` }));
      const button = createElement("button", {
        classNames: [`${CLASS}__step`, `${CLASS}__step--${status}`, done.has(i) ? `${CLASS}__step--done` : ""],
        attrs: { type: "button", "data-index": String(i), ...(status === "current" ? { "aria-current": "step" } : {}), ...(status === "locked" ? { "aria-disabled": "true", title: L.stepLocked } : {}) },
      }, [badge, label]);
      stepList.appendChild(createElement("li", {}, [button]));
    });
    scenarioButtons.forEach((button, i) => button.update({ pressed: i === sIdx }));
    proceedButton.update({ disabled: playing || !done.has(cur) || isLast() });
    proceedButton.element.title = playing ? L.proceedBusy : "";
    const zoomable = !playing;
    sceneMount.setAttribute("aria-disabled", String(!zoomable));
    sceneMount.classList.toggle("is-ready", zoomable);
    zoomHint.textContent = zoomable ? L.zoomHintReady : L.zoomHintBusy;
  }

  // --- Coreografia di un passaggio ------------------------------------------------------
  async function runStep(i) {
    const run = motion.begin();
    const sc = currentScenario();
    const hdd = sc.medium === "hdd";
    const step = scripts[sIdx][i];
    const compare = Boolean(sc.steps[i].kind === "compare");
    const F = hdd ? 1 : 0.5; // l'accesso elettronico è visibilmente più rapido, mai istantaneo
    const waitMs = async (ms) => run.wait(ms * F);

    physCard.element.hidden = logicCard.element.hidden = compare;
    compareBox.hidden = !compare;
    strip.hidden = reassemblyNote.hidden = !step.read;
    strip.className = `${CLASS}__strip`;
    clearChildren(strip);
    stepHeading.textContent = text("stepCounter", { n: i + 1, total: sc.steps.length }) + `: ${sc.steps[i].title}`;
    stepText.textContent = formatTemplate(sc.steps[i].text, { sum: summaryText(step.end.g) });
    announce(`${text("stepCounter", { n: i + 1, total: sc.steps.length })}: ${sc.steps[i].title}`);

    const live = { g: [...step.prev.g], n: [...step.prev.n] };
    drawState(live);
    markSector(null);
    scene.bind(live);
    scene.reset();
    caption.textContent = hdd ? L.capHome : L.capSsd;
    setMode(null, "");
    root.dataset.compare = "";
    applyState();

    if (compare) {
      if (!(await runCompare(run, sc.steps[i].referenceScenario))) return;
    } else if (step.phases.length === 0) {
      if (!(await run.wait(1200))) return;
    } else {
      for (const phase of step.phases) {
        if (phase.op === "d" && scene.zoomKey() !== null) {
          scene.out();
          markSector(null);
          if (!(await waitMs(1000))) return;
        }
        for (let j = 0; j < phase.cells.length; j += 1) {
          const c = phase.cells[j];
          lastCell = c;
          // 1) ALLOCAZIONE LOGICA: il sistema operativo sceglie il cluster.
          setMode("logic", text("logicStep", { c: c + 1 }));
          cells[c].classList.add("is-selected");
          if (!(await waitMs(350))) return;
          if (phase.op === "d") {
            paintCell(cells, live, c, true);
            if (!(await waitMs(300))) return;
          } else {
            // 2) ACCESSO FISICO: la testina (o il segnale) raggiunge la posizione.
            setMode("physical", hdd ? L.physicalHdd : text("physicalSsd", { chip: (c >> 3) + 1 }));
            if (scene.zoomKey() !== null && scene.zoomKey() !== scene.key(c)) {
              scene.out(); // uscita dal settore/chip: zoom out
              markSector(null);
              if (!(await waitMs(1000))) return;
            }
            if (scene.zoomKey() === null) {
              const changed = scene.travel(c);
              if (!(await waitMs(hdd ? (changed ? 750 : 350) : 400))) return;
              scene.zoomIn(c); // la camera si avvicina a traccia e settore
              if (hdd) markSector(c);
              if (!(await waitMs(1050))) return;
            } else {
              scene.travel(c);
              if (!(await waitMs(300))) return;
            }
            scene.light(c);
            caption.textContent = hdd
              ? text("capHdd", { t: (c >> 4) + 1, s: ((c & 15) >> 2) + 1, c: c + 1 })
              : text("capChip", { chip: (c >> 3) + 1, c: c + 1 });
            if (!(await waitMs(300))) return;
            if (phase.op === "read") strip.appendChild(buildTile(phase.nn[j]));
          }
          live.g[c] = phase.to[j];
          live.n[c] = phase.nn[j];
          paintCell(cells, live, c);
          cells[c].classList.remove("is-selected");
          scene.repaint();
          drawFiles(live.g);
          if (!(await waitMs(150))) return;
        }
      }
      if (scene.zoomKey() !== null) {
        scene.out();
        markSector(null);
        if (!(await waitMs(1000))) return;
      }
      if (step.read && !(await reassemble(run))) return;
    }

    if (!run.alive) return;
    setMode(null, "");
    playing = false;
    done.add(i);
    applyState();
    announce(`${text("stepCounter", { n: i + 1, total: sc.steps.length })}: ${sc.steps[i].title} ${L.completedSr}`);
  }

  function buildTile(number) {
    const file = styleById[readTargetId()];
    const tile = createElement("div", { classNames: [`${CLASS}__cell`, `${CLASS}__tile`], attrs: { "data-n": String(number) }, text: String(number) });
    tile.style.background = cellBackground(file);
    tile.style.color = file.textColor || "#ffffff";
    return tile;
  }

  // Id del file letto nel passaggio corrente (l'operazione "read" lo dichiara).
  function readTargetId() {
    const op = currentScenario().steps[cur].ops.find(([name]) => name === "read");
    return op ? op[1] : "y";
  }

  // Le porzioni, lette in ordine disordinato, si rimettono in ordine (FLIP) e si fondono.
  async function reassemble(run) {
    if (!(await run.wait(600))) return false;
    const tiles = Array.from(strip.children);
    const before = tiles.map((t) => t.getBoundingClientRect());
    [...tiles].sort((a, b) => a.dataset.n - b.dataset.n).forEach((t) => strip.appendChild(t));
    tiles.forEach((t, k) => {
      const after = t.getBoundingClientRect();
      t.style.transition = "none";
      t.style.transform = `translate(${before[k].left - after.left}px, ${before[k].top - after.top}px)`;
    });
    void strip.offsetWidth;
    tiles.forEach((t) => {
      t.style.transition = `transform ${0.7 * motion.factor()}s`;
      t.style.transform = "";
    });
    if (!(await run.wait(900))) return false;
    strip.classList.add("is-joined");
    strip.appendChild(createElement("span", { classNames: `${CLASS}__rebuilt`, text: L.rebuiltLabel }));
    caption.textContent = L.capRebuilt;
    return true;
  }

  // Confronto: la stessa sequenza di scrittura su entrambe le scene, con tempi in rapporto fisso.
  async function runCompare(run, referenceId) {
    const refIdx = Math.max(0, config.scenarios.findIndex((sc) => sc.id === referenceId));
    const events = flattenEvents(scripts[refIdx]);
    const total = events.length;
    root.dataset.compare = "running";
    cmpHdd.state.textContent = L.compareHddState;
    cmpSsd.state.textContent = L.compareSsdState;
    const devices = [
      { ui: cmpHdd, scene: buildScene("hdd", cmpHdd.sceneSlot, { overview: 0.75, small: true }), share: 1 },
      { ui: cmpSsd, scene: buildScene("ssd", cmpSsd.sceneSlot, { overview: 0.8, small: true }), share: config.timing.ratio },
    ].map((d) => {
      const st = { g: Array(CLUSTERS).fill("."), n: Array(CLUSTERS).fill(0) };
      const cs = buildGrid(d.ui.gridSlot, true);
      d.scene.bind(st);
      d.scene.reset();
      cs.forEach((_, c) => paintCell(cs, st, c));
      return { ...d, st, cs, applied: 0 };
    });
    const fmt = (ms) => (ms / 1000).toFixed(1).replace(".", ",");
    const finished = await run.frames(config.timing.hddTotalMs, (p) => {
      devices.forEach((d) => {
        const progress = Math.min(1, p * d.share);
        const upTo = Math.floor(progress * total + (progress >= 1 ? 1 : 0));
        while (d.applied < upTo && d.applied < total) {
          const ev = events[d.applied];
          d.applied += 1;
          d.st.g[ev.c] = ev.to;
          d.st.n[ev.c] = ev.n;
          paintCell(d.cs, d.st, ev.c);
          d.scene.travel(ev.c);
        }
        d.scene.repaint();
        d.ui.fill.style.width = `${progress * 100}%`;
        d.ui.bar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
        d.ui.time.textContent = text("compareTime", { s: fmt((progress * config.timing.hddTotalMs) / d.share) });
        if (progress >= 1) {
          d.scene.home();
          d.ui.state.textContent = L.compareDone;
        }
      });
    });
    if (finished) root.dataset.compare = "done";
    return finished;
  }

  function goTo(i) {
    cur = i;
    playing = true;
    lastCell = -1;
    runStep(i);
  }

  function loadScenario(i) {
    sIdx = i;
    done = new Set();
    scene = buildScene(currentScenario().medium, sceneMount, {});
    modePhysical.textContent = currentScenario().medium === "hdd" ? L.modePhysicalHdd : L.modePhysicalSsd;
    goTo(0);
  }

  // --- Ingrandimento manuale (solo a passaggio concluso) ---------------------------------
  function firstCellOf(key) {
    return currentScenario().medium === "hdd" ? key * 4 : key * 8;
  }

  function toggleManualZoom(key) {
    if (playing || destroyed) return;
    if (scene.zoomKey() !== null) {
      scene.out();
      markSector(null);
    } else if (key !== null) {
      const c = firstCellOf(key);
      scene.zoomIn(c, false);
      if (currentScenario().medium === "hdd") markSector(c);
      caption.textContent =
        currentScenario().medium === "hdd"
          ? text("capHdd", { t: (c >> 4) + 1, s: ((c & 15) >> 2) + 1, c: c + 1 }).replace(/ · cluster \d+$/, "")
          : text("capChip", { chip: (c >> 3) + 1, c: c + 1 }).replace(/ · cluster \d+$/, "");
    }
    applyState();
  }

  const onSceneClick = (event) => toggleManualZoom(scene.hit(event.target));
  const onSceneKeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleManualZoom(scene.key(lastCell >= 0 ? lastCell : 0));
    } else if (event.key === "Escape" && !playing && scene.zoomKey() !== null) {
      event.stopPropagation();
      toggleManualZoom(null);
    }
  };

  // --- Eventi dei controlli ------------------------------------------------------------------
  const onStepClick = (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    goTo(Number(button.dataset.index));
  };
  const onScenarioClick = (i) => () => loadScenario(i);
  const scenarioHandlers = scenarioButtons.map((button, i) => {
    const handler = onScenarioClick(i);
    button.element.addEventListener("sl:click", handler);
    return { button, handler };
  });
  const onProceed = () => goTo(cur + 1);
  const onReplay = () => goTo(cur);
  const onRestart = () => loadScenario(sIdx);
  const onInfoToggle = () => {
    infoOpen = !infoOpen;
    infoBox.hidden = !infoOpen;
    infoButton.element.setAttribute("aria-expanded", String(infoOpen));
  };

  const onDocumentClick = (event) => {
    if (!toolbar.contains(event.target)) setSettingsOpen(false);
  };
  const onDocumentKeydown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setSettingsOpen(false, true);
  };
  function setSettingsOpen(open, restoreFocus = false) {
    if (open === settingsOpen) return;
    settingsOpen = open;
    settingsPanel.hidden = !open;
    settingsButton.element.setAttribute("aria-expanded", String(open));
    if (open) {
      document.addEventListener("click", onDocumentClick);
      document.addEventListener("keydown", onDocumentKeydown);
    } else {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeydown);
      if (restoreFocus) settingsButton.element.focus();
    }
  }
  const onSettingsToggle = () => {
    setSettingsOpen(!settingsOpen);
    if (settingsOpen) speedOptions.find((o) => o.input.checked)?.input.focus();
  };
  const speedHandlers = speedOptions.map((option) => {
    const onChange = () => {
      if (!option.input.checked) return;
      speed = option.value;
      setSpeedVar(); // cambia solo i tempi: sequenza e stato finale restano gli stessi
      applyState();
    };
    option.input.addEventListener("change", onChange);
    return { input: option.input, onChange };
  });

  stepList.addEventListener("click", onStepClick);
  sceneMount.addEventListener("click", onSceneClick);
  sceneMount.addEventListener("keydown", onSceneKeydown);
  proceedButton.element.addEventListener("sl:click", onProceed);
  replayButton.element.addEventListener("sl:click", onReplay);
  restartButton.element.addEventListener("sl:click", onRestart);
  settingsButton.element.addEventListener("sl:click", onSettingsToggle);
  infoButton.element.addEventListener("sl:click", onInfoToggle);

  setSpeedVar();
  container.appendChild(root);
  loadScenario(0);

  return function destroy() {
    destroyed = true;
    motion.cancel();
    setSettingsOpen(false);
    stepList.removeEventListener("click", onStepClick);
    sceneMount.removeEventListener("click", onSceneClick);
    sceneMount.removeEventListener("keydown", onSceneKeydown);
    proceedButton.element.removeEventListener("sl:click", onProceed);
    replayButton.element.removeEventListener("sl:click", onReplay);
    restartButton.element.removeEventListener("sl:click", onRestart);
    settingsButton.element.removeEventListener("sl:click", onSettingsToggle);
    infoButton.element.removeEventListener("sl:click", onInfoToggle);
    scenarioHandlers.forEach(({ button, handler }) => button.element.removeEventListener("sl:click", handler));
    speedHandlers.forEach(({ input, onChange }) => input.removeEventListener("change", onChange));
    components.forEach((component) => component.destroy());
    root.remove();
  };
}
