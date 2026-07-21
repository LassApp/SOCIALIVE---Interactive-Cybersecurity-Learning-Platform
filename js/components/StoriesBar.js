/**
 * StoriesBar.js
 * -----------------------------------------------------------------------
 * Riga orizzontale di "storie in evidenza" (piano dei componenti, Fase 1
 * §4: componente esplicitamente differito per YAGNI — "progettati nel
 * dettaglio a ridosso delle fasi che li richiedono" — ora richiesto da
 * un consumer reale: il profilo Oversharing, Fase 6).
 *
 * COMPONE Avatar (Fase 2), non lo duplica: il fallback su iniziali di
 * Avatar (nessuna "src", o "src" non raggiungibile) è esattamente il
 * meccanismo che serve OGGI, prima che le immagini reali vengano
 * popolate in assets/posts/oversharing/ (punto 5 della roadmap di questa
 * fase) — nessun placeholder ad-hoc da inventare, il componente esistente
 * risolve già il problema. ariaHidden:true sull'Avatar interno: il
 * bottone che lo contiene ha già un nome accessibile derivato dalla
 * label visibile (vedi sotto), stesso principio già seguito da
 * AppHeader/ProfileMenu/PostCard per evitare la doppia lettura da parte
 * di uno screen reader.
 *
 * L'anello colorato (ring) NON è una prop di Avatar: è un contenitore
 * proprio di StoriesBar (uno <span> con padding+border). Il ring è un
 * dettaglio visivo specifico di "storia in evidenza", non del concetto
 * generico "immagine profilo" — introdurlo in Avatar.js accoppierebbe un
 * componente generico a un solo caso d'uso specifico (stessa logica di
 * "astrazione impropria" già motivata in ProfileMenu.js sul perché non
 * riusa Dropdown).
 *
 * NESSUNO stato "vista/non vista": ogni storia riceve lo stesso stile di
 * anello. Un vero tracking di "storia già vista dal docente" richiederebbe
 * uno stato persistito senza alcun consumer reale che lo richieda oggi
 * (YAGNI) — il docente naviga dal vivo durante la proiezione, non ha
 * bisogno di questa distinzione.
 *
 * Bottoni nativi <button>, non <div role="button">: nessun contenitore
 * complesso da rendere interattivo (a differenza di ModuleCard, che deve
 * comportarsi così con un intero <div> Card) — qui un bottone nativo
 * semplice dà gratuitamente focus/Invio/Spazio, stesso principio già
 * seguito ovunque nel progetto quando un elemento nativo è disponibile.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - stories {Array<{ id: string, label: string, thumbnail?: string }>}
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:story-open  detail: { storyId }
 */

import { createElement, clearChildren } from "../utils/dom.js";
import { create as createAvatar } from "./Avatar.js";

function buildStoryItem(story, onOpen) {
  const avatar = createAvatar({
    src: story.thumbnail,
    name: story.label,
    size: "lg",
    ariaHidden: true,
  });

  const ring = createElement("span", { classNames: "sl-stories-bar__ring" }, [avatar.element]);
  const label = createElement("span", {
    classNames: "sl-stories-bar__label",
    text: story.label || "",
  });

  const button = createElement(
    "button",
    { classNames: "sl-stories-bar__item", attrs: { type: "button" } },
    [ring, label]
  );
  button.addEventListener("click", () => onOpen(story));

  const listItem = createElement("li", { classNames: "sl-stories-bar__list-item" }, [button]);

  return { listItem, avatar };
}

// "previousAvatars" viene distrutto PRIMA di ricostruire: Avatar è un
// vero componente (non solo markup grezzo, a differenza delle voci di
// Sidebar), quindi va distrutto esplicitamente ad ogni re-render — stesso
// principio già seguito da PostCard/AppHeader ("ogni componente distrugge
// solo ciò che ha creato").
function render(list, props, onOpen, previousAvatars) {
  previousAvatars.forEach((avatar) => avatar.destroy());
  clearChildren(list);

  const nextAvatars = [];
  (props.stories || []).forEach((story) => {
    const { listItem, avatar } = buildStoryItem(story, onOpen);
    nextAvatars.push(avatar);
    list.appendChild(listItem);
  });
  return nextAvatars;
}

export function create(props = {}) {
  const list = createElement("ul", { classNames: "sl-stories-bar__list" });
  const element = createElement(
    "nav",
    { classNames: "sl-stories-bar", attrs: { "aria-label": "Storie in evidenza" } },
    [list]
  );

  function onOpen(story) {
    element.dispatchEvent(
      new CustomEvent("sl:story-open", { bubbles: true, detail: { storyId: story.id } })
    );
  }

  let avatars = render(list, props, onOpen, []);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    avatars = render(list, props, onOpen, avatars);
  }

  function destroy() {
    avatars.forEach((avatar) => avatar.destroy());
    element.remove();
  }

  return { element, update, destroy };
}
