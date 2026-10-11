/**
 * llmResponseCycleRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "llm-response-cycle" (scenario
 * "Allucinazioni", modulo AI) — sesto type distinto del progetto. Mostra
 * il ciclo di un LLM come un cerchio: Richiesta → (freccia
 * "Elaborazione") → Risposta → (freccia "genera risposta") → di nuovo
 * Richiesta. Tre switch fanno vedere tre esiti alla stessa domanda:
 *   - Risposta esatta e Risposta allucinata percorrono TUTTO il cerchio:
 *     per il ciclo sono indistinguibili, ed è il punto — a un LLM non
 *     importa che la risposta sia vera, importa che la generi;
 *   - Nessuna risposta si ferma alla freccia "Elaborazione in corso…":
 *     il cerchio resta aperto, ed è il caso che per un LLM NON può
 *     accadere (la spiegazione a schermo lo dice).
 *
 * SEQUENZA (un passo ogni stepMs, 2 s di default, scenario.json):
 *   request → process → answer → generate → complete   (esatta/allucinata)
 *   request → process → stalled                         (nessuna risposta)
 * Ogni passo SPEGNE quello precedente: si accende una sola parte alla
 * volta, per far notare i singoli passaggi. A cerchio chiuso (complete)
 * le quattro parti passano a uno stato "done" uniforme — il cerchio
 * disegnato per intero — e SOLO ORA compaiono il testo della risposta e
 * la spiegazione. Nel passo "stalled" la freccia di elaborazione resta
 * accesa, la Risposta resta vuota ("Nessun output") e la freccia di
 * ritorno è interrotta.
 *
 * STATI (data-state su ogni parte, data-step sulla radice — usati dal
 * CSS e dai test): off · lit · done · empty (solo Risposta) · broken
 * (solo freccia di ritorno).
 *
 * DATI: domande ed esiti non stanno nel codice. questions.json ha, per
 * ogni domanda, la risposta esatta e quella allucinata; outcomes.json
 * ha, per ciascuno dei tre esiti, l'etichetta dello switch e la
 * spiegazione del diagramma. Aggiungere una domanda è solo un cambio di
 * dati. I tre id degli esiti (exact, silence, hallucination) sono
 * invece vincolati al codice, perché determinano il comportamento: se
 * mancano, lo scenario non parte.
 *
 * SCELTA DELLA DOMANDA: Dropdown (componente generico, nuovo) + pulsante
 * "Casuale", che pesca da un mazzo mescolato senza ripetere la domanda a
 * schermo (questionDeck.js). All'apertura si parte da una domanda
 * casuale. Cambiare domanda riporta tutto a riposo: nessuno switch
 * premuto, cerchio spento.
 *
 * TEMPI E MOVIMENTO RIDOTTO: i passi sono narrazione, non decorazione —
 * durano uguale anche con "riduci animazioni"; sono invece le
 * transizioni CSS (che passano dai token --sl-duration-*) a sparire.
 *
 * ACCESSIBILITÀ: lo stato di ogni parte è anche nel testo (l'etichetta
 * della freccia passa da "Elaborazione" a "Elaborazione in corso…", la
 * Risposta mostra "—" / "Nessun output"), mai il solo colore. Ogni
 * passo e l'esito finale sono annunciati da una regione aria-live. Gli
 * switch sono bottoni con aria-pressed; il focus non viene mai spostato
 * da qui.
 *
 * Nessuna richiesta di rete oltre ai tre JSON locali, nessuna
 * persistenza: ogni apertura riparte da zero.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement } from "../../utils/dom.js";
import { svgNode } from "../../utils/svg.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { createQuestionDeck } from "../../utils/questionDeck.js";
import { createLocalJsonResource } from "../../repositories/localJsonRepository.js";
import { create as createButton } from "../../components/Button.js";
import { create as createCard } from "../../components/Card.js";
import { create as createDropdown } from "../../components/Dropdown.js";

const BLOCK = "sl-llm-cycle";

const DEFAULT_STEP_MS = 2000;
const MIN_STEP_MS = 300;
const MAX_STEP_MS = 10000;

const MODE_IDS = ["exact", "silence", "hallucination"];

const SEQUENCES = {
  exact: ["request", "process", "answer", "generate", "complete"],
  hallucination: ["request", "process", "answer", "generate", "complete"],
  silence: ["request", "process", "stalled"],
};

const OFF = { request: "off", process: "off", answer: "off", generate: "off" };
const PART_STATES = {
  idle: OFF,
  request: { ...OFF, request: "lit" },
  process: { ...OFF, process: "lit" },
  answer: { ...OFF, answer: "lit" },
  generate: { ...OFF, generate: "lit" },
  complete: { request: "done", process: "done", answer: "done", generate: "done" },
  stalled: { ...OFF, process: "lit", answer: "empty", generate: "broken" },
};

const PROCESS_LABEL_IDLE = "Elaborazione";
// Spazio non separabile tra "in" e "corso…": a capo l'etichetta si spezza
// in "Elaborazione / in corso…" invece di "Elaborazione in / corso…".
const PROCESS_LABEL_RUNNING = "Elaborazione in\u00a0corso…";
const GENERATE_LABEL = "genera risposta";
const ANSWER_PLACEHOLDER = "—";
const ANSWER_NONE = "Nessun output";

function resolveStepMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_STEP_MS;
  return Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, parsed));
}

function isFilledString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validQuestions(data) {
  const questions = data && data.questions;
  return (
    Array.isArray(questions) &&
    questions.length > 0 &&
    questions.every(
      (q) => q && isFilledString(q.id) && isFilledString(q.text) && isFilledString(q.exact) && isFilledString(q.hallucinated)
    )
  );
}

function validOutcomes(data) {
  const modes = data && data.modes;
  return (
    Array.isArray(modes) &&
    MODE_IDS.every((id) => modes.some((mode) => mode.id === id && isFilledString(mode.label) && isFilledString(mode.explanation)))
  );
}

// fill:"none" è ripetuto sul rettangolo: Button impone "fill: currentColor"
// sull'svg dell'icona (button.css) e il quadrato, ereditandolo, verrebbe
// pieno — stessa ragione per cui PostCard dichiara fill/stroke su ogni path.
function buildDiceIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("rect", { x: "4", y: "4", width: "16", height: "16", rx: "3", fill: "none", stroke: "currentColor", "stroke-width": "1.5" })
  );
  [
    [9, 9],
    [12, 12],
    [15, 15],
  ].forEach(([cx, cy]) => svg.appendChild(svgNode("circle", { cx: String(cx), cy: String(cy), r: "1.3", fill: "currentColor" })));
  return svg;
}

function buildInfoIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" });
  svg.appendChild(svgNode("circle", { cx: "12", cy: "12", r: "9", stroke: "currentColor", "stroke-width": "1.5" }));
  svg.appendChild(
    svgNode("path", { d: "M12 11v5", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" })
  );
  svg.appendChild(svgNode("circle", { cx: "12", cy: "8", r: "1", fill: "currentColor" }));
  return svg;
}

// Nodo del cerchio (Richiesta / Risposta): una Card con etichetta e testo.
function buildNode(part, label) {
  const text = createElement("p", { classNames: `${BLOCK}__node-text` });
  const card = createCard({
    content: [createElement("span", { classNames: `${BLOCK}__node-label`, text: label }), text],
  });
  card.element.classList.add(`${BLOCK}__node`, `${BLOCK}__node--${part}`);
  card.element.dataset.part = part;
  return { card, text };
}

// Freccia: un arco disegnato in CSS (bordi arrotondati + punta), così si
// ridimensiona con la pagina senza deformarsi. L'etichetta sta accanto.
function buildArrow(part, side) {
  const arrow = createElement("div", {
    classNames: [`${BLOCK}__arrow`, `${BLOCK}__arrow--${part}`],
    dataset: { part },
    attrs: { "aria-hidden": "true" },
  });
  const label = createElement("span", { classNames: `${BLOCK}__arrow-label` });
  const children = side === "right" ? [arrow, label] : [label, arrow];
  const element = createElement("div", { classNames: [`${BLOCK}__side`, `${BLOCK}__side--${side}`] }, children);
  return { element, arrow, label };
}

export async function renderLlmResponseCycle(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.questions || !refs.outcomes) {
    console.error(`[llmResponseCycleRenderer] "dataRefs" incompleto per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let questionsData;
  let outcomesData;
  try {
    [questionsData, outcomesData] = await Promise.all([
      createLocalJsonResource({ url: refs.questions }).get(),
      createLocalJsonResource({ url: refs.outcomes }).get(),
    ]);
  } catch (error) {
    console.error(`[llmResponseCycleRenderer] Impossibile caricare i dati di "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }
  if (!validQuestions(questionsData) || !validOutcomes(outcomesData)) {
    console.error(`[llmResponseCycleRenderer] Dati non validi per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  const questions = questionsData.questions;
  const modes = MODE_IDS.map((id) => outcomesData.modes.find((mode) => mode.id === id));
  const stepMs = resolveStepMs(scenario.stepMs);
  const deck = createQuestionDeck(questions.length);

  const state = { questionIndex: deck.next(-1), modeId: null, step: "idle", runId: 0, timer: 0 };
  let destroyed = false;

  // --- struttura ------------------------------------------------------
  const title = createElement("h1", { classNames: `${BLOCK}__title`, text: scenario.title || "Allucinazioni" });

  const dropdown = createDropdown({
    label: "Domanda",
    options: questions.map((q) => ({ value: q.id, label: q.text })),
    value: questions[state.questionIndex].id,
  });
  dropdown.element.classList.add(`${BLOCK}__dropdown`);

  const randomButton = createButton({
    variant: "secondary",
    label: "Casuale",
    ariaLabel: "Scegli una domanda a caso",
    icon: buildDiceIcon(),
  });
  randomButton.element.classList.add(`${BLOCK}__random`);
  const picker = createElement("div", { classNames: `${BLOCK}__picker` }, [dropdown.element, randomButton.element]);

  const modeButtons = modes.map((mode) => {
    const button = createButton({ variant: "secondary", label: mode.label, pressed: false });
    button.element.classList.add(`${BLOCK}__mode`);
    button.element.dataset.mode = mode.id;
    return button;
  });
  const modeGroup = createElement(
    "div",
    { classNames: `${BLOCK}__modes`, attrs: { role: "group", "aria-label": "Tipo di risposta" } },
    modeButtons.map((button) => button.element)
  );

  const request = buildNode("request", "Richiesta");
  const answer = buildNode("answer", "Risposta");
  const processArrow = buildArrow("process", "right");
  const generateArrow = buildArrow("generate", "left");
  generateArrow.label.textContent = GENERATE_LABEL;

  const ring = createElement("div", { classNames: `${BLOCK}__ring` }, [
    request.card.element,
    processArrow.element,
    answer.card.element,
    generateArrow.element,
  ]);
  const stage = createElement("div", { classNames: `${BLOCK}__stage` }, [ring]);
  const ringCard = createCard({ content: [stage] });
  ringCard.element.classList.add(`${BLOCK}__ring-card`);
  ringCard.element.setAttribute("role", "group");
  ringCard.element.setAttribute("aria-label", "Ciclo di generazione della risposta");

  const explanationText = createElement("p", { classNames: `${BLOCK}__explanation-text` });
  const explanation = createElement("div", { classNames: `${BLOCK}__explanation`, attrs: { role: "note" } }, [
    createElement("span", { classNames: `${BLOCK}__explanation-icon` }, [buildInfoIcon()]),
    explanationText,
  ]);
  explanation.hidden = true;

  const status = createElement("p", {
    classNames: ["sl-visually-hidden", `${BLOCK}__status`],
    attrs: { role: "status", "aria-live": "polite" },
  });

  const root = createElement(
    "div",
    { classNames: BLOCK, dataset: { step: state.step, mode: "" } },
    [title, picker, modeGroup, ringCard.element, explanation, status]
  );

  const parts = {
    request: request.card.element,
    process: processArrow.arrow,
    answer: answer.card.element,
    generate: generateArrow.arrow,
  };

  // --- rendering ------------------------------------------------------
  function currentQuestion() {
    return questions[state.questionIndex];
  }

  function currentMode() {
    return modes.find((mode) => mode.id === state.modeId) || null;
  }

  function answerSentence() {
    const question = currentQuestion();
    return state.modeId === "hallucination" ? question.hallucinated : question.exact;
  }

  function paint(step) {
    state.step = step;
    root.dataset.step = step;
    Object.entries(PART_STATES[step]).forEach(([part, partState]) => {
      parts[part].dataset.state = partState;
    });
    // Lo stato sta anche sul contenitore di ogni freccia: è lui che
    // colora l'etichetta accanto (nel DOM l'etichetta non è figlia
    // dell'arco, e il CSS non ha un selettore "fratello precedente").
    processArrow.element.dataset.state = PART_STATES[step].process;
    generateArrow.element.dataset.state = PART_STATES[step].generate;
    const processRunning = step === "process" || step === "stalled";
    processArrow.label.textContent = processRunning ? PROCESS_LABEL_RUNNING : PROCESS_LABEL_IDLE;
    if (step === "complete") answer.text.textContent = answerSentence();
    else if (step === "stalled") answer.text.textContent = ANSWER_NONE;
    else answer.text.textContent = ANSWER_PLACEHOLDER;
  }

  function paintQuestion() {
    request.text.textContent = currentQuestion().text;
  }

  function paintModes() {
    modeButtons.forEach((button) => {
      const pressed = button.element.dataset.mode === state.modeId;
      button.update({ variant: pressed ? "primary" : "secondary", pressed });
    });
    root.dataset.mode = state.modeId || "";
  }

  function announce(message) {
    status.textContent = message;
  }

  function announceStep(step) {
    const mode = currentMode();
    const messages = {
      request: `Richiesta inviata: ${currentQuestion().text}`,
      process: "Elaborazione in corso.",
      answer: "Risposta in preparazione.",
      generate: "Generazione della risposta.",
      complete: `${answerSentence()} ${mode ? mode.explanation : ""}`,
      stalled: `Nessuna risposta generata. ${mode ? mode.explanation : ""}`,
    };
    announce(messages[step] || "");
  }

  function showExplanation() {
    explanationText.textContent = currentMode().explanation;
    explanation.hidden = false;
  }

  // --- sequenza -------------------------------------------------------
  function stopRun() {
    clearTimeout(state.timer);
    state.runId += 1;
  }

  function reset() {
    stopRun();
    state.modeId = null;
    explanation.hidden = true;
    paintModes();
    paint("idle");
    announce("");
  }

  function run(modeId) {
    stopRun();
    const runId = state.runId;
    state.modeId = modeId;
    explanation.hidden = true;
    paintModes();

    const sequence = SEQUENCES[modeId];
    let index = 0;

    function showStep() {
      if (destroyed || runId !== state.runId) return;
      const step = sequence[index];
      paint(step);
      announceStep(step);
      if (index === sequence.length - 1) {
        showExplanation();
        return;
      }
      index += 1;
      state.timer = setTimeout(showStep, stepMs);
    }
    showStep();
  }

  // --- interazioni ----------------------------------------------------
  function setQuestion(index) {
    state.questionIndex = index;
    paintQuestion();
    reset();
  }

  function handleModeClick(event) {
    const modeId = event.currentTarget.dataset.mode;
    if (MODE_IDS.includes(modeId)) run(modeId);
  }

  function handleQuestionChange(event) {
    const index = questions.findIndex((q) => q.id === event.detail.value);
    if (index >= 0) setQuestion(index);
  }

  function handleRandom() {
    const index = deck.next(state.questionIndex);
    dropdown.update({ value: questions[index].id });
    setQuestion(index);
  }

  modeButtons.forEach((button) => button.element.addEventListener("sl:click", handleModeClick));
  dropdown.element.addEventListener("sl:change", handleQuestionChange);
  randomButton.element.addEventListener("sl:click", handleRandom);

  container.appendChild(root);
  paintQuestion();
  reset();

  return function destroy() {
    destroyed = true;
    stopRun();
    modeButtons.forEach((button) => button.element.removeEventListener("sl:click", handleModeClick));
    dropdown.element.removeEventListener("sl:change", handleQuestionChange);
    randomButton.element.removeEventListener("sl:click", handleRandom);
    [dropdown, randomButton, ...modeButtons, request.card, answer.card, ringCard].forEach((instance) =>
      instance.destroy()
    );
    root.remove();
  };
}
