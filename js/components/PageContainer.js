/**
 * PageContainer.js
 * -----------------------------------------------------------------------
 * Scheletro di pagina condiviso da ogni rotta protetta: compone
 * AppHeader + Sidebar + area di contenuto principale (piano dei
 * componenti, Fase 1 §4 — pianificato, mai costruito finora per mancanza
 * di un consumer reale: la Home, Fase 4, è il primo).
 *
 * Riceve NODI GIÀ MONTATI (header/sidebar/main), non li crea: chi ha
 * bisogno di ascoltare gli eventi di AppHeader/Sidebar (il page
 * controller, unico autorizzato a orchestrare — architettura Fase 1
 * §2.1) li istanzia e li collega PRIMA di passarli qui. PageContainer
 * non conosce sl:navigate, sl:profile-menu-toggle, sl:search: si limita
 * a posizionare i tre blocchi nel layout — stesso principio "dumb" già
 * seguito da Card (content come Node|Node[], mai markup grezzo, per non
 * diventare un vettore di injection quando i contenuti arriveranno dai
 * JSON di scenario).
 *
 * "main" è specificatamente un <main> semantico con landmark nativo
 * (nessun role= aggiuntivo necessario, stessa regola già seguita da
 * AppHeader per role="banner"): un solo <main> per pagina, e questo è
 * l'unico componente della piattaforma che lo dichiara — un secondo
 * <main> altrove nella stessa pagina sarebbe un errore di semantica.
 *
 * NON possiede l'aspetto intrinseco di header/sidebar (già definito nei
 * rispettivi CSS): possiede SOLO la disposizione reciproca dei tre
 * blocchi (page-container.css) — stesso principio già seguito da
 * post-card.css verso card.css (estendere, non duplicare).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 * (destroy() rimuove solo il PROPRIO markup di layout: header/sidebar/
 * main restano di proprietà del chiamante, che li ha creati e deve
 * distruggerli lui stesso — se PageContainer li distruggesse a sua
 * volta smetterebbe di essere "dumb", diventando un contenitore con
 * side-effect impliciti sui figli).
 *
 * Props:
 *   - header  {Node}        richiesto — l'elemento di AppHeader già creato
 *   - sidebar {Node}        richiesto — l'elemento di Sidebar già creato
 *   - main    {Node|Node[]} richiesto — contenuto dell'area principale
 *
 * SKIP-LINK (Fase 9, nuovo — WCAG 2.4.1 Bypass Blocks): la utility
 * .sl-visually-hidden anticipava questo esatto caso d'uso fin dal
 * commento originale in global.css (Fase 2), ma nessun componente lo
 * aveva mai implementato. Vive qui e non in appShell.js perché deve
 * essere il PRIMO elemento focalizzabile dell'intera pagina, prima di
 * header e sidebar — appShell.js non possiede il contenitore esterno
 * (non conosce PageContainer, per costruzione, vedi rationale in testa
 * ad appShell.js), quindi non potrebbe posizionarlo correttamente.
 *
 * NON un normale <a href="#sl-main-content">: SOCIALIVE usa routing
 * hash-based (Fase 1 §7) — un vero anchor scriverebbe su
 * window.location.hash, che router.js osserva GLOBALMENTE
 * ("hashchange"). "#sl-main-content" non corrisponde a nessuna rotta
 * registrata: risolverebbe come 404, SMONTANDO l'intera pagina invece
 * di limitarsi a spostare il focus — un'interazione distruttiva e non
 * ovvia, specifica di questa architettura, che il pattern "da manuale"
 * romperebbe silenziosamente. Il click viene quindi intercettato e
 * gestito via JS (mainEl.focus(), senza mai toccare l'hash), pur
 * restando un vero <a> con href (semantica di "link" per gli screen
 * reader, pattern comune per gli skip-link) — solo il comportamento di
 * navigazione nativo viene sostituito.
 *
 * "tabindex=-1" su <main>: senza, l'elemento non sarebbe programmaticamente
 * focalizzabile (mainEl.focus() non avrebbe effetto su un <main> nativo)
 * — pattern standard per i target di uno skip-link, esclude comunque
 * <main> dal normale ordine di tabulazione (-1, non un valore positivo).
 *
 * id statico ("sl-main-content"), non generato dinamicamente come in
 * Modal.js: PageContainer è per costruzione a istanza singola per
 * pagina (un solo page controller montato alla volta, router.js
 * smonta sempre il precedente prima del successivo) — nessun rischio
 * di collisione da id duplicati, quindi nessuna generazione dinamica
 * necessaria (YAGNI).
 */

import { createElement } from "../utils/dom.js";

function normalizeMain(main) {
  if (main instanceof Node) return [main];
  if (Array.isArray(main)) return main.filter((node) => node instanceof Node);
  return [];
}

export function create(props = {}) {
  const skipLink = createElement("a", {
    classNames: "sl-page-container__skip-link",
    attrs: { href: "#sl-main-content" },
    text: "Salta al contenuto principale",
  });

  const mainEl = createElement("main", {
    classNames: "sl-page-container__main",
    attrs: { id: "sl-main-content", tabindex: "-1" },
  });
  normalizeMain(props.main).forEach((node) => mainEl.appendChild(node));

  // preventDefault + focus manuale, MAI il comportamento nativo
  // dell'anchor: vedi rationale in testa al file sul perché un vero
  // salto di hash romperebbe il router.
  function handleSkipLinkClick(event) {
    event.preventDefault();
    mainEl.focus();
  }
  skipLink.addEventListener("click", handleSkipLinkClick);

  const body = createElement("div", { classNames: "sl-page-container__body" }, [
    props.sidebar,
    mainEl,
  ]);

  const element = createElement("div", { classNames: "sl-page-container" }, [
    skipLink,
    props.header,
    body,
  ]);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    // Solo "main" ha senso sostituire per intero da qui: header/sidebar
    // gestiscono il proprio update() autonomamente (il page controller
    // chiama appHeader.update()/sidebar.update() direttamente sulle
    // istanze che possiede), PageContainer non deve intermediare quella
    // relazione.
    if (nextProps.main !== undefined) {
      while (mainEl.firstChild) mainEl.removeChild(mainEl.firstChild);
      normalizeMain(props.main).forEach((node) => mainEl.appendChild(node));
    }
  }

  function destroy() {
    skipLink.removeEventListener("click", handleSkipLinkClick);
    element.remove();
  }

  return { element, update, destroy };
}
