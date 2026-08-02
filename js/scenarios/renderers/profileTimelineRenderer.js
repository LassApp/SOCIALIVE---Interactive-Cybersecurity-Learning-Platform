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
 * "sl:story-open": nessun listener collegato, stesso trattamento già
 * riservato a molti altri eventi in questo progetto (sl:search,
 * sl:settings-click, ecc.) — la destinazione (un futuro Story Viewer)
 * non esiste ancora.
 *
 * ERRORE DI FETCH SUI DATASET SECONDARI: un try/catch dedicato, distinto
 * da quello già presente nell'engine per scenario.json stesso — se
 * profile/stories/posts non fossero raggiungibili, si mostra un
 * messaggio di errore locale a questa pagina, senza costruire
 * un'infrastruttura di gestione errori condivisa per un solo consumer
 * reale (YAGNI, stesso principio già seguito ovunque nel progetto).
 *
 * Costruzione del messaggio di errore (Fase 9): estratta in
 * js/utils/fallbackMessage.js — la funzione locale "buildErrorMessage"
 * era identica, byte per byte, a "buildFallbackMessage" di
 * scenarioEngine.js (stesso padding/color/font-size). Centralizzarla in
 * un'unica utility condivisa elimina la duplicazione e, come effetto
 * collaterale utile, garantisce che ANCHE un terzo consumer (router.js,
 * "Pagina non trovata" — bug reale corretto nello stesso step) riceva
 * esattamente lo stesso trattamento visivo, invece di una copia
 * divergente. Vedi fallbackMessage.js per il rationale completo.
 *
 * TOGGLE PUBBLICO/PRIVATO — dimostrazione pedagogica di cosa cambia
 * quando un profilo decide di diventare privato. Icona lucchetto, posta
 * accanto alle statistiche (post/follower/seguiti — richiesta esplicita:
 * "accanto a" i tre numeri, non altrove nella pagina). Stato SEMPRE
 * locale a questo mount (una variabile nello scope della funzione, mai
 * scritta su storage.js): ogni apertura/refresh dello scenario riparte
 * da "pubblico" — persisterlo vanificherebbe l'effetto didattico della
 * demo (il docente deve poter ripetere il confronto più volte in classi
 * diverse, sempre a partire dallo stesso stato).
 *   - PUBBLICO (default): lucchetto aperto, aria-pressed="false". Storie,
 *     tab Post/Archivio ed entrambi i pannelli restano visibili come
 *     sono oggi — nessuna modifica al comportamento esistente in questo
 *     stato.
 *   - PRIVATO: lucchetto chiuso, aria-pressed="true". Copertina, avatar,
 *     bio e le TRE statistiche restano identiche e visibili (un profilo
 *     privato reale le mostra comunque a chiunque — solo i contenuti
 *     sono riservati): storie e i due pannelli Post/Archivio vengono
 *     sostituiti da un pannello "Questo profilo è privato" con un
 *     bottone "Segui" — volutamente fittizio (nessun listener
 *     applicativo, stesso trattamento già riservato altrove nel
 *     progetto a interazioni non implementate, es. sl:search/
 *     sl:settings-click), presente solo per rinforzare il realismo.
 * Vive in QUESTO renderer (non in un componente dedicato, non nello
 * scenario Oversharing) perché è un comportamento del TYPE
 * "profile-timeline", non del profilo "marti.travel" — un futuro
 * scenario con lo stesso type (es. "Privacy", Fase 1 §12) erediterebbe
 * gratuitamente questa stessa demo, senza alcuna modifica.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement } from "../../utils/dom.js";
import { formatFullDate } from "../../utils/dateFormat.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { applyImageFadeIn } from "../../utils/imageFadeIn.js";
import { createLocalJsonResource, createLocalJsonRepository } from "../../repositories/localJsonRepository.js";
import { svgNode } from "../../utils/svg.js";
import { create as createAvatar } from "../../components/Avatar.js";
import { create as createButton } from "../../components/Button.js";
import { create as createStoriesBar } from "../../components/StoriesBar.js";
import { create as createFeed } from "../../components/Feed.js";
import { create as createTimeline } from "../../components/Timeline.js";
import { create as createMediaViewer } from "../../components/MediaViewer.js";

function formatCount(value) {
  return (Number(value) || 0).toLocaleString("it-IT");
}

