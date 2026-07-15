/**
 * AppHeader.js
 * -----------------------------------------------------------------------
 * Intestazione fissa dell'applicazione: branding, ricerca rapida, trigger
 * del menu profilo (piano dei componenti, Fase 1 §4 — tre responsabilità,
 * non di più: niente notifiche qui, vedi sotto).
 *
 * NON monta al proprio interno il pannello ProfileMenu (componente
 * separato, prossimo step di questa stessa Fase 2/Step 5): resta "dumb"
 * come gli altri componenti (architettura Fase 1 §2.1) e si limita a
 * notificare l'intento di apertura/chiusura tramite evento — esattamente
 * come Modal non sa nulla di chi lo apre.
 *
 * Il bottone trigger gestisce da sé il proprio aria-expanded (pattern
 * "disclosure button", standard WAI-ARIA per un bottone che rivela un
 * pannello): stesso principio di autosufficienza già seguito da
 * ThemeSwitch per aria-checked. Il consumer riceve comunque lo stato
 * risultante nel detail di "sl:profile-menu-toggle" e può risincronizzarlo
 * dall'esterno via update({ profileMenuOpen }) nei rari casi in cui il
 * pannello si chiuda per altre vie (es. click fuori, gestito da
 * ProfileMenu stesso quando esisterà).
 *
 * L'avatar nel trigger è ariaHidden: il bottone porta già il nome
 * accessibile (aria-label con il nome utente), quindi l'avatar
 * duplicherebbe l'annuncio — esattamente il caso d'uso che la prop
 * ariaHidden di Avatar già documenta ("accanto all'avatar in un header,
 * per evitare la doppia lettura").
 *
 * Ricerca: riusa Input (type "search", prop "hideLabel" — vedi Input.js)
 * invece di un campo dedicato, per non duplicare markup/accessibilità/
 * gestione eventi già risolti lì (DRY). AppHeader non riespone "sl:input"
 * grezzo: lo intercetta e lo ritraduce in "sl:search", così chi consuma
 * AppHeader non deve sapere che internamente usa Input — stesso principio
 * di incapsulamento già seguito da Modal, che ritraduce "sl:click" del suo
 * Button interno in "sl:modal-close".
 *
 * Nessuna icona (lente di ricerca, campanella notifiche, chevron) in
 * questo step:
 *   - la lente è puramente decorativa: il campo resta pienamente
 *     accessibile/riconoscibile grazie a placeholder + label reale (solo
 *     nascosta alla vista), quindi non è un requisito minimo;
 *   - le notifiche non sono nel piano dei componenti originario di
 *     AppHeader e non hanno ancora una fonte dati (notifications.json è
 *     previsto in Fase 8) — aggiungerle ora sarebbe scope creep;
 *   - il chevron è ridondante con aria-haspopup/aria-expanded, già
 *     sufficienti per lo stato assistivo.
 *   In tutti e tre i casi si applica lo stesso criterio YAGNI già usato
 *   per il toggle mostra/nascondi password di Input: nuove icone inline
 *   solo quando davvero essenziali all'identità del componente (vedi
 *   invece l'icona × di Modal, l'unico modo di chiuderlo via mouse).
 *
 * role="banner" non è impostato esplicitamente: <header> come figlio
 * diretto di <body> espone già il landmark "banner" in modo implicito
 * (prima regola ARIA: non aggiungere un ruolo se l'elemento nativo lo
 * espone già).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - user               {{ name?: string, avatarSrc?: string }}
 *   - searchValue        {string}  opzionale, valore controllato del campo ricerca
 *   - searchPlaceholder  {string}  default: "Cerca in SocialAlive"
 *   - profileMenuOpen    {boolean} opzionale, per risincronizzare aria-expanded
 *     dall'esterno (vedi sopra)
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:search               detail: { value }
 *   - sl:profile-menu-toggle  detail: { open, anchorElement }
 *     (anchorElement = il nodo <button> del trigger, incluso per
 *     permettere a ProfileMenu — Fase 2/Step 5, prossima consegna — di
 *     posizionarsi vicino al trigger senza dover conoscere le classi CSS
 *     interne di AppHeader; AppHeader resta comunque ignaro dell'esistenza
 *     di ProfileMenu)
 */

import { createElement } from "../utils/dom.js";
import { create as createInput } from "./Input.js";
import { create as createAvatar } from "./Avatar.js";

function accessibleTriggerLabel(name) {
  return name ? `Apri menu profilo di ${name}` : "Apri menu profilo";
}

export function create(props = {}) {
  const state = { profileMenuOpen: Boolean(props.profileMenuOpen) };

  const brand = createElement("span", {
    classNames: "sl-app-header__brand",
    text: "SocialAlive",
  });

  const searchInput = createInput({
    type: "search",
    label: "Cerca",
    hideLabel: true,
    placeholder: props.searchPlaceholder || "Cerca in SocialAlive",
    value: props.searchValue,
  });
  searchInput.element.classList.add("sl-app-header__search-field");

  const avatar = createAvatar({
    src: props.user?.avatarSrc,
    name: props.user?.name,
    size: "sm",
    ariaHidden: true,
  });

  const trigger = createElement(
    "button",
    {
      classNames: "sl-app-header__profile-trigger",
      attrs: {
        type: "button",
        "aria-haspopup": "true",
        "aria-expanded": String(state.profileMenuOpen),
        "aria-label": accessibleTriggerLabel(props.user?.name),
      },
    },
    [avatar.element]
  );

  const element = createElement("header", { classNames: "sl-app-header" }, [
    brand,
    createElement("div", { classNames: "sl-app-header__search" }, [searchInput.element]),
    createElement("div", { classNames: "sl-app-header__actions" }, [trigger]),
  ]);

  function handleSearchInput(event) {
    element.dispatchEvent(
      new CustomEvent("sl:search", { bubbles: true, detail: { value: event.detail.value } })
    );
  }

  function handleTriggerClick() {
    state.profileMenuOpen = !state.profileMenuOpen;
    trigger.setAttribute("aria-expanded", String(state.profileMenuOpen));
    element.dispatchEvent(
      new CustomEvent("sl:profile-menu-toggle", {
        bubbles: true,
        detail: { open: state.profileMenuOpen, anchorElement: trigger },
      })
    );
  }

  searchInput.element.addEventListener("sl:input", handleSearchInput);
  trigger.addEventListener("click", handleTriggerClick);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };

    if (nextProps.user !== undefined) {
      avatar.update({ src: props.user?.avatarSrc, name: props.user?.name });
      trigger.setAttribute("aria-label", accessibleTriggerLabel(props.user?.name));
    }

    if (nextProps.searchValue !== undefined) {
      searchInput.update({ value: nextProps.searchValue });
    }

    if (typeof nextProps.profileMenuOpen === "boolean") {
      state.profileMenuOpen = nextProps.profileMenuOpen;
      trigger.setAttribute("aria-expanded", String(state.profileMenuOpen));
    }
  }

  function destroy() {
    searchInput.element.removeEventListener("sl:input", handleSearchInput);
    trigger.removeEventListener("click", handleTriggerClick);
    searchInput.destroy();
    avatar.destroy();
    element.remove();
  }

  return { element, update, destroy };
}
