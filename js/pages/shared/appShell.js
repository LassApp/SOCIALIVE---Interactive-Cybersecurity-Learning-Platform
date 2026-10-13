/**
 * appShell.js
 * -----------------------------------------------------------------------
 * Orchestrazione condivisa di AppHeader + ProfileMenu + Sidebar + logout,
 * comune a ogni rotta protetta che usa PageContainer (#/home,
 * #/scenario/:scenarioId).
 *
 * SIDEBAR — "Scenari" (ex "Moduli", rinominata con l'arrivo del secondo
 * modulo, AI): era una voce statica disabilitata ("nessuna rotta reale
 * la raggiungeva direttamente"), poi una voce con sottomenu
 * (Sidebar.js, prop "children") che elenca direttamente gli scenari
 * disponibili — niente più passaggio da una pagina selettore dedicata
 * per raggiungerli (quella pagina, #/modules/:moduleId, è stata
 * eliminata per intero una volta diventata irraggiungibile — vedi
 * moduleScenariosPageController.js nella cronologia git): la Sidebar è
 * visibile su OGNI rotta protetta (appShell è montato da
 * homePageController.js E da scenarioPageController.js), quindi il
 * docente può saltare da uno scenario all'altro senza mai tornare alla
 * Home.
 *
 * DATA-DRIVEN, non hardcoded: i sottomenu vengono letti da
 * data/modules.json (tramite js/utils/scenarioCatalog.js, lo stesso
 * catalogo che alimenta le card per area della Home — una sola regola
 * su quali aree sono visibili) — coerente col principio di progetto "i
 * contenuti non devono essere scritti nel codice". DUE LIVELLI: ogni
 * modulo con "available: true" e degli "scenarios" diventa un gruppo della fisarmonica
 * "Scenari" (oggi Cybersecurity e AI, nell'ordine del file), con i
 * propri scenari sotto di sé. La struttura a due livelli — rimandata
 * finché c'era un solo modulo reale (YAGNI) — è stata introdotta nel
 * momento in cui è arrivato il secondo (AI), come questo stesso
 * commento anticipava. Il gruppo che contiene lo scenario della pagina
 * corrente (hash #/scenario/:id) nasce aperto; nessuna voce risulta
 * comunque "attiva" su quella pagina (invariato).
 *
 * ASINCRONO, ma la Sidebar nasce subito: appShell resta sincrono verso
 * chi lo chiama (nessun controller deve attendere una Promise per
 * montare la pagina) — Sidebar viene creata SUBITO con "Scenari" senza
 * figli (quindi voce foglia interattiva ma senza sottomenu finché i
 * dati non arrivano; scelta preferita a "disabled" perché è comunque
 * onesto: appena i dati risolvono, l'utente vede il sottomenu apparire,
 * non un bottone che passa da disabilitato a abilitato, cambio più
 * brusco), poi aggiornata via sidebar.update({ items }) non appena il
 * fetch risolve — stesso pattern asincrono già stabilito da
 * scenarioPageController.js/homePageController.js.
 *
 * Guardia "destroyed": se il chiamante distrugge la shell prima che il
 * fetch di modules.json risolva, il .then() non chiama sidebar.update()
 * su un componente già rimosso dal DOM — stessa protezione già
 * verificata con un test dedicato in Fase 5/8 per gli altri controller
 * asincroni del progetto.
 *
 * OWNERSHIP — invariata: AppHeader e Sidebar restano di proprietà di
 * appShell, il chiamante non li distrugge mai direttamente.
 *
 * PROFILEMENU — invariato.
 *
 * Interfaccia: createAppShell({ activeSidebarId }) →
 *   { appHeader, sidebar, destroy() }
 */

import { create as createAppHeader } from "../../components/AppHeader.js";
import { create as createProfileMenu } from "../../components/ProfileMenu.js";
import { create as createSidebar } from "../../components/Sidebar.js";
import { getCurrentUser, logout } from "../../services/authService.js";
import { createLocalJsonRepository } from "../../repositories/localJsonRepository.js";
import { buildScenarioCatalog } from "../../utils/scenarioCatalog.js";

// Unica fabbrica/URL per il sottomenu Sidebar: la cache di
// localJsonRepository.js è per URL, non per istanza — nessuna richiesta
// di rete duplicata anche se più pagine protette montano ciascuna il
// proprio appShell.
const modulesRepository = createLocalJsonRepository({
  url: "data/modules.json",
  collectionKey: "modules",
  idField: "id",
});

