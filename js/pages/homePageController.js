/**
 * homePageController.js
 * -----------------------------------------------------------------------
 * Rotta protetta #/home — Home reale di SOCIALIVE (Prompt #4 della
 * Suite). SOSTITUISCE il placeholder di Fase 3 (dichiarato esplicitamente
 * "da non riusare senza revisione" nel proprio file originario): nessuna
 * riga di quel file viene mantenuta.
 *
 * Compone PageContainer (Fase 4) + AppHeader/ProfileMenu/Sidebar (Fase 2)
 * + ModuleCard×6 (Fase 4) + Feed (Fase 2) — tutti componenti "dumb", zero
 * modifiche a nessuno di essi: l'orchestrazione (chi ascolta cosa, chi
 * aggiorna cosa) vive qui, unico luogo autorizzato (architettura Fase 1
 * §2.1, "le pagine sono le uniche autorizzate a orchestrare").
 *
 * DATI DEL FEED: demo statica hardcoded in questo file, NON provenienti
 * da data/*.json. Deviazione consapevole rispetto al suggerimento nel §6
 * dell'handover di Fase 3 ("dati reali via data/*.json"): l'esternalizzazione
 * completa dei contenuti è il compito esplicito di Fase 8 (Prompt #8 —
 * "Spostare tutti i contenuti nei JSON"); introdurla ora per il solo feed
 * demo della Home anticiperebbe quel lavoro in modo parziale e
 * scoordinato (un file JSON isolato, senza lo schema/le convenzioni che
 * Fase 8 definirà per TUTTI i contenuti). Gli autori/contenuti sono del
 * tutto generici e slegati da qualunque scenario didattico: l'obiettivo
 * di questa fase è dimostrare che Home/Feed funzionano con dati nella
 * forma reale attesa da PostCard, non ancora la loro provenienza
 * definitiva.
 *
 * MODULI: tutti "available:false" — nessuno scenario esiste ancora
 * (Scenario Engine è Fase 5, Oversharing è Fase 6): presentarne uno come
 * disponibile sarebbe un'affermazione falsa sullo stato reale del
 * progetto (stesso principio già dichiarato in ModuleCard.js).
 *
 * SIDEBAR: solo "Home" è abilitata (rotta reale, corrisponde alla pagina
 * corrente). "Moduli"/"Impostazioni" sono disabilitate: le rotte
 * #/modules e #/settings non esistono ancora in router.js — un link
 * abilitato verso una rotta inesistente produrrebbe "Pagina non trovata"
 * al click, un'esperienza peggiore che non mostrarlo come disponibile.
 *
 * PROFILEMENU: orchestrazione apertura/chiusura identica al pattern già
 * verificato in style-guide.html (Fase 2/Step 5) — AppHeader e
 * ProfileMenu restano reciprocamente ignari, questo controller è il
 * "collante". sl:logout → authService.logout(): il redirect a #/login è
 * già gestito centralmente da router.js (ascolta sl:auth-logout),
 * nessuna nuova logica di navigazione qui.
 *
 * sl:settings-click, sl:search, sl:post-open, sl:post-comment: nessun
 * listener attaccato. Le destinazioni (#/settings, ricerca reale, Media
 * Viewer) non esistono ancora (Fase 4+/Fase 7) — un evento senza
 * consumer bolle fino a "page" e si esaurisce silenziosamente, nessun
 * errore, nessun comportamento da simulare qui. sl:post-like resta
 * invece gestito (aggiornamento ottimistico locale): è già pienamente
 * funzionante senza bisogno di un backend, per il realismo richiesto
 * dal progetto.
 */

import { createElement } from "../utils/dom.js";
import { create as createPageContainer } from "../components/PageContainer.js";
import { create as createAppHeader } from "../components/AppHeader.js";
import { create as createProfileMenu } from "../components/ProfileMenu.js";
import { create as createSidebar } from "../components/Sidebar.js";
import { create as createModuleCard } from "../components/ModuleCard.js";
import { create as createFeed } from "../components/Feed.js";
import { getCurrentUser, logout } from "../services/authService.js";

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
// esplicitamente dal progetto. Autori di fantasia diversi da qualunque
// nome già usato altrove nel progetto.
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
      author: { name: "Laura Ferretti" }, // nessun avatarSrc: verifica fallback iniziali anche nella Home reale
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
  { moduleId: "cybersecurity", title: "Cybersecurity" },
  { moduleId: "ricette", title: "Ricette" },
];

export function createHomePageController(container) {
  const user = getCurrentUser();
  const childComponents = [];
  let profileMenu = null;

  // --- AppHeader + ProfileMenu ----------------------------------------
  const appHeader = createAppHeader({
    user: { name: user?.displayName, avatarSrc: user?.avatar || undefined },
  });
  childComponents.push(appHeader);

  function closeProfileMenu() {
    if (!profileMenu) return;
    profileMenu.destroy();
    profileMenu = null;
  }

  function handleProfileMenuToggle(event) {
    if (!event.detail.open) {
      closeProfileMenu();
      return;
    }
    profileMenu = createProfileMenu({
      user: { name: user?.displayName, avatarSrc: user?.avatar || undefined },
      anchorElement: event.detail.anchorElement,
    });
    profileMenu.element.addEventListener("sl:profile-menu-close", () => {
      appHeader.update({ profileMenuOpen: false });
      profileMenu = null;
    });
    profileMenu.element.addEventListener("sl:logout", () => {
      logout();
    });
  }

  appHeader.element.addEventListener("sl:profile-menu-toggle", handleProfileMenuToggle);

  // --- Sidebar -----------------------------------------------------------
  // Solo "Home" corrisponde a una rotta reale oggi (vedi rationale in
  // testa al file): le altre restano disabilitate finché #/modules e
  // #/settings non esisteranno in router.js.
  const sidebar = createSidebar({
    items: [
      { id: "home", label: "Home", route: "#/home" },
      { id: "modules", label: "Moduli", disabled: true },
      { id: "settings", label: "Impostazioni", disabled: true },
    ],
    activeId: "home",
  });
  childComponents.push(sidebar);

  // --- Sezione Moduli ------------------------------------------------------
  const moduleCards = MODULES.map((moduleData) => createModuleCard(moduleData));
  childComponents.push(...moduleCards);

  const modulesGrid = createElement(
    "div",
    { classNames: "sl-home-page__modules-grid" },
    moduleCards.map((card) => card.element)
  );

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
  // hasMore:false da subito: nessun backend reale da paginare in questa
  // fase (vedi rationale in testa al file) — Feed non emetterà mai
  // sl:feed-load-more in questo stato, nessun listener necessario.
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
    header: appHeader.element,
    sidebar: sidebar.element,
    main: content,
  });
  childComponents.push(pageContainer);

  container.appendChild(pageContainer.element);

  return function destroy() {
    appHeader.element.removeEventListener("sl:profile-menu-toggle", handleProfileMenuToggle);
    feed.element.removeEventListener("sl:post-like", handlePostLike);
    closeProfileMenu();
    childComponents.forEach((instance) => instance.destroy());
  };
}
