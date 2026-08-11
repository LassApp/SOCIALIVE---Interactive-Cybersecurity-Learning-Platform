/**
 * moduleScenariosPageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/modules/:moduleId — selettore degli scenari di un
 * singolo modulo. Introdotto perché "Cybersecurity" ha ora DUE scenari
 * reali (Oversharing, Keylogger): data/modules.json passa da
 * "scenarioId" (singolare) a "scenarios" (array), e
 * homePageController.js instrada qui ogni modulo con più di uno
 * scenario, invece di navigare direttamente come faceva prima (quando
 * il rapporto modulo→scenario era sempre 1:1).
 *
 * RIUSA ModuleCard.js SENZA ALCUNA MODIFICA: il componente non è mai
 * stato specifico di "categoria top-level della Home" — legge solo
 * { moduleId, title, available } ed emette "sl:module-open" con
 * { moduleId }. Qui il valore che viaggia in "moduleId" è
 * concettualmente uno SCENARIO id, non un modulo id: si riusa il
 * componente as-is (invece di un "ScenarioCard" quasi identico) perché
 * la FUNZIONE (card cliccabile con badge disponibile/in arrivo) è
 * identica — stesso principio "mai duplicare per la stessa funzione"
 * già applicato ovunque nel Design System.
 *
 * Ogni scenario porta il proprio "available": uno scenario ancora in
 * sviluppo (oggi: Keylogger) resta "In arrivo" e non cliccabile — stesso
 * criterio già applicato ai moduli di primo livello in ModuleCard.js
 * ("presentarlo come cliccabile sarebbe un'affermazione falsa sullo
 * stato reale del progetto"), qui un livello più in basso.
 *
 * Nessuna voce Sidebar attiva su questa rotta (stesso trattamento già
 * riservato a #/scenario/:scenarioId da appShell.js).
 *
 * Interfaccia: (container, params) => destroy — "params.moduleId" è
 * l'unico punto in cui questo controller legge il parametro di rotta.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createModuleCard } from "../components/ModuleCard.js";
import { createAppShell } from "./shared/appShell.js";
import { navigate } from "../core/router.js";
import { createLocalJsonRepository } from "../repositories/localJsonRepository.js";
import { buildFallbackMessage } from "../utils/fallbackMessage.js";

// Stessa fabbrica/URL/cache già usata da homePageController.js: la cache
// di localJsonRepository.js è per URL, non per istanza — arrivare qui
// dopo aver già visitato la Home non rifà alcuna fetch di rete.
const modulesRepository = createLocalJsonRepository({
  url: "data/modules.json",
  collectionKey: "modules",
  idField: "id",
});

export function createModuleScenariosPageController(container, params) {
  const childComponents = [];
  let destroyed = false;
  let grid = null;

  const shell = createAppShell({});

  const heading = createElement("h1", { classNames: "sl-module-scenarios-page__title" });

  const dynamicArea = createElement("div", {
    classNames: "sl-module-scenarios-page__dynamic",
    attrs: { "aria-busy": "true" },
  });

  const content = createElement("div", { classNames: "sl-module-scenarios-page__content" }, [
    heading,
    dynamicArea,
  ]);

  const pageContainer = createPageContainer({
    header: shell.appHeader.element,
    sidebar: shell.sidebar.element,
    main: content,
  });
  childComponents.push(pageContainer);
  container.appendChild(pageContainer.element);

  function handleScenarioOpen(event) {
    navigate(`#/scenario/${event.detail.moduleId}`);
  }

  function renderScenarios(moduleRecord) {
    heading.textContent = moduleRecord.title;

    const scenarioCards = moduleRecord.scenarios.map((scenario) =>
      createModuleCard({
        moduleId: scenario.id,
        title: scenario.title,
        available: Boolean(scenario.available),
      })
    );
    childComponents.push(...scenarioCards);

    grid = createElement(
      "div",
      { classNames: "sl-module-scenarios-page__grid" },
      scenarioCards.map((card) => card.element)
    );
    grid.addEventListener("sl:module-open", handleScenarioOpen);
    dynamicArea.appendChild(grid);
  }

  modulesRepository
    .list()
    .then((modules) => {
      if (destroyed) return;
      const moduleRecord = modules.find((m) => m.id === params.moduleId);
      if (!moduleRecord || !Array.isArray(moduleRecord.scenarios) || moduleRecord.scenarios.length === 0) {
        heading.textContent = "Modulo non trovato";
        dynamicArea.appendChild(buildFallbackMessage("Nessuno scenario disponibile per questo modulo."));
        return;
      }
      renderScenarios(moduleRecord);
    })
    .catch((error) => {
      if (destroyed) return;
      console.error("[moduleScenariosPageController] Impossibile caricare i moduli", error);
      dynamicArea.appendChild(buildFallbackMessage("Impossibile caricare gli scenari. Riprova più tardi."));
    })
    .finally(() => {
      if (!destroyed) dynamicArea.removeAttribute("aria-busy");
    });

  return function destroy() {
    destroyed = true;
    if (grid) grid.removeEventListener("sl:module-open", handleScenarioOpen);
    childComponents.forEach((instance) => instance.destroy());
    shell.destroy();
  };
}
