/**
 * LoginForm.js
 * -----------------------------------------------------------------------
 * Form di login — SOLO UI (piano di Fase 1, Roadmap Fase 2: "form di
 * login" è un deliverable di QUESTA fase; "autenticazione reale" è
 * esplicitamente Fase 3). Nessuna dipendenza da authService: non esiste
 * ancora, e non deve esistere qui — questo componente non sa se le
 * credenziali sono corrette, sa solo se sono scritte in un FORMATO
 * plausibile (stesso principio "dumb" di tutti gli altri componenti).
 *
 * COMPONENTE, non "pagina": non esiste ancora un router/page controller
 * (Fase 4), quindi LoginForm resta un componente autosufficiente
 * (brand + card + form) con la propria interfaccia create/update/destroy
 * — pronto per essere montato da un vero page controller quando esisterà,
 * senza modifiche.
 *
 * VALIDAZIONE — SOLO DI FORMATO, non di credenziali:
 *   - email: obbligatoria + pattern minimo plausibile (contiene "@" e un
 *     dominio con punto). Non un regex RFC-completo: uno più permissivo
 *     rischierebbe di rifiutare indirizzi reali ma insoliti, esattamente
 *     il compromesso già scelto altrove nel progetto (KISS).
 *   - password: solo obbligatoria. Nessuna regola di complessità inventata
 *     qui: imporre requisiti di sicurezza è una decisione di backend/
 *     Fase 3 (dove esisterà un vero account), non di questo step.
 *   - Comportamento: valida al submit; DOPO il primo tentativo fallito,
 *     valida anche live (su "sl:blur"/"sl:input" di ciascun campo) per
 *     un feedback immediato mentre l'utente corregge — pattern UX
 *     consolidato ("valida al submit, poi in tempo reale"), evita di
 *     mostrare errori prematuri su un campo appena sfiorato la prima volta.
 *   - Focus automatico sul primo campo non valido dopo un submit fallito
 *     (richiede il metodo Input.focus(), aggiunto in questo stesso step) —
 *     requisito di accessibilità (WCAG 3.3.1): l'errore deve essere
 *     raggiungibile, non solo visibile.
 *
 * "novalidate" sul <form>: disabilita i tooltip nativi del browser (stile
 * incoerente tra browser diversi) in favore della UI di errore già
 * fornita da Input (helper text + aria-invalid + aria-describedby) —
 * un solo sistema di validazione visibile, non due sovrapposti.
 *
 * <form> REALE (non solo bottone + JS): dà "Invio conferma" gratuito su
 * qualunque campo (comportamento nativo atteso in un login reale) e
 * semantica corretta per screen reader — coerente con l'uso di elementi
 * nativi già preferito ovunque nel progetto (es. <a> in Sidebar invece
 * di bottoni con gestione manuale della navigazione).
 *
 * "Password dimenticata?": presente per realismo (un login reale senza
 * non sembrerebbe credibile — requisito esplicito di progetto), ma senza
 * flusso di recupero implementato (non esiste ancora, Fase 3+): emette
 * solo "sl:login-forgot-password", stesso pattern già usato altrove per
 * "emetti l'evento ora, collega il comportamento reale quando esisterà"
 * (es. sl:settings-click di ProfileMenu).
 *
 * Bottone "Accedi": <button type="submit"> (Button.js supporta già la
 * prop "type"), dentro il <form> — l'Invio da tastiera lo attiva
 * nativamente. Durante l'invio (prop "isSubmitting"): label cambia in
 * "Accesso in corso…" e riceve un'icona Loader (nuovo componente,
 * Fase 2/Step 8) — riusa il meccanismo icon+label già esistente di
 * Button (lo stesso già usato da PostCard per like/commenta/condividi),
 * nessuna modifica a Button.js necessaria.
 *
 * "error" (prop): messaggio di errore GENERALE (es. "Credenziali non
 * valide"), che potrà arrivare SOLO da un vero authService (Fase 3) — non
 * è una responsabilità di questo componente deciderlo, ma l'interfaccia è
 * già pronta a riceverlo e mostrarlo (banner con --sl-color-error-bg-subtle
 * + --sl-color-error-text, la stessa coppia "soft" già verificata e usata
 * da Badge/ProfileMenu — nessun nuovo accostamento colore).
 *
 * Interfaccia: create(props) → { element, update(props), destroy() }
 *
 * Props:
 *   - initialEmail {string} opzionale, valore iniziale del campo email
 *   - error        {string} opzionale, errore generale (es. da un futuro
 *     authService — "Credenziali non valide")
 *   - isSubmitting {boolean} default: false — disabilita i campi e il
 *     bottone, mostra lo stato di caricamento
 *
 * Eventi emessi (su element, bubbling):
 *   - sl:login-submit           detail: { email, password } (solo se il
 *     formato di entrambi i campi è valido)
 *   - sl:login-forgot-password  detail: {}
 */

import { createElement } from "../utils/dom.js";
import { create as createInput } from "./Input.js";
import { create as createButton } from "./Button.js";
import { create as createCard } from "./Card.js";
import { create as createLoader } from "./Loader.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "L'email è obbligatoria.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Inserisci un indirizzo email valido.";
  return null;
}

