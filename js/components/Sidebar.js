/**
 * Sidebar.js
 * -----------------------------------------------------------------------
 * Navigazione principale tra le rotte di primo livello (piano dei
 * componenti, Fase 1 §4). Componente "dumb": riceve le voci da fuori
 * (prop "items"), non conosce navigation.json né il router — stesso
 * principio già seguito da AppHeader/ProfileMenu.
 *
 * Le voci foglia sono vere <a href="#/...">, non bottoni: coerente con
 * la scelta di routing hash-based (Fase 1 §7). Voci "disabled" (moduli
 * non ancora implementati) sono <span aria-disabled="true">, mai
 * focalizzabili né cliccabili.
 *
 * SOTTOMENU (nuovo, additivo): una voce con "children" (array non vuoto)
 * diventa una voce "disclosure" — un <button> con aria-haspopup/
 * aria-expanded (stesso pattern già usato dal trigger profilo di
 * AppHeader.js) che rivela un pannello flyout con i propri figli come
 * veri <a>. Nessun impatto su voci esistenti senza "children": stesso
 * comportamento di sempre.
 *
 * Apertura SIA su hover SIA su click, convergono sullo STESSO stato
 * locale (mai due fonti di verità separate):
 *   - mouseenter sull'intera <li> (non solo sul trigger): così muovere
 *     il cursore dal trigger verso il pannello flyout non lo richiude —
 *     il pannello è figlio della stessa <li>.
 *   - mouseleave: chiusura ritardata (150ms), non immediata — un
 *     ritardo pari a zero chiuderebbe il pannello nell'istante in cui il
 *     cursore attraversa il piccolo margine tra trigger e pannello.
 *   - click sul trigger: indispensabile per tastiera/touch, dove l'hover
 *     non esiste — toggle immediato, annulla un'eventuale chiusura già
 *     pianificata.
 *   - Escape (quando il pannello è aperto): chiude e riporta il focus
 *     sul trigger, stesso principio già seguito da Modal/ProfileMenu per
 *     "mai lasciare il focus in un punto imprevedibile".
 *   - focusout dall'intera voce (tastiera: Tab che esce del tutto dalla
 *     voce): chiude — nessun listener globale su document necessario
 *     (a differenza di ProfileMenu, qui non serve un vero "click fuori"
 *     con focus trap: è un menu di navigazione, non un pannello di
 *     azioni bloccante).
 *
 * Un solo flyout aperto alla volta: un registro locale di "chiudi"
 * (Map id -> closeImmediately) permette a qualunque voce che si apre di
 * chiudere prima le altre — oggi un solo consumer reale ("Scenari"), ma
 * corretto anche se in futuro se ne aggiungesse un secondo.
 *
 * Stato locale (quale flyout è aperto), MAI esposto via props: stessa
 * natura di isFollowing in profileTimelineRenderer.js o dello stato di
 * zoom in MediaViewer.js — un dettaglio di presentazione interno al
 * componente, non un dato che un page controller debba orchestrare.
 *
 * Chevron: a differenza del trigger di AppHeader (dove aria-haspopup/
 * aria-expanded bastavano, nessun'altra voce dell'header suggerisce
 * interattività extra), qui la voce "Scenari" convive in una lista di
 * semplici link — senza un indizio visivo un utente vedente non ha modo
 * di distinguerla come "voce che si espande". Icona inline via
 * svgNode(), stesso pattern già usato ovunque nel progetto in assenza
 * dello sprite (assets/icons/icons.svg, debito noto).
 *
 * activeId → aria-current="page" sulla voce corrispondente, INVARIATO
 * per le voci foglia dirette e ora esteso anche ai figli di un
 * sottomenu: se "activeId" combacia con l'id di un figlio, quel link
 * riceve lo stesso trattamento (utile quando si è su una pagina di
 * scenario raggiunta dal flyout).
 *
 * SECONDO LIVELLO NEL FLYOUT (nuovo, additivo): un figlio del flyout può
 * a sua volta avere "children" (array non vuoto) e diventa allora un
 * GRUPPO a disclosure — un <button> con aria-expanded/aria-controls che
 * mostra o nasconde, SOTTO di sé, l'elenco dei propri link. Serve alla
 * voce "Scenari": il flyout contiene le categorie (Cybersecurity, AI) e
 * ciascuna raccoglie i propri scenari. Un figlio senza "children"
 * resta un normale link, identico a prima.
 *
 * Il gruppo si apre con click/Invio/Spazio (è un <button> nativo), NON
 * con l'hover: il flyout principale si apre già al passaggio del mouse,
 * ma una lista che si allunga sotto il puntatore mentre ci si sposta
 * verso la voce successiva farebbe "scappare" i bersagli. "expanded:
 * true" sul gruppo lo fa nascere aperto (lo decide chi costruisce i
 * dati, non Sidebar: oggi appShell, per la categoria della pagina in
 * cui ci si trova). Profondità massima: due livelli — un terzo non ha
 * alcun consumer reale (YAGNI).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - items {Array<{
 *       id, label, route?, icon?: Node, disabled?: boolean,
 *       children?: Array<
 *         { id, label, route, disabled?: boolean } |
 *         { id, label, expanded?: boolean, children: Array<{ id, label, route, disabled?: boolean }> }
 *       >
 *     }>}
 *   - activeId {string} opzionale
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:navigate  detail: { id, route }
 */

