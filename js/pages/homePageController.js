/**
 * homePageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/home — Home reale di SOCIALIVE. Compone PageContainer
 * + appShell + Feed (Fase 2) — tutti componenti "dumb", zero modifiche a
 * nessuno di essi.
 *
 * SEZIONE "MODULI" RIMOSSA (nuovo): la griglia di ModuleCard che viveva
 * qui sopra il Feed è stata eliminata — non una disattivazione, codice
 * morto rimosso per intero (stesso criterio già applicato al toggle
 * lucchetto in profileTimelineRenderer.js: "eliminato, non solo
 * nascosto"). I moduli sono ora raggiungibili dal sottomenu "Moduli"
 * della Sidebar (appShell.js, nuovo), visibile su OGNI rotta protetta —
 * un secondo punto di accesso identico nella stessa pagina sarebbe
 * ridondante, non un rinforzo. "sl:module-open"/ModuleCard non hanno
 * più alcun consumer su questa pagina: import rimossi.
 *
 * Conseguenza diretta: questo controller ora dipende SOLO da
 * data/home/feed.json, non più anche da data/modules.json (che
 * comunque appShell.js legge autonomamente per popolare il sottomenu —
 * nessuna duplicazione di rete: cache condivisa per URL di
 * localJsonRepository.js, ma nessun motivo per Home stessa di
 * richiederlo più).
 *
 * PATTERN ASINCRONO — invariato: il controller resta sincrono verso
 * router.js ((container) => destroy), costruisce subito lo scheletro
 * (appShell + PageContainer, <h1> incluso) con un'area dinamica vuota e
 * aria-busy="true", e popola il Feed solo quando il fetch risolve.
 * Guardia "destroyed" invariata.
 *
 * sl:post-open → MediaViewer: invariato (tramite
 * js/utils/mediaViewerLauncher.js).
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createFeed } from "../components/Feed.js";
import { createAppShell } from "./shared/appShell.js";
import { createLocalJsonRepository } from "../repositories/localJsonRepository.js";
import { buildFallbackMessage } from "../utils/fallbackMessage.js";
import { createMediaViewerLauncher } from "../utils/mediaViewerLauncher.js";

// Istanza creata una sola volta a livello di modulo — la cache interna
// di localJsonRepository.js è per URL, non per istanza (stesso pattern
// già usato da localAuthAdapter.js).
const feedRepository = createLocalJsonRepository({ url: "data/home/feed.json", collectionKey: "posts", idField: "id" });

export function createHomePageController(container) {
  const childComponents = [];
  let destroyed = false;

  const shell = createAppShell({ activeSidebarId: "home" });

  // <h1> nascosto solo visivamente (Fase 9): non deve dipendere dalla
  // rete, creato subito insieme allo scheletro.
  const pageHeading = createElement("h1", { classNames: "sl-visually-hidden", text: "Home" });

  // Area popolata in modo asincrono: aria-busy comunica lo stato di
  // caricamento a chi usa uno screen reader.
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

  let feedPosts = [];
  let feed = null;

  // Istanza singola del launcher per l'intera vita di questa rotta.
  const mediaViewerLauncher = createMediaViewerLauncher();

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
    feed = createFeed({ posts: feedPosts, isLoading: false, hasMore: false });
    childComponents.push(feed);
    feed.element.addEventListener("sl:post-like", handlePostLike);
    feed.element.addEventListener("sl:post-open", handlePostOpen);

    dynamicArea.appendChild(feed.element);
  }

  feedRepository
    .list()
    .then((posts) => {
      if (destroyed) return;
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
    if (feed) {
      feed.element.removeEventListener("sl:post-like", handlePostLike);
      feed.element.removeEventListener("sl:post-open", handlePostOpen);
    }
    childComponents.forEach((instance) => instance.destroy());
    shell.destroy();
    mediaViewerLauncher.destroy();
  };
}
