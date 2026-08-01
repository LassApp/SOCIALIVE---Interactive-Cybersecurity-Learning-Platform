import { createElement } from "../utils/dom.js";
import { create as createCard } from "./Card.js";
import { create as createAvatar } from "./Avatar.js";
import { create as createButton } from "./Button.js";
import { svgNode } from "../utils/svg.js";
import { applyImageFadeIn } from "../utils/imageFadeIn.js";

function formatCount(value) {
  return (Number(value) || 0).toLocaleString("it-IT");
}

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
    // Fase 9/#11 (implementato realmente in Fase 10): applyImageFadeIn è
    // idempotente sulla stessa src — un update() richiamato solo per il
    // contatore "mi piace" (vedi handleLikeClick) non fa ripartire il
    // fade-in di un'immagine già caricata (cfr. rationale in
    // js/utils/imageFadeIn.js).
    applyImageFadeIn(refs.mediaImg);
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
  // loading="lazy" (Fase 9): statico per l'intera vita del componente
  // (non cambia mai a runtime, quindi impostato qui in creazione, non in
  // render() ad ogni update) — stesso attributo già usato da Timeline.js
  // per le proprie anteprime (Fase 6), qui esteso al Feed reale (Home e
  // Oversharing), l'unico consumer che ne era ancora privo. Il browser
  // decide autonomamente quando l'immagine è "vicina" al viewport
  // (margine simile, concettualmente, al rootMargin già usato da Feed.js
  // per il proprio IntersectionObserver): nessuna nuova logica da
  // scrivere qui, solo l'attributo nativo.
  const mediaImg = createElement("img", {
    classNames: "sl-post-card__media-image",
    attrs: { loading: "lazy" },
  });
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
