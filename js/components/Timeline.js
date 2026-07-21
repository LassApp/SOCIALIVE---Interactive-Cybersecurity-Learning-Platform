/**
 * Timeline.js
 * -----------------------------------------------------------------------
 * Vista "archivio" dei post di un profilo, raggruppati per mese/anno
 * (piano dei componenti, Fase 1 §4: componente differito per YAGNI, ora
 * richiesto da un consumer reale — il profilo Oversharing, Fase 6).
 *
 * SCOPO DIDATTICO SENZA ALCUN ELEMENTO DIDATTICO VISIBILE (requisito
 * esplicito del Prompt #6, "Nessun elemento didattico visibile"):
 * Timeline non annota, non evidenzia, non etichetta alcun riquadro come
 * "sensibile" — i campi post.sensitive/post.insightNote
 * (data/scenarios/oversharing/posts.json, Fase 6/Step 1) NON vengono
 * letti da questo componente. Timeline è semplicemente una vista
 * cronologica per mese, una funzionalità plausibile in una vera
 * piattaforma (analoga a un "archivio"/griglia dei ricordi): è la
 * narrazione DAL VIVO del docente, scorrendo mese per mese, a rendere
 * visibile il pattern — non un badge messo dal componente.
 *
 * GRIGLIA DI ANTEPRIME QUADRATE, non PostCard: a differenza di Feed
 * (pensato per la lettura di un post alla volta), qui l'obiettivo è la
 * vista d'insieme di un intero anno — esattamente come la vista
 * "griglia" di un vero profilo social, dove si scorre rapidamente la
 * cronologia per miniature. Comporre PostCard qui produrrebbe un muro di
 * card enormi, inadatto a "vedere" un pattern che emerge solo osservando
 * molti post in poco spazio.
 *
 * Ogni riquadro apre il post con lo STESSO evento già emesso da PostCard
 * per l'immagine ("sl:post-open", stesso "detail: { postId }") — non un
 * evento gemello: un futuro Media Viewer (Fase 7) potrà ascoltare un
 * solo nome di evento indipendentemente da dove è stato aperto il post
 * (dal Feed o dalla Timeline).
 *
 * FALLBACK TESTUALE per i post senza immagine (nel dataset Oversharing,
 * un solo caso su dodici — post-004): un riquadro con l'inizio del testo
 * invece di lasciare un buco vuoto nella griglia. Non un componente
 * dedicato (troppo poco riuso per giustificarlo): solo markup locale a
 * questo file, stesso criterio già seguito da Feed per il proprio
 * "finto post" scheletro.
 *
 * Raggruppamento per mese via Intl.DateTimeFormat("it-IT", { month:
 * "long", year: "numeric" }) — API nativa del browser, stesso principio
 * già seguito da PostCard con Number.toLocaleString("it-IT"): zero
 * dipendenze, zero mappa manuale dei nomi dei mesi da mantenere.
 *
 * Ordine cronologico ASCENDENTE (gennaio → dicembre), non il più recente
 * in cima: la lezione si racconta seguendo l'ordine reale in cui i
 * dettagli si sono accumulati nel tempo, non a ritroso dalla fine.
 *
 * <ol>/<li> per la griglia di ciascun mese (non <ul>): l'ordine
 * cronologico dentro il mese è informazione reale, non solo un dettaglio
 * di presentazione — una lista ordinata lo comunica anche a chi naviga
 * con uno screen reader.
 *
 * Ogni mese è un <div> con un <h3>, NON un <section aria-labelledby>: un
 * <section> con nome accessibile diventa un landmark "region" — dodici
 * landmark (uno per mese) affollerebbero la navigazione a landmark senza
 * reale beneficio, quando la navigazione per intestazioni (già garantita
 * dagli <h3>) è sufficiente. Stesso principio già seguito da Feed.js
 * (nessun <section> proprio: la pagina che lo monta decide se e come
 * inquadrarlo in un landmark).
 *
 * Nessun lazy-load/paginazione (a differenza di Feed): il dataset di uno
 * scenario è un insieme fisso e già completo, non un flusso che cresce
 * nel tempo — introdurre IntersectionObserver qui sarebbe complessità
 * senza alcun bisogno reale (YAGNI).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - posts {Array<{ id: string, date: string, content?: string, image?: { src, alt } }>}
 *     stessa forma grezza dei record di posts.json (Fase 6/Step 1): il
 *     campo "date" è ISO (es. "2025-01-18"), non una stringa già
 *     formattata — a differenza di "timestamp" di PostCard, qui la data
 *     grezza è indispensabile per il raggruppamento per mese, quindi non
 *     viene preformattata dal chiamante (quella trasformazione, se serve
 *     altrove, resta competenza del renderer/page controller, non del
 *     dato né di questo componente).
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:post-open  detail: { postId }
 */

