/**
 * fakeLoginCaptureRenderer.js
 * -----------------------------------------------------------------------
 * Renderer per gli scenari di type "fake-login-capture" (scenario
 * Keylogger — primo type diverso da "profile-timeline" nel progetto).
 * Mostra un login fittizio identico nell'aspetto a quello reale (riusa
 * LoginForm.js/Button.js/Loader.js/Card.js as-is): al submit genera un
 * file di log fittizio con le credenziali digitate e lo scarica
 * localmente — nessun redirect applicativo, nessuna rivelazione dentro
 * l'interfaccia.
 *
 * NOTA ETICA — vincolo assoluto, rispettato in ogni riga di questo file:
 *   - NESSUN listener globale su "keydown"/"input" fuori dai due campi
 *     di questo form: non viene intercettato nulla al di fuori di ciò
 *     che l'utente digita volontariamente in QUESTI due input (che sono
 *     gli stessi identici campi di LoginForm.js, già verificati in
 *     Fase 2 — nessuna estensione della loro superficie di ascolto).
 *   - NESSUNA chiamata di rete per il meccanismo di "cattura": l'unica
 *     fetch di questo file è quella, già esistente nel progetto, che
 *     carica log-template.json (dati di configurazione, non
 *     credenziali) — mai un invio di username/password altrove.
 *   - NESSUNA persistenza: il testo generato vive in memoria per il
 *     tempo di costruire un Blob, scaricato subito e mai altrimenti
 *     salvato (né storage.js né alcun altro meccanismo del progetto
 *     viene toccato).
 *   - Questo è uno strumento didattico che RICOSTRUISCE VISIVAMENTE
 *     l'effetto di un keylogger, non un keylogger funzionante.
 *
 * PERCHÉ chrome:"none" (scenarioPageController.js) — questo scenario è
 * il primo a richiedere il layout immersivo: mostrare AppHeader/Sidebar
 * di SocialAlive attorno a un "finto login" romperebbe l'illusione
 * nell'istante stesso in cui la pagina si apre — l'intero valore
 * pedagogico dipende dal fatto che questa schermata sembri
 * indistinguibile da un vero login fino al momento della rivelazione
 * (che avviene fuori app, quando il docente apre il file scaricato).
 *
 * RIUSO DI LoginForm.js, NON DUPLICAZIONE: l'unica differenza reale col
 * login vero è la regola di validazione del campo email — qui basta la
 * presenza di "@" (il docente digita credenziali di fantasia decise al
 * momento, non un indirizzo verificabile), non il formato completo
 * "utente@dominio.tld" richiesto dal login reale. Estensione additiva
 * di LoginForm.js (prop "emailValidation": "loose", vedi quel file):
 * zero duplicazione di markup/CSS/accessibilità già risolti lì. Questa
 * stessa validazione è anche ciò che GARANTISCE la presenza di "@" nel
 * file scaricato senza che questo renderer o il generatore debbano mai
 * aggiungerne una sintetica (vedi rationale completo in
 * keyloggerLogGenerator.js).
 *
 * DOWNLOAD DEL FILE — triggerTextDownload() condivisa (Evil Twin
 * Wi-Fi, js/utils/textDownload.js): viveva come funzione locale in
 * questo stesso file, estratta al secondo consumo reale
 * (fakeCaptivePortalRenderer.js, scenario Evil Twin Wi-Fi) — stesso
 * principio DRY già seguito per svg.js/fallbackMessage.js/
 * imageFadeIn.js/mediaViewerLauncher.js. Comportamento identico,
 * byte per byte, a prima: zero regressione attesa.
 *
 * FINTA LATENZA DI SUBMIT (~800ms) — deviazione DICHIARATA dal principio
 * "niente latenza finta" stabilito per il Feed della Home (Fase 4 §4:
 * "un backend fittizio con latenza simulata sarebbe codice finto dentro
 * l'app vera"). Qui il ragionamento è opposto: l'INTERO scenario è
 * dichiaratamente una ricostruzione visiva ad uso didattico (vedi nota
 * etica sopra), non un pezzo di applicazione reale in attesa di un
 * backend vero — un login reale mostra sempre un breve stato "in corso"
 * prima di risolversi, ometterlo qui indebolirebbe proprio il realismo
 * che è l'obiettivo esplicito di questo scenario.
 *
 * DOPO IL DOWNLOAD: nessun redirect, nessun badge, nessuna rivelazione
 * nell'interfaccia — il form si sostituisce con un messaggio neutro
 * ("Accesso completato."), esattamente come richiesto: la rivelazione
 * pedagogica avviene SOLO quando il docente apre il file fuori
 * dall'app, in classe.
 *
 * Firma richiesta dall'engine: (container, scenario) => Promise<destroy|undefined>.
 */