function validatePassword(value) {
  if (!value) return "La password è obbligatoria.";
  return null;
}

export function create(props = {}) {
  const state = {
    email: props.initialEmail || "",
    password: "",
    emailError: null,
    passwordError: null,
    hasAttemptedSubmit: false,
  };

  const childComponents = [];

  const errorBanner = createElement("p", {
    classNames: "sl-login-form__error-banner",
    attrs: { role: "alert" },
  });

  const emailInput = createInput({
    type: "email",
    label: "Email",
    required: true,
    autocomplete: "username",
    value: state.email,
  });
  childComponents.push(emailInput);

  const passwordInput = createInput({
    type: "password",
    label: "Password",
    required: true,
    autocomplete: "current-password",
  });
  childComponents.push(passwordInput);

  const spinner = createLoader({ size: "sm" });
  childComponents.push(spinner);

  const submitButton = createButton({ type: "submit", variant: "primary", label: "Accedi" });
  submitButton.element.classList.add("sl-login-form__submit");
  childComponents.push(submitButton);

  const forgotLink = createElement("button", {
    classNames: "sl-login-form__forgot",
    attrs: { type: "button" },
    text: "Password dimenticata?",
  });

  const form = createElement(
    "form",
    { classNames: "sl-login-form__form", attrs: { novalidate: "true" } },
    [errorBanner, emailInput.element, passwordInput.element, submitButton.element, forgotLink]
  );

  const card = createCard({ content: [form] });
  card.element.classList.add("sl-login-form__card");
  childComponents.push(card);

  const brand = createElement("h1", { classNames: "sl-login-form__brand", text: "SocialAlive" });
  const tagline = createElement("p", {
    classNames: "sl-login-form__tagline",
    text: "Accedi alla tua area riservata",
  });

  const element = createElement("div", { classNames: "sl-login-form" }, [brand, tagline, card.element]);

  function renderFromProps() {
    errorBanner.textContent = props.error || "";
    errorBanner.hidden = !props.error;

    const submitting = Boolean(props.isSubmitting);
    emailInput.update({ disabled: submitting });
    passwordInput.update({ disabled: submitting });
    submitButton.update({
      disabled: submitting,
      label: submitting ? "Accesso in corso…" : "Accedi",
      icon: submitting ? spinner.element : null,
    });
  }

  renderFromProps();

  function handleEmailInput(event) {
    state.email = event.detail.value;
    if (state.hasAttemptedSubmit && state.emailError) {
      state.emailError = validateEmail(state.email);
      emailInput.update({ error: state.emailError || undefined });
    }
  }

  function handlePasswordInput(event) {
    state.password = event.detail.value;
    if (state.hasAttemptedSubmit && state.passwordError) {
      state.passwordError = validatePassword(state.password);
      passwordInput.update({ error: state.passwordError || undefined });
    }
  }

  function handleEmailBlur() {
    if (!state.hasAttemptedSubmit) return;
    state.emailError = validateEmail(state.email);
    emailInput.update({ error: state.emailError || undefined });
  }

  function handlePasswordBlur() {
    if (!state.hasAttemptedSubmit) return;
    state.passwordError = validatePassword(state.password);
    passwordInput.update({ error: state.passwordError || undefined });
  }

  function handleForgotClick() {
    element.dispatchEvent(new CustomEvent("sl:login-forgot-password", { bubbles: true, detail: {} }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    state.hasAttemptedSubmit = true;

    state.emailError = validateEmail(state.email);
    state.passwordError = validatePassword(state.password);
    emailInput.update({ error: state.emailError || undefined });
    passwordInput.update({ error: state.passwordError || undefined });

    if (state.emailError) {
      emailInput.focus();
      return;
    }
    if (state.passwordError) {
      passwordInput.focus();
      return;
    }

    element.dispatchEvent(
      new CustomEvent("sl:login-submit", {
        bubbles: true,
        detail: { email: state.email.trim(), password: state.password },
      })
    );
  }

  emailInput.element.addEventListener("sl:input", handleEmailInput);
  emailInput.element.addEventListener("sl:blur", handleEmailBlur);
  passwordInput.element.addEventListener("sl:input", handlePasswordInput);
  passwordInput.element.addEventListener("sl:blur", handlePasswordBlur);
  forgotLink.addEventListener("click", handleForgotClick);
  form.addEventListener("submit", handleSubmit);

  function update(nextProps = {}) {
    props = { ...props, ...nextProps };
    renderFromProps();
  }

  function destroy() {
    emailInput.element.removeEventListener("sl:input", handleEmailInput);
    emailInput.element.removeEventListener("sl:blur", handleEmailBlur);
    passwordInput.element.removeEventListener("sl:input", handlePasswordInput);
    passwordInput.element.removeEventListener("sl:blur", handlePasswordBlur);
    forgotLink.removeEventListener("click", handleForgotClick);
    form.removeEventListener("submit", handleSubmit);
    childComponents.forEach((instance) => instance.destroy());
    element.remove();
  }

  return { element, update, destroy };
}
