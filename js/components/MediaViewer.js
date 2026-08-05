/**
 * MediaViewer.js
 * -----------------------------------------------------------------------
 * Visualizzatore immersivo di contenuti multimediali (Fase 7, Prompt #7
 * — "apertura post, zoom immagini, navigazione fluida, microinterazioni,
 * caricamento immagini ottimizzato"). Componente pianificato in Fase 1
 * §4 e esplicitamente differito per YAGNI ("MediaViewer" — progettato a
 * ridosso della fase che lo richiede), costruito in Fase 7 perché
 * `sl:post-open` aveva finalmente un consumer reale (emesso da PostCard,
 * Fase 2, e da Timeline, Fase 6, con lo stesso `detail: { postId }`).
 *
 * GENERALIZZAZIONE (post Fase 10): la prop principale è stata rinominata
 * da "posts" a "items" — il componente non ha MAI letto `.stats` e ha
 * sempre trattato un elemento privo di immagine come testo centrato
 * (vedi "AMBITO DI NAVIGAZIONE" sotto): era già un visualizzatore
 * generico "di fatto", solo con un nome legato al suo primo consumer.
 * Oggi un secondo consumer reale (il feed della Home, non solo lo
 * scenario Oversharing) e un terzo tipo di contenuto (foto profilo,
 * copertina, storie in evidenza — non "post" in senso proprio) rendono
 * il nome "items" più onesto rispetto al contratto effettivo. Zero
 * cambi di comportamento: qualunque oggetto con la forma minima
 * `{ id, image?: {src, alt}, content?, author?, timestamp? }` funziona
 * esattamente come prima. La risoluzione "da un id a un item" resta,
 * come già deciso in Fase 7, responsabilità del chiamante (oggi tramite
 * js/utils/mediaViewerLauncher.js, che estrae la stessa identica logica
 * che profileTimelineRenderer.js già gestiva "a mano") — MediaViewer non
 * cerca mai nulla da solo, riceve sempre l'intero array + un indice.
 *
 * AMBITO DI NAVIGAZIONE — l'intero set di "items", non solo quelli con
 * immagine: un item di solo testo (es. post-004 di Oversharing) mostra
 * il proprio contenuto grande e centrato nello stage, esattamente come
 * Timeline tratta lo stesso caso con un riquadro di fallback testuale —
 * nessuna eccezione introdotta qui.
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
 * ZOOM — click sull'immagine ne alterna lo stato (scale 1× ↔ 1.8×).
 * PAN/DRAG (nuovo): da zoomato, trascinare con il puntatore (mouse,
 * touch o pen — Pointer Events, un solo set di listener per tutti)
 * sposta l'immagine all'interno dello stage, "limitato" (clamp) così da
 * non mostrare mai spazio vuoto oltre i bordi dell'immagine scalata —
 * stesso comportamento di Google Foto/Instagram. Il limite di pan viene
 * calcolato UNA VOLTA all'attivazione dello zoom (quando la scala è
 * ancora 1×, prima di applicare la trasformazione — leggere le
 * dimensioni "naturali" renderizzate DOPO aver già scalato darebbe un
 * numero già scalato, sbagliato per il calcolo), non ricalcolato durante
 * il drag: nessun consumer reale ridimensiona la finestra a zoom aperto
 * (stesso principio YAGNI già applicato da ProfileMenu per il proprio
 * mancato reposizionamento su resize).
 *
 * Click vs drag: un semplice click (nessun movimento oltre una soglia
 * minima) continua ad alternare lo zoom; un trascinamento reale (oltre
 * la soglia) NON lo alterna al rilascio — altrimenti ogni pan
 * chiuderebbe lo zoom appena rilasciato il puntatore (il "click" nativo
 * scatta comunque dopo un pointerup, indipendentemente da quanto ci si
 * è mossi nel frattempo).
 *
 * Cursore: "zoom-in" a riposo, "grab" da zoomato-non-in-trascinamento,
 * "grabbing" durante il trascinamento — comunica l'affordance corretta
 * in ogni stato senza bisogno di testo aggiuntivo.
 *
 * Nessun gesto di pinch-to-zoom multi-touch (solo click/tap + drag a
 * singolo puntatore): il caso d'uso primario resta il docente con
 * mouse/trackpad che proietta su una LIM, non un utente touch-first —
 * introdurlo ora sarebbe complessità senza un bisogno reale (YAGNI).
 * Nessun tasto freccia per il pan: ArrowLeft/ArrowRight sono già
 * riservati alla navigazione prev/next tra gli item (vedi sotto) — lo
 * stesso compromesso esiste in app reali come Google Foto.
 *
 * Il pan si azzera SEMPRE insieme allo zoom quando si passa a un item
 * diverso o quando si esce dallo zoom (evita disorientamento: ogni
 * nuovo item, o un nuovo ingresso in zoom, riparte dalla vista naturale
 * centrata).
 *
 * NAVIGAZIONE — bottoni prev/next (disabilitati ai due estremi, nessun
 * wraparound: un visualizzatore reale si ferma a inizio/fine) + tasti
 * ArrowLeft/ArrowRight con lo stesso identico effetto, catturati sullo
 * stesso listener "keydown" di document già usato per Escape/Tab (stesso
 * pattern già seguito da Modal). Annuncio invisibile (aria-live) ad ogni
 * cambio item, stesso principio già seguito da Feed.js per il proprio
 * annuncio di caricamento.
 *
 * CARICAMENTO IMMAGINI — nessuna infrastruttura di precaricamento
 * dedicata: la stessa "src" è già stata caricata dalla superficie
 * sottostante (Feed/Timeline/StoriesBar/header di profilo) PRIMA che
 * l'utente potesse cliccarci sopra (l'item era già visibile come card/
 * miniatura/avatar) — la cache HTTP del browser risolve la richiesta
 * senza round-trip in ogni caso reale. Il Loader (Fase 2) qui è solo una
 * rete di sicurezza per il caso limite (cache assente/scaduta), non
 * un'infrastruttura di precaricamento da costruire.
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
 *   - items       {Array<object>} richiesto — ogni elemento ha la stessa
 *     forma minima già usata da PostCard/Feed (id, author?, timestamp?,
 *     content?, image?, stats? — "stats" non viene mai letto qui). Un
 *     item senza "image" mostra "content" come testo centrato. Si
 *     assume non vuoto: il chiamante lo costruisce sempre a partire da
 *     un elemento realmente cliccato, mai da un set vuoto.
 *   - startIndex  {number}       default: 0 — indice iniziale in "items"
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
import { svgNode } from "../utils/svg.js";

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

function hasImage(item) {
  return Boolean(item && item.image && item.image.src);
}

const ZOOM_SCALE = 1.8;
// Sotto questa soglia (in px) un rilascio del puntatore è considerato
// un click (alterna lo zoom), non un trascinamento (pan) — senza questa
// soglia il minimo tremolio della mano durante un tentativo di click
// verrebbe interpretato come un pan, perdendo il click.
const DRAG_THRESHOLD = 6;

function clampPan(value, max) {
  if (max <= 0) return 0;
  return Math.min(max, Math.max(-max, value));
}

export function create(props = {}) {
  let items = [...(Array.isArray(props.items) ? props.items : [])];
  const previouslyFocused = document.activeElement;
  const childComponents = [];

  const state = {
    index: Math.min(Math.max(props.startIndex || 0, 0), Math.max(items.length - 1, 0)),
    zoomed: false,
    pan: { x: 0, y: 0 },
  };
  let panBounds = { x: 0, y: 0 };
  let drag = null; // stato del trascinamento IN CORSO (null se nessun drag attivo)
  let suppressNextClick = false; // true se il pointerup precedente proveniva da un drag reale

  // --- struttura statica (identica per ogni item) --------------------
  const closeButton = createButton({ variant: "icon", ariaLabel: "Chiudi", icon: buildCloseIcon() });
  closeButton.element.classList.add("sl-media-viewer__close");
  childComponents.push(closeButton);

  const prevButton = createButton({
    variant: "icon",
    ariaLabel: "Precedente",
    icon: buildChevronIcon("prev"),
  });
  prevButton.element.classList.add("sl-media-viewer__nav", "sl-media-viewer__nav--prev");
  childComponents.push(prevButton);

  const nextButton = createButton({
    variant: "icon",
    ariaLabel: "Successivo",
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
        "aria-label": "Visualizzatore multimediale",
        tabindex: "-1",
      },
    },
    [closeButton.element, prevButton.element, nextButton.element, stage, footer, status]
  );

  const overlay = createElement("div", { classNames: "sl-media-viewer-overlay" }, [panel]);

  // --- rendering dell'item corrente ------------------------------------
  let zoomButton = null; // ricreato ad ogni renderStage() insieme all'immagine
  let currentImage = null; // stessa vita di zoomButton: il nodo <img> effettivamente trascinato/scalato

  function renderStage() {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    zoomButton = null;
    currentImage = null;

    const item = items[state.index];
    if (!item) return;

    if (hasImage(item)) {
      // draggable:"false" + user-drag:none (media-viewer.css) evitano il
      // drag-and-drop nativo del browser (che sposterebbe l'immagine
      // fuori dalla pagina, non dentro lo stage) — il nostro drag è
      // interamente gestito via Pointer Events, sotto.
      const img = createElement("img", {
        classNames: "sl-media-viewer__image",
        attrs: { src: item.image.src, alt: item.image.alt || "", draggable: "false" },
      });
      currentImage = img;

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
      zoomButton.addEventListener("click", handleZoomTriggerClick);
      // Pointer Events (non mouse+touch separati): un solo set di
      // listener copre mouse, touch e pen — stesso principio "un solo
      // meccanismo per più input" già scelto altrove nel progetto
      // quando possibile (qui semplifica molto rispetto a duplicare
      // mousedown/touchstart).
      img.addEventListener("pointerdown", handlePointerDown);
      img.addEventListener("pointermove", handlePointerMove);
      img.addEventListener("pointerup", handlePointerUp);
      img.addEventListener("pointercancel", handlePointerUp);
      stage.appendChild(zoomButton);
    } else {
      stage.appendChild(
        createElement("p", { classNames: "sl-media-viewer__text-content", text: item.content || "" })
      );
    }

    stage.classList.toggle("sl-media-viewer__stage--zoomed", state.zoomed);
    applyImageTransform();
  }

  function renderFooter() {
    const item = items[state.index];
    if (!item) return;

    avatar.update({ src: item.author?.avatarSrc, name: item.author?.name });
    authorName.textContent = item.author?.name || "";
    timestamp.textContent = item.timestamp || "";

    // Didascalia mostrata SOLO per gli item con immagine: per un item di
    // solo testo il contenuto è già il protagonista dello stage, non va
    // duplicato anche qui sotto.
    const showCaption = hasImage(item) && Boolean(item.content);
    caption.textContent = showCaption ? item.content : "";
    caption.hidden = !showCaption;

    position.textContent = `${state.index + 1} di ${items.length}`;
  }

  function renderNavState() {
    prevButton.update({ disabled: state.index <= 0 });
    nextButton.update({ disabled: state.index >= items.length - 1 });
  }

  function announce() {
    const item = items[state.index];
    const kind = hasImage(item) ? "Foto" : "Contenuto";
    status.textContent = `${kind} ${state.index + 1} di ${items.length}`;
  }

  // Applica lo stato corrente (zoomed + pan) come transform inline
  // sull'immagine — sia il click-toggle sia il drag passano SEMPRE da
  // qui, unica fonte di verità per il transform visivo. La transizione
  // CSS su "transform" (già definita in media-viewer.css) anima
  // automaticamente i cambi innescati dal click; durante un drag reale
  // viene invece disattivata qui sotto (handlePointerDown) perché il
  // pan deve seguire il puntatore senza ritardo percepibile.
  function applyImageTransform() {
    if (!currentImage) return;
    currentImage.style.transform = state.zoomed
      ? `translate(${state.pan.x}px, ${state.pan.y}px) scale(${ZOOM_SCALE})`
      : "";
  }

  // Calcolato SOLO nel momento in cui lo zoom si attiva (la scala è
  // ancora 1×, quindi getBoundingClientRect() restituisce la dimensione
  // "naturale" già vincolata da max-width/max-height/object-fit) — non
  // durante il drag, dove leggere di nuovo il rect darebbe un valore già
  // scalato e sbagliato per il calcolo del limite.
  function computePanBounds() {
    if (!currentImage) return { x: 0, y: 0 };
    const rect = currentImage.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      x: Math.max(0, (rect.width * ZOOM_SCALE - stageRect.width) / 2),
      y: Math.max(0, (rect.height * ZOOM_SCALE - stageRect.height) / 2),
    };
  }

  function toggleZoom() {
    state.zoomed = !state.zoomed;
    state.pan = { x: 0, y: 0 }; // ogni ingresso/uscita dallo zoom riparte centrato
    panBounds = state.zoomed ? computePanBounds() : { x: 0, y: 0 };
    applyImageTransform();
    stage.classList.toggle("sl-media-viewer__stage--zoomed", state.zoomed);
    if (zoomButton) {
      zoomButton.classList.toggle("sl-media-viewer__zoom-trigger--zoomed", state.zoomed);
      zoomButton.setAttribute("aria-label", state.zoomed ? "Riduci immagine" : "Ingrandisci immagine");
    }
  }

  // Un click "vero" (nessun trascinamento oltre la soglia) alterna lo
  // zoom, esattamente come prima dell'introduzione del pan. Un click che
  // SEGUE un drag reale viene ignorato: il browser dispatcha comunque un
  // evento "click" dopo il pointerup indipendentemente da quanto ci si
  // è mossi nel frattempo, e senza questa guardia ogni pan chiuderebbe
  // lo zoom appena rilasciato il puntatore.
  function handleZoomTriggerClick() {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    toggleZoom();
  }

  function handlePointerDown(event) {
    // Il pan ha senso solo da zoomato; a riposo il click gestisce
    // già l'ingresso in zoom (handleZoomTriggerClick).
    if (!state.zoomed || !currentImage) return;
    // Esclude i tasti secondari del mouse (destro/centrale): button è
    // 0 per il tasto primario, -1/undefined per touch e pen.
    if (typeof event.button === "number" && event.button !== 0) return;

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: state.pan.x,
      baseY: state.pan.y,
      moved: false,
    };
    // Pointer capture: gli eventi successivi (move/up) raggiungono
    // sempre questo stesso <img>, anche se il puntatore esce
    // visivamente dall'area (ritagliata da overflow:hidden sullo
    // stage) — il drag non si "perde" mai a metà.
    currentImage.setPointerCapture(event.pointerId);
    // Transizione disattivata SOLO per la durata del drag: il pan deve
    // seguire il puntatore 1:1, senza il ritardo dell'easing usato per
    // il click-toggle (ripristinata in handlePointerUp).
    currentImage.style.transition = "none";
    if (zoomButton) zoomButton.classList.add("sl-media-viewer__zoom-trigger--dragging");
  }

  function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true;
    }
    state.pan = {
      x: clampPan(drag.baseX + dx, panBounds.x),
      y: clampPan(drag.baseY + dy, panBounds.y),
    };
    applyImageTransform();
  }

  function handlePointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (currentImage) currentImage.style.transition = "";
    if (zoomButton) zoomButton.classList.remove("sl-media-viewer__zoom-trigger--dragging");
    suppressNextClick = drag.moved;
    drag = null;
  }

  function goTo(nextIndex) {
    if (nextIndex < 0 || nextIndex >= items.length || nextIndex === state.index) return;
    state.index = nextIndex;
    state.zoomed = false; // ogni nuovo item riparte alla vista naturale
    state.pan = { x: 0, y: 0 };
    drag = null; // difensivo: interrompe un eventuale drag in corso sull'item precedente
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

  // BUG TROVATO in Fase 7 (Playwright): a differenza di Modal, qui il
  // pannello riempie l'intero overlay (necessario per ancorare i
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

  // update({ items }) copia il nuovo array (mai l'array del chiamante
  // per riferimento — stessa cautela già seguita da list() in
  // localJsonRepository.js): nessun consumer reale lo richiede oggi
  // (il dataset di una galleria è fisso), presente per uniformità
  // d'interfaccia e per non bloccare un futuro bisogno reale.
  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    if (nextProps.items !== undefined) {
      items = [...nextProps.items];
      state.index = Math.min(state.index, Math.max(items.length - 1, 0));
      renderStage();
      renderFooter();
      renderNavState();
    }
  }

  return { element: overlay, update, destroy };
}
