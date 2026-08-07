/**
 * profileTimelineRenderer.js
 * -----------------------------------------------------------------------
 * Renderer REALE per gli scenari di tipo "profile-timeline" (Fase 6/Step
 * 3). Profilo realistico (copertina, avatar, bio, statistiche), storie
 * in evidenza (StoriesBar, Fase 6/Step 2) e due VISTE sullo stesso
 * dataset di post — Feed (lettura post-per-post, Fase 2) e Archivio
 * (Timeline, Fase 6/Step 2) — commutabili con un toggle. NESSUN elemento
 * didattico visibile (requisito esplicito del Prompt #6):
 * scenario.title/scenario.description non vengono MAI renderizzati in
 * questa pagina: un vero profilo social non mostra il "nome della
 * lezione" a cui appartiene.
 *
 * GENERICO RISPETTO ALLO SCENARIO, SPECIFICO RISPETTO AL TYPE: un futuro
 * secondo scenario con lo stesso type "profile-timeline" (es. "Privacy",
 * Fase 1 §12) riuserebbe questo file senza alcuna modifica, mostrando i
 * PROPRI dati (scenario.dataRefs punta a una cartella diversa) — nessun
 * dato hardcoded qui specifico di "Oversharing" o del profilo
 * "marti.travel".
 *
 * FETCH DEI 3 DATASET: profile.json (risorsa singola →
 * createLocalJsonResource), stories.json/posts.json (collezioni →
 * createLocalJsonRepository). I tre URL arrivano da scenario.dataRefs,
 * non hardcoded qui.
 *
 * AUTORE UNICO PER TUTTI I POST: in questo tipo di scenario (un solo
 * profilo) l'autore di ogni post è sempre lo stesso — profile.json. La
 * trasformazione "post grezzo + profilo → prop PostCard" è
 * responsabilità di QUESTO renderer (toFeedPost, sotto).
 *
 * FEED vs ARCHIVIO — due VISTE sullo stesso posts.json, non due
 * dataset. Toggle con due bottoni "a stato" (Button.pressed), NON un
 * vero widget ARIA "tablist": costruire la semantica completa di tab
 * per due soli pannelli statici sarebbe un contratto di interazione
 * promesso e non implementato — stesso principio già seguito da Feed.js
 * per il proprio "niente role=feed".
 *
 * BOTTONE "SEGUI"/"SEGUI GIÀ" — UNICO CONTROLLO DI VISIBILITÀ
 * PUBBLICO/PRIVATO (miglioramento incrementale, post Fase 10.2): in una
 * prima versione di questo intervento esisteva un SECONDO controllo
 * dedicato — un bottone icona a forma di lucchetto — che duplicava, con
 * un controllo indipendente, la stessa decisione che il bottone "Segui"
 * già comunicava concettualmente ("seguo → vedo i contenuti, non seguo
 * → non li vedo"). Su richiesta esplicita, quel secondo controllo è
 * stato ELIMINATO: oggi un solo bottone (in due istanze DOM — vedi
 * sotto) governa sia lo stato "sto seguendo" sia la visibilità del
 * profilo, con un'unica fonte di verità (isFollowing).
 *   - Il profilo si apre SEMPRE già "Segui già" (isFollowing = true di
 *     default): contenuto pubblico visibile — storie, tab Post/Archivio,
 *     entrambi i pannelli — esattamente il comportamento che prima era
 *     dato dal "lucchetto aperto".
 *   - Click su "Segui già" → si passa a "Segui" (isFollowing = false):
 *     storie e i due pannelli Post/Archivio vengono sostituiti dal
 *     pannello "Questo profilo è privato" con l'invito a seguire —
 *     esattamente il comportamento che prima era dato dal "lucchetto
 *     chiuso". Copertina, avatar, bio e le TRE statistiche restano
 *     identiche e visibili in entrambi gli stati (un profilo privato
 *     reale le mostra comunque a chiunque — solo i CONTENUTI sono
 *     riservati).
 *   - Click di nuovo su "Segui" → si torna a "Segui già": il profilo
 *     torna visibile per intero, ripristinando la vista Feed/Archivio
 *     che era selezionata prima (comportamento preesistente, invariato:
 *     publicContent viene solo nascosto/rivelato, mai smontato).
 * Stato SEMPRE locale a questo mount (una variabile nello scope della
 * funzione, mai scritta su storage.js): ogni apertura/refresh dello
 * scenario riparte da "Segui già" — persisterlo vanificherebbe l'effetto
 * didattico della demo (il docente deve poter ripetere il confronto più
 * volte in classi diverse, sempre dallo stesso stato iniziale).
 *
 * DUE bottoni DOM distinti (uno nella riga statistiche dell'header
 * pubblico, uno nel pannello "profilo privato"), perché un nodo non può
 * stare in due punti del DOM contemporaneamente — ma UN SOLO stato
 * condiviso (isFollowing): non sono mai visibili insieme
 * (publicContent/privateNotice si escludono a vicenda), quindi
 * rappresentano concettualmente lo stesso bottone e restano sempre
 * sincronizzati. Variante primary→secondary ed etichetta "Segui"→"Segui
 * già" al click: stesso pattern reale di Instagram/X per comunicare lo
 * stato senza affidarsi al solo colore (§5.7 architettura Fase 1) — il
 * testo stesso cambia. Evento "sl:profile-follow-toggle" (detail:
 * { following }) emesso ad ogni click — nessun listener applicativo
 * reale lo ascolta oggi (stesso trattamento già riservato a
 * sl:search/sl:settings-click), ma la forma è pronta per un futuro
 * consumer.
 *
 * ICONA LUCCHETTO — SOLO DECORATIVA, NON PIÙ UN CONTROLLO: il pannello
 * "Questo profilo è privato" mostra ancora una piccola icona a lucchetto
 * chiuso dentro un badge circolare, sopra il titolo — è rimasta
 * invariata rispetto a prima: NON è il bottone eliminato, è sempre stata
 * una semplice illustrazione statica del concetto "privato" all'interno
 * del box, non interattiva (aria-hidden, nessun listener). buildLockIcon()
 * non accetta più un parametro "locked": prima dell'eliminazione del
 * toggle serviva anche la variante "aperta" per l'icona del bottone a
 * riposo, oggi l'unico consumer rimasto (questa icona decorativa) vuole
 * sempre e solo la variante "chiusa".
 *
 * MEDIAVIEWER SU AVATAR/COPERTINA/STORIE: "sl:story-open" (emesso da
 * StoriesBar.js) e i due eventi "sl:profile-avatar-open"/"sl:profile-
 * cover-open" (emessi da buildProfileHeader) aprono il MediaViewer
 * tramite mediaViewerLauncher — vedi il blocco dei listener più sotto.
 *
 * ERRORE DI FETCH SUI DATASET SECONDARI: un try/catch dedicato, distinto
 * da quello già presente nell'engine per scenario.json stesso.
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
import { createMediaViewerLauncher } from "../../utils/mediaViewerLauncher.js";

function formatCount(value) {
  return (Number(value) || 0).toLocaleString("it-IT");
}

// Icona lucchetto CHIUSO — oggi un solo consumer: il badge decorativo
// dentro il pannello "profilo privato" (mai un controllo interattivo,
// vedi rationale in testa al file). Nessuna dipendenza dallo sprite
// (assets/icons/icons.svg, ancora assente, debito noto da Fase 2).
function buildLockIcon() {
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
      d: "M8 11V8a4 4 0 1 1 8 0v3",
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

// postsCount NON arriva da profile.json — derivato da rawPosts.length,
// l'unica fonte di verità (nessuna duplicazione, Fase 6/Step 1).
function buildProfileHeader(profile, postsCount, followButtonElement) {
  const coverImage = createElement("img", {
    classNames: "sl-profile-timeline__cover-image",
    attrs: { src: profile.coverImage || "", alt: "" },
  });
  applyImageFadeIn(coverImage);

  const coverButton = createElement(
    "button",
    {
      classNames: "sl-profile-timeline__cover-trigger",
      attrs: { type: "button", "aria-label": "Apri la copertina del profilo" },
    },
    [coverImage]
  );
  function handleCoverOpen() {
    coverButton.dispatchEvent(new CustomEvent("sl:profile-cover-open", { bubbles: true, detail: {} }));
  }
  coverButton.addEventListener("click", handleCoverOpen);

  const cover = createElement("div", { classNames: "sl-profile-timeline__cover" }, [coverButton]);

  // ariaHidden: true — l'username subito sotto è già il nome accessibile
  // di questa identità (stesso principio già seguito da AppHeader/
  // ProfileMenu/PostCard per evitare la doppia lettura da screen reader).
  const avatar = createAvatar({
    src: profile.avatar,
    name: profile.displayName,
    size: "xl",
    ariaHidden: true,
  });

  const avatarButton = createElement(
    "button",
    {
      classNames: "sl-profile-timeline__avatar-trigger",
      attrs: { type: "button", "aria-label": "Apri la foto del profilo" },
    },
    [avatar.element]
  );
  function handleAvatarOpen() {
    avatarButton.dispatchEvent(new CustomEvent("sl:profile-avatar-open", { bubbles: true, detail: {} }));
  }
  avatarButton.addEventListener("click", handleAvatarOpen);

  const avatarWrap = createElement("div", { classNames: "sl-profile-timeline__avatar-wrap" }, [avatarButton]);

  // <h1>: il nome utente è il titolo effettivo di questa pagina — un
  // vero profilo social non mostra mai un secondo titolo "editoriale"
  // sopra.
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

  // Riga che affianca le statistiche al bottone "Segui" — richiesta
  // esplicita: il bottone deve stare PRIMA del conteggio "post", non
  // sopra o sotto l'intera riga. Nessun secondo controllo qui accanto
  // (il lucchetto interattivo è stato eliminato, vedi rationale in testa
  // al file): "Segui"/"Segui già" è oggi l'unico comando di questa riga.
  const statsRow = createElement("div", { classNames: "sl-profile-timeline__stats-row" }, [
    followButtonElement,
    stats,
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
      coverButton.removeEventListener("click", handleCoverOpen);
      avatarButton.removeEventListener("click", handleAvatarOpen);
      avatar.destroy();
    },
  };
}

// Trasforma un record grezzo di posts.json in una prop compatibile con
// PostCard: aggiunge l'autore (sempre lo stesso, dal profilo) e formatta
// la data in una stringa assoluta leggibile. I campi "sensitive"/
// "insightNote" NON vengono copiati: nessun elemento didattico visibile,
// in nessuna forma.
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

// Pannello mostrato al posto di storie/post quando NON si segue il
// profilo (isFollowing === false). "profile.displayName" rende il
// messaggio generico rispetto allo scenario (nessun nome hardcoded).
//
// "followButtonElement" arriva già pronto da renderProfileTimeline —
// stesso identico bottone concettuale (stato condiviso) del "Segui"
// nell'header pubblico: i due non sono mai visibili insieme, quindi
// devono riflettere sempre lo stesso "sto seguendo o no", non due stati
// indipendenti che potrebbero disallinearsi.
function buildPrivateNotice(profile, followButtonElement) {
  const icon = createElement(
    "div",
    { classNames: "sl-profile-timeline__private-icon", attrs: { "aria-hidden": "true" } },
    [buildLockIcon()]
  );

  const title = createElement("h2", {
    classNames: "sl-profile-timeline__private-title",
    text: "Questo profilo è privato",
  });

  const description = createElement("p", {
    classNames: "sl-profile-timeline__private-description",
    text: `Segui ${profile.displayName || "questo profilo"} per vedere le sue foto, i suoi video e le sue storie.`,
  });

  const element = createElement(
    "div",
    { classNames: "sl-profile-timeline__private-notice" },
    [icon, title, description, followButtonElement]
  );
  // Nascosto di default (attributo nativo, non una classe CSS): il
  // profilo si apre sempre "Segui già" — stesso principio già seguito da
  // "timeline.element.hidden = true" qualche riga più sotto in questo
  // stesso file per il pannello Archivio.
  element.hidden = true;

  return {
    element,
    // Nessun listener proprio da rimuovere qui: il bottone "Segui" è di
    // proprietà di renderProfileTimeline (che lo crea e lo distrugge),
    // questa funzione si limita a posizionarlo — stesso principio di
    // ownership già seguito per followButtonElement in
    // buildProfileHeader.
    destroy() {},
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

  // UNICA fonte di verità per "sto seguendo" E per la visibilità
  // pubblico/privato (vedi rationale "BOTTONE SEGUI/SEGUI GIÀ" in testa
  // al file) — mai in storage.js: ogni mount riparte da true.
  let isFollowing = true;

  // Entrambi i bottoni nascono già nello stato "Segui già" (il profilo
  // si apre seguito): variante secondary + pressed:true fin dalla
  // creazione, non impostati in un secondo momento — evita un frame
  // iniziale visivamente incoerente con isFollowing=true.
  const headerFollowButton = createButton({ variant: "secondary", label: "Segui già", pressed: true });
  headerFollowButton.element.classList.add("sl-profile-timeline__follow-button");

  const privateFollowButton = createButton({ variant: "secondary", label: "Segui già", pressed: true });
  privateFollowButton.element.classList.add("sl-profile-timeline__private-follow");

  // Unico punto che applica lo stato "seguo/non seguo" a UI + focus
  // management: nessuno spostamento forzato del focus (il bottone resta
  // dov'è, il contenuto sotto si aggiorna). Il pannello Feed/Archivio
  // che era attivo prima di smettere di seguire resta quello attivo al
  // ritorno (publicContent viene solo nascosto, mai smontato:
  // showFeed()/showArchive() non vengono richiamate qui).
  function setFollowing(nextIsFollowing) {
    isFollowing = nextIsFollowing;
    const nextProps = {
      label: isFollowing ? "Segui già" : "Segui",
      variant: isFollowing ? "secondary" : "primary",
      pressed: isFollowing,
    };
    headerFollowButton.update(nextProps);
    privateFollowButton.update(nextProps);
    publicContent.hidden = !isFollowing;
    privateNotice.element.hidden = isFollowing;
    followStatus.textContent = isFollowing
      ? "Ora segui questo profilo: contenuti visibili."
      : "Non segui più questo profilo: contenuti nascosti.";
  }

  // Un solo handler per entrambi i bottoni (stesso stato condiviso): non
  // importa quale dei due sia stato premuto, l'effetto è identico.
  function handleFollowToggle() {
    const next = !isFollowing;
    setFollowing(next);
    wrapper.dispatchEvent(
      new CustomEvent("sl:profile-follow-toggle", { bubbles: true, detail: { following: next } })
    );
  }
  headerFollowButton.element.addEventListener("sl:click", handleFollowToggle);
  privateFollowButton.element.addEventListener("sl:click", handleFollowToggle);

  const header = buildProfileHeader(profile, rawPosts.length, headerFollowButton.element);
  const storiesBar = createStoriesBar({ stories });

  // hasMore:false — il dataset di uno scenario è un insieme fisso e già
  // completo: nessuna paginazione reale da simulare qui.
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

  // Raggruppa TUTTO ciò che il profilo "non seguito" nasconde (storie,
  // tab, entrambi i pannelli) in un solo contenitore: un solo "hidden"
  // da commutare invece di quattro. Nessun "display" proprio dichiarato
  // su questa classe: l'attributo nativo [hidden] basta, nessuna
  // ridichiarazione CSS necessaria.
  const publicContent = createElement("div", { classNames: "sl-profile-timeline__public-content" }, [
    storiesBar.element,
    viewStatus,
    tabs,
    panels,
  ]);

  const privateNotice = buildPrivateNotice(profile, privateFollowButton.element);

  // Annuncio invisibile dedicato al cambio "seguo/non seguo" — separato
  // da "viewStatus" (Post/Archivio, sopra): sono due stati indipendenti,
  // un solo screen reader status condiviso tra i due rischierebbe di far
  // perdere l'annuncio più recente se entrambi cambiassero vicini nel
  // tempo.
  const followStatus = createElement("p", {
    classNames: ["sl-visually-hidden", "sl-profile-timeline__follow-status"],
    attrs: { role: "status", "aria-live": "polite" },
  });

  const wrapper = createElement("div", { classNames: "sl-profile-timeline" }, [
    header.element,
    publicContent,
    privateNotice.element,
    followStatus,
  ]);

  // sl:post-open bolle sia da PostCard (dentro Feed) sia da Timeline —
  // stesso evento, stesso "detail: { postId }" da entrambe le fonti. Il
  // post completo si risolve qui, in "feedPosts" (già caricato e
  // trasformato) — MAI un secondo fetch.
  const mediaViewerLauncher = createMediaViewerLauncher();

  function handlePostOpen(event) {
    mediaViewerLauncher.openById(feedPosts, event.detail.postId);
  }
  wrapper.addEventListener("sl:post-open", handlePostOpen);

  // Avatar e copertina: gallerie di UN SOLO elemento — aprire l'avatar
  // non deve permettere di scorrere fino alla copertina o ai post, sono
  // superfici indipendenti (comportamento reale di Instagram/Facebook).
  function handleAvatarOpen() {
    mediaViewerLauncher.open([
      { id: "avatar", author: { name: profile.displayName }, image: { src: profile.avatar, alt: profile.displayName || "" } },
    ]);
  }
  function handleCoverOpen() {
    mediaViewerLauncher.open([
      {
        id: "cover",
        author: { name: profile.displayName, avatarSrc: profile.avatar },
        image: { src: profile.coverImage, alt: "" },
      },
    ]);
  }
  wrapper.addEventListener("sl:profile-avatar-open", handleAvatarOpen);
  wrapper.addEventListener("sl:profile-cover-open", handleCoverOpen);

  // Storie: "sl:story-open" apre una galleria con TUTTE e 5 le storie,
  // navigabili con le stesse frecce prev/next già esistenti — coerente
  // con l'esperienza di un vero "reel".
  function handleStoryOpen(event) {
    const storyItems = stories.map((story) => ({
      id: story.id,
      author: { name: profile.displayName, avatarSrc: profile.avatar },
      content: story.label,
      image: { src: story.thumbnail, alt: story.label || "" },
    }));
    mediaViewerLauncher.openById(storyItems, event.detail.storyId);
  }
  wrapper.addEventListener("sl:story-open", handleStoryOpen);

  container.appendChild(wrapper);

  return function destroy() {
    feed.element.removeEventListener("sl:post-like", handlePostLike);
    wrapper.removeEventListener("sl:post-open", handlePostOpen);
    wrapper.removeEventListener("sl:profile-avatar-open", handleAvatarOpen);
    wrapper.removeEventListener("sl:profile-cover-open", handleCoverOpen);
    wrapper.removeEventListener("sl:story-open", handleStoryOpen);
    feedTab.element.removeEventListener("sl:click", showFeed);
    archiveTab.element.removeEventListener("sl:click", showArchive);
    headerFollowButton.element.removeEventListener("sl:click", handleFollowToggle);
    privateFollowButton.element.removeEventListener("sl:click", handleFollowToggle);
    header.destroy();
    storiesBar.destroy();
    feed.destroy();
    timeline.destroy();
    feedTab.destroy();
    archiveTab.destroy();
    headerFollowButton.destroy();
    privateFollowButton.destroy();
    privateNotice.destroy();
    // MediaViewer vive fuori da "wrapper" (montato direttamente su
    // <body>, come Modal): se questo controller viene smontato mentre il
    // visualizzatore è ancora aperto, va distrutto esplicitamente qui.
    mediaViewerLauncher.destroy();
  };
}
