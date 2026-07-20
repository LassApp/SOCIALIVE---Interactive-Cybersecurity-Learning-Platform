/**
 * scenarioPageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/scenario/:scenarioId (Fase 5). Compone PageContainer +
 * appShell (stesso helper già usato da homePageController.js — secondo
 * consumo reale che ha motivato l'estrazione in Fase 5/Step 4) e delega
 * il contenuto centrale a scenarioEngine.loadScenario(), che risolve il
 * renderer giusto in base al campo "type" dichiarato nello scenario.json
 * (Fase 5/Step 2).
 *
 * Nessuna voce di Sidebar risulta "attiva" su questa rotta: appShell
 * viene creato senza activeSidebarId — comportamento esplicito, non un
 * bug: la Sidebar elenca solo le rotte di primo livello (architettura
 * Fase 1 §7), non ogni singolo scenario. "Home" resta comunque un link
 * cliccabile per tornare indietro.
 *
 * CONTAINER CONDIVISO — non un querySelector nell'albero di
 * PageContainer: si crea un <div> proprio (mainContent), si passa a
 * PageContainer come "main" (che lo monta dentro il proprio <main>) e SI
 * PASSA LO STESSO riferimento a loadScenario() come punto di mount. Così
 * PageContainer resta ignaro di scenarioEngine (nessuna dipendenza tra i
 * due) e scenarioEngine ha un nodo stabile su cui montare/smontare il
 * proprio wrapper in modo asincrono, senza che questo controller debba
 * raggiungere la struttura DOM interna di PageContainer via selettore
 * CSS (violerebbe l'incapsulamento "a convenzione" del Design System).
 *
 * ASINCRONIA E RACE CONDITION: loadScenario() è asincrono (fa un fetch).
 * Se l'utente naviga altrove PRIMA che la Promise si risolva, destroy()
 * di questo controller è già stato invocato da router.js in modo
 * sincrono — pageContainer.destroy() rimuove comunque l'intero
 * sottoalbero (incluso mainContent) immediatamente. Il cleanup
 * dell'engine (engineDestroy) arriva comunque non appena la Promise
 * risolve, in coda: chiamare .remove() su un nodo già staccato dal DOM
 * non lancia errori (no-op), ma invocare comunque il cleanup del
 * renderer (se ne avesse uno) resta corretto — un futuro renderer che
 * registrasse listener globali (es. su document) deve poterli rimuovere
 * indipendentemente dallo stato del DOM.
 *
 * Interfaccia: (container, params) => destroy, coerente con la firma
 * dei page controller richiesta da router.js (Fase 5/Step 3) — "params"
 * è l'unico punto in cui questo controller legge params.scenarioId.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { createAppShell } from "./shared/appShell.js";
import { loadScenario } from "../scenarios/scenarioEngine.js";

export function createScenarioPageController(container, params) {
  const shell = createAppShell({});

  const mainContent = createElement("div", { classNames: "sl-scenario-page__main" });

  const pageContainer = createPageContainer({
    header: shell.appHeader.element,
    sidebar: shell.sidebar.element,
    main: mainContent,
  });

  container.appendChild(pageContainer.element);

  let engineDestroy = null;
  const scenarioReady = loadScenario(params.scenarioId, mainContent).then((destroy) => {
    engineDestroy = destroy;
  });

  return function destroy() {
    scenarioReady.then(() => {
      if (engineDestroy) engineDestroy();
    });
    pageContainer.destroy();
    shell.destroy();
  };
}
