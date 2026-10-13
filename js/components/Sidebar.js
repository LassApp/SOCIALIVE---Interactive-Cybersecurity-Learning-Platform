/**
 * Sidebar.js
 * -----------------------------------------------------------------------
 * Navigazione principale tra le rotte di primo livello e gli scenari
 * (piano dei componenti, Fase 1 §4). Componente "dumb": riceve le voci da
 * fuori (prop "items"), non conosce modules.json né il router — stesso
 * principio già seguito da AppHeader/ProfileMenu.
 *
 * FISARMONICA, NON FLYOUT (cambio richiesto dal docente): le voci con
 * sottomenu — oggi "Scenari" → aree → scenari — si aprono e si chiudono
 * IN LINEA, spingendo verso il basso le voci successive, invece di
 * comparire in un pannello flottante accanto alla Sidebar all'hover. Il
 * flyout richiedeva di tenere il mouse dentro un'area precisa e si
 * chiudeva da solo; la fisarmonica resta com'è lasciata, si controlla
 * con un click e funziona identica con mouse, tastiera e touch.
 *   - Si apre/chiude SOLO per click/Invio/Spazio sul bottone (mai
 *     all'hover, mai alla perdita del focus): un <button> nativo con
 *     aria-expanded + aria-controls, il pattern WAI-ARIA "disclosure".
 *   - Livelli: voce di primo livello ("Scenari") → gruppi (le AREE:
 *     Cybersecurity, AI) → scenari. I gruppi sono ESCLUSIVI tra loro
 *     (aprirne uno chiude gli altri: una vera fisarmonica, così la
 *     Sidebar non cresce oltre lo schermo con più aree); lo stesso vale
 *     per più voci di primo livello con sottomenu, se mai ce ne
 *     saranno. Un solo punto da cambiare se si volessero indipendenti:
 *     createExclusiveGroup().
 *   - Stato iniziale: la voce di primo livello ("Scenari") nasce CHIUSA su
 *     ogni pagina, salvo "expanded: true" esplicito; un'AREA nasce aperta
 *     se ha "expanded: true" (appShell.js lo imposta per l'area dello
 *     scenario corrente), quindi aprendo "Scenari" da uno scenario
 *     l'area di appartenenza è già aperta. Perché "Scenari" non nasce
 *     aperta nemmeno dentro uno scenario: la Sidebar resta visibile
 *     durante la proiezione e un elenco aperto mostrerebbe il titolo
 *     dello scenario in corso (es. "Oversharing" accanto al finto
 *     profilo), che gli scenari devono evitare — regola "nessun elemento
 *     didattico visibile". Con il flyout il problema non esisteva
 *     (chiuso finché non lo si apriva).
 *   - Chiusa = attributo nativo [hidden] sul pannello: fuori dall'ordine
 *     di tabulazione e dall'albero di accessibilità senza codice
 *     aggiuntivo. Nessuna animazione di chiusura (il pannello sparisce),
 *     come Modal/ProfileMenu; in apertura una breve dissolvenza
 *     (sidebar.css, azzerata da prefers-reduced-motion tramite i token).
 *
 * Le voci sono vere <a href="#/..."> per le rotte interne (routing
 * hash-based, Fase 1 §7): un click nativo aggiorna location.hash senza
 * reload e dà gratis semantica di navigazione corretta. Oltre al
 * comportamento nativo il componente emette "sl:navigate" per dare un
 * aggancio immediato a un eventuale consumer.
 *
 * VOCI ESTERNE ({ external: true, href }): link verso un altro sito (oggi
 * PixelProf). Si aprono in una NUOVA SCHEDA con rel="noopener noreferrer"
 * — la sessione di SocialAlive resta intatta nella scheda di origine e il
 * sito esterno non riceve né riferimento alla pagina né accesso a
 * window.opener — con un'icona che lo segnala alla vista e un testo
 * nascosto "(si apre in una nuova scheda)" per gli screen reader (il
 * nome accessibile è quindi "PixelProf (si apre in una nuova scheda)").
 * Non emettono "sl:navigate": non sono rotte dell'app.
 *
 * Voci "disabled": <span aria-disabled="true">, non <a>/<button>: un
 * elemento senza destinazione non deve comparire nell'ordine di
 * tabulazione né generare click. activeId → aria-current="page" sulla
 * voce corrispondente (non solo una classe CSS).
 *
 * Nascosta sotto il breakpoint "md" (768px, sidebar.css): sul telefono
 * l'accesso agli scenari passa dalle card della Home.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - items    {Array<Item>} Item = voce semplice
 *       { id, label, route, icon?: Node, disabled?: boolean }
 *     | voce esterna { id, label, href, external: true }
 *     | voce con sottomenu { id, label, children: Array<Item|Group> }
 *     dove Group = { id, label, expanded?: boolean, children: Item[] }
 *   - activeId {string} opzionale, id della voce corrispondente alla rotta corrente
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:navigate  detail: { id, route }  (solo per le voci interne)
 */

