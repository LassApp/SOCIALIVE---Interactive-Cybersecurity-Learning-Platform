/**
 * appShell.js
 * -----------------------------------------------------------------------
 * Orchestrazione condivisa di AppHeader + ProfileMenu + Sidebar + logout,
 * comune a ogni rotta protetta che usa PageContainer (oggi #/home, da
 * questo step anche #/scenario/:scenarioId). Estratta da
 * homePageController.js (Fase 4) non per anticipazione ipotetica, ma
 * perché scenarioPageController (Fase 5, prossimo step) ha bisogno
 * esattamente della stessa identica orchestrazione — un secondo consumo
 * REALE, non un'astrazione preventiva (stesso criterio "non un secondo
 * bisogno ipotetico ma reale" già seguito per focusTrap.js in Fase 2 e
 * per la decisione di non introdurre userRepository.js in Fase 3 §4).
 *
 * NON possiede il layout (PageContainer resta di competenza di ciascun
 * page controller, che decide cosa metterci nel "main"): appShell
 * possiede SOLO header/sidebar e il loro comportamento reciproco —
 * stesso principio "orchestratore vs layout di pagina" già seguito
 * ovunque nel progetto (Sidebar/PostCard non decidono la propria
 * posizione nella pagina, qui si applica lo stesso criterio a un livello
 * più alto).
 *
 * Interfaccia DELIBERATAMENTE diversa sia da quella dei componenti UI
 * (create(props) => {element, update, destroy}) sia da quella dei page
 * controller ((container, params) => destroy): appShell non è né un
 * componente "dumb" riusabile per props né una rotta — è un helper di
 * orchestrazione privato ai page controller che lo consumano. Restituisce
 * { appHeader, sidebar, destroy() }: il chiamante prende gli elementi
 * (appHeader.element / sidebar.element) e li passa a PageContainer come
 * faceva prima direttamente — appShell non conosce PageContainer, non lo
 * importa, non decide il layout.
 *
 * OWNERSHIP — cambio rispetto a Fase 4: da questo step, AppHeader e
 * Sidebar sono di proprietà di appShell, non più del page controller che
 * lo consuma. Il page controller NON deve più chiamare
 * appHeader.destroy()/sidebar.destroy() direttamente: lo fa
 * shell.destroy(), una sola volta. Resta coerente con la policy già
 * dichiarata da PageContainer ("header/sidebar/main restano di proprietà
 * del CHIAMANTE, che li ha creati e deve distruggerli lui stesso" — qui
 * il chiamante di PageContainer è il page controller, che a sua volta
 * delega la creazione/distruzione di header+sidebar ad appShell, senza
 * che PageContainer se ne accorga: PageContainer non cambia).
 *
 * SIDEBAR — voci fisse, invariate da Fase 4: solo "Home" corrisponde a
 * una rotta reale oggi (#/modules e #/settings non esistono in
 * router.js) — un link abilitato verso una rotta inesistente produrrebbe
 * "Pagina non trovata" al click, peggiore di non mostrarlo come
 * disponibile. "activeSidebarId" è il solo parametro che varia tra le
 * pagine consumer (oggi: "home" per la Home; nessuna voce attiva per la
 * pagina di scenario, che non ha una propria voce dedicata in Sidebar).
 *
 * PROFILEMENU: stesso pattern di orchestrazione apertura/chiusura già
 * verificato in style-guide.html (Fase 2/Step 5) e riusato in
 * homePageController.js (Fase 4) — AppHeader e ProfileMenu restano
 * reciprocamente ignari, appShell è il "collante", esattamente come lo
 * era prima il page controller. sl:logout → authService.logout(): il
 * redirect a #/login resta gestito centralmente da router.js (ascolta
 * sl:auth-logout), zero logica di navigazione qui.
 *
 * Interfaccia: createAppShell({ activeSidebarId }) →
 *   { appHeader, sidebar, destroy() }
 */

import { create as createAppHeader } from "../../components/AppHeader.js";
import { create as createProfileMenu } from "../../components/ProfileMenu.js";
import { create as createSidebar } from "../../components/Sidebar.js";
import { getCurrentUser, logout } from "../../services/authService.js";

export function createAppShell({ activeSidebarId } = {}) {
  const user = getCurrentUser();

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

    // ProfileMenu può chiudersi da sé (ESC, click fuori, azione scelta):
    // risincronizza aria-expanded su AppHeader senza simulare un secondo
    // click sul trigger — stesso pattern già verificato in Fase 2/4.
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
      { id: "modules", label: "Moduli", disabled: true },
      { id: "settings", label: "Impostazioni", disabled: true },
    ],
    activeId: activeSidebarId,
  });

  function destroy() {
    appHeader.element.removeEventListener("sl:profile-menu-toggle", handleProfileMenuToggle);
    closeProfileMenu();
    sidebar.destroy();
    appHeader.destroy();
  }

  return { appHeader, sidebar, destroy };
}
