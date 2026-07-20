/**
 * profileTimelineRenderer.js
 * -----------------------------------------------------------------------
 * Renderer PLACEHOLDER per gli scenari di tipo "profile-timeline"
 * (Fase 5). Registrato nel motore (scenarioEngine.registerRenderer) per
 * evitare che Oversharing mostri il generico messaggio "in preparazione"
 * dell'engine (Fase 5/Step 2) — un primo impatto dedicato, anche se
 * placeholder, è più credibile per il docente che verifica il
 * collegamento Home → scenario rispetto a un paragrafo grezzo indistinto
 * da qualunque altro tipo non ancora implementato.
 *
 * DA RISCRIVERE PER INTERO in Fase 6 (non da estendere incrementalmente):
 * quando arriveranno StoriesBar/Timeline/profilo realistico, questo file
 * verrà sostituito integralmente — stesso trattamento già riservato a
 * homePageController.js in Fase 3 ("placeholder dichiarato", non un
 * abbozzo di lavoro di design reale).
 *
 * Contenuto derivato ESCLUSIVAMENTE da scenario.json (title/description):
 * nessun dato hardcoded qui specifico di "Oversharing" — un futuro
 * secondo scenario con lo stesso type "profile-timeline" (es. "Privacy",
 * Fase 1 §12) userebbe questo stesso renderer senza alcuna modifica,
 * mostrando il PROPRIO title/description.
 *
 * Firma richiesta dall'engine (Fase 5/Step 2):
 * (container, scenario) => destroy|undefined. Nessun destroy restituito:
 * il contenuto è markup statico, senza listener/side-effect da pulire.
 *
 * CSS: css/layouts/scenario-page.css (le classi
 * .sl-scenario-page__placeholder-* sono di competenza di QUESTO
 * renderer e verranno rimosse insieme ad esso in Fase 6).
 */

function buildPlaceholder(scenario) {
  const wrapper = document.createElement("div");
  wrapper.className = "sl-scenario-page__placeholder";

  const title = document.createElement("h1");
  title.className = "sl-scenario-page__placeholder-title";
  title.textContent = scenario.title || "Scenario";
  wrapper.appendChild(title);

  if (scenario.description) {
    const description = document.createElement("p");
    description.className = "sl-scenario-page__placeholder-description";
    description.textContent = scenario.description;
    wrapper.appendChild(description);
  }

  const notice = document.createElement("p");
  notice.className = "sl-scenario-page__placeholder-notice";
  notice.textContent =
    "Questo scenario è in fase di sviluppo. Il profilo realistico e la timeline saranno disponibili nella prossima fase.";
  wrapper.appendChild(notice);

  return wrapper;
}

export function renderProfileTimeline(container, scenario) {
  container.appendChild(buildPlaceholder(scenario));
  return undefined;
}
