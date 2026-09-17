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
 * VISIBILITÀ DEL PROFILO — DUE VARIABILI INDIPENDENTI, NON PIÙ UNA SOLA
 * (miglioramento incrementale, post Fase 10.3, su richiesta esplicita):
 * un precedente intervento aveva eliminato un secondo controllo
 * "lucchetto" proprio perché duplicava, senza motivo reale, la stessa
 * decisione già presa dal bottone "Segui" — un solo bit di stato
 * (isFollowing) bastava. Quella semplificazione resta corretta per
 * QUEL caso, ma qui la richiesta è diversa: un vero profilo social ha
 * DUE concetti distinti che insieme decidono la visibilità dei
 * contenuti — "il profilo è impostato pubblico o privato" (una scelta
 * del proprietario, gestita da "Impostazioni") e "io lo seguo o no"
 * (una relazione del visitatore, gestita da "Segui"). Introdurre di
 * nuovo un secondo stato non è quindi un ritorno alla duplicazione
 * eliminata in precedenza: è una semantica reale, verificabile con la
 * stessa regola che useresti su Instagram/X:
 *
 *     contentVisible = isPublic || isFollowing
 *
 * cioè: pubblico → sempre visibile, segui tu o no; privato → visibile
 * SOLO se lo segui. Copertina, avatar, bio e le TRE statistiche restano
 * sempre visibili in ogni combinazione (un profilo privato reale le
 * mostra comunque a chiunque — solo i CONTENUTI, storie incluse, sono
 * riservati).
 *
 * BOTTONE IMPOSTAZIONI (nuovo, icona ingranaggio) — posizionato PRIMA
 * del bottone "Segui" nella riga statistiche, richiesta esplicita. Apre
 * un Modal (componente esistente, riusato as-is — mai un secondo
 * overlay component per la stessa funzione) con 4 controlli, tutti
 * REALMENTE funzionali, non solo illustrativi:
 *   1. "Profilo pubblico" — un Button a stato (pressed=Attivo/
 *      Disattivato) che scrive isPublic. Applicato immediatamente,
 *      anche a pannello ancora aperto (il profilo dietro l'overlay
 *      aggiorna comunque il proprio DOM).
 *   2. "Chi può seguirti" — Tutti | Approvazione (followPolicy). Non
 *      tocca isFollowing per chi già segue: regola solo le FUTURE
 *      richieste di follow (vedi sotto).
 *   3. "Chi può commentare" — Tutti | Follower | Nessuno
 *      (commentPolicy). Applicata per-post: ogni oggetto in
 *      "feedPosts" riceve un campo "commentsEnabled"
 *      (+ "commentsDisabledReason"), letto da PostCard.js (prop
 *      additiva, Fase corrente — default true, zero impatto sugli
 *      altri consumer di PostCard come la Home).
 *   4. "Chi vede le storie" — Tutti i follower | Amici stretti
 *      (storiesAudience). In questa demo il visitatore non è mai un
 *      "amico stretto": impostarlo su quel valore nasconde
 *      semplicemente StoriesBar, sostituita da una riga di testo che
 *      spiega perché (mai un buco silenzioso in UI, §5.7 architettura
 *      Fase 1 — uno stato non deve mai essere affidato al solo "non
 *      c'è più nulla qui").
 *
 * BOTTONE "SEGUI"/"SEGUI GIÀ" — governa isFollowing, ora in
 * combinazione con followPolicy:
 *   - followPolicy "everyone": click su "Segui" segue immediatamente
 *     (isFollowing = true), invariato dal comportamento precedente.
 *   - followPolicy "approval": click su "Segui" NON segue subito —
 *     apre un Modal informativo ("{displayName} deve accettare la tua
 *     richiesta...") e porta il bottone in un terzo stato visivo,
 *     "Richiesta inviata" (followRequestPending = true, isFollowing
 *     resta false: coerente con un vero social, dove la richiesta in
 *     sospeso non dà ancora accesso ai contenuti). Un secondo click
 *     sulla richiesta pendente la ritira (torna a "Segui").
 *   - Click su "Segui già" smette sempre di seguire immediatamente
 *     (l'unfollow non richiede mai approvazione, su nessun social
 *     reale).
 * DUE bottoni DOM distinti (header pubblico + pannello privato), UN
 * SOLO stato condiviso — invariato dal comportamento precedente, motivo
 * identico (non sono mai visibili insieme). Evento
 * "sl:profile-follow-toggle" (detail: { following }) emesso solo
 * quando isFollowing cambia realmente (non ad ogni click: una richiesta
 * "in sospeso" non è ancora un vero cambio di stato "seguo").
 *
 * TUTTO LO STATO INTRODOTTO QUI (isPublic, followPolicy,
 * followRequestPending, commentPolicy, storiesAudience) resta SEMPRE
 * locale a questo mount, mai scritto su storage.js — stesso principio
 * già motivato per isFollowing: ogni apertura/refresh riparte dai
 * medesimi default (pubblico attivo, tutti possono seguire/commentare/
 * vedere le storie), per poter ripetere la demo più volte in classi
 * diverse dallo stesso punto di partenza.
 *
 * ICONA LUCCHETTO — invariata, resta SOLO decorativa (badge circolare
 * nel pannello "Questo profilo è privato"), non interattiva.
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
import { create as createModal } from "../../components/Modal.js";
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

// Icona ingranaggio per il bottone "Impostazioni" (nuovo). Stesso
// pattern inline già usato per il lucchetto: nessuna dipendenza dallo
// sprite (assets/icons/icons.svg, ancora assente).
function buildSettingsIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(svgNode("circle", { cx: "12", cy: "12", r: "3", stroke: "currentColor", "stroke-width": "1.5" }));
  svg.appendChild(
    svgNode("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linejoin": "round",
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

// --- Helper del pannello "Impostazioni" (nuovo) -------------------------
// Tre piccoli costruttori generici, riusati per le 4 righe del pannello:
// nessun nuovo componente UI introdotto (mai duplicare per la stessa
// funzione) — sono tutte istanze di Button.js, esattamente come già
// avviene per feedTab/archiveTab (ghost + pressed = selezione) e per
// headerFollowButton (primary/secondary = stato binario). Restano
// funzioni MODULO (non closure su renderProfileTimeline) perché non
// toccano mai lo stato del profilo direttamente: ricevono un valore
// iniziale e una callback, non sanno cos'altro cambierà a fronte del
// loro click — la stessa separazione "componente dumb / orchestratore"
// già applicata ovunque nel Design System, qui a livello di renderer.

function buildSettingsRow(title, description, controlElement) {
  return createElement("div", { classNames: "sl-profile-timeline__settings-row" }, [
    createElement("div", { classNames: "sl-profile-timeline__settings-row-text" }, [
      createElement("p", { classNames: "sl-profile-timeline__settings-row-title", text: title }),
      createElement("p", { classNames: "sl-profile-timeline__settings-row-desc", text: description }),
    ]),
    controlElement,
  ]);
}

// Gruppo di opzioni a selezione singola (es. "Tutti"/"Approvazione"):
// ogni opzione è un Button ghost con "pressed" a riflettere la
// selezione corrente. "collected" raccoglie le istanze create, così il
// chiamante può distruggerle tutte insieme alla chiusura del pannello
// (ogni componente distrugge solo ciò che ha creato — stesso principio
// già seguito ovunque nel progetto).
function buildOptionGroup(options, initialValue, onSelect, collected) {
  let currentValue = initialValue;
  const buttons = options.map((option) =>
    createButton({ variant: "ghost", label: option.label, pressed: option.value === currentValue })
  );
  buttons.forEach((button, index) => {
    button.element.classList.add("sl-profile-timeline__settings-chip");
    button.element.addEventListener("sl:click", () => {
      currentValue = options[index].value;
      buttons.forEach((b, i) => b.update({ pressed: options[i].value === currentValue }));
      onSelect(currentValue);
    });
    collected.push(button);
  });
  return createElement(
    "div",
    { classNames: "sl-profile-timeline__settings-chip-group" },
    buttons.map((b) => b.element)
  );
}

// Toggle binario (es. "Profilo pubblico"): un solo Button, variante e
// label riflettono lo stato — mai il solo colore come segnale (§5.7
// architettura Fase 1), l'etichetta cambia sempre insieme al colore.
function buildToggleButton(initialValue, onChange, collected) {
  let value = Boolean(initialValue);
  const button = createButton({
    variant: value ? "primary" : "secondary",
    label: value ? "Attivo" : "Disattivato",
    pressed: value,
  });
  button.element.classList.add("sl-profile-timeline__settings-toggle");
  button.element.addEventListener("sl:click", () => {
    value = !value;
    button.update({ variant: value ? "primary" : "secondary", label: value ? "Attivo" : "Disattivato", pressed: value });
    onChange(value);
  });
  collected.push(button);
  return button.element;
}

// postsCount NON arriva da profile.json — derivato da rawPosts.length,
// l'unica fonte di verità (nessuna duplicazione, Fase 6/Step 1).
function buildProfileHeader(profile, postsCount, settingsButtonElement, followButtonElement) {
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

  // Riga che affianca le statistiche ai due bottoni — ordine richiesto
  // esplicitamente: Impostazioni, poi Segui, poi il conteggio "post".
  const statsRow = createElement("div", { classNames: "sl-profile-timeline__stats-row" }, [
    settingsButtonElement,
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

  // Tutto lo stato di visibilità/privacy — SEMPRE locale a questo mount,
  // mai in storage.js (vedi rationale "TUTTO LO STATO INTRODOTTO QUI" in
  // testa al file).
  let isFollowing = true;
  let isPublic = true;
  let followPolicy = "everyone"; // "everyone" | "approval"
  let followRequestPending = false;
  let commentPolicy = "everyone"; // "everyone" | "followers" | "nobody"
  let storiesAudience = "followers"; // "followers" | "close-friends"
  let feed = null; // assegnata più sotto — dichiarata qui perché applyCommentPolicyToPosts() la referenzia

  // Regola unica di visibilità del profilo (vedi rationale in testa al
  // file): pubblico -> sempre visibile; privato -> visibile solo se lo
  // segui.
  function contentVisible() {
    return isPublic || isFollowing;
  }

  // Chi può commentare dipende sia da "commentPolicy" sia, per la sola
  // opzione "followers", da isFollowing — va ricalcolato ogni volta che
  // uno dei due cambia, non solo all'apertura di Impostazioni.
  function computeCommentsPermission() {
    if (commentPolicy === "nobody") {
      return { enabled: false, reason: "I commenti sono disattivati per questo profilo." };
    }
    if (commentPolicy === "followers" && !isFollowing) {
      return { enabled: false, reason: "Solo i follower possono commentare i post di questo profilo." };
    }
    return { enabled: true, reason: null };
  }

  // Applica la permission a TUTTI i post già caricati (mai un secondo
  // fetch): "commentsEnabled"/"commentsDisabledReason" sono campi
  // additivi letti da PostCard.js (default abilitato per qualunque
  // altro consumer, es. il feed della Home — zero impatto lì). "feed"
  // può non esistere ancora alla primissima chiamata (applicata
  // direttamente su feedPosts prima della sua creazione, sotto).
  function applyCommentPolicyToPosts() {
    const { enabled, reason } = computeCommentsPermission();
    feedPosts.forEach((post) => {
      post.commentsEnabled = enabled;
      post.commentsDisabledReason = reason;
    });
    if (feed) feed.update({ posts: feedPosts });
  }
  applyCommentPolicyToPosts();

  // Entrambi i bottoni "Segui" nascono già nello stato "Segui già" (il
  // profilo si apre seguito): variante secondary + pressed:true fin
  // dalla creazione, non impostati in un secondo momento — evita un
  // frame iniziale visivamente incoerente con isFollowing=true.
  const headerFollowButton = createButton({ variant: "secondary", label: "Segui già", pressed: true });
  headerFollowButton.element.classList.add("sl-profile-timeline__follow-button");

  const privateFollowButton = createButton({ variant: "secondary", label: "Segui già", pressed: true });
  privateFollowButton.element.classList.add("sl-profile-timeline__private-follow");

  const settingsButton = createButton({
    variant: "icon",
    ariaLabel: "Impostazioni profilo",
    icon: buildSettingsIcon(),
  });
  settingsButton.element.classList.add("sl-profile-timeline__settings-trigger");

  // Applica isFollowing/followRequestPending a entrambi i bottoni
  // "Segui" + alla visibilità del profilo + all'annuncio aria-live —
  // unico punto che tocca questi aspetti insieme, così non possono
  // disallinearsi. Nessuno spostamento forzato del focus (invariato dal
  // comportamento precedente): il pannello Feed/Archivio selezionato
  // prima resta quello attivo al ritorno (publicContent viene solo
  // nascosto, mai smontato).
  function refreshFollowUI() {
    let label;
    let variant;
    if (isFollowing) {
      label = "Segui già";
      variant = "secondary";
    } else if (followRequestPending) {
      label = "Richiesta inviata";
      variant = "ghost";
    } else {
      label = "Segui";
      variant = "primary";
    }
    const nextProps = { label, variant, pressed: isFollowing };
    headerFollowButton.update(nextProps);
    privateFollowButton.update(nextProps);

    const visible = contentVisible();
    publicContent.hidden = !visible;
    privateNotice.element.hidden = visible;
    followStatus.textContent = visible
      ? "Contenuti visibili."
      : "Questo profilo è privato e non lo segui: contenuti nascosti.";

    applyCommentPolicyToPosts();
  }

  // Dialog informativo (Modal riusato, non un secondo overlay): nessun
  // vero backend dietro, ma la sequenza è quella di un social reale —
  // la richiesta resta in sospeso finché il profilo non la accetta.
  function openFollowRequestDialog() {
    const message = createElement("p", {
      text: `${profile.displayName || "Questo profilo"} deve accettare la tua richiesta per vedere i suoi contenuti.`,
    });
    const okButton = createButton({ variant: "primary", label: "Ho capito" });
    const dialog = createModal({ title: "Richiesta di follow inviata", content: [message, okButton.element] });
    function handleOk() {
      dialog.destroy();
    }
    okButton.element.addEventListener("sl:click", handleOk);
    dialog.element.addEventListener("sl:modal-close", () => {
      okButton.element.removeEventListener("sl:click", handleOk);
      okButton.destroy();
    });
  }

  // Un solo handler per entrambi i bottoni "Segui" (stesso stato
  // condiviso). L'unfollow è sempre immediato (nessun social reale
  // richiede approvazione per smettere di seguire); il follow dipende
  // da "followPolicy".
  function handleFollowToggle() {
    if (isFollowing) {
      isFollowing = false;
      followRequestPending = false;
      refreshFollowUI();
      wrapper.dispatchEvent(
        new CustomEvent("sl:profile-follow-toggle", { bubbles: true, detail: { following: false } })
      );
      return;
    }

    if (followRequestPending) {
      // Secondo click sulla richiesta pendente: la ritira.
      followRequestPending = false;
      refreshFollowUI();
      return;
    }

    if (followPolicy === "approval") {
      followRequestPending = true;
      refreshFollowUI();
      openFollowRequestDialog();
      return;
    }

    isFollowing = true;
    refreshFollowUI();
    wrapper.dispatchEvent(
      new CustomEvent("sl:profile-follow-toggle", { bubbles: true, detail: { following: true } })
    );
  }
  headerFollowButton.element.addEventListener("sl:click", handleFollowToggle);
  privateFollowButton.element.addEventListener("sl:click", handleFollowToggle);
  settingsButton.element.addEventListener("sl:click", openSettingsPanel);

  const header = buildProfileHeader(profile, rawPosts.length, settingsButton.element, headerFollowButton.element);
  const storiesBar = createStoriesBar({ stories });

  // Sostituisce StoriesBar quando "storiesAudience" è "close-friends":
  // in questa demo il visitatore non è mai un amico stretto, quindi
  // l'unica scelta onesta è nascondere la barra — ma mai in silenzio
  // (§5.7 architettura Fase 1, "mai uno stato affidato al solo colore/
  // alla sola assenza"): una riga di testo spiega perché non c'è nulla.
  const storiesNote = createElement("p", {
    classNames: "sl-profile-timeline__stories-note",
    text: "Storie visibili solo agli amici stretti.",
  });
  storiesNote.hidden = true;

  function updateStoriesVisibility() {
    const showStories = storiesAudience === "followers";
    storiesBar.element.hidden = !showStories;
    storiesNote.hidden = showStories;
  }
  updateStoriesVisibility();

  // hasMore:false — il dataset di uno scenario è un insieme fisso e già
  // completo: nessuna paginazione reale da simulare qui.
  feed = createFeed({ posts: feedPosts, isLoading: false, hasMore: false });
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
    storiesNote,
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

  // Pannello "Impostazioni" — Modal riusato con contenuto composto dai
  // 4 helper sopra. Ricostruito ad ogni apertura (mai tenuto in vita tra
  // un'apertura e l'altra, stesso principio già seguito da ProfileMenu/
  // Modal stessi: "create() = apri", nessuna istanza persistente).
  function openSettingsPanel() {
    const settingsChildren = []; // Button creati qui sotto, distrutti insieme alla chiusura del Modal

    const note = createElement("p", {
      classNames: "sl-profile-timeline__settings-note",
      text: "Anteprima didattica dei controlli di privacy offerti da un social reale: modificali per vedere l'effetto immediato sul profilo.",
    });

    const list = createElement("div", { classNames: "sl-profile-timeline__settings-list" }, [
      buildSettingsRow(
        "Profilo pubblico",
        "Visibile anche a chi non ti segue",
        buildToggleButton(
          isPublic,
          (next) => {
            isPublic = next;
            refreshFollowUI();
          },
          settingsChildren
        )
      ),
      buildSettingsRow(
        "Chi può seguirti",
        "Chi può inviarti richieste di follow",
        buildOptionGroup(
          [
            { value: "everyone", label: "Tutti" },
            { value: "approval", label: "Approvazione" },
          ],
          followPolicy,
          (next) => {
            followPolicy = next;
          },
          settingsChildren
        )
      ),
      buildSettingsRow(
        "Chi può commentare",
        "Sotto ai tuoi post",
        buildOptionGroup(
          [
            { value: "everyone", label: "Tutti" },
            { value: "followers", label: "Follower" },
            { value: "nobody", label: "Nessuno" },
          ],
          commentPolicy,
          (next) => {
            commentPolicy = next;
            applyCommentPolicyToPosts();
          },
          settingsChildren
        )
      ),
      buildSettingsRow(
        "Chi vede le storie",
        "Nella barra in evidenza",
        buildOptionGroup(
          [
            { value: "followers", label: "Tutti i follower" },
            { value: "close-friends", label: "Amici stretti" },
          ],
          storiesAudience,
          (next) => {
            storiesAudience = next;
            updateStoriesVisibility();
          },
          settingsChildren
        )
      ),
    ]);

    const modal = createModal({ title: "Impostazioni privacy", content: [note, list] });
    modal.element.addEventListener("sl:modal-close", () => {
      settingsChildren.forEach((child) => child.destroy());
    });
  }

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
    settingsButton.element.removeEventListener("sl:click", openSettingsPanel);
    header.destroy();
    storiesBar.destroy();
    feed.destroy();
    timeline.destroy();
    feedTab.destroy();
    archiveTab.destroy();
    headerFollowButton.destroy();
    privateFollowButton.destroy();
    settingsButton.destroy();
    privateNotice.destroy();
    // MediaViewer vive fuori da "wrapper" (montato direttamente su
    // <body>, come Modal): se questo controller viene smontato mentre il
    // visualizzatore è ancora aperto, va distrutto esplicitamente qui.
    mediaViewerLauncher.destroy();
  };
}
