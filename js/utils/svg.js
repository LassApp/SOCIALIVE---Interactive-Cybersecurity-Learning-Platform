/**
 * svg.js
 * -----------------------------------------------------------------------
 * Costruttore condiviso di un nodo SVG con il namespace corretto
 * (createElementNS, non createElement: gli elementi SVG richiedono il
 * proprio namespace per essere renderizzati come tali —
 * document.createElement produrrebbe un elemento HTML anonimo, non un
 * vero nodo SVG, e il browser non lo disegnerebbe). Estratto in Fase 9
 * perché la stessa identica funzione viveva duplicata in tre componenti
 * (Loader.js, PostCard.js, MediaViewer.js) — stesso principio DRY già
 * seguito per focusTrap.js (Fase 2), dateFormat.js (Fase 6) e
 * fallbackMessage.js (Fase 9, stesso step).
 *
 * Resta un'utility minima, non un builder di icone: costruisce UN nodo
 * SVG con i propri attributi, non un albero. Ogni componente continua a
 * comporre i propri nodi con appendChild espliciti, esattamente come
 * faceva prima — questo intervento elimina la duplicazione della
 * funzione, non introduce una nuova astrazione più ampia (es. un
 * parametro "children" come quello di createElement in dom.js): sarebbe
 * un secondo intervento distinto (ridurre il boilerplate ai call site),
 * da valutare separatamente se un giorno servisse davvero (YAGNI).
 *
 * Prerequisito ancora assente per l'icon sprite (assets/icons/icons.svg,
 * debito tecnico noto da Fase 2): quando lo sprite esisterà, le funzioni
 * che oggi chiamano svgNode per costruire icone verranno sostituite con
 * <use href="#icon-...">, e questo file potrà restringersi o sparire —
 * nel frattempo riduce da tre a un solo punto la funzione da mantenere.
 *
 * @param {string} tag es. "svg", "path", "circle", "rect", "line"
 * @param {Record<string, string>} attrs attributi impostati via setAttribute
 * @returns {SVGElement}
 */
export function svgNode(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}
