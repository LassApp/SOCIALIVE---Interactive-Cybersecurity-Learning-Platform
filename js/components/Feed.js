/**
 * Feed.js
 * -----------------------------------------------------------------------
 * Orchestrazione di una lista di PostCard con lazy-load "infinito"
 * (piano dei componenti, Fase 1 §4). Feed non conosce il contenuto dei
 * post: crea e aggiorna istanze di PostCard a partire dai dati ricevuti
 * (composizione, non duplicazione — stesso principio già seguito da
 * PostCard verso Card).
 *
 * EVENTO invece di "onLoadMore": il piano originario di Fase 1 elencava
 * "onLoadMore" come prop-callback, ma OGNI componente costruito finora
 * (Sidebar, PostCard, AppHeader, Modal...) comunica esclusivamente
 * tramite CustomEvent "sl:nome-evento", mai callback prop. Qui si applica
 * la stessa convenzione ormai consolidata (coerenza del vocabolario di
 * eventi, §3 naming): "sl:feed-load-more" invece di "onLoadMore". Gli
 * eventi di ogni PostCard (sl:post-open, sl:post-like, ecc.) NON vengono
 * ri-emessi da Feed: bollono naturalmente fino a qualunque listener
 * piazzato su Feed o più in alto nell'albero DOM (bubbles:true è già
 * impostato da PostCard) — zero codice aggiuntivo necessario qui.
 *
 * LAZY-LOAD: un elemento "sentinella" invisibile viene osservato con
 * IntersectionObserver; quando entra nel viewport (con un rootMargin di
 * anticipo, per un caricamento percepito come fluido) e non è già in
 * corso un caricamento (isLoading) e ce n'è ancora (hasMore !== false),
 * Feed emette "sl:feed-load-more". Il consumer risponde richiamando
 * update({ isLoading: true }) mentre recupera altri dati, poi
 * update({ posts: [...esistenti, ...nuovi], isLoading: false }) al
 * termine — Feed non conosce la sorgente dei dati (JSON locale oggi,
 * Supabase domani), stesso principio "dumb" già seguito ovunque.
 *
 * "scrollContainer": root dell'IntersectionObserver, default null (=
 * viewport del browser) — corretto per l'app reale, dove il feed scorre
 * con la pagina. Nella style guide, dove il feed vive dentro un riquadro
 * con altezza fissa e scroll proprio (stesso pattern già usato per la
 * demo "sticky" di AppHeader), si passa quel riquadro come
 * "scrollContainer" — altrimenti l'observer, guardando il viewport
 * dell'intera pagina di QA, non si accorgerebbe mai dello scroll interno
 * al riquadro.
 *
 * SKELETON DI CARICAMENTO: Feed compone alcune istanze di Skeleton in una
 * forma che ricorda un post (avatar tondo + due righe header + blocco
 * corpo, dentro una Card riusata). NON esiste un componente dedicato
 * "SkeletonPostCard": Skeleton resta generico (forme primitive
 * riutilizzabili altrove), è Feed a possedere la conoscenza di "che
 * aspetto ha un post" — stesso principio già seguito da PostCard per il
 * proprio layout full-bleed (la conoscenza del layout di un post vive
 * nel componente/contesto che lo consuma, non nel primitivo sottostante).
 *
 * ARIA — perché NON "role=feed": la ARIA Authoring Practices associa al
 * ruolo "feed" un preciso contratto di interazione da tastiera
 * (paginazione con Pagina Giù/Su tra gli articoli, focus programmatico
 * su ciascuno) che qui non viene implementato — l'unico utilizzatore
 * reale è il docente, che naviga col mouse durante una proiezione: non
 * vale la pena costruire ora la gestione del focus "roving" richiesta dal
 * ruolo. Usare "feed" senza il comportamento che promette sarebbe PEGGIO
 * per un utente di tecnologie assistive che nessun ruolo affatto (falsa
 * aspettativa data dal ruolo). Si usa quindi una <ul> reale (semantica di
 * lista nativa, già supportata ovunque, zero ARIA da mantenere) +
 * aria-busy sul contenitore + una regione aria-live="polite" nascosta
 * solo visivamente per annunciare inizio/fine caricamento.
 *
 * EMPTY STATE non gestito qui: un feed vuoto (posts:[] e isLoading:false)
 * oggi renderizza semplicemente una lista vuota. Un vero messaggio
 * "nessun post" richiede il componente EmptyState (pianificato in Fase 1
 * §4, non ancora costruito) — rimandato a quando un consumer reale (Fase
 * 4, Home) ne avrà bisogno, invece di introdurlo ora solo per Feed
 * (stesso criterio YAGNI già seguito altrove nel progetto).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - posts {Array<post>}  stessa forma del prop "post" di PostCard
 *   - isLoading {boolean}  default: false
 *   - hasMore   {boolean}  default: true — a false, Feed smette di
 *     emettere "sl:feed-load-more" (l'observer resta collegato ma il
 *     controllo su hasMore, valutato ad ogni intersezione, blocca
 *     l'emissione: non serve riconnettere/disconnettere l'observer per
 *     la correttezza, solo per igiene se in futuro servisse ottimizzare)
 *   - scrollContainer {HTMLElement} opzionale, root dell'IntersectionObserver
 *     (default: null, cioè il viewport del browser)
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:feed-load-more  detail: {}
 */

