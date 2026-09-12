/**
 * appShell.js
 * -----------------------------------------------------------------------
 * Orchestrazione condivisa di AppHeader + ProfileMenu + Sidebar + logout,
 * comune a ogni rotta protetta che usa PageContainer (#/home,
 * #/scenario/:scenarioId, #/modules/:moduleId).
 *
 * SIDEBAR — "Moduli" ora INTERATTIVA (nuovo): fino a questo intervento
 * era una voce statica disabilitata ("nessuna rotta reale la
 * raggiungeva direttamente"). Ora diventa una voce con sottomenu
 * (Sidebar.js, prop "children") che elenca direttamente gli scenari
 * disponibili — niente più passaggio dalla Home per raggiungerli: la
 * Sidebar è visibile su OGNI rotta protetta (appShell è montato da
 * homePageController.js E da scenarioPageController.js), quindi il
 * docente può saltare da uno scenario all'altro senza mai tornare alla
 * Home.
 *
 * DATA-DRIVEN, non hardcoded: i sottomenu vengono letti da
 * data/modules.json (stesso file già consumato da homePageController.js
 * e moduleScenariosPageController.js, stessa cache condivisa per URL di
 * localJsonRepository.js — zero richieste di rete aggiuntive se una
 * qualunque pagina lo ha già richiesto in questa sessione) — coerente
 * col principio di progetto "i contenuti non devono essere scritti nel
 * codice". Vengono appiattite le "scenarios" di OGNI modulo con
 * "available: true" in un'unica lista sotto "Moduli": con un solo
 * modulo reale oggi (Cybersecurity) il risultato è una lista piatta dei
 * suoi scenari — se in futuro un secondo modulo diventasse disponibile,
 * questa stessa lista si allungherebbe con i suoi scenari accodati.
 * Una struttura a due livelli (Modulo -> propri scenari) sarebbe più
 * corretta con più moduli reali, ma introdurla oggi per un solo modulo
 * sarebbe un'astrazione senza un secondo caso reale che la giustifichi
 * (YAGNI, stesso criterio già seguito ovunque nel progetto) — da
 * rivalutare quando un secondo modulo passerà a "available: true".
 *
 * ASINCRONO, ma la Sidebar nasce subito: appShell resta sincrono verso
 * chi lo chiama (nessun controller deve attendere una Promise per
 * montare la pagina) — Sidebar viene creata SUBITO con "Moduli" senza
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

// Stessa fabbrica/URL già usata da homePageController.js/
// moduleScenariosPageController.js: la cache di localJsonRepository.js è
// per URL, non per istanza — nessuna richiesta di rete duplicata anche
// se più pagine protette montano ciascuna il proprio appShell.
const modulesRepository = createLocalJsonRepository({
  url: "data/modules.json",
  collectionKey: "modules",
  idField: "id",
});

// Appiattisce le "scenarios" di ogni modulo disponibile in un'unica
// lista di voci per il sottomenu — vedi rationale "DATA-DRIVEN" in testa
// al file sul perché non c'è (ancora) un secondo livello di annidamento.
function buildModuleChildren(modules) {
  return modules
    .filter((moduleRecord) => moduleRecord.available && Array.isArray(moduleRecord.scenarios))
    .flatMap((moduleRecord) =>
      moduleRecord.scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.title,
        route: `#/scenario/${scenario.id}`,
        disabled: !scenario.available,
      }))
    );
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
      { id: "modules", label: "Moduli", children: [] },
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
          { id: "modules", label: "Moduli", children: buildModuleChildren(modules) },
          { id: "settings", label: "Impostazioni", disabled: true },
        ],
      });
    })
    .catch((error) => {
      // Nessun blocco della pagina per un fallimento sul solo sottomenu:
      // "Moduli" resta semplicemente senza figli (nessun sottomenu si
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