import { createElement } from "../../utils/dom.js";
import { buildFallbackMessage } from "../../utils/fallbackMessage.js";
import { triggerTextDownload } from "../../utils/textDownload.js";
import { createLocalJsonResource } from "../../repositories/localJsonRepository.js";
import { create as createLoginForm } from "../../components/LoginForm.js";
import { generateFakeLog } from "../../utils/keyloggerLogGenerator.js";

// Stesso ordine di grandezza già usato altrove nel progetto per una
// finta latenza di submit (style-guide.html, demo di LoginForm: 800ms)
// — vedi rationale "FINTA LATENZA DI SUBMIT" in testa al file per il
// perché qui è una scelta deliberata, diversa dal caso Feed/Home.
const FAKE_SUBMIT_DELAY_MS = 800;

export async function renderFakeLoginCapture(container, scenario) {
  const refs = scenario.dataRefs || {};
  if (!refs.logTemplate) {
    console.error(`[fakeLoginCaptureRenderer] "dataRefs.logTemplate" assente per lo scenario "${scenario.id}".`);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  let template;
  try {
    const templateResource = createLocalJsonResource({ url: refs.logTemplate });
    template = await templateResource.get();
  } catch (error) {
    console.error(`[fakeLoginCaptureRenderer] Impossibile caricare il template di log per "${scenario.id}"`, error);
    container.appendChild(buildFallbackMessage("Questo scenario non è disponibile al momento."));
    return undefined;
  }

  // "loose": unica differenza reale rispetto al login vero (vedi
  // rationale in testa al file) — tutto il resto di LoginForm.js
  // (brand "SocialAlive", tagline, campo password, focus management,
  // stato di submit) resta esattamente il componente già verificato da
  // Fase 2, riusato senza alcuna modifica al proprio markup.
  const loginForm = createLoginForm({ emailValidation: "loose" });

  // Annuncio invisibile del download — stesso pattern già stabilito da
  // Feed.js (stato di caricamento) e scenarioEngine.js (aria-busy): un
  // effetto visibile solo fuori dall'app (il download del browser)
  // merita comunque un annuncio testuale per chi naviga con uno screen
  // reader.
  const status = createElement("p", {
    classNames: "sl-visually-hidden",
    attrs: { role: "status", "aria-live": "polite" },
  });

  const wrapper = createElement("div", { classNames: "sl-fake-login-capture" }, [
    loginForm.element,
    status,
  ]);

  // Nessuna rivelazione qui: messaggio neutro e generico, coerente con
  // qualunque vero login che confermi un accesso riuscito — la
  // rivelazione pedagogica avviene SOLO quando il docente apre il file
  // scaricato fuori da questa interfaccia (vedi nota etica).
  function showCompletedState(fileName) {
    while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
    wrapper.appendChild(
      createElement("p", { classNames: "sl-fake-login-capture__completed", text: "Accesso completato." })
    );
    wrapper.appendChild(status);
    status.textContent = `Download avviato: ${fileName}`;
  }

  async function handleSubmit(event) {
    const { email, password } = event.detail;
    loginForm.update({ isSubmitting: true, error: undefined });

    // Finta latenza deliberata — vedi rationale "FINTA LATENZA DI
    // SUBMIT" in testa al file.
    await new Promise((resolve) => setTimeout(resolve, FAKE_SUBMIT_DELAY_MS));

    const { fileName, content } = generateFakeLog(template, email, password);
    triggerTextDownload(fileName, content);
    showCompletedState(fileName);
  }

  loginForm.element.addEventListener("sl:login-submit", handleSubmit);

  container.appendChild(wrapper);

  return function destroy() {
    loginForm.element.removeEventListener("sl:login-submit", handleSubmit);
    loginForm.destroy();
    wrapper.remove();
  };
}
