/**
 * loginPageController.js
 * -----------------------------------------------------------------------
 * Orchestratore della rotta #/login: monta LoginForm (Fase 2/Step 8, già
 * pronto), ascolta sl:login-submit, chiama authService.login(), riflette
 * isSubmitting/error sul componente, su successo naviga a #/home.
 *
 * Import diretto di router.js (per navigate): un page controller VIVE
 * dentro il routing, a differenza dei componenti che restano ignari
 * dell'esistenza del router (principio "dumb" già seguito ovunque in
 * Fase 2) — qui la dipendenza è corretta e prevista, non un'eccezione:
 * è esattamente il ruolo di orchestrazione riservato ai page controller
 * (architettura Fase 1 §2.1, "le pagine sono le uniche autorizzate a
 * orchestrare").
 *
 * Nessuna gestione di sl:login-forgot-password/sl:login-register oltre a
 * riceverli: nessun flusso di recupero o registrazione esiste (fuori
 * scope, già documentato in LoginForm.js) — i due listener sono qui solo
 * per completezza dell'interfaccia, pronti a essere popolati quando
 * servirà davvero.
 */

import { createElement } from "../utils/dom.js";
import { create as createLoginForm } from "../components/LoginForm.js";
import { login } from "../services/authService.js";
import { navigate } from "../core/router.js";

export function createLoginPageController(container) {
  const loginForm = createLoginForm({});
  const page = createElement("div", { classNames: "sl-login-page" }, [loginForm.element]);

  async function handleSubmit(event) {
    const { email, password } = event.detail;
    loginForm.update({ isSubmitting: true, error: undefined });

    const result = await login(email, password);

    if (result.success) {
      navigate("#/home");
      return; // il router smonterà questo controller: nessun update ulteriore necessario
    }

    loginForm.update({ isSubmitting: false, error: result.error });
  }

  function handleForgotPassword() {
    // Intenzionalmente vuoto — vedi rationale in testa al file.
  }

  function handleRegister() {
    // Intenzionalmente vuoto — vedi rationale in testa al file.
  }

  loginForm.element.addEventListener("sl:login-submit", handleSubmit);
  loginForm.element.addEventListener("sl:login-forgot-password", handleForgotPassword);
  loginForm.element.addEventListener("sl:login-register", handleRegister);

  container.appendChild(page);

  return function destroy() {
    loginForm.element.removeEventListener("sl:login-submit", handleSubmit);
    loginForm.element.removeEventListener("sl:login-forgot-password", handleForgotPassword);
    loginForm.element.removeEventListener("sl:login-register", handleRegister);
    loginForm.destroy();
    page.remove();
  };
}
