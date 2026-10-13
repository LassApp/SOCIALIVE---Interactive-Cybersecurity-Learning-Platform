/**
 * homePageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/home — Home di SOCIALIVE come PIATTAFORMA DIDATTICA:
 * intestazione di benvenuto + una card per ogni AREA di formazione
 * (Cybersecurity, AI, ...) con descrizione, icona e accesso diretto ai
 * suoi scenari. Compone PageContainer + appShell + AreaCard×N.
 *
 * COSA È CAMBIATO RISPETTO A PRIMA: la Home era un finto feed social
 * (post, "mi piace", MediaViewer sulle foto) coerente con l'unico
 * scenario di allora, Oversharing. Oggi la piattaforma ha più aree con
 * più scenari: un finto social come pagina iniziale era fuorviante. Il
 * finto social network (profilo, storie, feed, post) vive ora SOLO
 * dentro lo scenario Oversharing, raggiungibile come qualunque altro
 * scenario — il suo renderer, i suoi dati e i suoi test sono invariati.
 * Il realismo "da vero social" resta un requisito degli scenari che lo
 * richiedono, non della Home: questa deve sembrare il prodotto di una
 * piattaforma di formazione professionale.
 *
 * DATA-DRIVEN: aree e scenari arrivano da data/modules.json, tramite lo
 * stesso catalogo (js/utils/scenarioCatalog.js) che alimenta il sottomenu a fisarmonica
 * "Scenari" della Sidebar — una sola regola su cosa è visibile, quindi
 * Home e Sidebar non possono divergere. Nessun contenuto di area o
 * scenario è scritto in questo file; qui vivono solo i testi di
 * interfaccia (saluto, titoli di sezione, messaggi di stato).
 *
 * RICERCA: la barra di AppHeader emette "sl:search" ad ogni digitazione
 * (fino a oggi senza alcun consumer). Qui diventa un filtro: digitando il
 * nome di un'area o di uno scenario compare l'area che lo contiene (con
 * tutti i suoi scenari se corrisponde il nome dell'area, con i soli
 * scenari corrispondenti altrimenti) — logica in
 * filterScenarioCatalog(), che ignora maiuscole, accenti e punteggiatura.
 * Le aree senza corrispondenze sono nascoste con l'attributo nativo
 * [hidden] (le card restano nel DOM: nessuna ricostruzione ad ogni
 * tasto). Il risultato è annunciato agli screen reader da una regione
 * aria-live; senza risultati compare un messaggio visibile. La barra è
 * nascosta sotto i 768px (app-header.css, invariato): sul telefono le
 * card restano comunque l'unico accesso agli scenari, perché la Sidebar
 * è nascosta alla stessa soglia.
 *
 * PATTERN ASINCRONO — identico a scenarioPageController.js: il
 * controller resta SINCRONO verso router.js ((container) => destroy),
 * costruisce subito lo scheletro (appShell + PageContainer + <h1>, che
 * non devono dipendere dalla rete) con un'area dinamica in
 * aria-busy="true", e popola le card quando modules.json risolve.
 * Guardia "destroyed": se si naviga altrove prima della risposta, il
 * .then() non costruisce nulla. Errore di fetch → messaggio condiviso di
 * fallbackMessage.js, stesso trattamento degli altri stati non felici.
 *
 * Il saluto legge il nome dalla sessione (getCurrentUser), non è
 * scritto nel codice. Gli scenari non sono descritti nella Home di
 * proposito (vedi scenarioCatalog.js): le loro descrizioni spiegano la
 * lezione e una pagina proiettata in aula non deve anticiparla.
 *
 * Classe radice .sl-home-page__content: invariata, altre suite di test
 * (sidebar/llm/token) la usano per riconoscere "la Home è montata".
 *
 * Interfaccia: (container) => destroy, coerente con router.js.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createAreaCard } from "../components/AreaCard.js";
import { createAppShell } from "./shared/appShell.js";
import { getCurrentUser } from "../services/authService.js";
import { createLocalJsonRepository } from "../repositories/localJsonRepository.js";
import { buildFallbackMessage } from "../utils/fallbackMessage.js";
import { buildScenarioCatalog, filterScenarioCatalog } from "../utils/scenarioCatalog.js";

// Creata una sola volta a livello di modulo: la cache di
// localJsonRepository.js è per URL — stesso URL di appShell.js, quindi
// la Home non fa alcuna richiesta di rete in più per il solo catalogo.
const modulesRepository = createLocalJsonRepository({
  url: "data/modules.json",
  collectionKey: "modules",
  idField: "id",
});

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function createHomePageController(container) {
  const childComponents = [];
  let destroyed = false;
  let catalog = [];
  let areaEntries = []; // [{ area, card, item }] — una per area visibile
  let isRendered = false;
  let query = "";

  const shell = createAppShell({ activeSidebarId: "home" });

  // --- scheletro (non dipende dalla rete) --------------------------------
  const displayName = getCurrentUser()?.displayName;
  const intro = createElement("div", { classNames: "sl-home-page__intro" }, [
    createElement("h1", {
      classNames: "sl-home-page__title",
      text: displayName ? `Benvenuto, ${displayName}` : "Benvenuto",
    }),
    createElement("p", {
      classNames: "sl-home-page__subtitle",
      text: "Scegli un'area e apri uno scenario.",
    }),
  ]);

  const areasGrid = createElement("ul", { classNames: "sl-home-page__areas-grid" });
  const emptyMessage = buildFallbackMessage("");
  emptyMessage.hidden = true;

  // Area popolata in modo asincrono: aria-busy comunica il caricamento a
  // chi usa uno screen reader (stesso principio di scenarioEngine.js).
  const dynamicArea = createElement(
    "div",
    { classNames: "sl-home-page__dynamic", attrs: { "aria-busy": "true" } },
    [areasGrid, emptyMessage]
  );

  // Regione di stato nascosta solo visivamente: annuncia il risultato di
  // una ricerca senza spostare il focus dalla barra.
  const searchStatus = createElement("p", {
    classNames: "sl-visually-hidden",
    attrs: { role: "status", "aria-live": "polite" },
  });

  const areasSection = createElement(
    "section",
    { classNames: "sl-home-page__areas-section", attrs: { "aria-labelledby": "home-areas-heading" } },
    [
      createElement("h2", {
        classNames: "sl-home-page__section-title",
        attrs: { id: "home-areas-heading" },
        text: "Aree di formazione",
      }),
      searchStatus,
      dynamicArea,
    ]
  );

  const content = createElement("div", { classNames: "sl-home-page__content" }, [intro, areasSection]);

  const pageContainer = createPageContainer({
    header: shell.appHeader.element,
    sidebar: shell.sidebar.element,
    main: content,
  });
  childComponents.push(pageContainer);
  container.appendChild(pageContainer.element);

  // --- filtro -------------------------------------------------------------
  function applyFilter() {
    const results = filterScenarioCatalog(catalog, query);
    const resultByArea = new Map(results.map((result) => [result.area.id, result]));

    areaEntries.forEach(({ area, card, item }) => {
      const result = resultByArea.get(area.id);
      item.hidden = !result;
      if (result) card.update({ scenarios: result.scenarios, scenarioTotal: area.scenarios.length });
    });

    const isEmpty = results.length === 0;
    areasGrid.hidden = isEmpty;
    emptyMessage.hidden = !isEmpty;
    if (isEmpty) {
      emptyMessage.textContent = query.trim()
        ? `Nessun risultato per «${query.trim()}».`
        : "Nessuna area disponibile al momento.";
    }
    return results;
  }

  function announceSearchResult(results) {
    if (!query.trim()) {
      searchStatus.textContent = "Tutte le aree mostrate";
    } else if (results.length === 0) {
      searchStatus.textContent = emptyMessage.textContent;
    } else {
      const scenarioCount = results.reduce((sum, result) => sum + result.scenarios.length, 0);
      searchStatus.textContent = `${pluralize(results.length, "area", "aree")} e ${pluralize(
        scenarioCount,
        "scenario",
        "scenari"
      )} trovati`;
    }
  }

  function handleSearch(event) {
    query = event.detail.value || "";
    if (!isRendered) return; // la ricerca digitata prima del fetch si applica al primo render
    announceSearchResult(applyFilter());
  }
  shell.appHeader.element.addEventListener("sl:search", handleSearch);

  // --- popolamento asincrono ------------------------------------------------
  function renderAreas() {
    areaEntries = catalog.map((area) => {
      const card = createAreaCard({
        title: area.title,
        description: area.description,
        icon: area.icon,
        scenarios: area.scenarios,
      });
      childComponents.push(card);
      const item = createElement(
        "li",
        { classNames: "sl-home-page__area-item", dataset: { areaId: area.id } },
        [card.element]
      );
      areasGrid.appendChild(item);
      return { area, card, item };
    });
    isRendered = true;
    applyFilter();
  }

  modulesRepository
    .list()
    .then((modules) => {
      if (destroyed) return;
      catalog = buildScenarioCatalog(modules);
      renderAreas();
    })
    .catch((error) => {
      if (destroyed) return;
      console.error("[homePageController] Impossibile caricare data/modules.json", error);
      dynamicArea.appendChild(buildFallbackMessage("Impossibile caricare le aree. Riprova più tardi."));
    })
    .finally(() => {
      if (!destroyed) dynamicArea.removeAttribute("aria-busy");
    });

  return function destroy() {
    destroyed = true;
    shell.appHeader.element.removeEventListener("sl:search", handleSearch);
    childComponents.forEach((instance) => instance.destroy());
    shell.destroy();
  };
}
