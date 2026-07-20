/**
 * homePageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/home — Home reale di SOCIALIVE (Prompt #4 della
 * Suite). Compone PageContainer (Fase 4) + appShell (Fase 5 — vedi sotto)
 * + ModuleCard×6 (Fase 4) + Feed (Fase 2) — tutti componenti "dumb",
 * zero modifiche a nessuno di essi: l'orchestrazione (chi ascolta cosa,
 * chi aggiorna cosa) vive qui, unico luogo autorizzato (architettura
 * Fase 1 §2.1, "le pagine sono le uniche autorizzate a orchestrare").
 *
 * MODIFICATO in Fase 5, due cambi indipendenti:
 *
 * 1) L'orchestrazione di AppHeader/ProfileMenu/Sidebar/logout, scritta
 *    qui in Fase 4, è stata estratta in js/pages/shared/appShell.js:
 *    scenarioPageController (questo stesso step) ne ha bisogno
 *    identica — un secondo consumo reale, non un'anticipazione (DRY,
 *    stesso principio già seguito quando focusTrap.js fu estratto da
 *    Modal e riusato da ProfileMenu in Fase 2/Step 5). Questo file non
 *    importa più AppHeader/ProfileMenu/Sidebar/authService direttamente:
 *    chiama createAppShell({ activeSidebarId: "home" }) e usa
 *    shell.appHeader.element / shell.sidebar.element. Owneship di
 *    header/sidebar passata ad appShell: questo controller non li
 *    distrugge più singolarmente, chiama shell.destroy() una sola volta.
 *
 * 2) Il modulo Cybersecurity è ora "available: true" e collegato allo
 *    scenario Oversharing: ModuleCard emette già "sl:module-open" con
 *    { moduleId } (invariato da Fase 4, zero modifiche al componente).
 *    La corrispondenza moduleId → scenarioId vive in una mappa separata
 *    di sola competenza di QUESTO controller (MODULE_TO_SCENARIO, sotto)
 *    invece di un campo aggiunto direttamente alle entry di MODULES:
 *    ModuleCard legge solo { moduleId, title, available }, un campo in
 *    più su MODULES sarebbe silenziosamente ignorato da ModuleCard (che
 *    non valida le props extra) — tenere la mappa separata rende
 *    esplicito cosa alimenta la UI e cosa è solo metadato di navigazione
 *    del controller. Le altre 5 categorie restano "available: false":
 *    nessuno scenario esiste ancora per loro.
 *
 * DATI DEL FEED: demo statica hardcoded, invariato da Fase 4 (decisione
 * ancora aperta, da confermare prima di Fase 8 — vedi handover di Fase
 * 4 §4/§9).
 *
 * SIDEBAR: voci invariate, ora definite dentro appShell.js, non più qui.
 *
 * sl:settings-click, sl:search, sl:post-open, sl:post-comment: nessun
 * listener attaccato, invariato da Fase 4 — le destinazioni non esistono
 * ancora. sl:post-like resta gestito qui (aggiornamento ottimistico
 * locale sul feed demo).
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createModuleCard } from "../components/ModuleCard.js";
import { create as createFeed } from "../components/Feed.js";
import { createAppShell } from "./shared/appShell.js";
import { navigate } from "../core/router.js";

// Immagini generate via data URI: nessuna dipendenza di rete, nessun
// asset reale ancora presente in assets/images (Fase 8) — stesso motivo
// già documentato in style-guide.html per placeholderPhoto/-PostImage.
function solidCircleAvatar(hexColor) {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
        `<rect width="100" height="100" fill="${hexColor}"/>` +
        `<circle cx="50" cy="38" r="18" fill="#ffffff" opacity="0.85"/>` +
        `<rect x="20" y="62" width="60" height="34" rx="30" fill="#ffffff" opacity="0.85"/>` +
        `</svg>`
    )
  );
}

const MOUNTAIN_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">' +
      '<rect width="480" height="320" fill="#dce3ff"/>' +
      '<circle cx="380" cy="70" r="36" fill="#f5cb6b"/>' +
      '<polygon points="0,320 160,140 260,240 340,120 480,320" fill="#8fa3ff"/>' +
      "</svg>"
  );

// Contenuto generico, del tutto slegato da qualunque scenario didattico
// (Fase 6+): il Feed della Home deve sembrare un normale feed social,
// non un contenuto "preparato per la lezione" — realismo richiesto
// esplicitamente dal progetto. Invariato da Fase 4.
function buildDemoPosts() {
  return [
    {
      id: "home-post-1",
      author: { name: "Marco Bianchi", avatarSrc: solidCircleAvatar("#8fa3ff") },
      timestamp: "3 h fa",
      content:
        "Weekend in montagna, aria pulita e silenzio assoluto. Esattamente quello che serviva dopo due settimane no-stop.",
      image: { src: MOUNTAIN_IMAGE, alt: "Paesaggio montano stilizzato con sole e picchi" },
      stats: { likes: 214, comments: 18, shares: 4 },
      liked: false,
    },
    {
      id: "home-post-2",
      author: { name: "Giulia Conti", avatarSrc: solidCircleAvatar("#7fe3b4") },
      timestamp: "6 h fa",
      content:
        "Finito ieri notte questo libro che mi avevano consigliato in tre persone diverse. Consiglio a mia volta: si legge in un weekend.",
      stats: { likes: 89, comments: 7, shares: 1 },
      liked: false,
    },
    {
      id: "home-post-3",
      author: { name: "Laura Ferretti" },
      timestamp: "1 giorno fa",
      content:
        "Torta di mele della nonna, rifatta oggi dopo anni. Non è uscita perfetta come la sua, ma ci siamo vicini.",
      stats: { likes: 431, comments: 52, shares: 9 },
      liked: true,
    },
  ];
}

const MODULES = [
  { moduleId: "yoga", title: "Yoga" },
  { moduleId: "nissan-gtr", title: "Nissan GT-R R34/R35" },
  { moduleId: "beatbox", title: "Beatbox" },
  { moduleId: "fotografia", title: "Fotografia" },
  { moduleId: "cybersecurity", title: "Cybersecurity", available: true },
  { moduleId: "ricette", title: "Ricette" },
];

// Collegamento moduleId → scenarioId: vedi rationale (2) in testa al
// file sul perché resta una mappa separata invece di un campo su
// MODULES.
const MODULE_TO_SCENARIO = {
  cybersecurity: "oversharing",
};

export function createHomePageController(container) {
  const childComponents = [];

  const shell = createAppShell({ activeSidebarId: "home" });

  // --- Sezione Moduli ------------------------------------------------------
  const moduleCards = MODULES.map((moduleData) => createModuleCard(moduleData));
  childComponents.push(...moduleCards);

  const modulesGrid = createElement(
    "div",
    { classNames: "sl-home-page__modules-grid" },
    moduleCards.map((card) => card.element)
  );

  // ModuleCard emette sl:module-open SOLO se available===true (Fase 4):
  // oggi il solo caso reale è Cybersecurity. Il ramo "scenarioId assente"
  // è difensivo (non dovrebbe accadere data la mappa sopra), non un
  // percorso pensato per verificarsi in condizioni normali.
  function handleModuleOpen(event) {
    const scenarioId = MODULE_TO_SCENARIO[event.detail.moduleId];
    if (!scenarioId) return;
    navigate(`#/scenario/${scenarioId}`);
  }
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

  // --- Feed ----------------------------------------------------------------
  let demoPosts = buildDemoPosts();
  const feed = createFeed({ posts: demoPosts, isLoading: false, hasMore: false });
  childComponents.push(feed);

  function handlePostLike(event) {
    const { postId, liked } = event.detail;
    const target = demoPosts.find((post) => post.id === postId);
    if (!target) return;
    target.liked = liked;
    target.stats.likes += liked ? 1 : -1;
    feed.update({ posts: demoPosts });
  }
  feed.element.addEventListener("sl:post-like", handlePostLike);

  // --- Composizione pagina ---------------------------------------------
  const content = createElement("div", { classNames: "sl-home-page__content" }, [
    modulesSection,
    feed.element,
  ]);

  const pageContainer = createPageContainer({
    header: shell.appHeader.element,
    sidebar: shell.sidebar.element,
    main: content,
  });
  childComponents.push(pageContainer);

  container.appendChild(pageContainer.element);

  return function destroy() {
    modulesGrid.removeEventListener("sl:module-open", handleModuleOpen);
    feed.element.removeEventListener("sl:post-like", handlePostLike);
    childComponents.forEach((instance) => instance.destroy());
    shell.destroy();
  };
}
