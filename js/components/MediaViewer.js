/**
 * MediaViewer.js
 * -----------------------------------------------------------------------
 * Visualizzatore immersivo di post (Fase 7, Prompt #7 — "apertura post,
 * zoom immagini, navigazione fluida, microinterazioni, caricamento
 * immagini ottimizzato"). Componente pianificato in Fase 1 §4 e
 * esplicitamente differito per YAGNI ("MediaViewer" — progettato a
 * ridosso della fase che lo richiede), ora costruito perché
 * `sl:post-open` ha finalmente un consumer reale (emesso da PostCard,
 * Fase 2, e da Timeline, Fase 6, con lo stesso `detail: { postId }`).
 *
 * RISOLUZIONE DEL POST DAL SOLO postId — decisione presa PRIMA di questo
 * file, non dentro di esso: MediaViewer non riceve mai un "postId" da
 * cercare. Il chiamante (profileTimelineRenderer.js, prossimo step) ha
 * già in scope l'intero array di post risolti (autore + data formattata,
 * niente secondo fetch) e traduce l'evento "sl:post-open" in
 * `{ posts, startIndex }` prima di chiamare create() — stesso principio
 * "dumb" già seguito ovunque (i componenti ricevono dati, non li
 * cercano). Nessuna modifica a PostCard.js/Timeline.js: entrambi
 * continuano a emettere lo stesso evento generico di sempre.
 *
 * AMBITO DI NAVIGAZIONE — l'intero set di post, non solo quelli con
 * immagine: il Prompt #7 dice "apertura POST", non "apertura immagine".
 * Un post di solo testo (es. post-004 di Oversharing) mostra il proprio
 * contenuto grande e centrato nello stage, esattamente come Timeline
 * tratta lo stesso caso con un riquadro di fallback testuale — nessuna
 * eccezione introdotta qui.
 *
 * NON è una variante di Modal, pur riusandone la logica di focus trap
 * (js/utils/focusTrap.js, già condivisa con ProfileMenu): sono due
 * FUNZIONI diverse — Modal è un dialogo centrato su una superficie
 * chiara/dello stesso tema della pagina; MediaViewer è un visualizzatore
 * a schermo intero con sfondo scuro FISSO indipendente dal tema (vedi
 * sotto) — stesso principio già motivato per ProfileMenu (funzione
 * diversa da Modal, non una sua variante, pur condividendo focusTrap).
 *
 * SFONDO FISSO SCURO, non --sl-color-bg-*: un visualizzatore di foto
 * immersivo è per convenzione sempre scuro, in Light come in Dark
 * (Instagram/Facebook/X si comportano così) — --sl-color-media-backdrop
 * e i token correlati sono stati aggiunti a theme-light.css/
 * theme-dark.css con valori IDENTICI nei due file (stesso principio già
 * seguito da --sl-color-text-inverse), verificati numericamente prima di
 * scrivere questo file (script Python, luminanza relativa WCAG):
 * gray-50 su gray-950 → 17.64:1 (testo/icone, token text-inverse già
 * esistente, nessun nuovo colore per il testo); primary-300 su gray-950
 * → 7.90:1 (nuovo --sl-color-media-focus-ring, forzato in ENTRAMBI i temi
 * — il focus ring che Light userebbe altrimenti, primary-600, rende solo
 * 3.06:1 sullo stesso sfondo: margine troppo sottile per un fondo fisso).
 *
 * NESSUN secondo colore "attenuato" per la gerarchia testuale (nome
 * autore vs orario vs didascalia vs indicatore posizione): tutti usano
 * --sl-color-text-inverse (già verificato, 17.64:1). La gerarchia visiva
 * viene da dimensione/peso tipografico, non da un secondo colore
 * translucido introdotto ad hoc e non verificato numericamente — scelta
 * deliberata, non una semplificazione dimenticata.
 *
 * ZOOM — click/Invio sull'immagine ne alterna lo stato (scale 1× ↔ 1.8×,
 * cursore zoom-in/zoom-out). Nessun pan/drag: for a v1 sarebbe
 * complessità (gestione puntatore, inerzia) senza un bisogno reale oggi
 * (dataset con immagini singole, non gallerie a scorrimento interno) —
 * annotato come possibile estensione futura, non introdotto ora (YAGNI).
 * Lo zoom si azzera SEMPRE quando si passa a un post diverso (evita
 * disorientamento: ogni nuovo post riparte alla vista naturale).
 *
 * NAVIGAZIONE — bottoni prev/next (disabilitati ai due estremi, nessun
 * wraparound: un visualizzatore reale si ferma a inizio/fine) + tasti
 * ArrowLeft/ArrowRight con lo stesso identico effetto, catturati sullo
 * stesso listener "keydown" di document già usato per Escape/Tab (stesso
 * pattern già seguito da Modal). Annuncio invisibile (aria-live) ad ogni
 * cambio post, stesso principio già seguito da Feed.js per il proprio
 * annuncio di caricamento.
 *
 * CARICAMENTO IMMAGINI — nessuna infrastruttura di precaricamento
 * dedicata: la stessa "src" è già stata caricata dal Feed/Timeline
 * sottostante PRIMA che l'utente potesse cliccarci sopra (il post era
 * già visibile come card/miniatura) — la cache HTTP del browser risolve
 * la richiesta senza round-trip in ogni caso reale. Il Loader (Fase 2)
 * qui è solo una rete di sicurezza per il caso limite (cache assente/
 * scaduta), non un'infrastruttura di precaricamento da costruire.
 *
 * A differenza di Modal, create() qui equivale ad "apri il
 * visualizzatore": monta l'overlay in <body>, sposta e intrappola il
 * focus, disabilita lo scroll della pagina sottostante — stesso pattern
 * già stabilito da Modal, con lo stesso limite noto e accettato (nessuno
 * stacking: non previsto apparire sopra un altro overlay).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - posts       {Array<post>}  richiesto — stessa forma del prop
 *     "post" di PostCard/Feed (id, author, timestamp, content, image,
 *     stats). Si assume non vuoto: il chiamante lo costruisce sempre a
 *     partire da un post realmente cliccato, mai da un set vuoto.
 *   - startIndex  {number}       default: 0 — indice iniziale in "posts"
 *   - closeOnOverlayClick {boolean} default: true
 *   - closeOnEsc          {boolean} default: true
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:media-viewer-close  detail: { reason: "escape"|"overlay"|"close-button" }
 */

