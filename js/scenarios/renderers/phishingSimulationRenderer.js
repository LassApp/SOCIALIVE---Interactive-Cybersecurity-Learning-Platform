/**
 * phishingSimulationRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "phishing-simulation" — terzo type
 * distinto nel progetto (dopo "profile-timeline" e "fake-login-capture"),
 * introdotto perché uno scenario "webmail + sito fittizio a più
 * schermate" non è né un profilo da sfogliare né un singolo finto login:
 * serve una vera macchina a stati con cinque viste in sequenza:
 * Inbox → Email aperta → Finto sito (Accesso) → Finto sito (Pagamento)
 * → Rivelazione.
 *
 * chrome:"none" (come Keylogger): un client di posta/un sito bancario
 * realistici non devono mostrare l'header/sidebar di SocialAlive attorno
 * a sé — romperebbe l'illusione dal primo istante, stesso principio già
 * motivato per fakeLoginCaptureRenderer.js.
 *
 * INTESTAZIONE PER VISTA, NON UN TOPBAR FISSO CONDIVISO — decisione
 * rivista rispetto alla primissima implementazione (che aveva un
 * topbar "MailTime" esterno, comune a tutte le viste): non appena il
 * flusso lascia il client di posta per il finto sito bancario, l'utente
 * "naviga" concettualmente verso un'altra applicazione — mantenere
 * visibile il marchio del client di posta sopra un sito bancario
 * romperebbe la finzione. Ogni vista costruisce quindi la propria
 * intestazione coerente con l'app che sta impersonando: "MailTime" per
 * Inbox/Dettaglio (buildMailTopbar, condivisa dalle due), il nome banca
 * + barra indirizzo per le due viste del finto sito (buildBrowserBar),
 * un badge "Simulazione completata" per la Rivelazione (che non finge
 * di essere né l'uno né l'altro — è il momento in cui la finzione
 * termina esplicitamente).
 *
 * CTA NELL'EMAIL — presente SOLO se il dato lo prevede: il campo
 * "ctaLabel" in inbox.json esiste oggi solo sull'email target,
 * risolvendo per costruzione dei dati il problema "un bottone che non
 * porta da nessuna parte" (nessun controllo interattivo senza un
 * effetto osservabile, principio già rispettato ovunque nel progetto) —
 * ora che la vista di destinazione (il finto sito) esiste, il CTA è
 * cablato alla transizione reale.
 *
 * FETCH: inbox.json (createLocalJsonRepository, "emails" come
 * collectionKey) + bank-site.json/reveal.json (createLocalJsonResource,
 * risorse singole) — tutti e tre in un solo Promise.all, stesso pattern
 * già usato da profileTimelineRenderer.js per i propri tre dataset.
 *
 * MACCHINA A STATI — rebuild-on-transition, non show/hide di sottoalberi
 * paralleli: a differenza del toggle Feed/Archivio di
 * profileTimelineRenderer.js (dove i due pannelli coesistono nel DOM e
 * si nascondono a vicenda, utile perché lo stato di scroll/selezione del
 * Feed va preservato tra un giro e l'altro), qui il flusso è
 * sostanzialmente lineare (un solo "indietro" verso l'inbox, nessuno
 * stato interno da preservare tra un'apertura e l'altra) — si ricostruisce
 * la vista corrente ad ogni transizione, stesso principio già seguito da
 * fakeLoginCaptureRenderer.js per il proprio passaggio form→messaggio
 * finale: risparmia la complessità di gestire N sottoalberi nascosti per
 * un guadagno di stato che qui non serve.
 *
 * <h1> UNICO PER VISTA, MAI DUPLICATO: "MailTime" per Inbox/Dettaglio,
 * il nome della banca per le due viste del finto sito, il titolo della
 * rivelazione per l'ultima vista — dato che una sola vista è montata
 * alla volta (rebuild-on-transition), non esiste mai più di un <h1> nel
 * DOM in un dato istante, anche se il file ne dichiara diversi in punti
 * diversi. "Posta in arrivo"/oggetto email/titolo di step del finto
 * sito sono tutti <h2>, mai un secondo <h1> nella stessa vista.
 *
 * VALIDAZIONE DEI DUE FORM DEL FINTO SITO — MINIMA E DELIBERATA
 * (richiesta esplicita dell'utente): qualunque valore non vuoto è
 * accettato, sia per le credenziali di accesso sia per i dati di
 * pagamento — nessun controllo di formato (niente regex email, niente
 * algoritmo di Luhn sul numero di carta, niente formato MM/AA sulla
 * scadenza). Aggiungere una validazione più stringente insegnerebbe
 * implicitamente "come si genera un numero di carta valido", fuori tema
 * rispetto all'obiettivo pedagogico (riconoscere i segnali d'allarme,
 * non produrre dati plausibili). CVV con type:"password" (mascherato),
 * stesso realismo di un vero form bancario.
 *
 * autocomplete:"off" su TUTTI i campi dei due form del finto sito —
 * decisione di sicurezza pratica, non solo teorica: senza, il browser
 * del docente potrebbe suggerire/autocompletare credenziali o dati di
 * pagamento REALMENTE salvati (di un altro sito) durante una demo dal
 * vivo in aula. Nessun dato di questi form esce mai dal browser né viene
 * mai persistito in alcun modo, in ogni caso — ma evitare la sola
 * TENTAZIONE di usare dati reali è già di per sé la scelta più sicura.
 *
 * FINTA LATENZA DI SUBMIT (~800ms) su entrambi i form del finto sito —
 * stessa deviazione già dichiarata e motivata per il Keylogger:
 * l'intero scenario è una ricostruzione didattica, non un pezzo di app
 * reale in attesa di backend.
 *
 * Righe della lista inbox: bottoni nativi dentro <li> minimi, stesso
 * pattern già usato da Timeline.js per le proprie celle mese.
 *
 * Stato "non letta": MAI il solo peso tipografico come segnale — un
 * aria-label esplicito lo dichiara anche a chi usa uno screen reader
 * (stesso principio "mai il solo colore/stile" già applicato ovunque nel
 * progetto, qui esteso al peso del font).
 *
 * Annuncio aria-live ad ogni transizione di vista: stesso principio già
 * seguito da Feed.js/profileTimelineRenderer.js/MediaViewer.js per ogni
 * cambio di contenuto non accompagnato da una vera navigazione di pagina.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement, clearChildren } from "../../utils/dom.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { createLocalJsonRepository, createLocalJsonResource } from "../../repositories/localJsonRepository.js";
import { create as createAvatar } from "../../components/Avatar.js";
import { create as createButton } from "../../components/Button.js";
import { create as createInput } from "../../components/Input.js";
import { create as createLoader } from "../../components/Loader.js";
import { create as createBadge } from "../../components/Badge.js";

// Stesso ordine di grandezza già usato altrove nel progetto per una
// finta latenza di submit (Keylogger, style-guide.html): 800ms — vedi
// rationale "FINTA LATENZA DI SUBMIT" già motivato per il Keylogger,
// stesso principio qui: l'intero scenario è una ricostruzione didattica,
// non un pezzo di app reale in attesa di backend.
const FAKE_SUBMIT_DELAY_MS = 800;

// Validazione MINIMA e deliberata (richiesta esplicita dell'utente):
// qualunque valore non vuoto è accettato, su ENTRAMBI i form del finto
// sito — nessun controllo di formato (niente regex email, niente
// algoritmo di Luhn sul numero di carta, niente formato MM/AA sulla
// scadenza). Aggiungere una validazione più stringente insegnerebbe
// implicitamente "come si genera un numero di carta valido", fuori tema
// rispetto all'obiettivo pedagogico di questo scenario (riconoscere i
// segnali d'allarme, non produrre dati plausibili).
function validateRequired(value) {
  return (value || "").trim() ? null : "Campo obbligatorio.";
}

// Riga della lista inbox: bottone nativo con l'intero contenuto visibile
// come figli (avatar decorativo + blocco testuale) — il nome accessibile
// arriva da un aria-label esplicito (sotto), non dal testo concatenato
// dei figli: evita di far leggere per intero anche lo snippet come parte
// del "nome" del controllo, pur mantenendolo visibile.
function buildEmailRow(email, onOpen) {
  const avatar = createAvatar({ name: email.sender?.name, size: "md", ariaHidden: true });

  const senderEl = createElement("span", {
    classNames: ["sl-phishing__email-sender", email.unread ? "sl-phishing__email-sender--unread" : ""],
    text: email.sender?.name || "",
  });
  const timestampEl = createElement("span", {
    classNames: "sl-phishing__email-timestamp",
    text: email.timestamp || "",
  });
  const topLine = createElement("span", { classNames: "sl-phishing__email-line" }, [senderEl, timestampEl]);

  const subjectEl = createElement("span", {
    classNames: ["sl-phishing__email-subject", email.unread ? "sl-phishing__email-subject--unread" : ""],
    text: email.subject || "",
  });
  const snippetEl = createElement("span", {
    classNames: "sl-phishing__email-snippet",
    text: email.snippet || "",
  });

  const textBlock = createElement("span", { classNames: "sl-phishing__email-text" }, [
    topLine,
    subjectEl,
    snippetEl,
  ]);

  // Stato "non letta" dichiarato esplicitamente per chi usa uno screen
  // reader — mai affidato al solo peso tipografico (vedi rationale in
  // testa al file).
  const accessibleName = `${email.unread ? "Non letta. " : ""}${email.sender?.name || ""}: ${email.subject || ""}`;

  const row = createElement(
    "button",
    { classNames: "sl-phishing__email-row", attrs: { type: "button", "aria-label": accessibleName } },
    [avatar.element, textBlock]
  );

  function handleClick() {
    onOpen(email.id);
  }
  row.addEventListener("click", handleClick);

  const item = createElement("li", { classNames: "sl-phishing__email-item" }, [row]);

  return {
    element: item,
    destroy() {
      row.removeEventListener("click", handleClick);
      avatar.destroy();
    },
  };
}

// Intestazione del finto client di posta — condivisa da Inbox e
// Dettaglio (entrambe le viste restano concettualmente "dentro" lo
// stesso client fino al click sul CTA): un nuovo <h1> ad ogni mount,
// mai un nodo condiviso tra viste diverse (ogni vista è un blocco
// completo e autonomo, coerente con "rebuild-on-transition", vedi
// rationale più sotto).
function buildMailTopbar() {
  const brand = createElement("h1", { classNames: "sl-phishing__brand", text: "MailTime" });
  return createElement("div", { classNames: "sl-phishing__topbar" }, [brand]);
}

function buildInboxView(emails, onOpen) {
  const topbar = buildMailTopbar();
  const heading = createElement("h2", { classNames: "sl-phishing__view-title", text: "Posta in arrivo" });

  const rows = emails.map((email) => buildEmailRow(email, onOpen));

  const list = createElement(
    "ul",
    { classNames: "sl-phishing__email-list" },
    rows.map((row) => row.element)
  );

  const element = createElement("div", { classNames: "sl-phishing__inbox" }, [topbar, heading, list]);

  return {
    element,
    destroy() {
      rows.forEach((row) => row.destroy());
    },
  };
}

// Vista di dettaglio. "onOpenSite" è definita SOLO se l'email porta un
// ctaLabel (solo l'email target, per costruzione dei dati) — le email di
// riempimento restano di sola lettura, un bottone "Indietro" e nient'altro.
function buildEmailDetailView(email, { onOpenSite, onBack }) {
  const topbar = buildMailTopbar();

  const backButton = createButton({ variant: "secondary", label: "Indietro" });
  backButton.element.classList.add("sl-phishing__back");
  function handleBack() {
    onBack();
  }
  backButton.element.addEventListener("sl:click", handleBack);

  const avatar = createAvatar({ name: email.sender?.name, size: "md", ariaHidden: true });
  const senderName = createElement("span", {
    classNames: "sl-phishing__detail-sender-name",
    text: email.sender?.name || "",
  });
  const senderAddress = createElement("span", {
    classNames: "sl-phishing__detail-sender-address",
    text: email.sender?.address || "",
  });
  const senderText = createElement("span", { classNames: "sl-phishing__detail-sender-text" }, [
    senderName,
    senderAddress,
  ]);
  const timestamp = createElement("span", {
    classNames: "sl-phishing__detail-timestamp",
    text: email.timestamp || "",
  });

  const metaRow = createElement("div", { classNames: "sl-phishing__detail-meta" }, [
    avatar.element,
    senderText,
    timestamp,
  ]);

  const subject = createElement("h2", { classNames: "sl-phishing__detail-subject", text: email.subject || "" });
  const body = createElement("p", { classNames: "sl-phishing__detail-body", text: email.body || "" });

  const children = [topbar, backButton.element, subject, metaRow, body];

  // CTA presente SOLO se il dato lo prevede (campo "ctaLabel" in
  // inbox.json, oggi solo sull'email target) — vedi rationale "STEP
  // CORRENTE" più sotto per perché nello step precedente non esisteva.
  let ctaButton = null;
  if (email.ctaLabel && onOpenSite) {
    ctaButton = createButton({ variant: "primary", label: email.ctaLabel });
    ctaButton.element.classList.add("sl-phishing__cta");
    ctaButton.element.addEventListener("sl:click", onOpenSite);
    children.push(ctaButton.element);
  }

  const element = createElement("div", { classNames: "sl-phishing__detail" }, children);

  return {
    element,
    destroy() {
      backButton.element.removeEventListener("sl:click", handleBack);
      backButton.destroy();
      avatar.destroy();
      if (ctaButton) {
        ctaButton.element.removeEventListener("sl:click", onOpenSite);
        ctaButton.destroy();
      }
    },
  };
}

// Mini barra indirizzo del finto sito — l'unico elemento pensato
// esplicitamente per insegnare "controlla l'URL prima di inserire
// qualunque dato" (vedi reveal.json, segnale "Indirizzo del sito non
// ufficiale"). Prefisso invisibile per chi usa uno screen reader: il
// solo testo dell'URL, senza contesto, sarebbe ambiguo.
function buildBrowserBar(fakeUrl) {
  const prefix = createElement("span", { classNames: "sl-visually-hidden", text: "Indirizzo del sito: " });
  const url = createElement("span", { classNames: "sl-phishing__browser-url", text: fakeUrl || "" });
  return createElement("div", { classNames: "sl-phishing__browser-bar" }, [prefix, url]);
}

// Vista "Falso sito — Step A: Accesso". Due soli campi (email/codice
// cliente + password): NESSUNA validazione di formato oltre
// all'obbligatorietà, per costruzione (vedi validateRequired sopra) — è
// possibile digitare qualunque valore, anche non corrispondente a
// un'email reale, come richiesto esplicitamente.
//
// autocomplete:"off" su ENTRAMBI i campi — decisione di sicurezza
// pratica, non solo teorica: senza, il browser del docente potrebbe
// suggerire/autocompletare credenziali REALMENTE salvate (di un altro
// sito) durante una demo dal vivo in aula. Nessun dato di questo form
// esce mai dal browser né viene mai persistito, in ogni caso — ma
// evitare la sola TENTAZIONE di usare dati reali è già di per sé la
// scelta più sicura.
function buildBankLoginView(bankSite, onSubmit) {
  const browserBar = buildBrowserBar(bankSite.fakeUrl);
  const bankName = createElement("h1", { classNames: "sl-phishing__bank-name", text: bankSite.bankName || "" });
  const stepTitle = createElement("h2", {
    classNames: "sl-phishing__bank-step-title",
    text: bankSite.loginStep?.title || "",
  });
  const stepDescription = createElement("p", {
    classNames: "sl-phishing__bank-step-description",
    text: bankSite.loginStep?.description || "",
  });

  const state = { identifier: "", password: "" };

  const identifierInput = createInput({ label: "Email o codice cliente", required: true, autocomplete: "off" });
  const passwordInput = createInput({ label: "Password", type: "password", required: true, autocomplete: "off" });

  function handleIdentifierInput(event) {
    state.identifier = event.detail.value;
  }
  function handlePasswordInput(event) {
    state.password = event.detail.value;
  }
  identifierInput.element.addEventListener("sl:input", handleIdentifierInput);
  passwordInput.element.addEventListener("sl:input", handlePasswordInput);

  const spinner = createLoader({ size: "sm" });
  const submitButton = createButton({
    type: "submit",
    variant: "primary",
    label: bankSite.loginStep?.submitLabel || "Accedi",
  });
  submitButton.element.classList.add("sl-phishing__bank-submit");

  const form = createElement(
    "form",
    { classNames: "sl-phishing__bank-form", attrs: { novalidate: "true" } },
    [identifierInput.element, passwordInput.element, submitButton.element]
  );

  let isSubmitting = false;
  let submitTimer = null;

  function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const identifierError = validateRequired(state.identifier);
    const passwordError = validateRequired(state.password);
    identifierInput.update({ error: identifierError || undefined });
    passwordInput.update({ error: passwordError || undefined });
    if (identifierError) {
      identifierInput.focus();
      return;
    }
    if (passwordError) {
      passwordInput.focus();
      return;
    }

    isSubmitting = true;
    identifierInput.update({ disabled: true });
    passwordInput.update({ disabled: true });
    submitButton.update({ disabled: true, label: "Accesso in corso…", icon: spinner.element });

    submitTimer = setTimeout(() => onSubmit(), FAKE_SUBMIT_DELAY_MS);
  }
  form.addEventListener("submit", handleSubmit);

  const element = createElement("div", { classNames: "sl-phishing__browser" }, [
    browserBar,
    createElement("div", { classNames: "sl-phishing__bank" }, [bankName, stepTitle, stepDescription, form]),
  ]);

  return {
    element,
    destroy() {
      if (submitTimer) clearTimeout(submitTimer);
      identifierInput.element.removeEventListener("sl:input", handleIdentifierInput);
      passwordInput.element.removeEventListener("sl:input", handlePasswordInput);
      form.removeEventListener("submit", handleSubmit);
      identifierInput.destroy();
      passwordInput.destroy();
      submitButton.destroy();
      spinner.destroy();
    },
  };
}

// Vista "Falso sito — Step B: Metodo di pagamento". 5 campi (numero
// carta, scadenza, CVV, nome, cognome intestatario) — CVV con
// type:"password" (mascherato durante la digitazione, stesso realismo
// di un vero form bancario). Stessa validazione minima e stesso
// autocomplete:"off" del passo precedente, stesso rationale.
function buildBankCardView(bankSite, onSubmit) {
  const browserBar = buildBrowserBar(bankSite.fakeUrl);
  const bankName = createElement("h1", { classNames: "sl-phishing__bank-name", text: bankSite.bankName || "" });
  const stepTitle = createElement("h2", {
    classNames: "sl-phishing__bank-step-title",
    text: bankSite.cardStep?.title || "",
  });
  const stepDescription = createElement("p", {
    classNames: "sl-phishing__bank-step-description",
    text: bankSite.cardStep?.description || "",
  });

  const state = { cardNumber: "", expiry: "", cvv: "", firstName: "", lastName: "" };

  const cardNumberInput = createInput({
    label: "Numero carta",
    placeholder: "0000 0000 0000 0000",
    required: true,
    autocomplete: "off",
  });
  const expiryInput = createInput({ label: "Scadenza (MM/AA)", placeholder: "MM/AA", required: true, autocomplete: "off" });
  const cvvInput = createInput({ label: "CVV", type: "password", required: true, autocomplete: "off" });
  const firstNameInput = createInput({ label: "Nome", required: true, autocomplete: "off" });
  const lastNameInput = createInput({ label: "Cognome", required: true, autocomplete: "off" });

  const fieldEntries = [
    { input: cardNumberInput, key: "cardNumber" },
    { input: expiryInput, key: "expiry" },
    { input: cvvInput, key: "cvv" },
    { input: firstNameInput, key: "firstName" },
    { input: lastNameInput, key: "lastName" },
  ];

  const handlers = fieldEntries.map(({ input, key }) => {
    function handler(event) {
      state[key] = event.detail.value;
    }
    input.element.addEventListener("sl:input", handler);
    return { input, handler };
  });

  const spinner = createLoader({ size: "sm" });
  const submitButton = createButton({
    type: "submit",
    variant: "primary",
    label: bankSite.cardStep?.submitLabel || "Conferma",
  });
  submitButton.element.classList.add("sl-phishing__bank-submit");

  const form = createElement(
    "form",
    { classNames: "sl-phishing__bank-form", attrs: { novalidate: "true" } },
    [...fieldEntries.map(({ input }) => input.element), submitButton.element]
  );

  let isSubmitting = false;
  let submitTimer = null;

  function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    let firstInvalid = null;
    fieldEntries.forEach(({ input, key }) => {
      const error = validateRequired(state[key]);
      input.update({ error: error || undefined });
      if (error && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    isSubmitting = true;
    fieldEntries.forEach(({ input }) => input.update({ disabled: true }));
    submitButton.update({ disabled: true, label: "Elaborazione in corso…", icon: spinner.element });

    submitTimer = setTimeout(() => onSubmit(), FAKE_SUBMIT_DELAY_MS);
  }
  form.addEventListener("submit", handleSubmit);

  const element = createElement("div", { classNames: "sl-phishing__browser" }, [
    browserBar,
    createElement("div", { classNames: "sl-phishing__bank" }, [bankName, stepTitle, stepDescription, form]),
  ]);

  return {
    element,
    destroy() {
      if (submitTimer) clearTimeout(submitTimer);
      handlers.forEach(({ input, handler }) => input.element.removeEventListener("sl:input", handler));
      form.removeEventListener("submit", handleSubmit);
      fieldEntries.forEach(({ input }) => input.destroy());
      submitButton.destroy();
      spinner.destroy();
    },
  };
}

// Vista di rivelazione — MAI una "vittoria"/punteggio, un momento di
// spiegazione onesta. Badge "Simulazione completata" (tono info, stesso
// token già verificato ovunque per badge/notice) segnala chiaramente che
// la finzione è finita: da qui in poi si parla di nuovo "fuori" dal
// finto sito/client di posta, coerente con l'uscita di scena di
// entrambe le identità fittizie precedenti.
function buildRevealView(reveal) {
  const badge = createBadge({ label: "Simulazione completata", tone: "info" });
  badge.element.classList.add("sl-phishing__reveal-badge");

  const title = createElement("h1", { classNames: "sl-phishing__reveal-title", text: reveal.title || "" });
  const intro = createElement("p", { classNames: "sl-phishing__reveal-intro", text: reveal.intro || "" });

  // <ol>: ordine reale (segue la lettura naturale dell'email, dal
  // mittente al corpo all'URL), non solo un dettaglio estetico — stesso
  // principio già seguito da Timeline.js per la propria griglia
  // cronologica. Numerazione visiva via CSS (contatore), non tramite gli
  // indicatori nativi di <ol> (azzerati globalmente da reset.css).
  const flagItems = (reveal.redFlags || []).map((flag) =>
    createElement("li", { classNames: "sl-phishing__reveal-flag" }, [
      createElement("h2", { classNames: "sl-phishing__reveal-flag-title", text: flag.title || "" }),
      createElement("p", { classNames: "sl-phishing__reveal-flag-description", text: flag.description || "" }),
    ])
  );
  const flagsList = createElement("ol", { classNames: "sl-phishing__reveal-flags" }, flagItems);

  const closing = createElement("p", { classNames: "sl-phishing__reveal-closing", text: reveal.closingText || "" });

  const element = createElement("div", { classNames: "sl-phishing__reveal" }, [
    badge.element,
    title,
    intro,
    flagsList,
    closing,
  ]);

  return {
    element,
    destroy() {
      badge.destroy();
    },
  };
}

export async function renderPhishingSimulation(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.inbox || !refs.bankSite || !refs.reveal) {
    console.error(`[phishingSimulationRenderer] "dataRefs" incompleto per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let emails;
  let bankSite;
  let reveal;

  try {
    const inboxRepository = createLocalJsonRepository({ url: refs.inbox, collectionKey: "emails", idField: "id" });
    const bankSiteResource = createLocalJsonResource({ url: refs.bankSite });
    const revealResource = createLocalJsonResource({ url: refs.reveal });

    [emails, bankSite, reveal] = await Promise.all([
      inboxRepository.list(),
      bankSiteResource.get(),
      revealResource.get(),
    ]);
  } catch (error) {
    console.error(`[phishingSimulationRenderer] Impossibile caricare i dati per "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  const viewport = createElement("div", { classNames: "sl-phishing__view" });

  // Annuncio invisibile ad ogni transizione — stesso principio già
  // seguito da Feed.js/profileTimelineRenderer.js/MediaViewer.js.
  const status = createElement("p", {
    classNames: "sl-visually-hidden",
    attrs: { role: "status", "aria-live": "polite" },
  });

  const wrapper = createElement("div", { classNames: "sl-phishing" }, [viewport, status]);

  let currentView = null; // { element, destroy() } — vista attualmente montata in "viewport"

  function mountView(nextView) {
    if (currentView) currentView.destroy();
    clearChildren(viewport);
    currentView = nextView;
    viewport.appendChild(nextView.element);
  }

  function showInbox() {
    mountView(buildInboxView(emails, showEmailDetail));
    status.textContent = `Posta in arrivo: ${emails.length} email`;
  }

  function showEmailDetail(emailId) {
    const email = emails.find((item) => item.id === emailId);
    if (!email) return;
    const onOpenSite = email.ctaLabel ? showBankLogin : undefined;
    mountView(buildEmailDetailView(email, { onOpenSite, onBack: showInbox }));
    status.textContent = `Email aperta: ${email.subject || ""}`;
  }

  function showBankLogin() {
    mountView(buildBankLoginView(bankSite, showBankCard));
    status.textContent = `Sito aperto: ${bankSite.bankName || ""}`;
  }

  function showBankCard() {
    mountView(buildBankCardView(bankSite, showReveal));
    status.textContent = `Vista: ${bankSite.cardStep?.title || "Metodo di pagamento"}`;
  }

  function showReveal() {
    mountView(buildRevealView(reveal));
    status.textContent = reveal.title || "";
  }

  showInbox();

  container.appendChild(wrapper);

  return function destroy() {
    if (currentView) currentView.destroy();
    wrapper.remove();
  };
}
