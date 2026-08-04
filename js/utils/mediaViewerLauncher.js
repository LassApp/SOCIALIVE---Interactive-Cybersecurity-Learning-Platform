/**
 * mediaViewerLauncher.js
 * -----------------------------------------------------------------------
 * Helper condiviso per aprire/chiudere MediaViewer da qualunque page
 * controller o renderer di scenario. Estratto al SECONDO consumo reale:
 * profileTimelineRenderer.js gestiva già "a mano" un'istanza di
 * MediaViewer (Fase 7); homePageController.js, in questo stesso
 * intervento, ha bisogno esattamente della stessa identica logica per
 * aprire il post del feed della Home (Mario Bianchi) — stesso principio
 * "si estrae quando un secondo consumo reale lo richiede" già seguito
 * per focusTrap.js (Fase 2), dateFormat.js (Fase 6), svg.js/
 * fallbackMessage.js (Fase 9), imageFadeIn.js (Fase 9/10).
 *
 * Possiede l'istanza SINGOLA di MediaViewer (mai due visualizzatori
 * aperti insieme — stesso limite già noto e accettato da Modal, Fase 2):
 * aprirne un secondo distrugge silenziosamente il primo invece di
 * lasciarlo orfano sopra la pagina.
 *
 * "destroy()" copre lo stesso caso limite già gestito a mano in
 * profileTimelineRenderer.js fin da Fase 7: se il consumer che possiede
 * questo launcher viene smontato mentre il visualizzatore è ancora
 * aperto (navigazione via router non passata dalla chiusura naturale
 * del visualizzatore), va chiuso esplicitamente — altrimenti resterebbe
 * orfano sopra la pagina successiva.
 *
 * "openById" è la forma di utilizzo più comune: un evento "sl:post-open"
 * porta solo un id, il chiamante ha già l'intero array in scope
 * (feedPosts, in Home come in Oversharing) e non deve fare un secondo
 * fetch — stesso principio "mai un secondo fetch" già stabilito da
 * profileTimelineRenderer.js. Nessuna azione se l'id non è presente
 * nell'array (difensivo, stesso criterio di tolleranza già seguito da
 * scenarioEngine.js per un id disallineato).
 *
 * GENERICO PER COSTRUZIONE: "items" non è vincolato alla forma di un
 * post — vale per qualunque galleria di elementi che MediaViewer sappia
 * già visualizzare (post, foto profilo, copertina, storie in evidenza,
 * o qualunque cosa un futuro scenario introduca). Questo file non
 * conosce da dove arrivano gli "items", si limita a orchestrarne
 * l'apertura/chiusura — nessuna dipendenza da PostCard, Feed, Timeline o
 * StoriesBar.
 *
 * Interfaccia: createMediaViewerLauncher() → { open, openById, destroy }
 */

import { create as createMediaViewer } from "../components/MediaViewer.js";

export function createMediaViewerLauncher() {
  let mediaViewer = null;

  /**
   * Apre il visualizzatore su un set di elementi. Se uno è già aperto,
   * lo chiude prima (nessuno stacking).
   * @param {Array<object>} items
   * @param {number} [startIndex]
   */
  function open(items, startIndex = 0) {
    if (!Array.isArray(items) || items.length === 0) return;
    if (mediaViewer) mediaViewer.destroy();
    mediaViewer = createMediaViewer({ items, startIndex });
    mediaViewer.element.addEventListener("sl:media-viewer-close", () => {
      mediaViewer = null;
    });
  }

  /**
   * Risolve l'indice a partire da un id e apre il visualizzatore.
   * @param {Array<object>} items
   * @param {string} id
   */
  function openById(items, id) {
    const index = (items || []).findIndex((item) => item.id === id);
    if (index === -1) return;
    open(items, index);
  }

  /**
   * Chiude forzatamente il visualizzatore se aperto — da chiamare nel
   * destroy() del consumer, per il caso limite di navigazione mentre il
   * visualizzatore è ancora aperto.
   */
  function destroy() {
    if (mediaViewer) mediaViewer.destroy();
    mediaViewer = null;
  }

  return { open, openById, destroy };
}
