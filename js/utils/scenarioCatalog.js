/**
 * scenarioCatalog.js
 * -----------------------------------------------------------------------
 * Catalogo "aree → scenari" derivato da data/modules.json. Unica fonte di
 * verità su QUALI aree/scenari la piattaforma espone e con quale rotta:
 * la Sidebar (sottomenu a fisarmonica "Scenari", appShell.js) e la Home (card per area,
 * homePageController.js) lo consumano entrambe — estratto al SECONDO
 * consumo reale (stesso principio già seguito per focusTrap.js,
 * dateFormat.js, svg.js, mediaViewerLauncher.js). Senza questa utility la
 * regola "quali aree sono visibili" vivrebbe in due punti, e un'area
 * potrebbe comparire nella Home ma non nella Sidebar (o viceversa).
 *
 * Funzioni pure, nessuna dipendenza dal DOM né dalla rete: ricevono il
 * contenuto già caricato (l'array "modules" restituito da
 * localJsonRepository.js) e restituiscono strutture nuove — mai
 * mutazioni dell'input.
 *
 * Regola di visibilità (invariata rispetto a quella che appShell.js
 * applicava da solo prima di questa estrazione): un modulo è un'AREA solo
 * se "available" è true E ha un array "scenarios". Un modulo che non
 * soddisfa entrambe le condizioni (per esempio un'area annunciata ma non
 * ancora pronta) può stare in modules.json senza comparire né in Sidebar
 * né in Home.
 *
 * Campi aggiuntivi di modules.json, tutti OPZIONALI (additivi: nessun
 * consumer esistente ne dipende):
 *   - "description": testo breve dell'area, mostrato nella card della Home.
 *   - "icon": percorso (relativo, .svg) dell'icona dell'area in assets/.
 * Le descrizioni dei singoli scenari NON sono nel catalogo di proposito:
 * quelle di scenario.json spiegano la lezione (es. cosa rivela il
 * Keylogger) e mostrarle in una pagina che resta proiettata in aula
 * anticiperebbe il "colpo di scena" degli scenari immersivi.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]+/gu;

/**
 * @typedef {{ id: string, title: string, route: string, available: boolean }} CatalogScenario
 * @typedef {{ id: string, title: string, description: string, icon: string, scenarios: CatalogScenario[] }} CatalogArea
 */

/**
 * @param {Array<object>} modules contenuto di data/modules.json
 * @returns {CatalogArea[]} aree visibili, nell'ordine del file
 */
export function buildScenarioCatalog(modules) {
  return modules
    .filter((moduleRecord) => moduleRecord.available && Array.isArray(moduleRecord.scenarios))
    .map((moduleRecord) => ({
      id: moduleRecord.id,
      title: moduleRecord.title,
      description: moduleRecord.description || "",
      icon: moduleRecord.icon || "",
      scenarios: moduleRecord.scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        route: `#/scenario/${scenario.id}`,
        available: Boolean(scenario.available),
      })),
    }));
}

// Forma di confronto per la ricerca: senza accenti, minuscola e senza
// spazi/punteggiatura — così "wifi", "wi-fi" e "Wi Fi" sono la stessa
// cosa per chi digita al volo davanti alla classe. \p{L}/\p{N} (non
// [a-z0-9]) per non scartare lettere di alfabeti diversi dal latino se
// un giorno un titolo ne usasse.
function toSearchForm(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NOT_LETTER_OR_DIGIT, "");
}

/**
 * Filtra il catalogo per nome di area o di scenario e restituisce, per
 * ogni area che "contiene" la corrispondenza, gli scenari da mostrare:
 *   - il testo corrisponde al TITOLO DELL'AREA → l'area compare con tutti
 *     i suoi scenari;
 *   - corrisponde solo a UNO O PIÙ SCENARI → l'area compare (è lei che
 *     "contiene" lo scenario cercato) con i soli scenari corrispondenti;
 *   - nessuna corrispondenza → l'area non compare.
 * Una ricerca vuota (o fatta di sola punteggiatura) non filtra nulla.
 *
 * @param {CatalogArea[]} catalog
 * @param {string} query testo digitato nella barra di ricerca
 * @returns {Array<{ area: CatalogArea, scenarios: CatalogScenario[] }>}
 */
export function filterScenarioCatalog(catalog, query) {
  const needle = toSearchForm(query);
  if (!needle) return catalog.map((area) => ({ area, scenarios: area.scenarios }));

  const results = [];
  catalog.forEach((area) => {
    if (toSearchForm(area.title).includes(needle)) {
      results.push({ area, scenarios: area.scenarios });
      return;
    }
    const matching = area.scenarios.filter((scenario) => toSearchForm(scenario.title).includes(needle));
    if (matching.length > 0) results.push({ area, scenarios: matching });
  });
  return results;
}