// Link verso altri strumenti (oggi PixelProf), mostrati nella Sidebar: un
// file di dati, non codice — aggiungerne uno è una riga in
// data/external-links.json. Stessa fabbrica, stessa cache per URL.
const externalLinksRepository = createLocalJsonRepository({
  url: "data/external-links.json",
  collectionKey: "links",
  idField: "id",
});

// Solo https: un file di dati non va mai trattato come fidato fino
// all'href di un link ("javascript:" o "data:" verrebbero eseguiti al
// click). Un link non valido viene semplicemente ignorato.
const SAFE_EXTERNAL_URL = /^https:\/\//i;

// Scenario della pagina corrente, letto dall'hash (#/scenario/:id): serve
// solo a far nascere aperta, nella fisarmonica, l'area che lo contiene.
// Nessuna voce risulta "attiva" su quella pagina (invariato: vedi
// activeSidebarId) — qui si decide soltanto quale gruppo mostrare aperto.
function getCurrentScenarioId() {
  const match = /^#\/scenario\/([^/]+)$/.exec(window.location.hash);
  return match ? match[1] : null;
}

// Una categoria (area disponibile con scenari) per ogni gruppo della
// fisarmonica "Scenari", ciascuna con i propri scenari — l'ordine è quello di
// data/modules.json. QUALI aree/scenari esistono (e la loro rotta) lo
// decide js/utils/scenarioCatalog.js, condiviso con la Home: qui resta
// solo la forma che Sidebar.js si aspetta (id/label/expanded/children).
function buildScenarioGroups(modules) {
  const currentScenarioId = getCurrentScenarioId();
  return buildScenarioCatalog(modules).map((area) => ({
    id: area.id,
    label: area.title,
    expanded: area.scenarios.some((scenario) => scenario.id === currentScenarioId),
    children: area.scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.title,
      route: scenario.route,
      disabled: !scenario.available,
    })),
  }));
}

// Voci della Sidebar: Home, "Scenari" (aree → scenari, a fisarmonica), i
// link esterni da data/external-links.json e Impostazioni (disabilitata).
// Con i dati ancora da caricare (modules = [], externalLinks = []) è
// anche lo stato iniziale.
function buildSidebarItems(modules, externalLinks) {
  return [
    { id: "home", label: "Home", route: "#/home" },
    { id: "scenarios", label: "Scenari", children: buildScenarioGroups(modules) },
    ...externalLinks
      .filter((link) => SAFE_EXTERNAL_URL.test(link.url || ""))
      .map((link) => ({ id: `link-${link.id}`, label: link.label, href: link.url, external: true })),
    { id: "settings", label: "Impostazioni", disabled: true },
  ];
}

export function createAppShell({ activeSidebarId } = {}) {
  const user = getCurrentUser();
  let destroyed = false;

  // Tasto Home sempre presente accanto al marchio, su ogni pagina che
  // monta la shell (Home inclusa, dove risulta "pagina corrente"). Le
  // pagine immersive (chrome:"none") non montano la shell: lì l'uscita
  // verso la Home è il bottone "×" di scenarioPageController.js.
  const appHeader = createAppHeader({
    user: { name: user?.displayName, avatarSrc: user?.avatar || undefined },
    homeRoute: "#/home",
    homeActive: activeSidebarId === "home",
  });

  let profileMenu = null;

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

  const sidebar = createSidebar({
    items: buildSidebarItems([], []),
    activeId: activeSidebarId,
  });

  // Due fetch indipendenti: il fallimento di una non impedisce all'altra
  // di popolare la Sidebar. Nessun blocco della pagina per un problema sul
  // solo menu: "Scenari" resta senza figli / il link non compare — stesso
  // criterio di tolleranza già seguito altrove nel progetto per problemi
  // non critici (es. sessione non persistita in authService.js).
  // buildFallbackMessage non serve qui: non c'è un'area di contenuto in
  // cui mostrare un messaggio, solo voci di navigazione.
  const modulesPromise = modulesRepository.list().catch((error) => {
    console.error("[appShell] Impossibile caricare data/modules.json per il sottomenu Sidebar", error);
    return [];
  });
  const externalLinksPromise = externalLinksRepository.list().catch((error) => {
    console.error("[appShell] Impossibile caricare data/external-links.json per la Sidebar", error);
    return [];
  });

  Promise.all([modulesPromise, externalLinksPromise]).then(([modules, externalLinks]) => {
    if (destroyed) return;
    sidebar.update({ items: buildSidebarItems(modules, externalLinks) });
  });

  function destroy() {
    destroyed = true;
    appHeader.element.removeEventListener("sl:profile-menu-toggle", handleProfileMenuToggle);
    closeProfileMenu();
    sidebar.destroy();
    appHeader.destroy();
  }

  return { appHeader, sidebar, destroy };
}