import { createElement } from "../utils/dom.js";
import { create as createPostCard } from "./PostCard.js";
import { create as createCard } from "./Card.js";
import { create as createSkeleton } from "./Skeleton.js";

const SKELETON_ITEMS = 2;
const OBSERVER_ROOT_MARGIN = "200px";

// Un "finto post": stessa composizione visiva di un PostCard reale
// (avatar + due righe header + un blocco), costruita con le primitive
// generiche di Skeleton e la Card riusata — vedi rationale in testa al
// file sul perché non esiste un componente "SkeletonPostCard" dedicato.
function buildSkeletonPost() {
  const avatarBone = createSkeleton({ shape: "circle", size: "md" });
  const lineWide = createSkeleton({ shape: "text", width: "45%" });
  const lineNarrow = createSkeleton({ shape: "text", width: "25%" });
  const bodyBone = createSkeleton({ shape: "block" });

  const headerText = createElement("div", { classNames: "sl-feed__skeleton-header-text" }, [
    lineWide.element,
    lineNarrow.element,
  ]);
  const header = createElement("div", { classNames: "sl-feed__skeleton-header" }, [
    avatarBone.element,
    headerText,
  ]);

  const card = createCard({ content: [header, bodyBone.element] });
  card.element.classList.add("sl-feed__skeleton-card");

  const item = createElement(
    "li",
    { classNames: ["sl-feed__item", "sl-feed__item--skeleton"], attrs: { "aria-hidden": "true" } },
    [card.element]
  );

  const childInstances = [avatarBone, lineWide, lineNarrow, bodyBone, card];

  return {
    element: item,
    destroy() {
      childInstances.forEach((instance) => instance.destroy());
      item.remove();
    },
  };
}

