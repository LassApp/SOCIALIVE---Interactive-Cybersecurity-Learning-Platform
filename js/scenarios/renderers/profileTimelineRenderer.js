/**
 * profileTimelineRenderer.js
 * -----------------------------------------------------------------------
 * Renderer REALE per gli scenari di tipo "profile-timeline" (Fase 6/Step
 * 3). SOSTITUISCE PER INTERO il placeholder di Fase 5 (non un'estensione
 * — così come il commento storico di quel file annunciava): profilo
 * realistico (copertina, avatar, bio, statistiche), storie in evidenza
 * (StoriesBar, Fase 6/Step 2) e due VISTE sullo stesso dataset di post —
 * Feed (lettura post-per-post, Fase 2) e Archivio (Timeline, Fase 6/Step
 * 2) — commutabili con un toggle. NESSUN elemento didattico visibile
 * (requisito esplicito del Prompt #6): scenario.title/scenario.description
 * (metadati interni, pensati per l'editoria dei contenuti — es. una
 * futura Sidebar/breadcrumb) non vengono MAI renderizzati in questa
 * pagina: un vero profilo social non mostra il "nome della lezione" a
 * cui appartiene.
 *
 * GENERICO RISPETTO ALLO SCENARIO, SPECIFICO RISPETTO AL TYPE: un futuro
 * secondo scenario con lo stesso type "profile-timeline" (es. "Privacy",
 * Fase 1 §12) riuserebbe questo stesso file senza alcuna modifica,
 * mostrando i PROPRI dati (scenario.dataRefs punta a una cartella
 * diversa) — nessun dato hardcoded qui specifico di "Oversharing" o del
 * profilo "marti.travel".
 *
 * FETCH DEI 3 DATASET: profile.json (risorsa singola →
 * createLocalJsonResource), stories.json/posts.json (collezioni →
 * createLocalJsonRepository) — entrambe le fabbriche già esistenti da
 * Fase 3/5, zero modifiche a localJsonRepository.js richieste (previsto
 * fin da Fase 6/Step 1). I tre URL arrivano da scenario.dataRefs, non
 * hardcoded qui: è esattamente ciò che rende questo renderer riusabile
 * da un secondo scenario dello stesso type.
 *
 * BUG TROVATO E CORRETTO in scenarioEngine.js in questo stesso step
 * (non un file nuovo — la correzione minima e retrocompatibile è
 * documentata lì): il placeholder di Fase 5 era sincrono, quindi il
 * problema non si era mai manifestato. Un renderer che deve fare fetch
 * (come questo) è necessariamente asincrono — l'engine non "attendeva"
 * il valore di ritorno del renderer, quindi aria-busy veniva rimosso
 * troppo presto e la funzione destroy() risultante non funzionava
 * (chiudeva su una Promise, non sulla funzione reale).
 *
 * AUTORE UNICO PER TUTTI I POST: in questo tipo di scenario (un solo
 * profilo) l'autore di ogni post è sempre lo stesso — profile.json.
 * posts.json non duplica quindi nome/avatar per ogni singolo record
 * (DRY, decisione già presa in Fase 6/Step 1): la trasformazione "post
 * grezzo + profilo → prop PostCard" è responsabilità di QUESTO
 * renderer (toFeedPost, sotto), non del dato né dei componenti Feed/
 * PostCard, che restano "dumb" e ignari di dove viene l'autore.
 *
 * FEED vs ARCHIVIO — due VISTE sullo stesso posts.json, non due
 * dataset (nessun feed.json separato, Fase 6/Step 1). Toggle con due
 * bottoni "a stato" (Button.pressed, già esteso in Fase 2/Step 6), NON
 * un vero widget ARIA "tablist": costruire la semantica completa di tab
 * (tablist/tab/tabpanel, navigazione a frecce) per due soli pannelli
 * statici sarebbe un contratto di interazione promesso e non
 * implementato — stesso principio già seguito da Feed.js per il proprio
 * "niente role=feed". Entrambe le viste vengono montate SEMPRE (Feed e
 * Timeline create() una sola volta all'apertura della pagina) e
 * nascoste via l'attributo nativo "hidden" quando non attive — nessun
 * CSS ad-hoc necessario: né .sl-feed né .sl-timeline dichiarano un
 * proprio "display" che comprometterebbe lo stile UA di [hidden] (a
 * differenza del caso già corretto in post-card.css per
 * .sl-post-card__media[hidden]). Un annuncio invisibile (aria-live)
 * segnala il cambio vista a chi naviga con uno screen reader — stesso
 * pattern già usato da Feed.js per l'annuncio di caricamento.
 *
 * "sl:post-like": gestito qui con lo stesso pattern già stabilito da
 * homePageController.js (aggiornamento ottimistico locale sull'array di
 * post, poi Feed.update()) — Timeline non mostra contatori, non
 * necessita di alcun aggiornamento quando cambia un "mi piace".
 *
 * "sl:story-open"/"sl:post-open": nessun listener collegato, stesso
 * trattamento già riservato a molti altri eventi in questo progetto
 * (sl:search, sl:settings-click, ecc.) — le destinazioni (Media Viewer,
 * Fase 7) non esistono ancora.
 *
 * ERRORE DI FETCH SUI DATASET SECONDARI: un try/catch dedicato, distinto
 * da quello già presente nell'engine per scenario.json stesso — se
 * profile/stories/posts non fossero raggiungibili, si mostra un
 * messaggio di errore locale a questa pagina, senza costruire
 * un'infrastruttura di gestione errori condivisa per un solo consumer
 * reale (YAGNI, stesso principio già seguito ovunque nel progetto).
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement } from "../../utils/dom.js";
import { formatFullDate } from "../../utils/dateFormat.js";
import { createLocalJsonResource, createLocalJsonRepository } from "../../repositories/localJsonRepository.js";
import { create as createAvatar } from "../../components/Avatar.js";
import { create as createButton } from "../../components/Button.js";
import { create as createStoriesBar } from "../../components/StoriesBar.js";
import { create as createFeed } from "../../components/Feed.js";
import { create as createTimeline } from "../../components/Timeline.js";

function formatCount(value) {
  return (Number(value) || 0).toLocaleString("it-IT");
}

function buildStat(label, value) {
  return createElement("div", { classNames: "sl-profile-timeline__stat" }, [
    createElement("dt", { classNames: "sl-profile-timeline__stat-value", text: formatCount(value) }),
    createElement("dd", { classNames: "sl-profile-timeline__stat-label", text: label }),
  ]);
}

// postsCount NON arriva da profile.json (decisione di Fase 6/Step 1: un
// conteggio derivabile da un'altra fonte non va duplicato) — qui viene
// calcolato da rawPosts.length, l'unica fonte di verità.
function buildProfileHeader(profile, postsCount) {
  const coverImage = createElement("img", {
    classNames: "sl-profile-timeline__cover-image",
    attrs: { src: profile.coverImage || "", alt: "" },
  });
  const cover = createElement("div", { classNames: "sl-profile-timeline__cover" }, [coverImage]);

  // ariaHidden: true — l'username subito sotto è già il nome accessibile
  // di questa identità (stesso principio già seguito da AppHeader/
  // ProfileMenu/PostCard per evitare la doppia lettura da screen reader).
  const avatar = createAvatar({
    src: profile.avatar,
    name: profile.displayName,
    size: "xl",
    ariaHidden: true,
  });
  const avatarWrap = createElement("div", { classNames: "sl-profile-timeline__avatar-wrap" }, [
    avatar.element,
  ]);

  // <h1>: il nome utente è il titolo effettivo di questa pagina — un
  // vero profilo social non mostra mai un secondo titolo "editoriale"
  // sopra (a differenza del vecchio placeholder, che mostrava
  // scenario.title: qui deliberatamente non accade più, vedi rationale
  // in testa al file).
  const username = createElement("h1", {
    classNames: "sl-profile-timeline__username",
    text: profile.displayName || "",
  });

  const bio = createElement("p", { classNames: "sl-profile-timeline__bio", text: profile.bio || "" });

  const stats = createElement("dl", { classNames: "sl-profile-timeline__stats" }, [
    buildStat("post", postsCount),
    buildStat("follower", profile.stats?.followersCount),
    buildStat("seguiti", profile.stats?.followingCount),
  ]);

  const identity = createElement("div", { classNames: "sl-profile-timeline__identity" }, [
    avatarWrap,
    username,
    bio,
    stats,
  ]);

  const element = createElement("header", { classNames: "sl-profile-timeline__header" }, [cover, identity]);

  return {
    element,
    destroy() {
      avatar.destroy();
    },
  };
}

// Trasforma un record grezzo di posts.json in una prop compatibile con
// PostCard: aggiunge l'autore (sempre lo stesso, dal profilo — vedi
// rationale in testa al file) e formatta la data in una stringa assoluta
// leggibile. I campi "sensitive"/"insightNote" NON vengono copiati:
// PostCard non deve mai riceverli, nemmeno come dato ignorato in più —
// nessun elemento didattico visibile, in nessuna forma.
function toFeedPost(rawPost, author) {
  return {
    id: rawPost.id,
    author,
    timestamp: formatFullDate(new Date(rawPost.date)),
    content: rawPost.content,
    image: rawPost.image,
    stats: rawPost.stats,
    liked: rawPost.liked,
  };
}

function buildErrorMessage(text) {
  const message = document.createElement("p");
  message.textContent = text;
  message.style.padding = "var(--sl-space-8)";
  message.style.color = "var(--sl-color-text-secondary)";
  message.style.fontSize = "var(--sl-font-size-md)";
  return message;
}

export async function renderProfileTimeline(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.profile || !refs.stories || !refs.posts) {
    console.error(`[profileTimelineRenderer] "dataRefs" incompleto per lo scenario "${scenario.id}".`);
    container.appendChild(buildErrorMessage("I dati di questo profilo non sono disponibili al momento."));
    return undefined;
  }

  let profile;
  let stories;
  let rawPosts;

  try {
    const profileResource = createLocalJsonResource({ url: refs.profile });
    const storiesRepository = createLocalJsonRepository({ url: refs.stories, collectionKey: "stories" });
    const postsRepository = createLocalJsonRepository({ url: refs.posts, collectionKey: "posts" });

    [profile, stories, rawPosts] = await Promise.all([
      profileResource.get(),
      storiesRepository.list(),
      postsRepository.list(),
    ]);
  } catch (error) {
    console.error(`[profileTimelineRenderer] Impossibile caricare i dati del profilo "${scenario.id}"`, error);
    container.appendChild(buildErrorMessage("I dati di questo profilo non sono disponibili al momento."));
    return undefined;
  }

  const author = { name: profile.displayName, avatarSrc: profile.avatar };
  const feedPosts = rawPosts.map((post) => toFeedPost(post, author));

  const header = buildProfileHeader(profile, rawPosts.length);
  const storiesBar = createStoriesBar({ stories });

  // hasMore:false — il dataset di uno scenario è un insieme fisso e già
  // completo (stesso principio già motivato in Timeline.js): nessuna
  // paginazione reale da simulare qui, a differenza della demo di Feed
  // nello style-guide.
  const feed = createFeed({ posts: feedPosts, isLoading: false, hasMore: false });
  const timeline = createTimeline({ posts: rawPosts });
  timeline.element.hidden = true;

  function handlePostLike(event) {
    const { postId, liked } = event.detail;
    const target = feedPosts.find((post) => post.id === postId);
    if (!target) return;
    target.liked = liked;
    target.stats = { ...target.stats, likes: (target.stats?.likes || 0) + (liked ? 1 : -1) };
    feed.update({ posts: feedPosts });
  }
  feed.element.addEventListener("sl:post-like", handlePostLike);

  const viewStatus = createElement("p", {
    classNames: ["sl-visually-hidden", "sl-profile-timeline__view-status"],
    attrs: { role: "status", "aria-live": "polite" },
  });

  const feedTab = createButton({ variant: "ghost", label: "Post", pressed: true });
  const archiveTab = createButton({ variant: "ghost", label: "Archivio", pressed: false });
  feedTab.element.classList.add("sl-profile-timeline__tab");
  archiveTab.element.classList.add("sl-profile-timeline__tab");

  function showFeed() {
    feed.element.hidden = false;
    timeline.element.hidden = true;
    feedTab.update({ pressed: true });
    archiveTab.update({ pressed: false });
    viewStatus.textContent = "Vista: Post";
  }

  function showArchive() {
    feed.element.hidden = true;
    timeline.element.hidden = false;
    feedTab.update({ pressed: false });
    archiveTab.update({ pressed: true });
    viewStatus.textContent = "Vista: Archivio";
  }

  feedTab.element.addEventListener("sl:click", showFeed);
  archiveTab.element.addEventListener("sl:click", showArchive);

  const tabs = createElement("div", { classNames: "sl-profile-timeline__tabs" }, [
    feedTab.element,
    archiveTab.element,
  ]);

  const panels = createElement("div", { classNames: "sl-profile-timeline__panels" }, [
    feed.element,
    timeline.element,
  ]);

  const wrapper = createElement("div", { classNames: "sl-profile-timeline" }, [
    header.element,
    storiesBar.element,
    viewStatus,
    tabs,
    panels,
  ]);

  container.appendChild(wrapper);

  return function destroy() {
    feed.element.removeEventListener("sl:post-like", handlePostLike);
    feedTab.element.removeEventListener("sl:click", showFeed);
    archiveTab.element.removeEventListener("sl:click", showArchive);
    header.destroy();
    storiesBar.destroy();
    feed.destroy();
    timeline.destroy();
    feedTab.destroy();
    archiveTab.destroy();
    wrapper.remove();
  };
}
