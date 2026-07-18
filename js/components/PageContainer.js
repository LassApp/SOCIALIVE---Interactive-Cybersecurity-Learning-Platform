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
 */

import { createElement } from "../utils/dom.js";

function normalizeMain(main) {
  if (main instanceof Node) return [main];
  if (Array.isArray(main)) return main.filter((node) => node instanceof Node);
  return [];
}

export function create(props = {}) {
  const mainEl = createElement("main", { classNames: "sl-page-container__main" });
  normalizeMain(props.main).forEach((node) => mainEl.appendChild(node));

  const body = createElement("div", { classNames: "sl-page-container__body" }, [
    props.sidebar,
    mainEl,
  ]);

  const element = createElement("div", { classNames: "sl-page-container" }, [
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
    element.remove();
  }

  return { element, update, destroy };
}
