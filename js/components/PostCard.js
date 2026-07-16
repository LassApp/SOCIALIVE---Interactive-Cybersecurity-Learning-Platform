/**
 * PostCard.js
 * -----------------------------------------------------------------------
 * Visualizza un post del feed (piano dei componenti, Fase 1 §4). NON
 * duplica Card: lo compone come contenitore base (header + corpo +
 * azioni passati come "content"), esattamente come già anticipato dal
 * commento in cima a Card.js ("PostCard lo comporrà come base, non lo
 * duplicherà").
 *
 * ICONE (like/commenta/condividi): nessuno sprite SVG esiste ancora
 * (assets/icons/icons.svg, YAGNI già applicato a Input/Modal/Sidebar).
 * Costruite qui inline, stesso identico pattern già usato da
 * Modal.buildCloseIcon(): quando lo sprite esisterà, sostituire con
 * <use href="#icon-...">, il markup esterno (Button, variante ghost)
 * resta identico — zero impatto sui consumer.
 *
 * STATO "MI PIACE" — PIENAMENTE CONTROLLATO, non locale:
 * il bottone like NON muta il proprio aspetto al click (a differenza di
 * ThemeSwitch, l'unica eccezione già prevista dal piano che chiama
 * direttamente un service). Non esiste ancora un likeService/repository
 * (arriverà con Fase 8, dati esterni): introdurre qui uno stato "di
 * business" violerebbe la regola dei componenti "dumb" (architettura
 * Fase 1 §2.1 — "ricevono dati come parametri e comunicano verso
 * l'esterno solo tramite eventi"). Al click viene emesso solo l'INTENTO
 * ("sl:post-like" col valore invertito); l'aspetto cambia solo quando
 * il consumer richiama update({ post: { ...con liked aggiornato } }),
 * esattamente come già Button non gestisce da sé lo stato "disabled"
 * dopo un click.
 *
 * COLORE STATO "LIKED": --sl-color-error-text, non --sl-color-error-500.
 * Il colore qui tinge anche la label visibile del bottone (il contatore
 * numerico, testo vero — non solo l'icona), quindi la soglia applicabile
 * è 4.5:1 (testo), non 3:1 (icona/decorativo) — la stessa distinzione
 * fill-vs-testo già alla base del bug primary-600 documentato in
 * theme-dark.css. error-text è già verificato ESATTAMENTE su bg-surface
 * (8.17:1 Light / 8.55:1 Dark — numeri già presenti in input.css):
 * nessuna nuova verifica necessaria, è lo stesso token sullo stesso
 * sfondo, non un nuovo accostamento. Lo stato non è affidato al solo
 * colore (§5.7 architettura Fase 1): l'icona cambia FORMA (contorno →
 * piena) e aria-pressed riflette lo stato per gli screen reader.
 *
 * APERTURA POST ("sl:post-open"): scatta SOLO cliccando l'eventuale
 * immagine, non l'intera card né il testo. Il testo resta selezionabile
 * (renderlo "cliccabile per aprire" comprometterebbe la selezione,
 * pattern comune nei social reali); un post senza immagine non ha oggi
 * nulla da "aprire" (Media Viewer è Fase 7) — comportamento rimandato,
 * non uno scope creep introdotto ora.
 *
 * IMMAGINE FULL-BLEED: l'immagine del post "sfonda" il padding laterale
 * della card (margine negativo pari a --sl-space-5 in post-card.css, lo
 * stesso valore del padding di .sl-card) per apparire a piena larghezza
 * come nei social reali, pur restando distanziata da header/azioni (mai
 * a contatto con gli angoli arrotondati della card, nessun overflow da
 * gestire). Accoppiamento noto: se in futuro il padding di Card
 * cambiasse, il valore in post-card.css andrebbe aggiornato di
 * conseguenza (annotato anche lì).
 *
 * Contatori (mi piace/commenti/condivisioni): formattati con
 * Number.prototype.toLocaleString("it-IT") — corretto raggruppamento
 * delle migliaia senza introdurre una libreria o una logica di
 * abbreviazione ("1,2k") non richiesta ora (YAGNI: aggiungerla in
 * futuro non cambierebbe l'interfaccia pubblica del componente).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - post {{
 *       id: string,
 *       author?: { name?: string, avatarSrc?: string },
 *       timestamp?: string   (stringa già formattata dal chiamante —
 *         PostCard non calcola tempi relativi, stessa regola già
 *         seguita da Card/Input: i dati arrivano pronti, non grezzi),
 *       content?: string,    (testo del post, opzionale)
 *       image?: { src: string, alt: string },
 *       stats?: { likes?: number, comments?: number, shares?: number },
 *       liked?: boolean
 *     }}
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:post-open     detail: { postId }  (click sull'immagine)
 *   - sl:post-like     detail: { postId, liked }  (liked = valore INTENTO, non applicato)
 *   - sl:post-comment  detail: { postId }
 *   - sl:post-share    detail: { postId }
 */

