/**
 * ModuleCard.js
 * -----------------------------------------------------------------------
 * Rappresenta una categoria/modulo nella sezione "Moduli" della Home
 * (contenuto della Home, Prompt #4 della Suite: "categorie (Yoga, Nissan
 * GT-R R34/R35, Beatbox, Fotografia, Cybersecurity, Ricette)"). Non era
 * elencato per nome nel piano dei componenti di Fase 1 §4 — introdotto
 * ora perché la Home (Fase 4) è il primo consumer reale.
 *
 * Compone Card + Badge (Fase 2), non li duplica — stesso principio già
 * seguito da PostCard su Card/Avatar/Button.
 *
 * STATO "disponibile" vs "in arrivo": nessuna categoria è oggi realmente
 * interattiva (Scenario Engine è Fase 5, primo contenuto reale —
 * Oversharing — è Fase 6): presentarne una come cliccabile sarebbe
 * un'affermazione falsa sullo stato reale del progetto. "available"
 * default false — in quel caso la card resta un contenitore puramente
 * informativo, senza alcun ruolo ARIA aggiuntivo (un <div> non
 * interattivo non necessita di role/aria-disabled: stessa regola già
 * seguita da AppHeader, "prima regola ARIA: non aggiungere un ruolo se
 * non serve"). Il badge "In arrivo" comunica lo stato, testo + colore
 * (mai il solo colore, §5.7 architettura Fase 1).
 *
 * Quando "available" sarà true (Fase 5+), la card diventa interattiva:
 * variante Card "interactive" già esistente (hover/focus già gestiti in
 * card.css) + pattern ARIA "div reso interattivo via JS" (role="button",
 * tabindex, Invio/Spazio da tastiera oltre al click) — necessario perché
 * Card resta un <div> generico per restare riusabile anche in contesti
 * non interattivi, a differenza di un elemento nativo (es. <a> in
 * Sidebar, dove la semantica è gratuita). Interfaccia già pronta:
 * quando la prima categoria diventerà reale, zero modifiche a questo
 * componente — solo un cambio del dato "available" passato da fuori
 * (stesso pattern additivo già seguito da Button.pressed, Fase 2/Step 6).
 *
 * Nessuna icona per categoria: lo sprite (assets/icons/icons.svg) non
 * esiste ancora (debito tecnico noto, Fase 2) — un'emoji segnaposto
 * contrasterebbe con l'obiettivo "professionale" del design, quindi si
 * omette piuttosto che approssimare (YAGNI, stesso criterio già seguito
 * per l'icona di ricerca di AppHeader).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 * (update() è un no-op intenzionale, presente solo per uniformità
 * d'interfaccia: "title"/"available"/"moduleId" non cambiano mai a
 * runtime nello stato attuale del progetto — le categorie della Home
 * sono statiche in questa fase, stesso principio già seguito da
 * ProfileMenu).
 *
 * Props:
 *   - moduleId  {string}  richiesto — identificatore stabile (es. "cybersecurity")
 *   - title     {string}  richiesto — nome visibile della categoria
 *   - available {boolean} default: false
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:module-open  detail: { moduleId }  (solo se available === true)
 */

import { createElement } from "../utils/dom.js";
import { create as createCard } from "./Card.js";
import { create as createBadge } from "./Badge.js";

export function create(props = {}) {
  const available = Boolean(props.available);

  const titleEl = createElement("p", {
    classNames: "sl-module-card__title",
    text: props.title || "",
  });

  const badge = createBadge({
    label: available ? "Disponibile" : "In arrivo",
    tone: available ? "success" : "neutral",
  });

  const card = createCard({
    content: [titleEl, badge.element],
    interactive: available,
  });
  card.element.classList.add("sl-module-card");

  function handleClick() {
    card.element.dispatchEvent(
      new CustomEvent("sl:module-open", { bubbles: true, detail: { moduleId: props.moduleId } })
    );
  }

  function handleKeydown(event) {
    // Stesso trattamento standard di qualunque elemento reso
    // interattivo via role="button" su un tag non nativo: Invio e
    // Spazio devono attivarlo, esattamente come farebbe un <button>.
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleClick();
  }

  if (available) {
    card.element.setAttribute("role", "button");
    card.element.setAttribute("tabindex", "0");
    card.element.setAttribute("aria-label", `Apri modulo ${props.title || ""}`);
    card.element.addEventListener("click", handleClick);
    card.element.addEventListener("keydown", handleKeydown);
  }

  function update() {
    // Vedi rationale in testa al file: nessuna prop ha oggi un consumer
    // reale che le cambi dopo la creazione.
  }

  function destroy() {
    if (available) {
      card.element.removeEventListener("click", handleClick);
      card.element.removeEventListener("keydown", handleKeydown);
    }
    badge.destroy();
    card.destroy();
  }

  return { element: card.element, update, destroy };
}
