/**
 * ProfileMenu.js
 * -----------------------------------------------------------------------
 * Pannello a comparsa (popover) agganciato al trigger di AppHeader:
 * riepilogo utente, ThemeSwitch, azioni "Impostazioni"/"Esci" (piano dei
 * componenti, Fase 1 §4).
 *
 * NON è una variante di Modal, pur condividendone la logica di focus trap
 * (estratta in utils/focusTrap.js — vedi sotto): Modal blocca l'intera
 * pagina dietro un overlay scuro per una decisione centrale e bloccante;
 * ProfileMenu è un pannello contestuale, ancorato vicino al trigger,
 * senza overlay, che lascia il resto della pagina interagibile finché non
 * lo si chiude. Sono due FUNZIONI diverse (decisione bloccante vs. menu
 * contestuale leggero): la regola "mai duplicare componenti per la stessa
 * funzione" qui va nella direzione opposta — è la differenza di funzione
 * a giustificare due componenti distinti, non a vietarli.
 *
 * NON riusa il componente Dropdown pianificato in Fase 1 (§4: "Dropdown —
 * Selettore a comparsa, options/value"): quel componente è pensato come
 * sostituto di <select> per scegliere UN valore tra opzioni — un pattern
 * d'interazione diverso da un pannello con contenuti eterogenei (un
 * toggle, due azioni). Forzare ProfileMenu dentro l'astrazione di Dropdown
 * sarebbe un'astrazione impropria quanto duplicarne una: stesso principio
 * (mai una funzione, due forme), applicato però al contrario.
 *
 * Focus trap + ciclo Tab/Shift+Tab: stessa identica logica di Modal,
 * estratta in js/utils/focusTrap.js perché serviva identica una seconda
 * volta (DRY — Modal.js è stato aggiornato in questo stesso step per
 * usare la stessa utility, zero cambi di comportamento: vedi test di
 * regressione).
 *
 * Posizionamento: "position: fixed" (dichiarato in profile-menu.css),
 * coordinate calcolate una sola volta all'apertura dalla bounding box di
 * "anchorElement" (il bottone trigger di AppHeader, ricevuto nel detail
 * di "sl:profile-menu-toggle" — vedi AppHeader.js). Non si riposiziona su
 * resize/scroll in questo step (semplificazione nota e volutamente
 * minima, YAGNI: l'unico utilizzatore chiude/riapre il menu più spesso
 * di quanto ridimensioni la finestra a menu aperto — annotato come debito
 * tecnico a bassa priorità nell'handover).
 *
 * Click fuori: il listener su "document" viene agganciato con
 * setTimeout(…, 0) invece che in modo sincrono — altrimenti lo stesso
 * click che ha aperto il menu (gestito da AppHeader, PRIMA che l'evento
 * raggiunga "document" in bubbling) chiuderebbe il pannello nell'istante
 * stesso in cui viene creato: bug classico dei popover aperti/chiusi
 * dallo stesso elemento scatenante. Il click sull'anchorElement stesso è
 * esplicitamente ignorato dal listener: la sua chiusura è già gestita dal
 * toggle di AppHeader (che il consumer traduce in un destroy() esplicito),
 * quindi non deve avviare ANCHE il percorso "chiusura per click fuori"
 * per lo stesso click, che emetterebbe un secondo evento di chiusura
 * ridondante.
 *
 * role="region" + aria-label sul pannello (non role="menu"): il contenuto
 * include un controllo che non è un "menuitem" (il toggle di ThemeSwitch),
 * e le ARIA Authoring Practices sconsigliano di annidare controlli
 * generici in un vero widget "menu" (che richiederebbe anche navigazione
 * a frecce/Home/End, non prevista da nessun componente di SOCIALIVE finora
 * — introdurla solo per questo pannello sarebbe overengineering). "region"
 * espone comunque il pannello come una sezione riconoscibile per chi
 * naviga con screen reader, con normale navigazione Tab tra i controlli
 * interni — pattern "disclosure" coerente con l'aria-haspopup/
 * aria-expanded già impostato sul trigger in AppHeader.js.
 *
 * Sfondo: --sl-color-bg-elevated, il token riservato esplicitamente a
 * "sfondo modali/dropdown" (architettura Fase 1 §5.1) — già usato da
 * Modal. A differenza di bg-surface, bg-elevated ha un valore DIVERSO in
 * Dark (gray-800 vs gray-900 di bg-surface): le combinazioni text-primary/
 * text-secondary/error-text su bg-elevated sono quindi state verificate
 * numericamente in questo step (non assunte dai numeri già noti su
 * bg-surface) — risultati: 17.05:1 / 12.45:1 (text-primary), 6.11:1 /
 * 5.81:1 (text-secondary), 8.17:1 / 6.64:1 (error-text, voce "Esci") in
 * Light/Dark rispettivamente — tutte ben oltre la soglia AA 4.5:1.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 * (update() qui è un no-op intenzionale, presente solo per uniformità
 * d'interfaccia: nessuna prop ha senso cambiare a pannello già aperto —
 * si chiude e si ricrea, come già Modal).
 *
 * Props:
 *   - user                {{ name?: string, avatarSrc?: string }}
 *   - anchorElement       {HTMLElement} richiesto, per il posizionamento
 *   - closeOnOutsideClick {boolean} default: true
 *   - closeOnEsc          {boolean} default: true
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:profile-menu-close  detail: { reason: "escape"|"outside"|"logout"|"settings" }
 *   - sl:logout              detail: {}
 *   - sl:settings-click      detail: {}
 */