import { createElement, clearChildren } from "../utils/dom.js";
import { svgNode } from "../utils/svg.js";

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

// Freccia "esce dal riquadro": convenzione comune per un link che porta
// fuori dall'app.
function buildExternalIcon() {
  const svg = svgNode("svg", {
    class: "sl-sidebar__external-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
  });
  svg.appendChild(
    svgNode("path", {
      d: "M7 17 17 7M9 7h8v8",
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

// Insieme di fratelli "a fisarmonica": aprirne uno chiude gli altri.
// Registro di funzioni "chiudi" per id, locale a un gruppo di fratelli —
// stesso stato locale mai esposto via props già usato dal componente
// prima di questo cambio per il flyout.
function createExclusiveGroup() {
  const closers = new Map();
  return {
    register(id, close) {
      closers.set(id, close);
    },
    unregister(id) {
      closers.delete(id);
    },
    closeOthers(id) {
      closers.forEach((close, otherId) => {
        if (otherId !== id) close();
      });
    },
  };
}

// Voce foglia: link interno, link esterno o voce disabilitata. Riusata
// sia per le voci di primo livello sia per i figli di un pannello — un
// link è un link, indipendentemente da dove vive nel DOM.
function buildLeaf(item, activeId, onNavigate) {
  if (item.disabled) {
    return createElement(
      "span",
      { classNames: ["sl-sidebar__link", "sl-sidebar__link--disabled"], attrs: { "aria-disabled": "true" } },
      buildItemContent(item)
    );
  }

  if (item.external) {
    return createElement(
      "a",
      {
        classNames: ["sl-sidebar__link", "sl-sidebar__link--external"],
        attrs: { href: item.href, target: "_blank", rel: "noopener noreferrer" },
      },
      [
        ...buildItemContent(item),
        createElement("span", { classNames: "sl-visually-hidden", text: " (si apre in una nuova scheda)" }),
        buildExternalIcon(),
      ]
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

// Link foglia dentro un <li>: una lista (<ul>) deve contenere solo <li>,
// altrimenti gli screen reader non la annunciano come lista.
function buildPanelLeafEntry(child, activeId, onNavigate) {
  return createElement("li", { classNames: "sl-sidebar__panel-item" }, [
    buildLeaf(child, activeId, onNavigate),
  ]);
}

// Gruppo (secondo livello, un'AREA): bottone disclosure + lista degli
// scenari sotto di esso. Esclusivo rispetto ai gruppi fratelli.
function buildGroup(group, activeId, onNavigate, siblings) {
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

  const list = createElement(
    "ul",
    { classNames: "sl-sidebar__group-list", attrs: { id: listId } },
    group.children.map((child) => buildPanelLeafEntry(child, activeId, onNavigate))
  );
  list.hidden = !expanded;

  function setExpanded(nextExpanded) {
    list.hidden = !nextExpanded;
    trigger.setAttribute("aria-expanded", String(nextExpanded));
  }

  function handleToggle() {
    const nextExpanded = list.hidden;
    if (nextExpanded) siblings.closeOthers(group.id);
    setExpanded(nextExpanded);
  }
  trigger.addEventListener("click", handleToggle);
  siblings.register(group.id, () => setExpanded(false));

  const element = createElement(
    "li",
    { classNames: ["sl-sidebar__panel-item", "sl-sidebar__panel-item--group"] },
    [trigger, list]
  );

  return {
    element,
    destroy() {
      siblings.unregister(group.id);
      trigger.removeEventListener("click", handleToggle);
    },
  };
}

// Un figlio del pannello è un gruppo (ha dei figli) o un link semplice.
function buildPanelEntry(child, activeId, onNavigate, groupSiblings) {
  if (Array.isArray(child.children) && child.children.length > 0) {
    return buildGroup(child, activeId, onNavigate, groupSiblings);
  }
  return { element: buildPanelLeafEntry(child, activeId, onNavigate), destroy() {} };
}

// Voce con sottomenu ("Scenari"): bottone disclosure + pannello in linea.
// Vedi rationale in testa al file.
function buildExpandableItem(item, activeId, onNavigate, topLevelSiblings) {
  const panelId = `sl-sidebar-panel-${item.id}`;
  const children = item.children || [];
  const openInitially = Boolean(item.expanded);

  const trigger = createElement(
    "button",
    {
      classNames: ["sl-sidebar__link", "sl-sidebar__trigger"],
      attrs: { type: "button", "aria-expanded": String(openInitially), "aria-controls": panelId },
    },
    [...buildItemContent(item), buildChevronIcon()]
  );

  const groupSiblings = createExclusiveGroup();
  const entries = children.map((child) => buildPanelEntry(child, activeId, onNavigate, groupSiblings));
  const panel = createElement(
    "ul",
    { classNames: "sl-sidebar__panel", attrs: { id: panelId } },
    entries.map((entry) => entry.element)
  );
  panel.hidden = !openInitially;

  const listItem = createElement(
    "li",
    { classNames: ["sl-sidebar__item", "sl-sidebar__item--has-children"] },
    [trigger, panel]
  );

  function setOpen(nextOpen) {
    panel.hidden = !nextOpen;
    trigger.setAttribute("aria-expanded", String(nextOpen));
  }

  function handleTriggerClick() {
    const nextOpen = panel.hidden;
    if (nextOpen) topLevelSiblings.closeOthers(item.id);
    setOpen(nextOpen);
  }
  trigger.addEventListener("click", handleTriggerClick);
  topLevelSiblings.register(item.id, () => setOpen(false));

  return {
    element: listItem,
    destroy() {
      topLevelSiblings.unregister(item.id);
      entries.forEach((entry) => entry.destroy());
      trigger.removeEventListener("click", handleTriggerClick);
    },
  };
}

function buildItem(item, activeId, onNavigate, topLevelSiblings) {
  if (Array.isArray(item.children) && item.children.length > 0) {
    return buildExpandableItem(item, activeId, onNavigate, topLevelSiblings);
  }
  const link = buildLeaf(item, activeId, onNavigate);
  const listItem = createElement("li", { classNames: "sl-sidebar__item" }, [link]);
  return { element: listItem, destroy() {} };
}

function render(list, props, onNavigate, previousInstances) {
  previousInstances.forEach((instance) => instance.destroy());
  clearChildren(list);

  const topLevelSiblings = createExclusiveGroup();
  const nextInstances = [];
  (props.items || []).forEach((item) => {
    const instance = buildItem(item, props.activeId, onNavigate, topLevelSiblings);
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

  function onNavigate(item) {
    element.dispatchEvent(
      new CustomEvent("sl:navigate", {
        bubbles: true,
        detail: { id: item.id, route: item.route || null },
      })
    );
  }

  let instances = render(list, props, onNavigate, []);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    instances = render(list, props, onNavigate, instances);
  }

  function destroy() {
    instances.forEach((instance) => instance.destroy());
    element.remove();
  }

  return { element, update, destroy };
}