import { createElement } from "../utils/dom.js";
import { create as createCard } from "./Card.js";
import { create as createAvatar } from "./Avatar.js";
import { create as createButton } from "./Button.js";

function formatCount(value) {
  return (Number(value) || 0).toLocaleString("it-IT");
}

function svgNode(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

// Cuore: contorno (non "mi piace") oppure pieno (mi piace) — la FORMA
// cambia, non solo il colore (§5.7 architettura Fase 1: mai il solo colore
// come unico segnale di stato).
function buildHeartIcon(filled) {
  const svg = svgNode("svg", { viewBox: "0 0 24 24" });
  const path = svgNode("path", {
    d: "M12 21s-6.716-4.35-9.428-8.485C.665 9.72 1.4 6.5 4.2 5.1c2.2-1.1 4.8-.3 6.3 1.6.4.5 1.1.5 1.5 0 1.5-1.9 4.1-2.7 6.3-1.6 2.8 1.4 3.535 4.62 1.628 7.415C18.716 16.65 12 21 12 21z",
  });
  if (filled) {
    path.setAttribute("fill", "currentColor");
  } else {
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
  }
  svg.appendChild(path);
  return svg;
}

// Fumetto di commento: rettangolo arrotondato (corpo) + piccola coda,
// costruito con primitive SVG invece di un unico path complesso — più
// semplice da mantenere leggibile qui nel codice.
function buildCommentIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("rect", { x: "3", y: "4", width: "18", height: "12", rx: "3", stroke: "currentColor", "stroke-width": "1.5" })
  );
  svg.appendChild(
    svgNode("path", {
      d: "M8 16v3.5L12 16",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    })
  );
  return svg;
}

// Condividi: tre nodi collegati da due segmenti (icona "condividi"
// convenzionale, riconoscibile senza ambiguità).
function buildShareIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(svgNode("circle", { cx: "18", cy: "5", r: "2.5", fill: "currentColor" }));
  svg.appendChild(svgNode("circle", { cx: "6", cy: "12", r: "2.5", fill: "currentColor" }));
  svg.appendChild(svgNode("circle", { cx: "18", cy: "19", r: "2.5", fill: "currentColor" }));
  svg.appendChild(svgNode("line", { x1: "8.2", y1: "10.6", x2: "15.8", y2: "6.4", stroke: "currentColor", "stroke-width": "1.5" }));
  svg.appendChild(svgNode("line", { x1: "8.2", y1: "13.4", x2: "15.8", y2: "17.6", stroke: "currentColor", "stroke-width": "1.5" }));
  return svg;
}

function render(refs, props) {
  const post = props.post || {};
  const author = post.author || {};
  const stats = post.stats || {};
  const likes = stats.likes || 0;
  const comments = stats.comments || 0;
  const shares = stats.shares || 0;
  const liked = Boolean(post.liked);
  const authorName = author.name || "Utente";

  refs.avatar.update({ src: author.avatarSrc, name: author.name });
  refs.authorEl.textContent = authorName;
  refs.timestampEl.textContent = post.timestamp || "";

  refs.contentEl.textContent = post.content || "";
  refs.contentEl.hidden = !post.content;

  const hasImage = Boolean(post.image && post.image.src);
  refs.mediaButton.hidden = !hasImage;
  if (hasImage) {
    refs.mediaImg.src = post.image.src;
    refs.mediaImg.alt = post.image.alt || "";
    refs.mediaButton.setAttribute("aria-label", `Apri immagine del post di ${authorName}`);
  }

  refs.likeButton.update({
    label: formatCount(likes),
    icon: buildHeartIcon(liked),
    pressed: liked,
    ariaLabel: `${liked ? "Rimuovi \u00abMi piace\u00bb" : "Metti \u00abMi piace\u00bb"} — ${formatCount(likes)} Mi piace`,
  });
  refs.likeButton.element.classList.toggle("sl-post-card__action--liked", liked);

  refs.commentButton.update({
    label: formatCount(comments),
    ariaLabel: `Commenta il post — ${formatCount(comments)} commenti`,
  });

  refs.shareButton.update({
    label: formatCount(shares),
    ariaLabel: `Condividi il post — ${formatCount(shares)} condivisioni`,
  });

  refs.card.element.setAttribute(
    "aria-label",
    `Post di ${authorName}${post.timestamp ? `, pubblicato ${post.timestamp}` : ""}`
  );
}

