/**
 * Sidebar.js
 * -----------------------------------------------------------------------
 * Navigazione principale tra le rotte di primo livello (piano dei
 * componenti, Fase 1 §4: "Navigazione tra moduli/scenari"; rotte reali
 * in §7: #/home, #/modules, #/settings). Componente "dumb": riceve le
 * voci da fuori (prop "items"), non conosce navigation.json né il router
 * — stesso principio già seguito da AppHeader/ProfileMenu.
 *
 * Le voci sono vere <a href="#/...">, non bottoni: coerente con la
 * scelta di routing hash-based già presa in Fase 1 (§7) — un click
 * nativo su un'ancora aggiorna location.hash SENZA reload di pagina,
 * esattamente il meccanismo su cui si baserà il futuro router.js
 * (§2.4/§2.5, "osserva i cambi di location.hash"). Usare <a> reali dà
 * gratuitamente semantica di navigazione corretta (screen reader, apri
 * in nuova scheda, copia link) che un <button> non darebbe. Oltre al
 * comportamento nativo, il componente emette comunque "sl:navigate" (già
 * previsto dal piano dei componenti) per dare un aggancio immediato al
 * futuro page controller, senza dover aspettare il round-trip di un
 * evento "hashchange".
 *
 * Nessuna icona in questo step: un sidebar realistico ne userebbe una
 * per voce, ma lo sprite (assets/icons/icons.svg) non esiste ancora —
 * stesso criterio YAGNI già applicato a Input/AppHeader, qui ancora più
 * netto (servirebbero N icone disegnate a mano invece di una sola, tutte
 * da rifare quando lo sprite esisterà). La prop "icon" per singola voce
 * è comunque già prevista (Node opzionale, clonato): quando lo sprite
 * esisterà basterà passare i dati, zero modifiche al componente
 * (Open/Closed) — stesso pattern già usato da Button.
 *
 * Voci "disabled" (moduli non ancora implementati — il progetto ne
 * prevede molti, oggi solo Cybersecurity/Oversharing è reale) sono
 * renderizzate come <span aria-disabled="true">, non <a>/<button>: un
 * elemento realmente privo di destinazione non deve comparire
 * nell'ordine di tabulazione né generare click. Niente href="#" placeholder
 * (che sposterebbe il focus in cima alla pagina se mai cliccato).
 *
 * activeId → aria-current="page" sull'ancora corrispondente (non solo
 * una classe CSS): comunica "pagina corrente" anche a chi naviga con
 * screen reader, non solo visivamente.
 *
 * Stato attivo: SOLO --sl-color-text-primary per il testo (mai un colore
 * di brand come testo pieno — vedi il bug trovato in questo stesso step
 * su AppHeader, corretto con il nuovo token --sl-color-primary-text) +
 * peso semibold + sfondo bg-active persistente + una barra decorativa a
 * sinistra in --sl-color-primary-500 (soglia 3:1, non 4.5:1 — token già
 * verificato per uso decorativo in entrambi i temi, nessuna verifica
 * aggiuntiva necessaria). Vedi sidebar.css per i numeri.
 *
 * Posizionamento nella pagina: NON è responsabilità di questo componente
 * (colonna fissa accanto al contenuto, eventuale sticky agganciato
 * all'altezza reale — non fissa — dell'header) è una decisione di
 * LAYOUT DI PAGINA, presa in Fase 4 quando esisterà un vero page
 * controller/shell che compone AppHeader + Sidebar + contenuto.
 * sidebar.css definisce solo l'aspetto intrinseco del componente
 * (larghezza, padding, stato dei link), non la sua posizione nella
 * pagina — stesso principio "dumb" applicato anche al layout, non solo
 * ai dati.
 *
 * Nascosto sotto il breakpoint "md" (768px, cfr. §5.6 architettura Fase
 * 1) per la stessa ragione già documentata in app-header.css per la
 * ricerca: un drawer mobile con trigger dedicato richiederebbe di
 * riaprire AppHeader per aggiungere un hamburger e orchestrare
 * apertura/chiusura — rimandato alla Fase 4 quando esisterà un page
 * controller reale per gestirlo.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - items    {Array<{ id, label, route, icon?: Node, disabled?: boolean }>}
 *   - activeId {string} opzionale, id della voce corrispondente alla rotta corrente
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:navigate  detail: { id, route }
 */

import { createElement, clearChildren } from "../utils/dom.js";

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

function buildItem(item, activeId, onNavigate) {
  if (item.disabled) {
    const disabledEl = createElement(
      "span",
      {
        classNames: ["sl-sidebar__link", "sl-sidebar__link--disabled"],
        attrs: { "aria-disabled": "true" },
      },
      buildItemContent(item)
    );
    return createElement("li", { classNames: "sl-sidebar__item" }, [disabledEl]);
  }

  const isActive = item.id === activeId;
  const link = createElement(
    "a",
    {
      classNames: ["sl-sidebar__link", isActive ? "sl-sidebar__link--active" : ""],
      attrs: {
        href: item.route || "#",
        ...(isActive ? { "aria-current": "page" } : {}),
      },
    },
    buildItemContent(item)
  );
  link.addEventListener("click", () => onNavigate(item));

  return createElement("li", { classNames: "sl-sidebar__item" }, [link]);
}

function render(list, props, onNavigate) {
  clearChildren(list);
  (props.items || []).forEach((item) => {
    list.appendChild(buildItem(item, props.activeId, onNavigate));
  });
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

  render(list, props, onNavigate);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    render(list, props, onNavigate);
  }

  function destroy() {
    element.remove();
  }

  return { element, update, destroy };
}
