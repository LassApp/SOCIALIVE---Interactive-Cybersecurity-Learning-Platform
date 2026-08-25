/**
 * scenarioPageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/scenario/:scenarioId. Compone PageContainer + appShell
 * + scenarioEngine.loadScenario() — MODALITÀ STANDARD, usata da ogni
 * scenario che non dichiari diversamente (Oversharing, invariato).
 *
 * MODALITÀ IMMERSIVA (chrome:"none", introdotta per lo scenario
 * Keylogger — primo consumo reale di questo campo): alcuni scenari (un
 * login fittizio, in questo caso) devono occupare l'intera viewport
 * SENZA AppHeader/Sidebar attorno — mostrare la navigazione di
 * SocialAlive romperebbe l'illusione nell'istante stesso in cui la
 * pagina si apre. La decisione si legge dal campo "chrome" di
 * scenario.json, letto QUI prima di scegliere quale scheletro montare.
 *
 * Per farlo, questo controller esegue una PROPRIA fetch di
 * scenario.json (via createLocalJsonResource, la stessa fabbrica già
 * usata dall'engine) PRIMA di chiamare loadScenario(): la cache
 * condivisa di localJsonRepository.js (per URL, non per istanza — Fase
 * 5) rende la seconda fetch fatta internamente dall'engine un
 * cache-hit, zero richieste di rete aggiuntive. Additiva e
 * retrocompatibile: uno scenario senza il campo "chrome" (Oversharing,
 * ogni scenario esistente prima di questo intervento) valuta
 * "chrome === 'none'" a false e ottiene esattamente il comportamento di
 * sempre — nessuna riga di codice esistente cambia risultato.
 *
 * Nessuna voce di Sidebar risulta "attiva" su questa rotta in modalità
 * standard (appShell creato senza activeSidebarId, invariato da Fase
 * 5). In modalità immersiva non esiste alcuna Sidebar/AppHeader da
 * attivare — nessuna delle due, non solo nessuna voce.
 *
 * CONTAINER CONDIVISO (modalità standard) — invariato da Fase 5: un
 * solo <div> creato dal controller viene passato SIA a PageContainer
 * (come "main") SIA a loadScenario() (come punto di mount), evitando un
 * querySelector nell'albero interno di PageContainer.
 *
 * PLACEHOLDER DI CARICAMENTO: prima di sapere se lo scenario è standard
 * o immersivo, non si può ancora scegliere quale scheletro mostrare —
 * un nodo minimo con aria-busy occupa il container fino a quando la
 * fetch di scenario.json (per il solo campo "chrome") non risolve,
 * stesso principio già seguito da homePageController.js per l'area
 * popolata in modo asincrono.
 *
 * ASINCRONIA E RACE CONDITION: la guardia "destroyed" (stesso pattern
 * già stabilito in Fase 5/8) impedisce di costruire qualunque
 * componente se il controller viene smontato prima che la fetch di
 * "chrome" risolva — sia per la scelta dello scheletro sia per il
 * montaggio successivo del renderer via loadScenario().
 *
 * USCITA DALLA MODALITÀ IMMERSIVA (nuovo — richiesta del docente dopo
 * l'uso in produzione di Keylogger/Phishing): la modalità immersiva, per
 * design, non mostra AppHeader/Sidebar — ma questo lasciava il docente
 * SENZA ALCUNA via di uscita in-app dal flusso (solo back del browser o
 * modifica manuale dell'hash). Un bottone icona "×" (stesso pattern
 * grafico già usato da Modal/MediaViewer per la propria chiusura) viene
 * quindi montato QUI, non nei singoli renderer: un concern trasversale a
 * QUALUNQUE scenario chrome:"none", presente e futuro — un secondo
 * renderer immersivo (oltre a Keylogger/Phishing) lo eredita
 * automaticamente, zero modifiche a quel renderer (stesso principio DRY
 * già seguito per .sl-scenario-page__immersive stesso). Nome accessibile
 * onesto ("Torna alla Home", via aria-label): non compare come testo
 * visibile (l'icona resta un semplice "×", discreta e non didattica),
 * ma un docente che naviga con screen reader deve comunque sapere dove
 * porta — non c'è motivo di offuscare il nome accessibile per il
 * realismo, che riguarda solo la resa VISIVA per gli studenti in aula.
 * Presente fin dal primo istante (non solo dopo una rivelazione, che
 * Keylogger non ha nemmeno): la via di uscita deve esistere per tutta
 * la durata della simulazione, non solo alla fine.
 *
 * Interfaccia: (container, params) => destroy, coerente con router.js.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createButton } from "../components/Button.js";
import { createAppShell } from "./shared/appShell.js";
import { loadScenario } from "../scenarios/scenarioEngine.js";
import { createLocalJsonResource } from "../repositories/localJsonRepository.js";
import { navigate } from "../core/router.js";
import { svgNode } from "../utils/svg.js";

// Icona "×" — stesso identico pattern già usato da Modal.js/MediaViewer.js
// per la propria chiusura (nessuna dipendenza dall'icon sprite, ancora
// assente, debito noto da Fase 2). Locale a questo file: un solo
// consumer (il bottone di uscita sotto), non vale l'indirection di un
// quarto import da svg.js per una singola forma non riusata altrove in
// questo controller.
function buildExitIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("path", {
      d: "M6 6L18 18M18 6L6 18",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
    })
  );
  return svg;
}

export function createScenarioPageController(container, params) {
  let destroyed = false;
  let shell = null;
  let pageContainer = null;
  let mountPoint = null;
  let engineDestroy = null;
  let exitButton = null;

  function handleExitClick() {
    navigate("#/home");
  }

  const loadingPlaceholder = createElement("div", { attrs: { "aria-busy": "true" } });
  container.appendChild(loadingPlaceholder);

  const chromeResource = createLocalJsonResource({
    url: `data/scenarios/${params.scenarioId}/scenario.json`,
  });

  const ready = chromeResource
    // Un eventuale errore qui (scenario.json assente/malformato) non va
    // gestito con un messaggio dedicato: loadScenario(), subito dopo,
    // farà la stessa identica fetch (un fallimento rimuove la entry
    // dalla cache di localJsonRepository.js, quindi la seconda chiamata
    // RITENTA da capo) e mostrerà il proprio fallback "Impossibile
    // caricare questo scenario" — un secondo messaggio di errore qui
    // sarebbe ridondante. "null" è un default sicuro: valutato come
    // "non immersivo", scheletro standard.
    .get()
    .catch(() => null)
    .then((scenario) => {
      if (destroyed) return undefined;
      loadingPlaceholder.remove();

      const isImmersive = Boolean(scenario && scenario.chrome === "none");

      if (isImmersive) {
        exitButton = createButton({
          variant: "icon",
          ariaLabel: "Torna alla Home",
          icon: buildExitIcon(),
        });
        exitButton.element.classList.add("sl-scenario-page__immersive-exit");
        exitButton.element.addEventListener("sl:click", handleExitClick);
        container.appendChild(exitButton.element);

        mountPoint = createElement("div", { classNames: "sl-scenario-page__immersive" });
        container.appendChild(mountPoint);
      } else {
        shell = createAppShell({});
        mountPoint = createElement("div", { classNames: "sl-scenario-page__main" });
        pageContainer = createPageContainer({
          header: shell.appHeader.element,
          sidebar: shell.sidebar.element,
          main: mountPoint,
        });
        container.appendChild(pageContainer.element);
      }

      return loadScenario(params.scenarioId, mountPoint).then((destroyFn) => {
        if (destroyed) {
          destroyFn();
          return;
        }
        engineDestroy = destroyFn;
      });
    });

  return function destroy() {
    destroyed = true;
    ready.then(() => {
      if (engineDestroy) engineDestroy();
    });
    loadingPlaceholder.remove();
    if (exitButton) {
      exitButton.element.removeEventListener("sl:click", handleExitClick);
      exitButton.destroy();
    }
    if (pageContainer) {
      pageContainer.destroy();
      shell.destroy();
    } else if (mountPoint) {
      mountPoint.remove();
    }
  };
}