export function create(props = {}) {
  const avatar = createAvatar({ size: "md", ariaHidden: true });
  const authorEl = createElement("span", { classNames: "sl-post-card__author" });
  const timestampEl = createElement("span", { classNames: "sl-post-card__timestamp" });
  const header = createElement("div", { classNames: "sl-post-card__header" }, [
    avatar.element,
    createElement("div", { classNames: "sl-post-card__header-text" }, [authorEl, timestampEl]),
  ]);

  const contentEl = createElement("p", { classNames: "sl-post-card__content" });
  const mediaImg = createElement("img", { classNames: "sl-post-card__media-image" });
  const mediaButton = createElement("button", { classNames: "sl-post-card__media", attrs: { type: "button" } }, [
    mediaImg,
  ]);
  const body = createElement("div", { classNames: "sl-post-card__body" }, [contentEl, mediaButton]);

  const likeButton = createButton({ variant: "ghost", icon: buildHeartIcon(false) });
  likeButton.element.classList.add("sl-post-card__action", "sl-post-card__action--like");

  const commentButton = createButton({ variant: "ghost", icon: buildCommentIcon() });
  commentButton.element.classList.add("sl-post-card__action");

  const shareButton = createButton({ variant: "ghost", icon: buildShareIcon() });
  shareButton.element.classList.add("sl-post-card__action");

  const actions = createElement("div", { classNames: "sl-post-card__actions" }, [
    likeButton.element,
    commentButton.element,
    shareButton.element,
  ]);

  const card = createCard({ content: [header, body, actions] });
  card.element.classList.add("sl-post-card");
  card.element.setAttribute("role", "article");

  const refs = { card, avatar, authorEl, timestampEl, contentEl, mediaButton, mediaImg, likeButton, commentButton, shareButton };
  render(refs, props);
  if (props.post?.id) card.element.dataset.postId = props.post.id;

  function currentPostId() {
    return (props.post || {}).id;
  }

  function handleMediaClick() {
    card.element.dispatchEvent(
      new CustomEvent("sl:post-open", { bubbles: true, detail: { postId: currentPostId() } })
    );
  }

  function handleLikeClick() {
    const nextLiked = !(props.post || {}).liked;
    card.element.dispatchEvent(
      new CustomEvent("sl:post-like", { bubbles: true, detail: { postId: currentPostId(), liked: nextLiked } })
    );
  }

  function handleCommentClick() {
    card.element.dispatchEvent(
      new CustomEvent("sl:post-comment", { bubbles: true, detail: { postId: currentPostId() } })
    );
  }

  function handleShareClick() {
    card.element.dispatchEvent(
      new CustomEvent("sl:post-share", { bubbles: true, detail: { postId: currentPostId() } })
    );
  }

  mediaButton.addEventListener("click", handleMediaClick);
  likeButton.element.addEventListener("sl:click", handleLikeClick);
  commentButton.element.addEventListener("sl:click", handleCommentClick);
  shareButton.element.addEventListener("sl:click", handleShareClick);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    render(refs, props);
    if (props.post?.id) card.element.dataset.postId = props.post.id;
  }

  function destroy() {
    mediaButton.removeEventListener("click", handleMediaClick);
    likeButton.element.removeEventListener("sl:click", handleLikeClick);
    commentButton.element.removeEventListener("sl:click", handleCommentClick);
    shareButton.element.removeEventListener("sl:click", handleShareClick);
    avatar.destroy();
    likeButton.destroy();
    commentButton.destroy();
    shareButton.destroy();
    card.destroy();
  }

  return { element: card.element, update, destroy };
}
