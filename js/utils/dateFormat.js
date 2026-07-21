/**
 * dateFormat.js
 * -----------------------------------------------------------------------
 * Formattazione di una data in una stringa italiana assoluta e completa
 * (es. "18 gennaio 2025"). Estratta in questo step perché serve IDENTICA
 * una seconda volta: Timeline.js (Fase 6/Step 2, aria-label dei riquadri
 * — dove viveva come costante locale) e profileTimelineRenderer.js
 * (Fase 6/Step 3, campo "timestamp" passato a PostCard) — stesso
 * principio già seguito quando focusTrap.js fu estratto da Modal e
 * riusato da ProfileMenu in Fase 2/Step 5: si estrae quando un SECONDO
 * consumo reale lo richiede, non prima. Timeline.js è stato aggiornato
 * in questo stesso step per importare questa utility al posto della
 * propria costante locale (stesso comportamento, zero duplicazione).
 *
 * Perché una data ASSOLUTA e non relativa ("3 giorni fa"): i post di
 * questo scenario risalgono a mesi (o anni) prima della data corrente —
 * un formato relativo produrrebbe numeri innaturali ("550 giorni fa"),
 * mentre ogni social reale passa a un formato assoluto una volta che un
 * contenuto non è più recente. I post demo della Home (Fase 4) restano
 * invece stringhe "timestamp" già pre-formattate a mano ("3 h fa") nel
 * proprio page controller: un caso diverso (contenuto sempre "recente"
 * per costruzione), non toccato da questa utility.
 */

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * @param {Date} date
 * @returns {string} es. "18 gennaio 2025"
 */
export function formatFullDate(date) {
  return FULL_DATE_FORMATTER.format(date);
}
