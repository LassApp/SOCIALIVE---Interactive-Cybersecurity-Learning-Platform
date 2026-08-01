/**
 * imageFadeIn.js
 * -----------------------------------------------------------------------
 * Utility condivisa per il fade-in di un'immagine al termine del suo
 * caricamento reale (Fase 9, intervento 🟢 #11 dell'audit di rifinitura
 * UX). Estratta subito come funzione condivisa perché aveva GIÀ due
 * consumer reali fin dal primo commit — PostCard.js (immagine del post,
 * Home e Oversharing) e profileTimelineRenderer.js (copertina del
 * profilo) — stesso principio "estrarre al secondo consumo reale" già
 * seguito per focusTrap.js (Fase 2), dateFormat.js (Fase 6), svg.js/
 * fallbackMessage.js (Fase 9).
 *
 * NOTA DI PROCESSO (Fase 10): questo intervento era stato DICHIARATO
 * completato nell'handover di Fase 9 ("js/utils/imageFadeIn.js, nuovo"),
 * ma non era mai stato realmente scritto — la suite Playwright
 * persistita conteneva già due controlli che lo davano per assunto,
 * entrambi falliti alla prima esecuzione reale durante l'audit di
 * Fase 10 (stessa classe di errore già documentata per
 * homePageController.js tra Fase 8 e Fase 9: un handover che descrive
 * un lavoro non applicato al codice). Questo file chiude quel gap.
 *
 * COMPORTAMENTO:
 *   1. Applica subito la classe base ("sl-fade-in-image", opacity:0 —
 *      definita in css/base/global.css, non nel CSS di un singolo
 *      componente: è un concern trasversale a qualunque immagine
 *      futura, stesso principio già seguito per .sl-route-transition).
 *   2. Applica la classe "--loaded" (piena opacità) non appena
 *      l'immagine ha realmente terminato di caricare — sia "load" sia
 *      "error": un'immagine rotta non deve restare invisibile per
 *      sempre, deve comunque rivelare il proprio spazio riservato
 *      (aspect-ratio, Fase 9/#2) e il fallback del browser.
 *   3. Se l'immagine è già "complete" nel momento in cui questa
 *      funzione viene chiamata (cache del browser — caso comune per
 *      un'immagine già vista altrove, o già presente nella cache HTTP),
 *      la classe "--loaded" viene applicata SUBITO, in modo sincrono:
 *      un "load" che è già stato emesso in passato non si ripete, quindi
 *      un listener da solo lascerebbe l'immagine invisibile per sempre
 *      in questo caso (stesso problema, in scala minore, già gestito da
 *      MediaViewer.js per il proprio Loader).
 *
 * IDEMPOTENTE RISPETTO ALLA STESSA "src" — bug di UX reale trovato e
 * corretto durante la progettazione di questo intervento (Fase 9,
 * dichiarato nell'handover, ora davvero implementato): PostCard.update()
 * viene richiamato anche per motivi che non riguardano l'immagine (es.
 * il contatore "mi piace"), e il consumer resetta comunque
 * "img.src = post.image.src" ad ogni render(). Senza un confronto
 * esplicito sulla src già gestita, l'immagine ripartirebbe da opacity:0
 * ad ogni update, anche quando il caricamento reale è già avvenuto una
 * volta — un fade-in "a lampeggio" ripetuto, peggiore di nessun fade-in.
 * Il confronto usa un dataset dedicato sull'elemento stesso (non uno
 * stato esterno da tenere sincronizzato): l'informazione "quale src ho
 * già gestito" appartiene naturalmente al nodo DOM che la porta.
 *
 * Interfaccia minima e diretta (non un componente con create/update/
 * destroy): questa è un'utility funzionale su un nodo DOM già esistente,
 * stessa natura di svgNode()/formatFullDate(), non un elemento del
 * Design System con un proprio ciclo di vita.
 *
 * @param {HTMLImageElement} img elemento <img> con "src" già impostata
 *   dal chiamante PRIMA di invocare questa funzione (questa utility non
 *   assegna mai essa stessa l'attributo "src": resta responsabilità del
 *   consumer, che conosce il dato di provenienza).
 */
export function applyImageFadeIn(img) {
  const currentSrc = img.getAttribute("src") || "";

  // Stessa src già gestita in una chiamata precedente: nessuna azione,
  // lo stato attuale delle classi (presumibilmente già "--loaded") resta
  // intatto — vedi rationale sopra sul bug del fade-in ripetuto.
  if (img.dataset.fadeInSrc === currentSrc) return;
  img.dataset.fadeInSrc = currentSrc;

  img.classList.add("sl-fade-in-image");
  img.classList.remove("sl-fade-in-image--loaded");

  if (img.complete && img.naturalWidth > 0) {
    img.classList.add("sl-fade-in-image--loaded");
    return;
  }

  function handleSettled() {
    img.classList.add("sl-fade-in-image--loaded");
    img.removeEventListener("load", handleSettled);
    img.removeEventListener("error", handleSettled);
  }
  img.addEventListener("load", handleSettled, { once: true });
  img.addEventListener("error", handleSettled, { once: true });
}
