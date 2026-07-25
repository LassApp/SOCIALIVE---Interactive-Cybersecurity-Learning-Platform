/**
 * fallbackMessage.js
 * -----------------------------------------------------------------------
 * Costruttore condiviso di un messaggio di fallback/errore minimale (un
 * singolo <p> con padding + colore secondario + dimensione md). Estratto
 * in Fase 9 perché la stessa identica logica viveva duplicata in tre
 * file (router.js → "Pagina non trovata"; scenarioEngine.js → "in
 * preparazione"/"impossibile caricare questo scenario";
 * profileTimelineRenderer.js → "dati del profilo non disponibili") —
 * stesso principio DRY già seguito per focusTrap.js (Fase 2) e
 * dateFormat.js (Fase 6): si estrae quando la duplicazione è reale e
 * accertata, non per anticipazione.
 *
 * BUG REALE CORRETTO in questo stesso step (non solo debito DRY): le tre
 * copie non erano nemmeno identiche tra loro — router.js impostava solo
 * "padding", mentre le altre due impostavano anche "color"/"font-size".
 * Il messaggio "Pagina non trovata." rendeva quindi con colore e
 * dimensione di DEFAULT (eredità di global.css su <body>, non il
 * trattamento "soft" secondario) invece dello stile usato ovunque altrove
 * per gli stati non felici — un'incoerenza visiva reale tra tre superfici
 * che dovrebbero comunicare lo stesso concetto ("qui non c'è nulla da
 * mostrare"). Centralizzare la costruzione in un unico punto rende
 * impossibile la ricomparsa di questa divergenza in futuro: un quarto
 * consumer che dimenticasse "color"/"font-size" oggi non potrebbe più
 * accadere, perché non c'è più nulla da "dimenticare" — chiama solo la
 * funzione.
 *
 * Resta intenzionalmente un singolo <p> con stile INLINE (nessuna nuova
 * classe/file CSS introdotta): motivazione invariata rispetto a quella
 * già documentata in scenarioEngine.js (Fase 5) — questi sono stati
 * transitori/di errore minimali, non un componente del Design System con
 * una propria identità visiva da mantenere nel tempo. Introdurre ora un
 * file CSS dedicato sarebbe un secondo intervento (spostare la
 * presentazione dal JS al CSS), distinto da QUESTO intervento (eliminare
 * la duplicazione) — se in futuro un quarto consumer richiedesse una
 * variante visiva reale, sarà quello il momento di valutarlo.
 *
 * Nessun parametro di "tono" (errore vs informativo): tutti i consumer
 * attuali vogliono lo stesso identico trattamento visivo indipendentemente
 * dalla natura del messaggio (lo stato "in preparazione" di
 * scenarioEngine non è più "grave" visivamente di un vero errore di
 * fetch) — introdurre un parametro oggi sarebbe un'opzione senza un
 * consumer reale che la richieda (YAGNI).
 *
 * @param {string} text
 * @returns {HTMLParagraphElement}
 */
export function buildFallbackMessage(text) {
  const message = document.createElement("p");
  message.textContent = text;
  message.style.padding = "var(--sl-space-8)";
  message.style.color = "var(--sl-color-text-secondary)";
  message.style.fontSize = "var(--sl-font-size-md)";
  return message;
}