import { createElement, clearChildren } from "../utils/dom.js";
import { svgNode } from "../utils/svg.js";

const CLOSE_DELAY_MS = 150;

function buildChevronIcon() {
  const svg = svgNode("svg", {
    class: "sl-sidebar__chevron",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
  });
  svg.appendChild(
    svgNode("path", {
      d: "M9 6l6 6-6 6",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

function buildItemContent(item) {
  const children = [];
  if (item.icon) {
    children.push(
      createElement("span", { classNames: "sl-sidebar__icon", attrs: { "aria-hidden": "true" } }, [
        item.icon.cloneNode(true),
      ])
    );
  }
  children.push(createElement("span", { classNames: "sl-sidebar__label", text: item.label }));
  return children;
}

// Voce foglia (nessun sottomenu): stesso comportamento di sempre,
// riusato sia per le voci di primo livello sia per i figli di un
// flyout — un link è un link, indipendentemente da dove vive nel DOM.
function buildLeaf(item, activeId, onNavigate) {
  if (item.disabled) {
    return createElement(
      "span",
      { classNames: ["sl-sidebar__link", "sl-sidebar__link--disabled"], attrs: { "aria-disabled": "true" } },
      buildItemContent(item)
    );
  }

  const isActive = item.id === activeId;
  const link = createElement(
    "a",
    {
      classNames: ["sl-sidebar__link", isActive ? "sl-sidebar__link--active" : ""],
      attrs: { href: item.route || "#", ...(isActive ? { "aria-current": "page" } : {}) },
    },
    buildItemContent(item)
  );
  link.addEventListener("click", () => onNavigate(item));
  return link;
}

// Gruppo del flyout (secondo livello): bottone disclosure + lista dei
// link sotto di esso. Si apre solo per click/tastiera (vedi rationale in
// testa al file). Riusa le classi del link e del chevron del trigger
// principale: stessa resa visiva, nessuna regola CSS duplicata.
function buildGroup(group, activeId, onNavigate) {
  const listId = `sl-sidebar-group-${group.id}`;
  const expanded = Boolean(group.expanded);

  const trigger = createElement(
    "button",
    {
      classNames: ["sl-sidebar__link", "sl-sidebar__group-trigger"],
      attrs: { type: "button", "aria-expanded": String(expanded), "aria-controls": listId },
    },
    [...buildItemContent(group), buildChevronIcon()]
  );

  const entries = group.children.map((child) => buildFlyoutLeafEntry(child, activeId, onNavigate));
  const list = createElement(
    "ul",
    { classNames: "sl-sidebar__group-list", attrs: { id: listId } },
    entries
  );
  list.hidden = !expanded;

  function handleToggle() {
    const nextExpanded = list.hidden;
    list.hidden = !nextExpanded;
    trigger.setAttribute("aria-expanded", String(nextExpanded));
  }
  trigger.addEventListener("click", handleToggle);

  const element = createElement(
    "li",
    { classNames: ["sl-sidebar__flyout-item", "sl-sidebar__flyout-item--group"] },
    [trigger, list]
  );

  return {
    element,
    destroy() {
      trigger.removeEventListener("click", handleToggle);
    },
  };
}

// Link foglia dentro un <li>: una lista (<ul>) deve contenere solo <li>,
// altrimenti gli screen reader non la annunciano come lista.
function buildFlyoutLeafEntry(child, activeId, onNavigate) {
  return createElement("li", { classNames: "sl-sidebar__flyout-item" }, [
    buildLeaf(child, activeId, onNavigate),
  ]);
}

// Una voce del flyout è un gruppo (ha dei figli) o un link semplice.
function buildFlyoutEntry(child, activeId, onNavigate) {
  if (Array.isArray(child.children) && child.children.length > 0) {
    return buildGroup(child, activeId, onNavigate);
  }
  return { element: buildFlyoutLeafEntry(child, activeId, onNavigate), destroy() {} };
}

// Voce con sottomenu ("Scenari"): bottone disclosure + pannello flyout
// con i figli (link, oppure gruppi a loro volta apribili). Vedi
// rationale completo in testa al file per apertura hover+click,
// chiusura ritardata, un solo flyout aperto.
function buildExpandableItem(item, activeId, onNavigate, closers, closeAllExcept) {
  const trigger = createElement(
    "button",
    {
      classNames: ["sl-sidebar__link", "sl-sidebar__trigger"],
      attrs: { type: "button", "aria-haspopup": "true", "aria-expanded": "false" },
    },
    [...buildItemContent(item), buildChevronIcon()]
  );

  const flyoutEntries = (item.children || []).map((child) => buildFlyoutEntry(child, activeId, onNavigate));
  const flyout = createElement(
    "ul",
    { classNames: "sl-sidebar__flyout" },
    flyoutEntries.map((entry) => entry.element)
  );
  flyout.hidden = true;

  const listItem = createElement(
    "li",
    { classNames: ["sl-sidebar__item", "sl-sidebar__item--has-children"] },
    [trigger, flyout]
  );

  let isOpen = false;
  let closeTimer = null;

  function applyOpenState(nextOpen) {
    isOpen = nextOpen;
    flyout.hidden = !nextOpen;
    trigger.setAttribute("aria-expanded", String(nextOpen));
  }

  function cancelPendingClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function open() {
    cancelPendingClose();
    closeAllExcept(item.id);
    applyOpenState(true);
  }

  function closeImmediately() {
    cancelPendingClose();
    applyOpenState(false);
  }

  function scheduleClose() {
    cancelPendingClose();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      applyOpenState(false);
    }, CLOSE_DELAY_MS);
  }

  function handleTriggerClick() {
    if (isOpen) closeImmediately();
    else open();
  }

  function handleMouseEnter() {
    open();
  }

  function handleMouseLeave() {
    scheduleClose();
  }

  // relatedTarget assente = il focus ha lasciato del tutto il documento
  // (es. click su un'altra finestra/tab): non un segnale affidabile che
  // l'utente abbia lasciato la voce, quindi non si chiude in quel caso.
  function handleFocusOut(event) {
    if (event.relatedTarget && listItem.contains(event.relatedTarget)) return;
    closeImmediately();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && isOpen) {
      closeImmediately();
      trigger.focus();
    }
  }

  trigger.addEventListener("click", handleTriggerClick);
  listItem.addEventListener("mouseenter", handleMouseEnter);
  listItem.addEventListener("mouseleave", handleMouseLeave);
  listItem.addEventListener("focusout", handleFocusOut);
  listItem.addEventListener("keydown", handleKeydown);

  closers.set(item.id, closeImmediately);

  return {
    element: listItem,
    destroy() {
      closers.delete(item.id);
      cancelPendingClose();
      flyoutEntries.forEach((entry) => entry.destroy());
      trigger.removeEventListener("click", handleTriggerClick);
      listItem.removeEventListener("mouseenter", handleMouseEnter);
      listItem.removeEventListener("mouseleave", handleMouseLeave);
      listItem.removeEventListener("focusout", handleFocusOut);
      listItem.removeEventListener("keydown", handleKeydown);
    },
  };
}

function buildItem(item, activeId, onNavigate, closers, closeAllExcept) {
  if (Array.isArray(item.children) && item.children.length > 0) {
    return buildExpandableItem(item, activeId, onNavigate, closers, closeAllExcept);
  }
  const link = buildLeaf(item, activeId, onNavigate);
  const listItem = createElement("li", { classNames: "sl-sidebar__item" }, [link]);
  return { element: listItem, destroy() {} };
}

function render(list, props, onNavigate, closers, closeAllExcept, previousInstances) {
  previousInstances.forEach((instance) => instance.destroy());
  clearChildren(list);

  const nextInstances = [];
  (props.items || []).forEach((item) => {
    const instance = buildItem(item, props.activeId, onNavigate, closers, closeAllExcept);
    nextInstances.push(instance);
    list.appendChild(instance.element);
  });
  return nextInstances;
}

export function create(props = {}) {
  const list = createElement("ul", { classNames: "sl-sidebar__list" });
  const element = createElement(
    "nav",
    { classNames: "sl-sidebar", attrs: { "aria-label": "Navigazione principale" } },
    [list]
  );

  // Registro dei "chiudi" delle voci con sottomenu attualmente montate
  // — vedi rationale "un solo flyout alla volta" in testa al file.
  const closers = new Map();
  function closeAllExcept(exceptId) {
    closers.forEach((closeFn, id) => {
      if (id !== exceptId) closeFn();
    });
  }

  function onNavigate(item) {
    element.dispatchEvent(
      new CustomEvent("sl:navigate", {
        bubbles: true,
        detail: { id: item.id, route: item.route || null },
      })
    );
  }

  let instances = render(list, props, onNavigate, closers, closeAllExcept, []);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    instances = render(list, props, onNavigate, closers, closeAllExcept, instances);
  }

  function destroy() {
    instances.forEach((instance) => instance.destroy());
    element.remove();
  }

  return { element, update, destroy };
}
