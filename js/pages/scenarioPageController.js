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
 * Interfaccia: (container, params) => destroy, coerente con router.js.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { createAppShell } from "./shared/appShell.js";
import { loadScenario } from "../scenarios/scenarioEngine.js";
import { createLocalJsonResource } from "../repositories/localJsonRepository.js";

export function createScenarioPageController(container, params) {
  let destroyed = false;
  let shell = null;
  let pageContainer = null;
  let mountPoint = null;
  let engineDestroy = null;

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
    if (pageContainer) {
      pageContainer.destroy();
      shell.destroy();
    } else if (mountPoint) {
      mountPoint.remove();
    }
  };
}