import { createElement } from "../utils/dom.js";
import { getFocusableElements, trapTabKey } from "../utils/focusTrap.js";
import { create as createAvatar } from "./Avatar.js";
import { create as createThemeSwitch } from "./ThemeSwitch.js";

const GAP_FROM_ANCHOR = 8;

export function create(props = {}) {
  const previouslyFocused = document.activeElement;
  const childComponents = [];

  const avatar = createAvatar({
    src: props.user?.avatarSrc,
    name: props.user?.name,
    size: "md",
    ariaHidden: true,
  });
  childComponents.push(avatar);

  const userName = createElement("p", {
    classNames: "sl-profile-menu__user-name",
    text: props.user?.name || "",
  });

  const header = createElement("div", { classNames: "sl-profile-menu__header" }, [
    avatar.element,
    userName,
  ]);

  const themeSwitch = createThemeSwitch({});
  childComponents.push(themeSwitch);

  const themeSection = createElement("div", { classNames: "sl-profile-menu__section" }, [
    themeSwitch.element,
  ]);

  const divider = createElement("div", {
    classNames: "sl-profile-menu__divider",
    attrs: { role: "separator" },
  });

  const settingsButton = createElement("button", {
    classNames: "sl-profile-menu__item",
    attrs: { type: "button" },
    text: "Impostazioni",
  });

  const logoutButton = createElement("button", {
    classNames: ["sl-profile-menu__item", "sl-profile-menu__item--danger"],
    attrs: { type: "button" },
    text: "Esci",
  });

  const panel = createElement(
    "div",
    {
      classNames: "sl-profile-menu",
      attrs: {
        role: "region",
        "aria-label": props.user?.name ? `Menu profilo di ${props.user.name}` : "Menu profilo",
        tabindex: "-1",
      },
    },
    [header, themeSection, divider, settingsButton, logoutButton]
  );

  function positionPanel() {
    if (!props.anchorElement) return;
    const rect = props.anchorElement.getBoundingClientRect();
    panel.style.top = `${rect.bottom + GAP_FROM_ANCHOR}px`;
    panel.style.right = `${Math.max(window.innerWidth - rect.right, 0)}px`;
  }

  document.body.appendChild(panel);
  positionPanel();

  const initialFocusTarget = getFocusableElements(panel)[0] || panel;
  initialFocusTarget.focus();

  function close(reason) {
    panel.dispatchEvent(
      new CustomEvent("sl:profile-menu-close", { bubbles: true, detail: { reason } })
    );
    destroy();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (props.closeOnEsc !== false) close("escape");
      return;
    }
    if (event.key === "Tab") {
      trapTabKey(event, panel);
    }
  }

  function handleOutsideClick(event) {
    if (props.closeOnOutsideClick === false) return;
    if (panel.contains(event.target)) return;
    // Il click sul trigger stesso è già gestito da AppHeader (toggle):
    // ignorarlo qui evita un secondo evento di chiusura ridondante.
    if (props.anchorElement && props.anchorElement.contains(event.target)) return;
    close("outside");
  }

  function handleSettingsClick() {
    panel.dispatchEvent(new CustomEvent("sl:settings-click", { bubbles: true, detail: {} }));
    close("settings");
  }

  function handleLogoutClick() {
    panel.dispatchEvent(new CustomEvent("sl:logout", { bubbles: true, detail: {} }));
    close("logout");
  }

  document.addEventListener("keydown", handleKeydown);
  settingsButton.addEventListener("click", handleSettingsClick);
  logoutButton.addEventListener("click", handleLogoutClick);
  // Deferito al tick successivo: vedi motivazione in testa al file (evita
  // la chiusura immediata sullo stesso click che ha aperto il pannello).
  const outsideClickTimer = setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
  }, 0);

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(outsideClickTimer);
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("click", handleOutsideClick);
    settingsButton.removeEventListener("click", handleSettingsClick);
    logoutButton.removeEventListener("click", handleLogoutClick);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
    childComponents.forEach((c) => c.destroy());
    panel.remove();
  }

  function update() {
    // Nessuna prop ha senso cambiare a pannello già aperto (vedi commento
    // in testa al file): presente solo per l'interfaccia uniforme.
  }

  return { element: panel, update, destroy };
}
