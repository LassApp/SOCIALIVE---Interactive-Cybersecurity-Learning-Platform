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
 * data/modules.json — coerente col principio di progetto "i contenuti
 * non devono essere scritti nel codice". DUE LIVELLI: ogni modulo con
 * "available: true" e degli "scenarios" diventa un gruppo del flyout
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
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";

// Unica fabbrica/URL per il sottomenu Sidebar: la cache di
// localJsonRepository.js è per URL, non per istanza — nessuna richiesta
// di rete duplicata anche se più pagine protette montano ciascuna il
// proprio appShell.
const modulesRepository = createLocalJsonRepository({
  url: "data/modules.json",
  collectionKey: "modules",
  idField: "id",
});

// Scenario della pagina corrente, letto dall'hash (#/scenario/:id): serve
// solo a far nascere aperta, nel flyout, la categoria che lo contiene.
// Nessuna voce risulta "attiva" su quella pagina (invariato: vedi
// activeSidebarId) — qui si decide soltanto quale gruppo mostrare aperto.
function getCurrentScenarioId() {
  const match = /^#\/scenario\/([^/]+)$/.exec(window.location.hash);
  return match ? match[1] : null;
}

// Una categoria (modulo disponibile con scenari) per ogni gruppo del
// flyout "Scenari", ciascuna con i propri scenari — l'ordine è quello di
// data/modules.json. Il secondo livello annunciato come "da rivalutare
// quando un secondo modulo passerà a available:true" è questo: oggi
// Cybersecurity e AI.
function buildScenarioGroups(modules) {
  const currentScenarioId = getCurrentScenarioId();
  return modules
    .filter((moduleRecord) => moduleRecord.available && Array.isArray(moduleRecord.scenarios))
    .map((moduleRecord) => ({
      id: moduleRecord.id,
      label: moduleRecord.title,
      expanded: moduleRecord.scenarios.some((scenario) => scenario.id === currentScenarioId),
      children: moduleRecord.scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.title,
        route: `#/scenario/${scenario.id}`,
        disabled: !scenario.available,
      })),
    }));
}

export function createAppShell({ activeSidebarId } = {}) {
  const user = getCurrentUser();
  let destroyed = false;

  const appHeader = createAppHeader({
    user: { name: user?.displayName, avatarSrc: user?.avatar || undefined },
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
    items: [
      { id: "home", label: "Home", route: "#/home" },
      { id: "scenarios", label: "Scenari", children: [] },
      { id: "settings", label: "Impostazioni", disabled: true },
    ],
    activeId: activeSidebarId,
  });

  modulesRepository
    .list()
    .then((modules) => {
      if (destroyed) return;
      sidebar.update({
        items: [
          { id: "home", label: "Home", route: "#/home" },
          { id: "scenarios", label: "Scenari", children: buildScenarioGroups(modules) },
          { id: "settings", label: "Impostazioni", disabled: true },
        ],
      });
    })
    .catch((error) => {
      // Nessun blocco della pagina per un fallimento sul solo sottomenu:
      // "Scenari" resta semplicemente senza figli (nessun sottomenu si
      // apre) — stesso criterio di tolleranza già seguito altrove nel
      // progetto per problemi non critici (es. sessione non persistita
      // in authService.js). buildFallbackMessage non serve qui: non c'è
      // un'area di contenuto dedicata in cui mostrare un messaggio,
      // solo una voce di navigazione che resta silenziosamente vuota.
      console.error("[appShell] Impossibile caricare data/modules.json per il sottomenu Sidebar", error);
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
