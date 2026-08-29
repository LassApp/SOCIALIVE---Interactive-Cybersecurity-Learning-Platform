/**
 * fakeCaptivePortalRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "fake-captive-portal" (Evil Twin
 * Wi-Fi — terzo type reale del progetto, dopo "profile-timeline" e
 * "fake-login-capture"). State machine a 4 viste, mai coesistenti nel
 * DOM: reti Wi-Fi -> connessione -> portale captive -> completato —
 * stesso principio di swap già usato da profileTimelineRenderer.js per
 * Feed/Archivio, qui su 4 stati anziché 2.
 *
 * NOTA ETICA (invariata dal Keylogger): nessuna scansione/manipolazione
 * Wi-Fi reale (l'elenco reti è dato statico in networks.json, e
 * comunque tecnicamente impossibile da un browser); nessuna chiamata di
 * rete per la cattura; nessuna persistenza oltre il download locale.
 *
 * RETE "EVIL TWIN": solo la rete "secured:false" è cliccabile — una
 * rete protetta aprirebbe un prompt OS per la password, flusso fuori
 * scope. Le reti protette sono <li> puramente informativi, mai <button>
 * (mai promettere un'interazione non implementata, stessa disciplina di
 * Sidebar per le voci disabilitate). "insightNote" di ciascuna rete non
 * viene MAI letto qui: esiste solo per il docente nel JSON.
 *
 * BOTTONI SOCIAL: decorativi, provider FITTIZI (mai marchi reali, stessa
 * disciplina già applicata al brand "MailTime" del Phishing) — emettono
 * un evento senza listener applicativo, stesso trattamento di
 * "Password dimenticata?" in LoginForm.js.
 *
 * BRANDING DEL PORTALE: header (provider/headline/subheadline) costruito
 * qui, non da LoginForm — il form viene montato con showBrand:false/
 * showForgotLink:false (prop additive di LoginForm.js) per contribuire
 * SOLO i campi email/password, senza duplicare intestazioni né violare
 * l'incapsulamento del componente con un accesso diretto al suo DOM.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement, clearChildren } from "../../utils/dom.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { svgNode } from "../../utils/svg.js";
import { triggerTextDownload } from "../../utils/textDownload.js";
import { createLocalJsonResource, createLocalJsonRepository } from "../../repositories/localJsonRepository.js";
import { create as createButton } from "../../components/Button.js";
import { create as createLoader } from "../../components/Loader.js";
import { create as createLoginForm } from "../../components/LoginForm.js";
import { generateFakeLog } from "../../utils/keyloggerLogGenerator.js";

const CONNECTING_DELAY_MS = 1200;
const PORTAL_SUBMIT_DELAY_MS = 800;

function buildSignalIcon(level) {
  const svg = svgNode("svg", { viewBox: "0 0 24 24" });
  const heights = [6, 10, 14, 18];
  heights.forEach((h, index) => {
    svg.appendChild(
      svgNode("rect", {
        x: String(2 + index * 5),
        y: String(20 - h),
        width: "3.5",
        height: String(h),
        rx: "1",
        fill: "currentColor",
        opacity: index < level ? "1" : "0.3",
      })
    );
  });
  return svg;
}

function buildLockIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(
    svgNode("rect", { x: "5", y: "11", width: "14", height: "9", rx: "2", stroke: "currentColor", "stroke-width": "1.5" })
  );
  svg.appendChild(
    svgNode("path", { d: "M8 11V8a4 4 0 1 1 8 0v3", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" })
  );
  return svg;
}

// Icona generica "account collegato" — nessun logo di terze parti.
function buildSocialIcon() {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none" });
  svg.appendChild(svgNode("circle", { cx: "9", cy: "12", r: "6", stroke: "currentColor", "stroke-width": "1.5" }));
  svg.appendChild(svgNode("circle", { cx: "15", cy: "12", r: "6", stroke: "currentColor", "stroke-width": "1.5", opacity: "0.5" }));
  return svg;
}

export async function renderFakeCaptivePortal(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.networks || !refs.portal || !refs.logTemplate) {
    console.error(`[fakeCaptivePortalRenderer] "dataRefs" incompleto per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let networks, portalContent, logTemplate;
  try {
    const networksRepository = createLocalJsonRepository({ url: refs.networks, collectionKey: "networks" });
    const portalResource = createLocalJsonResource({ url: refs.portal });
    const logTemplateResource = createLocalJsonResource({ url: refs.logTemplate });
    [networks, portalContent, logTemplate] = await Promise.all([
      networksRepository.list(),
      portalResource.get(),
      logTemplateResource.get(),
    ]);
  } catch (error) {
    console.error(`[fakeCaptivePortalRenderer] Impossibile caricare i dati per "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let destroyed = false;
  let pendingTimer = null;
  let currentViewDestroy = null;

  const stage = createElement("div", { classNames: "sl-fake-captive-portal__stage" });
  const viewStatus = createElement("p", {
    classNames: ["sl-visually-hidden", "sl-fake-captive-portal__view-status"],
    attrs: { role: "status", "aria-live": "polite" },
  });
  const wrapper = createElement("div", { classNames: "sl-fake-captive-portal" }, [stage, viewStatus]);

  function swapView(buildFn, announce) {
    if (currentViewDestroy) {
      currentViewDestroy();
      currentViewDestroy = null;
    }
    clearChildren(stage);
    const view = buildFn();
    stage.appendChild(view.element);
    currentViewDestroy = view.destroy || null;
    viewStatus.textContent = announce;
  }

  // --- Vista 1: elenco reti -------------------------------------------
  function buildNetworksView() {
    const childComponents = [];
    const title = createElement("h1", { classNames: "sl-fake-captive-portal__title", text: "Wi-Fi" });
    const list = createElement("ul", { classNames: "sl-fake-captive-portal__networks-list" });

    networks.forEach((network) => {
      const iconWrap = createElement("span", { classNames: "sl-fake-captive-portal__network-icon", attrs: { "aria-hidden": "true" } }, [
        buildSignalIcon(network.signal),
      ]);
      const ssidEl = createElement("span", { classNames: "sl-fake-captive-portal__network-ssid", text: network.ssid });

      if (network.secured) {
        const item = createElement(
          "li",
          { classNames: ["sl-fake-captive-portal__network-item", "sl-fake-captive-portal__network-item--secured"] },
          [
            iconWrap,
            ssidEl,
            createElement("span", { classNames: "sl-fake-captive-portal__network-lock", attrs: { "aria-hidden": "true" } }, [buildLockIcon()]),
          ]
        );
        list.appendChild(item);
        return;
      }

      const button = createElement(
        "button",
        { classNames: "sl-fake-captive-portal__network-button", attrs: { type: "button", "aria-label": `Connetti alla rete ${network.ssid}, aperta` } },
        [iconWrap, ssidEl]
      );
      function handleClick() {
        swapView(() => buildConnectingView(network), `Connessione a ${network.ssid} in corso`);
        pendingTimer = setTimeout(() => {
          if (destroyed) return;
          swapView(buildPortalView, "Portale di accesso");
        }, CONNECTING_DELAY_MS);
      }
      button.addEventListener("click", handleClick);
      childComponents.push({ destroy: () => button.removeEventListener("click", handleClick) });
      list.appendChild(createElement("li", { classNames: "sl-fake-captive-portal__network-item" }, [button]));
    });

    const element = createElement("div", { classNames: "sl-fake-captive-portal__panel" }, [title, list]);
    return { element, destroy() { childComponents.forEach((c) => c.destroy()); } };
  }

  // --- Vista 2: connessione --------------------------------------------
  function buildConnectingView(network) {
    const loader = createLoader({ size: "lg" });
    const text = createElement("p", { classNames: "sl-fake-captive-portal__connecting-text", text: `Connessione a ${network.ssid} in corso…` });
    const element = createElement("div", { classNames: "sl-fake-captive-portal__connecting" }, [loader.element, text]);
    return { element, destroy: () => loader.destroy() };
  }

  // --- Vista 3: portale captive -----------------------------------------
  function buildPortalView() {
    const childComponents = [];
    const brand = createElement("p", { classNames: "sl-fake-captive-portal__portal-brand", text: portalContent.providerName || "" });
    const headline = createElement("h1", { classNames: "sl-fake-captive-portal__portal-headline", text: portalContent.headline || "" });
    const subheadline = createElement("p", { classNames: "sl-fake-captive-portal__portal-subheadline", text: portalContent.subheadline || "" });

    const socialButtons = (portalContent.socialProviders || []).map((provider) => {
      const button = createButton({ variant: "secondary", label: provider.label, icon: buildSocialIcon() });
      button.element.classList.add("sl-fake-captive-portal__social-button");
      // Decorativo — nessun listener applicativo, stesso trattamento già
      // riservato a "Password dimenticata?" in LoginForm.js.
      button.element.addEventListener("sl:click", () => {
        button.element.dispatchEvent(new CustomEvent("sl:captive-portal-social-click", { bubbles: true, detail: { providerId: provider.id } }));
      });
      childComponents.push(button);
      return button.element;
    });
    const socialWrap = createElement("div", { classNames: "sl-fake-captive-portal__social-buttons" }, socialButtons);
    const divider = createElement("p", { classNames: "sl-fake-captive-portal__divider", text: "oppure" });

    const loginForm = createLoginForm({ emailValidation: "loose", showBrand: false, showForgotLink: false });
    childComponents.push(loginForm);

    const terms = createElement("p", { classNames: "sl-fake-captive-portal__terms", text: portalContent.termsText || "" });

    async function handleSubmit(event) {
      const { email, password } = event.detail;
      loginForm.update({ isSubmitting: true, error: undefined });
      await new Promise((resolve) => setTimeout(resolve, PORTAL_SUBMIT_DELAY_MS));
      if (destroyed) return;
      const { fileName, content } = generateFakeLog(logTemplate, email, password);
      triggerTextDownload(fileName, content);
      swapView(() => buildCompletedView(fileName), "Connesso a Internet");
    }
    loginForm.element.addEventListener("sl:login-submit", handleSubmit);
    childComponents.push({ destroy: () => loginForm.element.removeEventListener("sl:login-submit", handleSubmit) });

    const element = createElement("div", { classNames: "sl-fake-captive-portal__panel" }, [
      brand, headline, subheadline, socialWrap, divider, loginForm.element, terms,
    ]);
    return { element, destroy() { childComponents.forEach((c) => c.destroy()); } };
  }

  // --- Vista 4: completato ------------------------------------------------
  function buildCompletedView(fileName) {
    const status = createElement("p", { classNames: "sl-visually-hidden", attrs: { role: "status", "aria-live": "polite" } });
    status.textContent = `Download avviato: ${fileName}`;
    const element = createElement("div", { classNames: "sl-fake-captive-portal__panel" }, [
      createElement("p", { classNames: "sl-fake-captive-portal__completed", text: "Connesso a Internet." }),
      status,
    ]);
    return { element, destroy: () => {} };
  }

  swapView(buildNetworksView, "Reti Wi-Fi disponibili");
  container.appendChild(wrapper);

  return function destroy() {
    destroyed = true;
    if (pendingTimer) clearTimeout(pendingTimer);
    if (currentViewDestroy) currentViewDestroy();
    wrapper.remove();
  };
}