import { createElement, clearChildren } from "../utils/dom.js";

const MONTH_FORMATTER = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const TILE_DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Intl.DateTimeFormat restituisce il mese in minuscolo ("gennaio 2025"):
// la maiuscola iniziale è solo un dettaglio tipografico per il titolo di
// sezione, non richiede una libreria — un semplice slice basta.
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
}

/**
 * Raggruppa i post per mese/anno e ordina sia i gruppi (cronologico
 * ascendente) sia i post dentro ciascun gruppo. Date non valide/assenti
 * vengono scartate silenziosamente (difensivo: un dato malformato non
 * deve far crollare l'intera vista, coerente con la tolleranza già
 * mostrata da scenarioEngine.js verso un "id" disallineato).
 */
function groupByMonth(posts) {
  const groups = new Map();

  posts.forEach((post) => {
    const date = new Date(post.date);
    if (Number.isNaN(date.getTime())) return;
    const key = monthKey(date);
    if (!groups.has(key)) groups.set(key, { date, posts: [] });
    groups.get(key).posts.push({ ...post, parsedDate: date });
  });

  return Array.from(groups.values())
    .sort((a, b) => a.date - b.date)
    .map((group) => ({ ...group, posts: group.posts.sort((a, b) => a.parsedDate - b.parsedDate) }));
}

function buildTile(post, onOpen) {
  const isImagePost = Boolean(post.image && post.image.src);
  const dateLabel = TILE_DATE_FORMATTER.format(post.parsedDate);

  const tile = createElement("button", {
    classNames: ["sl-timeline__tile", isImagePost ? "sl-timeline__tile--image" : "sl-timeline__tile--text"],
    attrs: { type: "button", "aria-label": `Apri post del ${dateLabel}` },
  });

  if (isImagePost) {
    // alt="" volutamente: il bottone ha già un nome accessibile tramite
    // aria-label (vedi sopra), l'immagine qui è puramente decorativa —
    // stesso principio già seguito da AppHeader per l'avatar nel trigger
    // del menu profilo (evitare la doppia lettura da screen reader).
    tile.appendChild(
      createElement("img", {
        classNames: "sl-timeline__tile-image",
        attrs: { src: post.image.src, alt: "", loading: "lazy" },
      })
    );
  } else {
    tile.appendChild(
      createElement("span", { classNames: "sl-timeline__tile-text", text: post.content || "" })
    );
  }

  function handleClick() {
    onOpen(post.id);
  }
  tile.addEventListener("click", handleClick);

  const item = createElement("li", { classNames: "sl-timeline__grid-item" }, [tile]);

  return {
    element: item,
    destroy() {
      tile.removeEventListener("click", handleClick);
    },
  };
}

function buildMonthGroup(group, onOpen) {
  const heading = createElement("h3", {
    classNames: "sl-timeline__month-title",
    text: capitalize(MONTH_FORMATTER.format(group.date)),
  });

  const tiles = group.posts.map((post) => buildTile(post, onOpen));

  const grid = createElement(
    "ol",
    { classNames: "sl-timeline__grid" },
    tiles.map((tile) => tile.element)
  );

  const wrapper = createElement("div", { classNames: "sl-timeline__month" }, [heading, grid]);

  return {
    element: wrapper,
    destroy() {
      tiles.forEach((tile) => tile.destroy());
    },
  };
}

export function create(props = {}) {
  const element = createElement("div", { classNames: "sl-timeline" });

  function onOpen(postId) {
    element.dispatchEvent(new CustomEvent("sl:post-open", { bubbles: true, detail: { postId } }));
  }

  let months = [];

  function render(currentProps) {
    months.forEach((month) => month.destroy());
    clearChildren(element);
    const groups = groupByMonth(currentProps.posts || []);
    months = groups.map((group) => buildMonthGroup(group, onOpen));
    months.forEach((month) => element.appendChild(month.element));
  }

  render(props);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    render(props);
  }

  function destroy() {
    months.forEach((month) => month.destroy());
    element.remove();
  }

  return { element, update, destroy };
}
