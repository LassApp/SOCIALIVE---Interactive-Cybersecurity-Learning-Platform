/**
 * homePageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/home — Home reale di SOCIALIVE (Prompt #4 della
 * Suite). Compone PageContainer (Fase 4) + appShell (Fase 5) +
 * ModuleCard×N (Fase 4) + Feed (Fase 2) — tutti componenti "dumb", zero
 * modifiche a nessuno di essi.
 *
 * RISCRITTO all'inizio di Fase 10 per chiudere un punto aperto segnalato
 * in Fase 9: l'handover di Fase 8 dichiarava che questo file leggesse
 * già "data/modules.json"/"data/home/feed.json", ma il file reale era
 * rimasto la versione hardcoded di Fase 5 (MODULES/MODULE_TO_SCENARIO/
 * buildDemoPosts/solidCircleAvatar) — verificato con grep sul file
 * reale, non per assunzione. Questa versione applica DAVVERO quella
 * riscrittura, riusando "js/repositories/localJsonRepository.js" già
 * esistente (nessuna nuova astrazione: stessa fabbrica già usata da
 * localAuthAdapter.js/scenarioEngine.js).
 *
 * PATTERN ASINCRONO — identico a quello già stabilito da
 * scenarioPageController.js (Fase 5): il controller resta SINCRONO
 * verso router.js ((container) => destroy, mai una Promise), costruisce
 * subito lo scheletro (appShell + PageContainer, <h1> incluso — non deve
 * dipendere dalla rete) con un'area dinamica vuota e aria-busy="true", e
 * popola moduli+feed solo quando Promise.all([...]) risolve. Guardia
 * "destroyed": se l'utente naviga altrove prima che il fetch risolva, il
 * .then()/.catch() non costruisce alcun componente — stessa protezione
 * già verificata con un test dedicato in Fase 5/8.
 *
 * FALLBACK DI ERRORE: buildFallbackMessage() condiviso (Fase 9), stesso
 * trattamento visivo già usato da scenarioEngine.js/router.js per i
 * propri stati non felici — nessun nuovo stile inventato qui.
 *
 * SCENARIO ID DAL RECORD DEL MODULO, NON DA UNA MAPPA SEPARATA: il campo
 * opzionale "scenarioId" vive direttamente nel record JSON di ciascun
 * modulo (presente solo dove "available: true") — un'unica fonte di
 * verità, non una MODULE_TO_SCENARIO da tenere sincronizzata a mano
 * (quella mappa esisteva SOLO perché i moduli erano hardcoded qui; ora
 * che arrivano dal JSON, il campo può viaggiare con il resto del
 * record). ModuleCard continua a ricevere SOLO { moduleId, title,
 * available } (zero modifiche al componente: un campo extra come
 * "scenarioId" viene semplicemente ignorato da ModuleCard, che non
 * valida le props extra) — è questo controller, non ModuleCard, a
 * conservare il record completo per risolvere la navigazione.
 *
 * AVATAR: feed.json non porta più alcun "avatarSrc" per nessun autore
 * (decisione già presa, ora davvero applicata): tutti e tre gli autori
 * demo usano il fallback a iniziali già esistente e verificato in
 * Avatar.js — nessun generatore di SVG inline da mantenere qui.
 *
 * sl:settings-click, sl:search, sl:post-comment: nessun listener
 * attaccato, invariato dalle fasi precedenti — le destinazioni non
 * esistono ancora. sl:post-like resta gestito qui (aggiornamento
 * ottimistico locale sui post caricati da feed.json).
 *
 * sl:post-open → MediaViewer (nuovo, post Fase 10): PRIMA il click
 * sull'immagine del post (es. quello di Mario Bianchi) emetteva già
 * "sl:post-open" — stesso identico evento di PostCard usato da Fase 2 —
 * ma senza alcun consumer: qui non succedeva nulla. Ora si apre
 * MediaViewer tramite js/utils/mediaViewerLauncher.js, lo stesso helper
 * già usato da profileTimelineRenderer.js — nessuna modifica a
 * PostCard.js/Feed.js/MediaViewer.js è stata necessaria: è la prova
 * concreta che il visualizzatore, generico fin dalla propria interfaccia
 * (Fase 7), funziona identico su un secondo consumer reale.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createModuleCard } from "../components/ModuleCard.js";
import { create as createFeed } from "../components/Feed.js";
import { createAppShell } from "./shared/appShell.js";
import { navigate } from "../core/router.js";
import { createLocalJsonRepository } from "../repositories/localJsonRepository.js";
import { buildFallbackMessage } from "../utils/fallbackMessage.js";
import { createMediaViewerLauncher } from "../utils/mediaViewerLauncher.js";

// Istanze create una sola volta a livello di modulo, non ad ogni
// montaggio della rotta: la cache interna di localJsonRepository.js è
// per URL, non per istanza di repository — crearne una nuova ad ogni
// visita di #/home rifarebbe comunque una fetch la prima volta ma non
// guadagnerebbe nulla in cambio. Stesso pattern già usato da
// localAuthAdapter.js per users/roles.
const modulesRepository = createLocalJsonRepository({ url: "data/modules.json", collectionKey: "modules", idField: "id" });
const feedRepository = createLocalJsonRepository({ url: "data/home/feed.json", collectionKey: "posts", idField: "id" });

export function createHomePageController(container) {
  const childComponents = [];
  let destroyed = false;

  const shell = createAppShell({ activeSidebarId: "home" });

  // <h1> nascosto solo visivamente (Fase 9): non deve dipendere dalla
  // rete, quindi viene creato subito insieme allo scheletro — la Home
  // era l'unica delle tre pagine reali priva di un h1 (Login lo ha per
  // il brand, la pagina di scenario per il nome profilo). Testo "Home",
  // non il brand "SocialAlive" (già coperto da LoginForm): coerente con
  // l'etichetta già usata per questa stessa rotta in Sidebar/appShell.js.
  const pageHeading = createElement("h1", { classNames: "sl-visually-hidden", text: "Home" });

  // Area popolata in modo asincrono: aria-busy comunica lo stato di
  // caricamento a chi usa uno screen reader, stesso principio già
  // seguito da scenarioEngine.js per il proprio wrapper.
  const dynamicArea = createElement("div", {
    classNames: "sl-home-page__dynamic",
    attrs: { "aria-busy": "true" },
  });

  const content = createElement("div", { classNames: "sl-home-page__content" }, [pageHeading, dynamicArea]);

  const pageContainer = createPageContainer({
    header: shell.appHeader.element,
    sidebar: shell.sidebar.element,
    main: content,
  });
  childComponents.push(pageContainer);
  container.appendChild(pageContainer.element);

  // Record COMPLETI dei moduli caricati (incl. "scenarioId" quando
  // presente) — conservati qui, non solo nelle prop passate a
  // ModuleCard, per poter risolvere sl:module-open senza una mappa
  // separata (vedi rationale in testa al file).
  let loadedModules = [];
  let feedPosts = [];
  let modulesGrid = null;
  let feed = null;

  // Istanza singola del launcher per l'intera vita di questa rotta —
  // stesso pattern già usato da profileTimelineRenderer.js: possiede
  // l'eventuale MediaViewer aperto, lo chiude/apre in sicurezza, e va
  // distrutta esplicitamente nel destroy() di questo controller (vedi
  // sotto) per il caso limite di navigazione via router mentre il
  // visualizzatore è ancora aperto.
  const mediaViewerLauncher = createMediaViewerLauncher();

  function handleModuleOpen(event) {
    const moduleRecord = loadedModules.find((m) => m.id === event.detail.moduleId);
    if (!moduleRecord) return;

    // Un modulo con più scenari (oggi: solo Cybersecurity, Oversharing +
    // Keylogger) porta a un selettore dedicato (#/modules/:moduleId),
    // stesso principio già seguito da ModuleCard per i moduli di primo
    // livello: mai saltare direttamente a un contenuto se esiste più di
    // un'opzione reale. Il precedente campo singolare "scenarioId" è
    // stato sostituito per intero da "scenarios" (array) in questo
    // stesso intervento, insieme al JSON — nessun modulo residuo usa
    // ancora il vecchio campo, quindi nessun fallback da mantenere qui.
    if (Array.isArray(moduleRecord.scenarios) && moduleRecord.scenarios.length > 0) {
      navigate(`#/modules/${moduleRecord.id}`);
    }
  }

  function handlePostLike(event) {
    const { postId, liked } = event.detail;
    const target = feedPosts.find((post) => post.id === postId);
    if (!target) return;
    target.liked = liked;
    target.stats.likes += liked ? 1 : -1;
    feed.update({ posts: feedPosts });
  }

  function handlePostOpen(event) {
    mediaViewerLauncher.openById(feedPosts, event.detail.postId);
  }

  function renderContent() {
    const moduleCards = loadedModules.map((moduleData) =>
      createModuleCard({ moduleId: moduleData.id, title: moduleData.title, available: moduleData.available })
    );
    childComponents.push(...moduleCards);

    modulesGrid = createElement(
      "div",
      { classNames: "sl-home-page__modules-grid" },
      moduleCards.map((card) => card.element)
    );
    modulesGrid.addEventListener("sl:module-open", handleModuleOpen);

    const modulesSection = createElement(
      "section",
      { attrs: { "aria-labelledby": "home-modules-heading" } },
      [
        createElement("h2", {
          classNames: "sl-home-page__section-title",
          attrs: { id: "home-modules-heading" },
          text: "Moduli",
        }),
        modulesGrid,
      ]
    );

    feed = createFeed({ posts: feedPosts, isLoading: false, hasMore: false });
    childComponents.push(feed);
    feed.element.addEventListener("sl:post-like", handlePostLike);
    feed.element.addEventListener("sl:post-open", handlePostOpen);

    dynamicArea.append(modulesSection, feed.element);
  }

  Promise.all([modulesRepository.list(), feedRepository.list()])
    .then(([modules, posts]) => {
      if (destroyed) return;
      loadedModules = modules;
      feedPosts = posts;
      renderContent();
    })
    .catch((error) => {
      if (destroyed) return;
      console.error("[homePageController] Impossibile caricare i dati della Home", error);
      dynamicArea.appendChild(buildFallbackMessage("Impossibile caricare la Home. Riprova più tardi."));
    })
    .finally(() => {
      if (!destroyed) dynamicArea.removeAttribute("aria-busy");
    });

  return function destroy() {
    destroyed = true;
    if (modulesGrid) modulesGrid.removeEventListener("sl:module-open", handleModuleOpen);
    if (feed) {
      feed.element.removeEventListener("sl:post-like", handlePostLike);
      feed.element.removeEventListener("sl:post-open", handlePostOpen);
    }
    childComponents.forEach((instance) => instance.destroy());
    shell.destroy();
    // Stesso caso limite già gestito da profileTimelineRenderer.js: se
    // si naviga altrove mentre MediaViewer è ancora aperto, va chiuso
    // esplicitamente qui — altrimenti resterebbe orfano sopra la pagina
    // successiva. No-op sicuro se nulla è aperto.
    mediaViewerLauncher.destroy();
  };
}
