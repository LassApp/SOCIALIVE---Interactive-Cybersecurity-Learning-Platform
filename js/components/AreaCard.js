/**
 * AreaCard.js
 * -----------------------------------------------------------------------
 * Card di un'AREA di formazione nella Home (Cybersecurity, AI, ...):
 * icona, titolo, badge con il numero di scenari, descrizione breve e
 * l'elenco degli scenari come link diretti. Prima di questo componente la
 * Home mostrava un finto feed social: oggi è il punto d'ingresso della
 * piattaforma (vedi homePageController.js).
 *
 * COMPONE Card + Badge (Fase 2), non li duplica — stesso principio già
 * seguito da PostCard su Card/Avatar/Button. Componente "dumb": riceve
 * dati già pronti (il catalogo di js/utils/scenarioCatalog.js) e non
 * conosce né il router né modules.json. Non emette eventi: gli scenari
 * sono veri <a href="#/scenario/:id"> (come le voci della Sidebar), la
 * navigazione hash-based è nativa e dà gratis semantica di link (screen
 * reader, tastiera, "apri in nuova scheda") che un bottone non darebbe.
 *
 * ICONA = FILE IN assets/, NON CODICE: il percorso dell'SVG arriva da
 * modules.json ("icon") e viene usato come MASCHERA CSS (mask-image) di
 * un riquadro colorato con currentColor. Così l'icona segue il tema
 * Light/Dark (un <img src="…svg"> non potrebbe ereditare il colore) e
 * aggiungere un'area non richiede alcuna modifica al JS — solo un file
 * SVG e una voce in modules.json. mask-image è impostata INLINE (non
 * tramite una custom property): un url() relativo in un attributo style
 * si risolve rispetto al documento (index.html), quindi funziona anche
 * quando l'app vive in un sottopercorso di GitHub Pages; dentro una
 * custom property la base di risoluzione dipende dal foglio di stile
 * che la usa. Il percorso è validato (solo .svg relativi, nessun
 * carattere speciale) prima di finire in un url(): modules.json è un
 * file di dati, non va mai trattato come fiducioso fino al CSS. Senza
 * "icon" valida si ripiega sulle iniziali del titolo (stesso fallback
 * già usato da Avatar): mai un cerchio vuoto.
 *
 * BADGE "N di M": quando l'elenco è filtrato dalla ricerca (meno scenari
 * di quanti l'area ne contenga) il badge lo dice — "1 di 4 scenari" —
 * così chi cerca "Phishing" capisce che l'area ne ha altri senza che la
 * card li mostri tutti.
 *
 * Scenario non disponibile (available:false): riga non cliccabile e
 * senza href (aria-disabled, opacità ridotta come le voci disabilitate
 * di Sidebar) — mai un link verso una rotta che non esiste ancora.
 *
 * ATTENZIONE: update() NON richiama Card.update(), che sovrascrive
 * className (Card.render) e cancellerebbe la classe .sl-area-card
 * aggiunta qui. Si aggiornano solo i nodi interni.
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - title         {string}  richiesto
 *   - description   {string}  opzionale, nascosta se vuota
 *   - icon          {string}  opzionale, percorso relativo di un .svg
 *   - scenarios     {Array<{ id, title, route, available }>}
 *   - scenarioTotal {number}  scenari totali dell'area (default:
 *     scenarios.length) — differisce da scenarios.length solo se filtrato
 */

import { createElement, clearChildren } from "../utils/dom.js";
import { svgNode } from "../utils/svg.js";
import { create as createCard } from "./Card.js";
import { create as createBadge } from "./Badge.js";

// Solo percorsi relativi a file .svg, composti da lettere/cifre/_ . / -:
// niente "http:", "//", virgolette, parentesi o "..". in testa.
const SAFE_ICON_PATH = /^\w[\w./-]*\.svg$/;

function getInitials(title) {
  return String(title || "").trim().slice(0, 2).toUpperCase();
}

function buildBadgeLabel(shown, total) {
  const noun = total === 1 ? "scenario" : "scenari";
  return shown === total ? `${total} ${noun}` : `${shown} di ${total} ${noun}`;
}

function buildChevron() {
  const svg = svgNode("svg", {
    class: "sl-area-card__chevron",
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

function renderIcon(iconEl, props) {
  iconEl.textContent = ""; // svuota anche eventuali nodi figli
  if (SAFE_ICON_PATH.test(props.icon || "")) {
    const glyph = createElement("span", { classNames: "sl-area-card__glyph" });
    const maskUrl = `url("${props.icon}")`;
    glyph.style.setProperty("-webkit-mask-image", maskUrl);
    glyph.style.setProperty("mask-image", maskUrl);
    iconEl.appendChild(glyph);
  } else {
    iconEl.textContent = getInitials(props.title);
  }
}

function buildScenarioItem(scenario) {
  let row;
  if (scenario.available) {
    row = createElement(
      "a",
      { classNames: "sl-area-card__scenario", attrs: { href: scenario.route } },
      [createElement("span", { text: scenario.title }), buildChevron()]
    );
  } else {
    row = createElement("span", {
      classNames: ["sl-area-card__scenario", "sl-area-card__scenario--disabled"],
      attrs: { "aria-disabled": "true" },
      text: scenario.title,
    });
  }
  return createElement("li", { classNames: "sl-area-card__scenario-item" }, [row]);
}

function render(refs, props) {
  const scenarios = props.scenarios || [];
  const total = Number.isFinite(props.scenarioTotal) ? props.scenarioTotal : scenarios.length;

  refs.title.textContent = props.title || "";
  renderIcon(refs.icon, props);
  refs.badge.update({ label: buildBadgeLabel(scenarios.length, total), tone: "neutral" });

  refs.description.textContent = props.description || "";
  refs.description.hidden = !props.description;

  refs.list.setAttribute("aria-label", `Scenari di ${props.title || "questa area"}`);
  clearChildren(refs.list);
  scenarios.forEach((scenario) => refs.list.appendChild(buildScenarioItem(scenario)));
}

export function create(props = {}) {
  const icon = createElement("span", { classNames: "sl-area-card__icon", attrs: { "aria-hidden": "true" } });
  const title = createElement("h3", { classNames: "sl-area-card__title" });
  const badge = createBadge({ label: "", tone: "neutral" });
  const heading = createElement("div", { classNames: "sl-area-card__heading" }, [title, badge.element]);
  const header = createElement("div", { classNames: "sl-area-card__header" }, [icon, heading]);
  const description = createElement("p", { classNames: "sl-area-card__description" });
  const list = createElement("ul", { classNames: "sl-area-card__scenarios" });

  const card = createCard({ content: [header, description, list] });
  card.element.classList.add("sl-area-card");

  const refs = { icon, title, badge, description, list };
  render(refs, props);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    render(refs, props);
  }

  function destroy() {
    badge.destroy();
    card.destroy();
  }

  return { element: card.element, update, destroy };
}