import { createElement } from "../utils/dom.js";
import { getFocusableElements, trapTabKey } from "../utils/focusTrap.js";
import { create as createButton } from "./Button.js";
import { create as createAvatar } from "./Avatar.js";
import { create as createLoader } from "./Loader.js";

function svgNode(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

// Icona × — stesso identico pattern già usato da Modal.buildCloseIcon():
// nessuno sprite SVG esiste ancora (debito tecnico noto da Fase 2).
function buildCloseIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("path", {
      d: "M6 6L18 18M18 6L6 18",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
    })
  );
  return svg;
}

function buildChevronIcon(direction) {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  const d = direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  svg.appendChild(
    svgNode("path", {
      d,
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

function hasImage(post) {
  return Boolean(post && post.image && post.image.src);
}

export function create(props = {}) {
  let posts = [...(Array.isArray(props.posts) ? props.posts : [])];
  const previouslyFocused = document.activeElement;
  const childComponents = [];

  const state = {
    index: Math.min(Math.max(props.startIndex || 0, 0), Math.max(posts.length - 1, 0)),
    zoomed: false,
  };

  // --- struttura statica (identica per ogni post) --------------------
  const closeButton = createButton({ variant: "icon", ariaLabel: "Chiudi", icon: buildCloseIcon() });
  closeButton.element.classList.add("sl-media-viewer__close");
  childComponents.push(closeButton);

  const prevButton = createButton({
    variant: "icon",
    ariaLabel: "Post precedente",
    icon: buildChevronIcon("prev"),
  });
  prevButton.element.classList.add("sl-media-viewer__nav", "sl-media-viewer__nav--prev");
  childComponents.push(prevButton);

  const nextButton = createButton({
    variant: "icon",
    ariaLabel: "Post successivo",
    icon: buildChevronIcon("next"),
  });
  nextButton.element.classList.add("sl-media-viewer__nav", "sl-media-viewer__nav--next");
  childComponents.push(nextButton);

  const stage = createElement("div", { classNames: "sl-media-viewer__stage" });

  const avatar = createAvatar({ size: "sm", ariaHidden: true });
  childComponents.push(avatar);
  const authorName = createElement("span", { classNames: "sl-media-viewer__author-name" });
  const timestamp = createElement("span", { classNames: "sl-media-viewer__timestamp" });
  const authorBlock = createElement("div", { classNames: "sl-media-viewer__author" }, [
    avatar.element,
    createElement("div", { classNames: "sl-media-viewer__author-text" }, [authorName, timestamp]),
  ]);

  const caption = createElement("p", { classNames: "sl-media-viewer__caption" });
  const position = createElement("p", { classNames: "sl-media-viewer__position" });

  const footer = createElement("div", { classNames: "sl-media-viewer__footer" }, [
    authorBlock,
    caption,
    position,
  ]);

  // Annuncio invisibile ad ogni navigazione — stesso principio già
  // seguito da Feed.js per il proprio stato di caricamento.
  const status = createElement("p", {
    classNames: "sl-visually-hidden",
    attrs: { role: "status", "aria-live": "polite" },
  });

  const panel = createElement(
    "div",
    {
      classNames: "sl-media-viewer",
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Visualizzatore post",
        tabindex: "-1",
      },
    },
    [closeButton.element, prevButton.element, nextButton.element, stage, footer, status]
  );

  const overlay = createElement("div", { classNames: "sl-media-viewer-overlay" }, [panel]);

  // --- rendering del post corrente ------------------------------------
  let zoomButton = null; // ricreato ad ogni renderStage() insieme all'immagine

  function renderStage() {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    zoomButton = null;

    const post = posts[state.index];
    if (!post) return;

    if (hasImage(post)) {
      const img = createElement("img", {
        classNames: "sl-media-viewer__image",
        attrs: { src: post.image.src, alt: post.image.alt || "" },
      });

      const loader = createLoader({ size: "md" });
      loader.element.classList.add("sl-media-viewer__loader");
      stage.appendChild(loader.element);
      img.addEventListener("load", () => loader.element.remove(), { once: true });
      img.addEventListener("error", () => loader.element.remove(), { once: true });

      zoomButton = createElement(
        "button",
        {
          classNames: "sl-media-viewer__zoom-trigger",
          attrs: { type: "button", "aria-label": "Ingrandisci immagine" },
        },
        [img]
      );
      zoomButton.addEventListener("click", toggleZoom);
      stage.appendChild(zoomButton);
    } else {
      stage.appendChild(
        createElement("p", { classNames: "sl-media-viewer__text-content", text: post.content || "" })
      );
    }

    stage.classList.toggle("sl-media-viewer__stage--zoomed", state.zoomed);
  }

  function renderFooter() {
    const post = posts[state.index];
    if (!post) return;

    avatar.update({ src: post.author?.avatarSrc, name: post.author?.name });
    authorName.textContent = post.author?.name || "";
    timestamp.textContent = post.timestamp || "";

    // Didascalia mostrata SOLO per i post con immagine: per un post di
    // solo testo il contenuto è già il protagonista dello stage, non va
    // duplicato anche qui sotto.
    const showCaption = hasImage(post) && Boolean(post.content);
    caption.textContent = showCaption ? post.content : "";
    caption.hidden = !showCaption;

    position.textContent = `${state.index + 1} di ${posts.length}`;
  }

  function renderNavState() {
    prevButton.update({ disabled: state.index <= 0 });
    nextButton.update({ disabled: state.index >= posts.length - 1 });
  }

  function announce() {
    const post = posts[state.index];
    const kind = hasImage(post) ? "Foto" : "Post";
    status.textContent = `${kind} ${state.index + 1} di ${posts.length}`;
  }

  function toggleZoom() {
    state.zoomed = !state.zoomed;
    stage.classList.toggle("sl-media-viewer__stage--zoomed", state.zoomed);
    if (zoomButton) {
      zoomButton.setAttribute("aria-label", state.zoomed ? "Riduci immagine" : "Ingrandisci immagine");
    }
  }

  function goTo(nextIndex) {
    if (nextIndex < 0 || nextIndex >= posts.length || nextIndex === state.index) return;
    state.index = nextIndex;
    state.zoomed = false; // ogni nuovo post riparte alla vista naturale
    renderStage();
    renderFooter();
    renderNavState();
    announce();
  }

  function goPrev() {
    goTo(state.index - 1);
  }
  function goNext() {
    goTo(state.index + 1);
  }

  renderStage();
  renderFooter();
  renderNavState();

  // --- apertura: monta, blocca lo scroll, sposta il focus -------------
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  const initialFocusTarget = getFocusableElements(panel)[0] || panel;
  initialFocusTarget.focus();

  // BUG TROVATO in questo step (Playwright): a differenza di Modal, qui
  // il pannello riempie l'intero overlay (necessario per ancorare i
  // controlli position:absolute a schermo intero) — un click sullo
  // sfondo ha quindi come target il PANNELLO, non l'overlay (che non ha
  // mai area propria esposta). "Click fuori per chiudere" deve perciò
  // controllare anche il pannello stesso, non solo l'overlay: il click è
  // "fuori" quando non cade su nessuno dei figli con contenuto (stage,
  // footer, bottoni) — cioè quando il target è overlay o panel stessi.
  function handleOverlayClick(event) {
    if (props.closeOnOverlayClick === false) return;
    if (event.target === overlay || event.target === panel) close("overlay");
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (props.closeOnEsc !== false) close("escape");
      return;
    }
    if (event.key === "ArrowLeft") {
      goPrev();
      return;
    }
    if (event.key === "ArrowRight") {
      goNext();
      return;
    }
    if (event.key === "Tab") {
      trapTabKey(event, panel);
    }
  }

  function handleCloseClick() {
    close("close-button");
  }

  overlay.addEventListener("click", handleOverlayClick);
  closeButton.element.addEventListener("sl:click", handleCloseClick);
  prevButton.element.addEventListener("sl:click", goPrev);
  nextButton.element.addEventListener("sl:click", goNext);
  document.addEventListener("keydown", handleKeydown);

  function close(reason) {
    overlay.dispatchEvent(new CustomEvent("sl:media-viewer-close", { bubbles: true, detail: { reason } }));
    destroy();
  }

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    document.body.style.overflow = "";
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
    overlay.removeEventListener("click", handleOverlayClick);
    closeButton.element.removeEventListener("sl:click", handleCloseClick);
    prevButton.element.removeEventListener("sl:click", goPrev);
    nextButton.element.removeEventListener("sl:click", goNext);
    document.removeEventListener("keydown", handleKeydown);
    childComponents.forEach((c) => c.destroy());
    overlay.remove();
  }

  // update({ posts }) copia il nuovo array (mai l'array del chiamante
  // per riferimento — stessa cautela già seguita da list() in
  // localJsonRepository.js): nessun consumer reale lo richiede oggi
  // (il dataset di uno scenario è fisso), presente per uniformità
  // d'interfaccia e per non bloccare un futuro bisogno reale.
  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    if (nextProps.posts !== undefined) {
      posts = [...nextProps.posts];
      state.index = Math.min(state.index, Math.max(posts.length - 1, 0));
      renderStage();
      renderFooter();
      renderNavState();
    }
  }

  return { element: overlay, update, destroy };
}