// Icona lucchetto: due varianti, aperto/chiuso, stesso pattern inline
// già usato per il cuore di PostCard (buildHeartIcon) — nessuna
// dipendenza dallo sprite (assets/icons/icons.svg, ancora assente,
// debito noto da Fase 2). Corpo del lucchetto identico nelle due
// varianti; solo l'arco superiore (shackle) cambia: chiuso quando
// ridiscende su entrambi i lati nel corpo, aperto quando si stacca su
// un lato — la stessa convenzione visiva di qualunque icona reale di
// "lucchetto aperto/chiuso".
function buildLockIcon(locked) {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("rect", {
      x: "5",
      y: "11",
      width: "14",
      height: "9",
      rx: "2",
      stroke: "currentColor",
      "stroke-width": "1.5",
    })
  );
  svg.appendChild(
    svgNode("path", {
      d: locked ? "M8 11V8a4 4 0 1 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.6-1.6",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
    })
  );
  return svg;
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
function buildProfileHeader(profile, postsCount, privacyToggleElement) {
  const coverImage = createElement("img", {
    classNames: "sl-profile-timeline__cover-image",
    attrs: { src: profile.coverImage || "", alt: "" },
  });
  // Fase 9/#11 (implementato realmente in Fase 10): questo header viene
  // costruito una sola volta all'apertura della pagina (nessun update()
  // successivo per questo renderer), quindi qui il confronto idempotente
  // sulla src non è strettamente necessario — applicato comunque per
  // usare sempre lo stesso punto di ingresso della utility condivisa.
  applyImageFadeIn(coverImage);
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

  // Riga che affianca le statistiche al lucchetto — richiesta esplicita:
  // il toggle deve stare "accanto a" post/follower/seguiti, non altrove
  // nella pagina (es. nell'header dell'app, dove non avrebbe relazione
  // visiva col profilo che descrive).
  const statsRow = createElement("div", { classNames: "sl-profile-timeline__stats-row" }, [
    stats,
    privacyToggleElement,
  ]);

  const identity = createElement("div", { classNames: "sl-profile-timeline__identity" }, [
    avatarWrap,
    username,
    bio,
    statsRow,
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

// Pannello mostrato al posto di storie/post quando il profilo è
// impostato su privato (vedi rationale "TOGGLE PUBBLICO/PRIVATO" in
// testa al file). "profile.displayName" rende il messaggio generico
// rispetto allo scenario (nessun nome hardcoded): un futuro secondo
// scenario con lo stesso type mostrerebbe il PROPRIO nome utente senza
// alcuna modifica a questa funzione.
//
// Bottone "Segui" volutamente inerte: emette solo un evento
// "sl:profile-follow-request" senza alcun listener applicativo — stesso
// trattamento già riservato altrove nel progetto a interazioni non
// implementate (es. sl:search, sl:settings-click). Presente solo per
// realismo: un vero profilo privato mostra sempre un invito a seguire.
function buildPrivateNotice(profile) {
  const icon = createElement(
    "div",
    { classNames: "sl-profile-timeline__private-icon", attrs: { "aria-hidden": "true" } },
    [buildLockIcon(true)]
  );

  const title = createElement("h2", {
    classNames: "sl-profile-timeline__private-title",
    text: "Questo profilo è privato",
  });

  const description = createElement("p", {
    classNames: "sl-profile-timeline__private-description",
    text: `Segui ${profile.displayName || "questo profilo"} per vedere le sue foto, i suoi video e le sue storie.`,
  });

  const followButton = createButton({ variant: "primary", label: "Segui" });
  followButton.element.classList.add("sl-profile-timeline__private-follow");

  const element = createElement(
    "div",
    { classNames: "sl-profile-timeline__private-notice" },
    [icon, title, description, followButton.element]
  );
  // Nascosto di default (attributo nativo, non una classe CSS): il
  // profilo è pubblico al primo mount — stesso principio già seguito da
  // "timeline.element.hidden = true" qualche riga più sotto in questo
  // stesso file per il pannello Archivio.
  element.hidden = true;

  function handleFollowClick() {
    element.dispatchEvent(new CustomEvent("sl:profile-follow-request", { bubbles: true, detail: {} }));
  }
  followButton.element.addEventListener("sl:click", handleFollowClick);

  return {
    element,
    destroy() {
      followButton.element.removeEventListener("sl:click", handleFollowClick);
      followButton.destroy();
    },
  };
}

export async function renderProfileTimeline(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.profile || !refs.stories || !refs.posts) {
    console.error(`[profileTimelineRenderer] "dataRefs" incompleto per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("I dati di questo profilo non sono disponibili al momento."));
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
    container.appendChild(buildFallbackMessage("I dati di questo profilo non sono disponibili al momento."));
    return undefined;
  }

  const author = { name: profile.displayName, avatarSrc: profile.avatar };
  const feedPosts = rawPosts.map((post) => toFeedPost(post, author));

  // Stato del toggle pubblico/privato — SOLO in questa variabile, mai in
  // storage.js (vedi rationale "TOGGLE PUBBLICO/PRIVATO" in testa al
  // file): ogni mount riparte da "pubblico", nessuna eccezione.
  let isPrivate = false;

  const privacyToggle = createButton({
    variant: "icon",
    icon: buildLockIcon(false),
    pressed: false,
    ariaLabel: "Rendi il profilo privato",
  });
  privacyToggle.element.classList.add("sl-profile-timeline__privacy-toggle");

  const header = buildProfileHeader(profile, rawPosts.length, privacyToggle.element);
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

  // Raggruppa TUTTO ciò che il profilo privato nasconde (storie, tab,
  // entrambi i pannelli) in un solo contenitore: un solo "hidden" da
  // commutare invece di quattro, stesso principio già seguito da questo
  // stesso file per Feed/Timeline (un "hidden" per pannello, non uno per
  // ciascun figlio interno). Nessun "display" proprio dichiarato su
  // questa classe: l'attributo nativo [hidden] basta, nessuna
  // ridichiarazione CSS necessaria (a differenza di .sl-timeline/
  // .sl-post-card__media, che invece impongono un proprio display).
  const publicContent = createElement("div", { classNames: "sl-profile-timeline__public-content" }, [
    storiesBar.element,
    viewStatus,
    tabs,
    panels,
  ]);

  const privateNotice = buildPrivateNotice(profile);

  // Annuncio invisibile DEDICATO al cambio pubblico/privato — separato
  // da "viewStatus" (Post/Archivio, sopra): sono due stati indipendenti,
  // un solo screen reader status condiviso tra i due rischierebbe di far
  // perdere l'annuncio più recente se entrambi cambiassero vicini nel
  // tempo (non il caso reale qui, ma nessun motivo per condividerli).
  const privacyStatus = createElement("p", {
    classNames: ["sl-visually-hidden", "sl-profile-timeline__privacy-status"],
    attrs: { role: "status", "aria-live": "polite" },
  });

  // Unico punto che applica lo stato "pubblico"/"privato" a UI + focus
  // management: nessuno spostamento forzato del focus (il bottone resta
  // dov'è, il contenuto sotto si aggiorna) — stesso comportamento già
  // scelto per il toggle Feed/Archivio poco sopra in questo file. Il
  // pannello Feed/Archivio che era attivo prima di passare a "privato"
  // resta quello attivo quando si ritorna a "pubblico" (publicContent
  // viene solo nascosto, mai smontato: showFeed()/showArchive() non
  // vengono richiamate qui).
  function setPrivacy(nextIsPrivate) {
    isPrivate = nextIsPrivate;
    publicContent.hidden = isPrivate;
    privateNotice.element.hidden = !isPrivate;
    privacyToggle.update({
      icon: buildLockIcon(isPrivate),
      pressed: isPrivate,
      ariaLabel: isPrivate ? "Rendi il profilo pubblico" : "Rendi il profilo privato",
    });
    privacyStatus.textContent = isPrivate ? "Profilo impostato su privato." : "Profilo impostato su pubblico.";
  }

  function handlePrivacyToggleClick() {
    setPrivacy(!isPrivate);
  }
  privacyToggle.element.addEventListener("sl:click", handlePrivacyToggleClick);

  const wrapper = createElement("div", { classNames: "sl-profile-timeline" }, [
    header.element,
    publicContent,
    privateNotice.element,
    privacyStatus,
  ]);

  // sl:post-open bolle sia da PostCard (dentro Feed) sia da Timeline —
  // stesso evento, stesso "detail: { postId }" da entrambe le fonti
  // (nessuna delle due emette un evento diverso). Il post completo si
  // risolve qui, in "feedPosts" (già caricato e trasformato, autore+data
  // compresi) — MAI un secondo fetch: MediaViewer riceve l'intero array
  // + l'indice di partenza, così la navigazione prev/next avviene
  // sull'intero profilo, non solo sulla vista di provenienza (Feed o
  // Archivio). Ascoltato su "wrapper" (non su feed/timeline
  // singolarmente): un solo listener copre entrambe le fonti, dato che
  // sono entrambe discendenti di wrapper nel DOM.
  let mediaViewer = null;

  function handlePostOpen(event) {
    const index = feedPosts.findIndex((post) => post.id === event.detail.postId);
    if (index === -1) return;
    if (mediaViewer) mediaViewer.destroy();
    mediaViewer = createMediaViewer({ posts: feedPosts, startIndex: index });
    mediaViewer.element.addEventListener("sl:media-viewer-close", () => {
      mediaViewer = null;
    });
  }
  wrapper.addEventListener("sl:post-open", handlePostOpen);

  container.appendChild(wrapper);

  return function destroy() {
    feed.element.removeEventListener("sl:post-like", handlePostLike);
    wrapper.removeEventListener("sl:post-open", handlePostOpen);
    feedTab.element.removeEventListener("sl:click", showFeed);
    archiveTab.element.removeEventListener("sl:click", showArchive);
    privacyToggle.element.removeEventListener("sl:click", handlePrivacyToggleClick);
    header.destroy();
    storiesBar.destroy();
    feed.destroy();
    timeline.destroy();
    feedTab.destroy();
    archiveTab.destroy();
    privacyToggle.destroy();
    privateNotice.destroy();
    // MediaViewer vive fuori da "wrapper" (montato direttamente su
    // <body>, come Modal): se questo controller viene smontato mentre il
    // visualizzatore è ancora aperto (caso limite, navigazione via router
    // non passando per la chiusura naturale del visualizzatore), va
    // distrutto esplicitamente qui — altrimenti resterebbe orfano sopra
    // la pagina successiva. Stessa cautela non ancora applicata a Modal
    // altrove nel progetto (debito tecnico noto e accettato lì, cfr.
    // Modal.js "nessuno stacking"), qui risolta perché il costo è minimo.
    if (mediaViewer) mediaViewer.destroy();
  };
}
