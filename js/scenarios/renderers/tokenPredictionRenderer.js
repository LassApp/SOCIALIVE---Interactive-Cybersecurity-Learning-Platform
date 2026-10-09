/**
 * tokenPredictionRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "token-prediction" (scenario
 * "Tokenizzazione", modulo AI) — quinto type distinto del progetto. Lo
 * studente assiste alla "nascita" di una frase un token alla volta: a
 * ogni passo il finto modello assegna una percentuale a ciascun
 * candidato successivo (animazione live, tre decimali), sceglie quello
 * con la percentuale più alta e, premendo "Prosegui", la frase avanza.
 * "Rigenera" rifà SOLO il calcolo del passo corrente: lo stesso punto
 * dell'albero produce una distribuzione diversa, e può vincere un altro
 * candidato — è così che si vede cosa cambia quando cambia il contesto.
 *
 * CHROME STANDARD (nessun chrome:"none"): qui non c'è nessuna illusione
 * da preservare — è dichiaratamente una visualizzazione didattica — e il
 * docente tiene la Sidebar a portata per passare a un altro scenario.
 *
 * DATI: l'albero (token-tree.json) contiene solo parole e struttura;
 * le percentuali NON sono dati ma vengono generate a runtime (senza
 * contesto la scelta è casuale — vedi tokenProbability.js). Un nodo
 * senza "children" è un token finale e chiude la frase. Il vocabolario
 * (token-vocab.json, opzionale) associa a ogni parola la sua
 * tokenizzazione REALE con gli ID (o200k_base): se manca, tutto
 * funziona e l'unica cosa che sparisce è l'interruttore "Mostra token".
 *
 * SEMPLIFICAZIONE DICHIARATA: i candidati animati sono parole, per
 * leggibilità in aula; un LLM reale prevede invece "pezzi" (token),
 * spesso sotto-parole. Con "Mostra token" lo si vede: ogni parola si
 * apre nei suoi token reali con il rispettivo ID.
 *
 * MACCHINA A STATI (root.dataset.phase, usata anche dai test):
 *   calculating → barre animate, bottoni disattivi
 *   revealed    → vincitore evidenziato, Prosegui/Rigenera attivi
 *   complete    → frase finita: risultato + "Ricomincia"
 * Prosegui: revealed → (calculating sul passo successivo | complete).
 * Rigenera: revealed → calculating sullo STESSO passo.
 *
 * ACCESSIBILITÀ: il vincitore è segnalato dal testo "Scelto" e dal peso
 * tipografico, non dal solo colore; le barre sono decorative (il valore
 * è sempre anche testo). Le percentuali vengono annunciate UNA volta a
 * passo concluso (regione aria-live), non durante il conteggio. Il
 * focus resta nell'area di lavoro: dopo un click su Prosegui/Rigenera
 * (bottoni che si disattivano durante il calcolo) passa al gruppo dei
 * candidati e, a calcolo finito, torna su Prosegui — il ciclo Invio →
 * attesa → Invio funziona da tastiera.
 *
 * Nessuna richiesta di rete oltre ai due JSON locali, nessuna
 * persistenza: ogni apertura riparte dall'inizio.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement, clearChildren } from "../../utils/dom.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { createLocalJsonResource } from "../../repositories/localJsonRepository.js";
import { create as createButton } from "../../components/Button.js";
import { create as createCard } from "../../components/Card.js";
import { create as createBadge } from "../../components/Badge.js";
import { needsSpaceBefore, joinTokens } from "../../utils/tokenText.js";
import { generateDistribution, pickWinnerIndex, formatMilliPercent } from "../../utils/tokenProbability.js";
import {
  createMotionSeed,
  distributionAtProgress,
  CALCULATION_MS,
  REDUCED_MOTION_MS,
} from "../../utils/tokenMotion.js";

const BLOCK = "sl-token-prediction";
const TOKENS_VIEW_CLASS = `${BLOCK}--tokens`;

// Lettura a voce dei segni di punteggiatura nell'annuncio aria-live.
const SPOKEN_PUNCTUATION = { ".": "punto", "!": "punto esclamativo", "?": "punto interrogativo" };

function spokenToken(token) {
  return SPOKEN_PUNCTUATION[token] || token;
}

// Forma del token da usare in quel punto della frase (con o senza lo
// spazio iniziale, vedi tokenText.js). null se il vocabolario non lo
// conosce: il chiamante mostra allora solo la parola.
function formFor(vocab, token, previousToken) {
  const entry = vocab.tokens[token];
  if (!entry) return null;
  return needsSpaceBefore(previousToken, token) ? entry.spaced : entry.plain;
}

// Lo spazio iniziale di un token è invisibile: nella vista token lo si
// mostra come "·" (la legenda lo spiega).
function visibleSpaces(piece) {
  return piece.replace(/ /g, "·");
}

function buildPieces(form) {
  if (!form) return null;
  const pieces = form.pieces.map((piece, index) =>
    createElement("span", { classNames: `${BLOCK}__piece` }, [
      createElement("span", { classNames: `${BLOCK}__piece-text`, text: visibleSpaces(piece) }),
      createElement("span", { classNames: `${BLOCK}__piece-id`, text: String(form.ids[index]) }),
    ])
  );
  return createElement("span", { classNames: `${BLOCK}__pieces` }, pieces);
}

function buildCandidateRow(candidate, form) {
  const isEnd = !candidate.children;
  const label = createElement("span", { classNames: `${BLOCK}__candidate-label` }, [
    createElement("span", { classNames: `${BLOCK}__candidate-word`, text: candidate.token }),
    isEnd ? createElement("span", { classNames: `${BLOCK}__candidate-note`, text: "fine della frase" }) : null,
    buildPieces(form),
  ]);
  const badgeSlot = createElement("span", { classNames: `${BLOCK}__candidate-badge` });
  const percent = createElement("span", { classNames: `${BLOCK}__percent`, text: "0,000%" });
  const fill = createElement("span", { classNames: `${BLOCK}__fill` });
  const track = createElement("span", { classNames: `${BLOCK}__track`, attrs: { "aria-hidden": "true" } }, [fill]);

  const element = createElement(
    "li",
    { classNames: `${BLOCK}__candidate`, dataset: { token: candidate.token } },
    [createElement("div", { classNames: `${BLOCK}__candidate-header` }, [label, badgeSlot, percent]), track]
  );
  return { element, percent, fill, badgeSlot };
}

function countWords(path) {
  return path.filter((token) => /[\p{L}\d]/u.test(token)).length;
}

export async function renderTokenPrediction(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.tree) {
    console.error(`[tokenPredictionRenderer] "dataRefs.tree" assente per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let tree;
  try {
    tree = await createLocalJsonResource({ url: refs.tree }).get();
  } catch (error) {
    console.error(`[tokenPredictionRenderer] Impossibile caricare l'albero di "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }
  if (!tree || !tree.root || !Array.isArray(tree.children) || tree.children.length < 2) {
    console.error(`[tokenPredictionRenderer] Albero non valido per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  // Vocabolario opzionale: un suo fallimento non blocca lo scenario.
  let vocab = { tokens: {} };
  if (refs.vocab) {
    try {
      vocab = await createLocalJsonResource({ url: refs.vocab }).get();
    } catch (error) {
      console.warn("[tokenPredictionRenderer] Vocabolario non disponibile: la vista 'Mostra token' resta disattivata.", error);
    }
  }
  const hasVocab = Object.keys(vocab.tokens || {}).length > 0;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    path: [tree.root],
    node: { token: tree.root, children: tree.children },
    phase: "calculating",
    target: [],
    winner: -1,
    rows: [],
    badge: null,
    frame: 0,
    runId: 0,
  };
  let destroyed = false;

  // --- struttura ------------------------------------------------------
  const heading = createElement("h1", {
    classNames: "sl-visually-hidden",
    text: scenario.title || "Tokenizzazione",
  });

  const tokensToggle = createButton({
    variant: "ghost",
    label: "Mostra token",
    pressed: false,
    ariaLabel: "Mostra token: scomponi ogni parola nei token reali del modello",
  });
  tokensToggle.element.classList.add(`${BLOCK}__tokens-toggle`);
  tokensToggle.element.hidden = !hasVocab;

  const legend = createElement("p", {
    classNames: `${BLOCK}__legend`,
    text: "Il punto · segna uno spazio che fa parte del token. Sotto ogni pezzo, il suo ID.",
  });

  const chipList = createElement("ol", {
    classNames: `${BLOCK}__sentence`,
    attrs: { "aria-label": "Frase in costruzione" },
  });
  const stats = createElement("p", { classNames: `${BLOCK}__stats` });
  stats.hidden = true;

  const sentenceCard = createCard({
    content: [
      createElement("div", { classNames: `${BLOCK}__toolbar` }, [hasVocab ? legend : null, tokensToggle.element]),
      chipList,
      stats,
    ],
  });

  const candidateList = createElement("ul", { classNames: `${BLOCK}__candidates` });
  const stepRegion = createElement(
    "div",
    {
      classNames: `${BLOCK}__step`,
      attrs: { role: "group", "aria-label": "Candidati per il prossimo token", tabindex: "-1" },
    },
    [candidateList]
  );
  const stepCard = createCard({ content: [stepRegion] });

  const resultText = createElement("p", { classNames: `${BLOCK}__result-text` });
  const resultCard = createCard({ content: [resultText] });
  resultCard.element.hidden = true;

  const proceedButton = createButton({ variant: "primary", label: "Prosegui", disabled: true });
  proceedButton.element.classList.add(`${BLOCK}__proceed`);
  const regenerateButton = createButton({
    variant: "secondary",
    label: "Rigenera",
    ariaLabel: "Rigenera le percentuali di questo passo",
    disabled: true,
  });
  regenerateButton.element.classList.add(`${BLOCK}__regenerate`);
  const restartButton = createButton({ variant: "primary", label: "Ricomincia" });
  restartButton.element.classList.add(`${BLOCK}__restart`);
  restartButton.element.hidden = true;

  const controls = createElement("div", { classNames: `${BLOCK}__controls` }, [
    proceedButton.element,
    regenerateButton.element,
    restartButton.element,
  ]);

  const status = createElement("p", {
    classNames: ["sl-visually-hidden", `${BLOCK}__status`],
    attrs: { role: "status", "aria-live": "polite" },
  });

  const root = createElement(
    "div",
    { classNames: BLOCK, dataset: { phase: state.phase } },
    [heading, sentenceCard.element, stepCard.element, resultCard.element, controls, status]
  );

  // --- rendering ------------------------------------------------------
  function announce(message) {
    status.textContent = message;
  }

  function lastToken() {
    return state.path[state.path.length - 1];
  }

  function renderSentence() {
    clearChildren(chipList);
    state.path.forEach((token, index) => {
      const previous = index === 0 ? null : state.path[index - 1];
      const chip = createElement("li", { classNames: `${BLOCK}__chip` }, [
        createElement("span", { classNames: `${BLOCK}__chip-word`, text: token }),
        buildPieces(formFor(vocab, token, previous)),
      ]);
      chipList.appendChild(chip);
    });
    if (state.phase !== "complete") {
      chipList.appendChild(
        createElement("li", { classNames: `${BLOCK}__slot`, attrs: { "aria-hidden": "true" }, text: "…" })
      );
    }
  }

  function releaseBadge() {
    if (state.badge) state.badge.destroy();
    state.badge = null;
  }

  function renderCandidates() {
    releaseBadge();
    clearChildren(candidateList);
    state.rows = state.node.children.map((candidate) =>
      buildCandidateRow(candidate, formFor(vocab, candidate.token, lastToken()))
    );
    state.rows.forEach((row) => candidateList.appendChild(row.element));
  }

  function paintDistribution(values) {
    values.forEach((value, index) => {
      const row = state.rows[index];
      row.percent.textContent = `${formatMilliPercent(value)}%`;
      row.fill.style.width = `${value / 1000}%`;
    });
  }

  function setPhase(phase) {
    state.phase = phase;
    root.dataset.phase = phase;
    stepRegion.setAttribute("aria-busy", String(phase === "calculating"));
    const interactive = phase === "revealed";
    proceedButton.update({ disabled: !interactive });
    regenerateButton.update({ disabled: !interactive });
  }

  // Il focus "libero" (nessun elemento preciso) è l'unico caso in cui
  // lo si sposta da soli: mai strappare il focus a chi sta altrove.
  function focusIsIdle() {
    const active = document.activeElement;
    return !active || active === document.body || active === stepRegion;
  }

  function reveal() {
    setPhase("revealed");
    paintDistribution(state.target);
    state.rows.forEach((row, index) => {
      const isWinner = index === state.winner;
      row.element.classList.toggle(`${BLOCK}__candidate--winner`, isWinner);
      row.element.classList.toggle(`${BLOCK}__candidate--loser`, !isWinner);
    });
    const winnerRow = state.rows[state.winner];
    state.badge = createBadge({ label: "Scelto", tone: "success" });
    winnerRow.badgeSlot.appendChild(state.badge.element);

    const spoken = state.node.children
      .map((candidate, index) => `${spokenToken(candidate.token)} ${formatMilliPercent(state.target[index])} per cento`)
      .join(", ");
    announce(`Percentuali calcolate. ${spoken}. Il più probabile: ${spokenToken(state.node.children[state.winner].token)}.`);
    if (focusIsIdle()) proceedButton.element.focus();
  }

  function runAnimation() {
    const reducedMotion = reducedMotionQuery.matches;
    const duration = reducedMotion ? REDUCED_MOTION_MS : CALCULATION_MS;
    const seed = createMotionSeed(state.target.length);
    const runId = (state.runId += 1);
    const startedAt = performance.now();
    const options = { reducedMotion };

    paintDistribution(distributionAtProgress(state.target, 0, seed, options));

    function frame(now) {
      if (destroyed || runId !== state.runId) return;
      const progress = Math.min((now - startedAt) / duration, 1);
      if (progress >= 1) {
        reveal();
        return;
      }
      paintDistribution(distributionAtProgress(state.target, progress, seed, options));
      state.frame = requestAnimationFrame(frame);
    }
    state.frame = requestAnimationFrame(frame);
  }

  function startStep({ regenerate }) {
    cancelAnimationFrame(state.frame);
    const count = state.node.children.length;
    state.target = generateDistribution(count, { previous: regenerate ? state.target : null });
    state.winner = pickWinnerIndex(state.target);
    renderCandidates();
    setPhase("calculating");
    runAnimation();
  }

  function completeSentence() {
    cancelAnimationFrame(state.frame);
    state.runId += 1;
    releaseBadge();
    setPhase("complete");
    renderSentence();

    const sentence = joinTokens(state.path);
    const words = countWords(state.path);
    const realTokens = state.path.reduce((total, token, index) => {
      const form = formFor(vocab, token, index === 0 ? null : state.path[index - 1]);
      return total + (form ? form.pieces.length : 1);
    }, 0);
    resultText.textContent = sentence;
    stats.textContent = hasVocab ? `${words} parole · ${realTokens} token reali` : `${words} parole`;
    stats.hidden = false;

    stepCard.element.hidden = true;
    resultCard.element.hidden = false;
    proceedButton.element.hidden = true;
    regenerateButton.element.hidden = true;
    restartButton.element.hidden = false;
    announce(`Frase completa: ${sentence}. ${stats.textContent}.`);
    if (focusIsIdle()) restartButton.element.focus();
  }

  // --- interazioni ----------------------------------------------------
  function handleProceed() {
    if (state.phase !== "revealed") return;
    const chosen = state.node.children[state.winner];
    state.path.push(chosen.token);
    state.node = chosen;
    stepRegion.focus({ preventScroll: true });
    if (!chosen.children) {
      completeSentence();
      return;
    }
    renderSentence();
    startStep({ regenerate: false });
  }

  function handleRegenerate() {
    if (state.phase !== "revealed") return;
    stepRegion.focus({ preventScroll: true });
    announce("Ricalcolo delle percentuali di questo passo.");
    startStep({ regenerate: true });
  }

  function handleRestart() {
    state.path = [tree.root];
    state.node = { token: tree.root, children: tree.children };
    stats.hidden = true;
    stepCard.element.hidden = false;
    resultCard.element.hidden = true;
    proceedButton.element.hidden = false;
    regenerateButton.element.hidden = false;
    restartButton.element.hidden = true;
    // Prima il passo (porta la fase fuori da "complete"), poi la frase:
    // il segnaposto del prossimo token compare solo se la frase non è
    // completa. Ridisegnarla prima lo faceva sparire.
    startStep({ regenerate: false });
    renderSentence();
    stepRegion.focus({ preventScroll: true });
  }

  function handleTokensToggle() {
    const showTokens = !root.classList.contains(TOKENS_VIEW_CLASS);
    root.classList.toggle(TOKENS_VIEW_CLASS, showTokens);
    tokensToggle.update({ pressed: showTokens });
  }

  proceedButton.element.addEventListener("sl:click", handleProceed);
  regenerateButton.element.addEventListener("sl:click", handleRegenerate);
  restartButton.element.addEventListener("sl:click", handleRestart);
  tokensToggle.element.addEventListener("sl:click", handleTokensToggle);

  container.appendChild(root);
  renderSentence();
  startStep({ regenerate: false });

  return function destroy() {
    destroyed = true;
    state.runId += 1;
    cancelAnimationFrame(state.frame);
    proceedButton.element.removeEventListener("sl:click", handleProceed);
    regenerateButton.element.removeEventListener("sl:click", handleRegenerate);
    restartButton.element.removeEventListener("sl:click", handleRestart);
    tokensToggle.element.removeEventListener("sl:click", handleTokensToggle);
    releaseBadge();
    [proceedButton, regenerateButton, restartButton, tokensToggle, sentenceCard, stepCard, resultCard].forEach(
      (instance) => instance.destroy()
    );
    root.remove();
  };
}