export function create(props = {}) {
  const postInstances = new Map(); // postId -> istanza PostCard (+ riferimento al proprio <li>)
  let skeletonInstances = [];
  let observer = null;
  let previousPostCount = 0;
  let isFirstRender = true;

  const list = createElement("ul", { classNames: "sl-feed__list" });
  const sentinel = createElement("div", { classNames: "sl-feed__sentinel", attrs: { "aria-hidden": "true" } });
  // Regione di stato nascosta solo visivamente (.sl-visually-hidden, già
  // definita in css/base/global.css): comunica a chi usa uno screen
  // reader l'inizio/fine del caricamento, dato che Feed non usa
  // role="feed" (vedi rationale sopra) e i placeholder di Skeleton sono
  // aria-hidden.
  const status = createElement("p", {
    classNames: "sl-visually-hidden",
    attrs: { role: "status", "aria-live": "polite" },
  });

  const element = createElement("div", { classNames: "sl-feed" }, [status, list, sentinel]);

  function clearSkeletons() {
    skeletonInstances.forEach((instance) => instance.destroy());
    skeletonInstances = [];
  }

  function renderSkeletons(show) {
    clearSkeletons();
    if (!show) return;
    for (let i = 0; i < SKELETON_ITEMS; i += 1) {
      const skeletonItem = buildSkeletonPost();
      skeletonInstances.push(skeletonItem);
      list.appendChild(skeletonItem.element);
    }
  }

  // Riconciliazione per id: le istanze esistenti vengono SOLO aggiornate
  // (update), mai distrutte/ricreate — appendChild su un nodo già
  // presente nel DOM lo sposta, non lo ricrea, quindi riordinare tutto
  // ad ogni chiamata resta economico anche quando l'ordine non cambia
  // (il caso più comune: solo append in coda, tipico dell'infinite
  // scroll). La rimozione (post non più presente in "posts") è comunque
  // necessaria per la correttezza generale del componente, anche se il
  // caso d'uso principale è "solo aggiunta".
  function reconcile(posts) {
    const nextIds = new Set(posts.map((post) => post.id));

    postInstances.forEach((instance, id) => {
      if (!nextIds.has(id)) {
        instance.listItem.remove();
        instance.destroy();
        postInstances.delete(id);
      }
    });

    posts.forEach((post) => {
      let instance = postInstances.get(post.id);
      if (!instance) {
        instance = createPostCard({ post });
        instance.listItem = createElement("li", { classNames: "sl-feed__item" }, [instance.element]);
        postInstances.set(post.id, instance);
      } else {
        instance.update({ post });
      }
      list.appendChild(instance.listItem);
    });
  }

  function updateStatusMessage(isLoading, newlyAdded) {
    if (isLoading) {
      status.textContent = "Caricamento di altri post…";
    } else if (newlyAdded > 0) {
      status.textContent = `${newlyAdded} nuovi post caricati`;
    }
  }

  function applyState(currentProps) {
    const posts = currentProps.posts || [];
    const isLoading = Boolean(currentProps.isLoading);

    reconcile(posts);
    renderSkeletons(isLoading);
    element.setAttribute("aria-busy", String(isLoading));

    const newlyAdded = Math.max(0, posts.length - previousPostCount);
    if (!isFirstRender) {
      updateStatusMessage(isLoading, newlyAdded);
    }
    previousPostCount = posts.length;
    isFirstRender = false;
  }

  function setupObserver(scrollContainer) {
    if (observer) observer.disconnect();
    // Fallback silenzioso su browser molto datati privi di
    // IntersectionObserver: nessun lazy-load automatico, nessun crash —
    // il consumer può comunque emettere manualmente sl:feed-load-more
    // da un proprio bottone "Carica altro" se necessario (fuori scope
    // qui, ma l'evento pubblico resta lo stesso).
    if (!("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        if (props.isLoading) return;
        if (props.hasMore === false) return;
        element.dispatchEvent(new CustomEvent("sl:feed-load-more", { bubbles: true, detail: {} }));
      },
      { root: scrollContainer || null, rootMargin: OBSERVER_ROOT_MARGIN }
    );
    observer.observe(sentinel);
  }

  applyState(props);
  setupObserver(props.scrollContainer);

  function update(nextProps = {}) {
    const containerChanged =
      "scrollContainer" in nextProps && nextProps.scrollContainer !== props.scrollContainer;
    props = { ...props, ...nextProps };
    applyState(props);
    if (containerChanged) setupObserver(props.scrollContainer);
  }

  function destroy() {
    if (observer) observer.disconnect();
    postInstances.forEach((instance) => {
      instance.listItem.remove();
      instance.destroy();
    });
    postInstances.clear();
    clearSkeletons();
    element.remove();
  }

  return { element, update, destroy };
}
