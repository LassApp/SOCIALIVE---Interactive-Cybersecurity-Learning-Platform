/**
 * homePageController.js
 * -----------------------------------------------------------------------
 * Placeholder della rotta protetta #/home. La Home reale (feed personale,
 * categorie, menu profilo, accesso agli scenari — Prompt #4 della Suite)
 * è Fase 4: l'obiettivo di QUESTO step è dimostrare che l'intero ciclo di
 * autenticazione funziona end-to-end (login → rotta protetta → logout →
 * redirect), non costruire la UI definitiva. Nessun elemento qui verrà
 * riusato in Fase 4 senza revisione — dichiarato esplicitamente per non
 * confondere un futuro passaggio di contesto.
 *
 * Non importa router.js: il logout è già completamente orchestrato da
 * authService (evento sl:auth-logout) + router.js (che lo ascolta
 * centralmente e naviga a #/login) — questo controller si limita a
 * chiamare logout(), la navigazione non è una sua responsabilità (stesso
 * principio di disaccoppiamento già seguito ovunque nel Design System).
 */

import { createElement } from "../utils/dom.js";
import { create as createButton } from "../components/Button.js";
import { getCurrentUser, logout } from "../services/authService.js";

export function createHomePageController(container) {
  const user = getCurrentUser();

  const heading = createElement("h1", {
    text: user ? `Ciao, ${user.displayName}` : "Ciao",
  });

  const note = createElement("p", {
    text: "Home provvisoria — la vera Home (feed, categorie, scenari) arriva in Fase 4.",
  });

  const logoutButton = createButton({ label: "Esci", variant: "secondary" });

  function handleLogoutClick() {
    logout();
  }
  logoutButton.element.addEventListener("sl:click", handleLogoutClick);

  const page = createElement("div", { classNames: "sl-home-page-placeholder" }, [
    heading,
    note,
    logoutButton.element,
  ]);
  container.appendChild(page);

  return function destroy() {
    logoutButton.element.removeEventListener("sl:click", handleLogoutClick);
    logoutButton.destroy();
    page.remove();
  };
}
