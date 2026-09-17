/**
 * scenario.spec.js
 * -----------------------------------------------------------------------
 * Copre gli scenari reali del progetto: Oversharing (Fase 6, incluso il
 * Media Viewer di Fase 7), Keylogger (fake-login-capture) ed Evil Twin
 * Wi-Fi (fake-captive-portal — vedi blocco dedicato più sotto).
 *
 * MODIFICATO (Evil Twin Wi-Fi): aggiunto un blocco dedicato al terzo
 * scenario reale, type "fake-captive-portal" — seconda vera prova (dopo
 * il Keylogger) del pattern Registry di scenarioEngine.js con un type
 * diverso da "profile-timeline". Aggiunto anche un controllo di
 * regressione esplicito sul login reale ("strict"), dato che
 * LoginForm.js ha ricevuto due nuove prop additive (showBrand/
 * showForgotLink) proprio per servire il portale captive di questo
 * scenario.
 *
 * CORRETTA CORRUZIONE DI SINTASSI (revert Supabase Auth, sessione
 * successiva): un intervento precedente aveva incollato due versioni
 * conflittuali dello stesso test ("selettore Cybersecurity mostra N
 * scenari...", una con 4 scenari incl. Phishing, una con 3 senza) l'una
 * dentro l'altra all'inizio di run() — bug bloccante, `node --check`
 * falliva e `run-all.js` non arrivava mai a eseguire un solo test. Il
 * blocco duplicato in testa (ridondante con quello già esistente più
 * sotto, dentro la sezione "Evil Twin Wi-Fi") è stato rimosso; l'unica
 * copia superstite del test è stata aggiornata al conteggio reale (4
 * scenari, verificato contro data/modules.json: oversharing, keylogger,
 * phishing, evil-twin-wifi, in quest'ordine) e all'indice corretto della
 * card Evil Twin Wi-Fi (nth=3, non più nth=2, da quando Phishing è stato
 * inserito prima di esso nell'array).
 *
 * GAP NOTO, NON CHIUSO DA QUESTA CORREZIONE: **Phishing non ha ancora un
 * proprio blocco di test dedicato** in questo file (solo il conteggio
 * "4 scenari" lo verifica indirettamente, nessun controllo sul contenuto
 * del renderer phishingSimulationRenderer.js) — segnalato esplicitamente
 * come attività futura, non introdotto silenziosamente qui per restare
 * un intervento isolato e verificabile (la correzione della corruzione,
 * non una nuova copertura).
 *
 * chromium.launch() senza { headless: false } (revert Supabase Auth):
 * la deviazione era necessaria solo contro un timeout osservato in
 * Chromium headless verso la rete di Supabase Auth (usata da
 * loginAsDocente() tramite helpers/auth.js) — causa rimossa insieme
 * alla chiamata di rete, vedi rationale completo in login.spec.js.
 *
 * NOTA D'ONESTÀ DI PROCESSO: il blocco Evil Twin Wi-Fi è stato scritto
 * in una sessione priva di accesso a un ambiente Playwright reale — non
 * è mai stato eseguito. Va verificato per primo, con la stessa
 * disciplina "mai fidarsi della narrazione" già consolidata nel
 * progetto, prima di considerarlo parte della baseline "nota buona".
 *
 * MODIFICATO (Impostazioni privacy Oversharing, sessione corrente):
 * il blocco "Bottone Segui" è stato riscritto — il profilo NON è più
 * "pubblico se e solo se seguito": "isPublic" (nuovo, gestito dal
 * pannello Impostazioni) e "isFollowing" sono ora due variabili
 * indipendenti, regola contentVisible = isPublic || isFollowing (vedi
 * profileTimelineRenderer.js). Aggiunti nuovi blocchi dedicati al
 * pannello Impostazioni (bottone ingranaggio, nuovo, prima di "Segui"):
 * toggle pubblico/privato combinato con Segui, "Chi può seguirti" con
 * flusso di approvazione (dialog + stato "Richiesta inviata"), "Chi può
 * commentare" (il bottone Commenta di PostCard SCOMPARE, prop additiva
 * commentsEnabled — non solo disabilitato), "Chi vede le storie"
 * (StoriesBar sostituita da una nota testuale quando "Amici stretti"),
 * "Chi può vedere quando sei online" (pallino di stato sull'avatar).
 * NON ancora eseguiti in un browser reale in questa sessione (nessun
 * Chromium scaricabile in questo ambiente sandbox, download bloccato
 * dalla rete consentita) — stessa onestà di processo già richiesta sopra
 * per il blocco Evil Twin: verificarli per primi con `npm test` in un
 * ambiente con Playwright/Chromium disponibile, prima di considerarli
 * parte della baseline "nota buona".
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startServer } = require("./helpers/server");
const { createSuite } = require("./helpers/testKit");
const { loginAsDocente } = require("./helpers/auth");

const APP_ROOT = path.join(__dirname, "..");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

async function gotoScenario(page, baseUrl) {
  await loginAsDocente(page, baseUrl);
  await page.goto(`${baseUrl}/#/scenario/oversharing`);
  await page.waitForSelector(".sl-profile-timeline");
}

async function run() {
  const suite = createSuite("scenario.spec.js");
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Profilo, storie, feed -------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("nessuna voce Sidebar risulta attiva sulla pagina di scenario", async () => {
      const activeLinks = await page.locator(".sl-sidebar__link--active").count();
      assert.equal(activeLinks, 0);
    });

    await suite.test("header profilo: username, bio, statistiche derivate da posts.length", async () => {
      const username = await page.locator(".sl-profile-timeline__username").textContent();
      assert.equal(username.trim(), "marti.travel");
      const statValues = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      const expectedPosts = await page.evaluate(() => (12).toLocaleString("it-IT"));
      const expectedFollowers = await page.evaluate(() => (2450).toLocaleString("it-IT"));
      const expectedFollowing = await page.evaluate(() => (587).toLocaleString("it-IT"));
      assert.deepEqual(
        statValues.map((v) => v.trim()),
        [expectedPosts, expectedFollowers, expectedFollowing]
      );
    });

    await suite.test("scenario.title/description NON vengono mai renderizzati", async () => {
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(!bodyText.includes("Un profilo social realistico"), "trovata la description dello scenario nel DOM visibile");
    });

    await suite.test("StoriesBar: 5 storie renderizzate", async () => {
      assert.equal(await page.locator(".sl-stories-bar__item").count(), 5);
    });

    await suite.test("Feed di default: 12 PostCard, vista Archivio nascosta", async () => {
      assert.equal(await page.locator(".sl-feed .sl-post-card").count(), 12);
      assert.equal(await page.locator(".sl-timeline").isHidden(), true);
    });

    await suite.test("nessun elemento didattico visibile (sensitive/insightNote/scenarioId)", async () => {
      const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      ["sensibile", "insight", "oversharing"].forEach((term) => {
        assert.ok(!bodyText.includes(term), `trovato il termine didattico "${term}" nel testo visibile`);
      });
    });

    await context.close();
  }

  // --- Toggle Post/Archivio ---------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("toggle su Archivio: Timeline visibile, Feed nascosto, annuncio aria-live", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Archivio");
      await page.waitForSelector(".sl-timeline:not([hidden])");
      assert.equal(await page.locator(".sl-feed").isHidden(), true);
      const status = await page.locator(".sl-profile-timeline__view-status").textContent();
      assert.equal(status.trim(), "Vista: Archivio");
      assert.equal(await page.locator(".sl-timeline__tile").count(), 12);
    });

    await suite.test("post-004 (solo testo) ha un riquadro di fallback testuale in Archivio", async () => {
      assert.equal(await page.locator(".sl-timeline__tile--text").count(), 1);
    });

    await suite.test("torna su Post: Feed di nuovo visibile", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Post");
      await page.waitForSelector(".sl-feed:not([hidden])");
      assert.equal(await page.locator(".sl-timeline").isHidden(), true);
    });

    await context.close();
  }

  // --- Bottone "Segui" — ora regola SOLO la relazione, non basta da
  // sola a nascondere i contenuti (il profilo è pubblico di default:
  // vedi il blocco "Impostazioni" sotto per l'interazione con isPublic)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const headerFollow = () => page.locator(".sl-profile-timeline__follow-button");
    const publicContent = () => page.locator(".sl-profile-timeline__public-content");
    const privateNotice = () => page.locator(".sl-profile-timeline__private-notice");

    await suite.test("regressione: il vecchio bottone lucchetto non esiste più nel DOM", async () => {
      assert.equal(await page.locator(".sl-profile-timeline__privacy-toggle").count(), 0);
    });

    await suite.test("riga statistiche: Impostazioni, poi Segui, poi conteggio post", async () => {
      const order = await page
        .locator(".sl-profile-timeline__stats-row")
        .evaluate((row) => Array.from(row.children).map((c) => c.className));
      assert.ok(order[0].includes("settings-trigger"), `Impostazioni non è il primo figlio: ${order.join(" | ")}`);
      assert.ok(order[1].includes("follow-button"), `Segui non è il secondo figlio: ${order.join(" | ")}`);
    });

    await suite.test("stato iniziale: 'Segui già', profilo pubblico -> contenuto visibile", async () => {
      assert.equal((await headerFollow().textContent()).trim(), "Segui già");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "true");
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    let statsBefore;
    await suite.test("3 statistiche leggibili prima del click (baseline per il confronto)", async () => {
      statsBefore = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      assert.equal(statsBefore.length, 3);
    });

    await suite.test("click su 'Segui già' -> 'Segui' (unfollow): profilo pubblico, contenuto resta visibile", async () => {
      const detail = await page.evaluate(
        () =>
          new Promise((resolve) => {
            document
              .querySelector(".sl-profile-timeline")
              .addEventListener("sl:profile-follow-toggle", (e) => resolve(e.detail), { once: true });
            document.querySelector(".sl-profile-timeline__follow-button").click();
          })
      );
      assert.deepEqual(detail, { following: false });
      assert.equal((await headerFollow().textContent()).trim(), "Segui");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "false");
      assert.equal(await publicContent().isVisible(), true, "un profilo pubblico deve restare visibile anche senza seguirlo");
      assert.equal(await privateNotice().isHidden(), true);
    });

    await suite.test("statistiche IDENTICHE dopo l'unfollow (stessi valori di prima)", async () => {
      const statsAfter = await page.locator(".sl-profile-timeline__stat-value").allTextContents();
      assert.deepEqual(statsAfter, statsBefore);
    });

    await suite.test("click su 'Segui' -> segue di nuovo immediatamente (policy 'Tutti', nessun dialog)", async () => {
      await headerFollow().click();
      await page.waitForTimeout(30);
      assert.equal((await headerFollow().textContent()).trim(), "Segui già");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator(".sl-modal").count(), 0, "nessun dialog atteso con policy 'Tutti'");
    });

    await context.close();
  }

  // --- Impostazioni: "Profilo pubblico" combinato con Segui -------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const headerFollow = () => page.locator(".sl-profile-timeline__follow-button");
    const publicContent = () => page.locator(".sl-profile-timeline__public-content");
    const privateNotice = () => page.locator(".sl-profile-timeline__private-notice");
    const settingsModal = () => page.locator(".sl-modal", { hasText: "Impostazioni privacy" });

    await suite.test("apertura Impostazioni: Modal con 6 controlli", async () => {
      await page.click(".sl-profile-timeline__settings-trigger");
      await settingsModal().waitFor({ state: "visible" });
      assert.equal(await settingsModal().locator(".sl-profile-timeline__settings-row").count(), 6);
    });

    await suite.test("toggle 'Profilo pubblico': Attivo -> Disattivato", async () => {
      const toggle = settingsModal().locator(".sl-profile-timeline__settings-toggle").nth(0);
      assert.equal((await toggle.textContent()).trim(), "Attivo");
      await toggle.click();
      assert.equal((await toggle.textContent()).trim(), "Disattivato");
      await page.keyboard.press("Escape");
      await settingsModal().waitFor({ state: "detached" });
    });

    await suite.test("profilo privato ma ancora seguito -> contenuto resta visibile", async () => {
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    await suite.test("smetto di seguire un profilo privato -> contenuto si nasconde", async () => {
      await headerFollow().click();
      await page.waitForTimeout(30);
      assert.equal(await publicContent().isHidden(), true);
      assert.equal(await privateNotice().isVisible(), true);
    });

    await suite.test("torno a seguire -> contenuto torna visibile", async () => {
      await headerFollow().click();
      await page.waitForTimeout(30);
      assert.equal(await publicContent().isVisible(), true);
      assert.equal(await privateNotice().isHidden(), true);
    });

    await context.close();
  }

  // --- Impostazioni: "Chi può seguirti" -> Approvazione ------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const headerFollow = () => page.locator(".sl-profile-timeline__follow-button");
    const settingsModal = () => page.locator(".sl-modal", { hasText: "Impostazioni privacy" });
    const requestModal = () => page.locator(".sl-modal", { hasText: "Richiesta di follow inviata" });

    await suite.test("smetto di seguire, poi imposto 'Chi può seguirti' su Approvazione", async () => {
      await headerFollow().click();
      await page.waitForTimeout(30);
      await page.click(".sl-profile-timeline__settings-trigger");
      await settingsModal().waitFor({ state: "visible" });
      await settingsModal()
        .locator(".sl-profile-timeline__settings-chip-group")
        .nth(0)
        .locator('button:has-text("Approvazione")')
        .click();
      await page.keyboard.press("Escape");
      await settingsModal().waitFor({ state: "detached" });
    });

    await suite.test("click su 'Segui' -> dialog di richiesta, bottone 'Richiesta inviata'", async () => {
      await headerFollow().click();
      await requestModal().waitFor({ state: "visible" });
      const text = await requestModal().textContent();
      assert.ok(text.includes("marti.travel"), "il nome del profilo non compare nel messaggio");
      assert.ok(text.includes("deve accettare la tua richiesta"), "il messaggio non spiega l'attesa di approvazione");
      assert.equal((await headerFollow().textContent()).trim(), "Richiesta inviata");
      assert.equal(await headerFollow().getAttribute("aria-pressed"), "false");
    });

    await suite.test("chiudo il dialog con 'Ho capito': la richiesta resta in sospeso", async () => {
      await requestModal().locator('button:has-text("Ho capito")').click();
      await requestModal().waitFor({ state: "detached" });
      assert.equal((await headerFollow().textContent()).trim(), "Richiesta inviata");
    });

    await suite.test("un secondo click sulla richiesta pendente la ritira", async () => {
      await headerFollow().click();
      await page.waitForTimeout(30);
      assert.equal((await headerFollow().textContent()).trim(), "Segui");
    });

    await context.close();
  }

  // --- Impostazioni: "Chi può commentare" --------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const settingsModal = () => page.locator(".sl-modal", { hasText: "Impostazioni privacy" });
    const firstCommentButton = () =>
      page.locator(".sl-feed .sl-post-card").nth(0).locator(".sl-post-card__action").nth(1);

    async function setCommentPolicy(label) {
      await page.click(".sl-profile-timeline__settings-trigger");
      await settingsModal().waitFor({ state: "visible" });
      await settingsModal()
        .locator(".sl-profile-timeline__settings-chip-group")
        .nth(1)
        .locator(`button:has-text("${label}")`)
        .click();
      await page.keyboard.press("Escape");
      await settingsModal().waitFor({ state: "detached" });
    }

    await suite.test("stato iniziale: bottone Commenta visibile sul primo post", async () => {
      assert.equal(await firstCommentButton().isVisible(), true);
      assert.equal(await firstCommentButton().getAttribute("aria-label"), "Commenta il post — 0 commenti");
    });

    await suite.test("'Chi può commentare' -> Nessuno: bottone Commenta SCOMPARE (non solo disabilitato)", async () => {
      await setCommentPolicy("Nessuno");
      assert.equal(await firstCommentButton().isHidden(), true);
    });

    await suite.test("'Chi può commentare' -> Follower, non seguo -> ancora nascosto", async () => {
      await setCommentPolicy("Follower");
      await page.click(".sl-profile-timeline__follow-button"); // smetto di seguire
      await page.waitForTimeout(30);
      assert.equal(await firstCommentButton().isHidden(), true);
    });

    await suite.test("torno a seguire -> bottone Commenta di nuovo visibile", async () => {
      await page.click(".sl-profile-timeline__follow-button");
      await page.waitForTimeout(30);
      assert.equal(await firstCommentButton().isVisible(), true);
    });

    await context.close();
  }

  // --- Impostazioni: "Chi vede le storie" --------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const settingsModal = () => page.locator(".sl-modal", { hasText: "Impostazioni privacy" });

    async function setStoriesAudience(label) {
      await page.click(".sl-profile-timeline__settings-trigger");
      await settingsModal().waitFor({ state: "visible" });
      await settingsModal()
        .locator(".sl-profile-timeline__settings-chip-group")
        .nth(2)
        .locator(`button:has-text("${label}")`)
        .click();
      await page.keyboard.press("Escape");
      await settingsModal().waitFor({ state: "detached" });
    }

    await suite.test("stato iniziale: StoriesBar visibile con 5 storie, nota nascosta", async () => {
      assert.equal(await page.locator(".sl-stories-bar").isVisible(), true);
      assert.equal(await page.locator(".sl-stories-bar__item").count(), 5);
      assert.equal(await page.locator(".sl-profile-timeline__stories-note").isVisible(), false);
    });

    await suite.test("'Chi vede le storie' -> Amici stretti: StoriesBar nascosta, nota visibile", async () => {
      await setStoriesAudience("Amici stretti");
      assert.equal(await page.locator(".sl-stories-bar").isHidden(), true);
      const note = page.locator(".sl-profile-timeline__stories-note");
      assert.equal(await note.isVisible(), true);
      assert.equal((await note.textContent()).trim(), "Storie visibili solo agli amici stretti.");
    });

    await suite.test("torno su 'Tutti i follower': StoriesBar di nuovo visibile", async () => {
      await setStoriesAudience("Tutti i follower");
      assert.equal(await page.locator(".sl-stories-bar").isVisible(), true);
    });

    await context.close();
  }

  // --- Impostazioni: pallino online/offline + "Condivisione della
  // posizione" (nuovo) --------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    const settingsModal = () => page.locator(".sl-modal", { hasText: "Impostazioni privacy" });
    const statusDot = () => page.locator(".sl-profile-timeline__status-dot");

    async function setOnlineVisibility(label) {
      await page.click(".sl-profile-timeline__settings-trigger");
      await settingsModal().waitFor({ state: "visible" });
      await settingsModal()
        .locator(".sl-profile-timeline__settings-chip-group")
        .nth(3)
        .locator(`button:has-text("${label}")`)
        .click();
      await page.keyboard.press("Escape");
      await settingsModal().waitFor({ state: "detached" });
    }

    await suite.test("pallino di stato presente sull'avatar, con title 'Online' o 'Offline'", async () => {
      assert.equal(await statusDot().count(), 1);
      const title = await statusDot().getAttribute("title");
      assert.ok(title === "Online" || title === "Offline", `title inatteso: "${title}"`);
      const ariaLabel = await statusDot().getAttribute("aria-label");
      assert.ok(/^Stato: (online|offline)$/.test(ariaLabel), `aria-label inatteso: "${ariaLabel}"`);
    });

    await suite.test("stato iniziale: 'Chi può vedere quando sei online' = Tutti, pallino visibile", async () => {
      assert.equal(await statusDot().isVisible(), true);
    });

    await suite.test("'Chi può vedere quando sei online' -> Nessuno: pallino nascosto", async () => {
      await setOnlineVisibility("Nessuno");
      assert.equal(await statusDot().isHidden(), true);
    });

    await suite.test("-> Follower, non seguo -> ancora nascosto; seguo di nuovo -> visibile", async () => {
      await setOnlineVisibility("Follower");
      await page.click(".sl-profile-timeline__follow-button"); // smetto di seguire
      await page.waitForTimeout(30);
      assert.equal(await statusDot().isHidden(), true);
      await page.click(".sl-profile-timeline__follow-button"); // seguo di nuovo
      await page.waitForTimeout(30);
      assert.equal(await statusDot().isVisible(), true);
    });

    await suite.test("Impostazioni: presente la voce 'Condivisione della posizione' con toggle Attivo/Disattivato", async () => {
      await page.click(".sl-profile-timeline__settings-trigger");
      await settingsModal().waitFor({ state: "visible" });
      const locationToggle = settingsModal().locator(".sl-profile-timeline__settings-toggle").nth(1);
      assert.equal((await locationToggle.textContent()).trim(), "Attivo");
      await locationToggle.click();
      assert.equal((await locationToggle.textContent()).trim(), "Disattivato");
      await page.keyboard.press("Escape");
      await settingsModal().waitFor({ state: "detached" });
    });

    await context.close();
  }

  // --- MediaViewer: avatar, copertina, storie ---------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("click sull'avatar -> MediaViewer con 1 solo item, nessuna navigazione", async () => {
      await page.click(".sl-profile-timeline__avatar-trigger");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 1");
      assert.equal(await page.locator(".sl-media-viewer__nav--prev").isDisabled(), true);
      assert.equal(await page.locator(".sl-media-viewer__nav--next").isDisabled(), true);
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("click sulla copertina -> MediaViewer con 1 item, autore = marti.travel", async () => {
      await page.click(".sl-profile-timeline__cover-trigger");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const author = await page.locator(".sl-media-viewer__author-name").textContent();
      assert.equal(author.trim(), "marti.travel");
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("click su una storia -> MediaViewer con 5 item, didascalia = etichetta della storia", async () => {
      await page.click(".sl-stories-bar__item >> nth=2");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "3 di 5");
      const caption = await page.locator(".sl-media-viewer__caption").textContent();
      assert.equal(caption.trim(), "Food");
    });

    await suite.test("navigazione tra storie con freccia destra, poi chiusura", async () => {
      await page.click(".sl-media-viewer__nav--next");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "4 di 5");
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("dopo le nuove interazioni: profilo ancora integro (12 post, nessun residuo)", async () => {
      assert.equal(await page.locator(".sl-feed .sl-post-card").count(), 12);
      assert.equal(await page.locator(".sl-media-viewer-overlay").count(), 0);
    });

    await context.close();
  }

  // --- MediaViewer -------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("apertura da Feed: MediaViewer mostra il post corretto (1 di 12)", async () => {
      await page.click(".sl-feed .sl-post-card >> nth=0 >> .sl-post-card__media");
      await page.waitForSelector(".sl-media-viewer-overlay");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 12");
    });

    await suite.test("navigazione successiva: prev disabilitato, next abilitato", async () => {
      assert.equal(await page.locator(".sl-media-viewer__nav--prev").isDisabled(), true);
      assert.equal(await page.locator(".sl-media-viewer__nav--next").isDisabled(), false);
      await page.click(".sl-media-viewer__nav--next");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "2 di 12");
    });

    await suite.test("navigazione da tastiera (ArrowLeft) torna al post precedente", async () => {
      await page.keyboard.press("ArrowLeft");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "1 di 12");
    });

    await suite.test("zoom: click sull'immagine attiva lo stato zoomato", async () => {
      await page.click(".sl-media-viewer__zoom-trigger");
      const zoomed = await page.locator(".sl-media-viewer__stage").evaluate((el) =>
        el.classList.contains("sl-media-viewer__stage--zoomed")
      );
      assert.ok(zoomed);
    });

    await suite.test("chiusura con Escape: overlay rimosso", async () => {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await context.close();
  }

  // --- Screenshot Light/Dark/mobile/breakpoint intermedio ---------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await gotoScenario(page, server.url);

    await suite.test("screenshot scenario — desktop Light (vista Post)", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-desktop-light.png"), fullPage: true });
    });

    await suite.test("screenshot scenario — desktop Dark", async () => {
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-desktop-dark.png"), fullPage: true });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    });

    await suite.test("screenshot scenario — breakpoint 900px, nessun overflow orizzontale", async () => {
      await page.setViewportSize({ width: 900, height: 900 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-900.png"), fullPage: true });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false);
    });

    await suite.test("screenshot scenario — mobile 375px, vista Archivio", async () => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.click(".sl-profile-timeline__tabs >> text=Archivio");
      await page.waitForSelector(".sl-timeline:not([hidden])");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-archive-mobile-375.png"), fullPage: true });
    });

    await suite.test("screenshot scenario — mobile 375px, pannello privato (non seguo)", async () => {
      await page.click(".sl-profile-timeline__tabs >> text=Post");
      await page.click(".sl-profile-timeline__follow-button");
      await page.waitForSelector(".sl-profile-timeline__private-notice:not([hidden])");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "scenario-private-mobile-375.png"), fullPage: true });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false, "overflow orizzontale rilevato nel pannello privato a 375px");
      // Ripristina lo stato "seguo" per non alterare eventuali blocchi successivi.
      await page.click(".sl-profile-timeline__follow-button");
    });

    await context.close();
  }

  // --- Evil Twin Wi-Fi (scenario "fake-captive-portal") -----------------
  // NUOVO — vedi rationale completo in fakeCaptivePortalRenderer.js.
  // acceptDownloads:true esplicito, stesso principio già seguito per il
  // Keylogger: intercettare un download REALE (page.waitForEvent), non
  // solo asserire che il click non lanci errori.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("selettore Cybersecurity mostra 4 scenari (Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi)", async () => {
      await page.click(".sl-home-page__modules-grid .sl-module-card >> nth=4");
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
      assert.equal(await page.locator(".sl-module-scenarios-page__grid .sl-module-card").count(), 4);
    });

    await suite.test("click su Evil Twin Wi-Fi -> #/scenario/evil-twin-wifi, chrome:none rispettato", async () => {
      // Ordine reale in data/modules.json: oversharing(0), keylogger(1),
      // phishing(2), evil-twin-wifi(3) — indice aggiornato da nth=2 a
      // nth=3 dopo l'inserimento di Phishing come terzo scenario.
      await page.click(".sl-module-scenarios-page__grid .sl-module-card >> nth=3");
      await page.waitForFunction(() => window.location.hash === "#/scenario/evil-twin-wifi");
      await page.waitForSelector(".sl-fake-captive-portal");
      assert.equal(await page.locator(".sl-app-header").count(), 0);
      assert.equal(await page.locator(".sl-sidebar").count(), 0);
    });

    await suite.test("elenco reti: 4 voci, 1 sola apribile (aperta), 3 protette non interattive", async () => {
      assert.equal(await page.locator(".sl-fake-captive-portal__network-item").count(), 4);
      assert.equal(await page.locator(".sl-fake-captive-portal__network-button").count(), 1);
      assert.equal(await page.locator(".sl-fake-captive-portal__network-item--secured").count(), 3);
    });

    await suite.test("rete protetta non è un elemento interattivo (nessun <button>)", async () => {
      const tagName = await page
        .locator(".sl-fake-captive-portal__network-item--secured")
        .first()
        .locator(":scope > *")
        .first()
        .evaluate((el) => el.tagName);
      assert.notEqual(tagName, "BUTTON");
    });

    await suite.test("click sulla rete aperta -> vista 'connessione in corso'", async () => {
      await page.click(".sl-fake-captive-portal__network-button");
      await page.waitForSelector(".sl-fake-captive-portal__connecting");
    });

    await suite.test("dopo la connessione: transizione automatica al portale captive", async () => {
      await page.waitForSelector(".sl-fake-captive-portal__portal-headline", { timeout: 3000 });
      const headline = await page.locator(".sl-fake-captive-portal__portal-headline").textContent();
      assert.equal(headline.trim(), "Accedi per continuare a navigare");
      assert.equal(await page.locator(".sl-fake-captive-portal__social-button").count(), 2);
    });

    await suite.test("il portale NON mostra brand/tagline di SocialAlive (showBrand:false)", async () => {
      assert.equal(await page.locator(".sl-fake-captive-portal .sl-login-form__brand").isVisible(), false);
    });

    await suite.test("il portale NON mostra 'Password dimenticata?' (showForgotLink:false)", async () => {
      assert.equal(await page.locator(".sl-fake-captive-portal .sl-login-form__forgot").isVisible(), false);
    });

    let downloadedContent = "";
    await suite.test("submit con email 'loose' (senza dominio) -> download reale del file di log", async () => {
      await page.fill(".sl-fake-captive-portal .sl-login-form__form input[type='email']", "ospite@wifi");
      await page.fill(".sl-fake-captive-portal .sl-login-form__form input[type='password']", "prova123");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click(".sl-fake-captive-portal .sl-login-form__submit"),
      ]);
      const filePath = await download.path();
      downloadedContent = fs.readFileSync(filePath, "utf-8");
      assert.ok(downloadedContent.length > 0, "il file scaricato è vuoto");
    });

    await suite.test("il file contiene fedelmente username/password digitati", async () => {
      assert.ok(downloadedContent.includes('username="ospite@wifi"'), "username non trovato fedelmente nel file");
      assert.ok(downloadedContent.includes('password="prova123"'), "password non trovata fedelmente nel file");
    });

    await suite.test("il file contiene una sola occorrenza di '@', sulla riga di cattura", async () => {
      const atCount = (downloadedContent.match(/@/g) || []).length;
      assert.equal(atCount, 1, `attese 1 occorrenza di "@", trovate ${atCount}`);
    });

    await suite.test("disclaimer finale presente, rivela la natura didattica", async () => {
      assert.ok(downloadedContent.includes("SocialAlive"), "riferimento a SocialAlive non trovato nel disclaimer");
      assert.ok(downloadedContent.includes("scopo didattico"), "testo del disclaimer non trovato");
    });

    await suite.test("dopo il download: nessuna rivelazione in-app, messaggio neutro 'Connesso a Internet.'", async () => {
      const message = await page.locator(".sl-fake-captive-portal__completed").textContent();
      assert.equal(message.trim(), "Connesso a Internet.");
      const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      ["evil twin", "clonata", "attacco"].forEach((term) => {
        assert.ok(!bodyText.includes(term), `trovato il termine rivelatore "${term}" nel testo visibile`);
      });
    });

    await suite.test("nessun redirect forzato dopo il download (hash invariato)", async () => {
      assert.equal(await page.evaluate(() => window.location.hash), "#/scenario/evil-twin-wifi");
    });

    await context.close();
  }

  // --- Screenshot Evil Twin Wi-Fi ----------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    await page.goto(`${server.url}/#/scenario/evil-twin-wifi`);
    await page.waitForSelector(".sl-fake-captive-portal");

    await suite.test("screenshot Evil Twin Wi-Fi — elenco reti, Light", async () => {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "evil-twin-networks-light.png") });
    });

    await suite.test("screenshot Evil Twin Wi-Fi — portale captive, mobile 375px", async () => {
      await page.click(".sl-fake-captive-portal__network-button");
      await page.waitForSelector(".sl-fake-captive-portal__portal-headline", { timeout: 3000 });
      await page.setViewportSize({ width: 375, height: 800 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "evil-twin-portal-mobile-375.png") });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      assert.equal(hasOverflow, false, "overflow orizzontale rilevato nel portale a 375px");
    });

    await context.close();
  }

  // --- Regressione: login reale ('strict') invariato dopo l'aggiunta ----
  // di showBrand/showForgotLink e dell'estrazione di textDownload.js
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await suite.test("regressione: login reale rifiuta ancora un'email senza dominio valido (strict)", async () => {
      await page.goto(`${server.url}/#/login`);
      await page.waitForSelector(".sl-login-form");
      await page.fill(".sl-login-form__form input[type='email']", "docente@scuola");
      await page.fill(".sl-login-form__form input[type='password']", "password123");
      await page.click(".sl-login-form__submit");
      const helperText = await page
        .locator(".sl-login-form__form input[type='email']")
        .locator("xpath=..")
        .locator(".sl-input__helper")
        .textContent();
      assert.equal(helperText.trim(), "Inserisci un indirizzo email valido.");
    });

    await suite.test("regressione: login reale mostra ancora brand/tagline SocialAlive (showBrand default true)", async () => {
      assert.equal(await page.locator(".sl-login-form__brand").isVisible(), true);
      assert.equal(await page.locator(".sl-login-form__forgot").isVisible(), true);
    });

    await context.close();
  }

  // --- Regressione: Keylogger invariato dopo l'estrazione di textDownload.js ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);

    await suite.test("regressione: Keylogger genera ancora un download reale dopo l'estrazione di textDownload.js", async () => {
      await page.goto(`${server.url}/#/scenario/keylogger`);
      await page.waitForSelector(".sl-fake-login-capture");
      await page.fill(".sl-fake-login-capture .sl-login-form__form input[type='email']", "prof@scuola");
      await page.fill(".sl-fake-login-capture .sl-login-form__form input[type='password']", "test123");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click(".sl-fake-login-capture .sl-login-form__submit"),
      ]);
      const filePath = await download.path();
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(content.includes('username="prof@scuola"'), "il Keylogger non genera più un download fedele dopo il refactor");
    });

    await context.close();
  }

  // --- Flusso completo da tastiera: Home -> Scenario -> MediaViewer ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await loginAsDocente(page, server.url);
    // FIX (scoperto eseguendo davvero la suite per la prima volta in questa
    // sessione): homePageController.js popola la griglia moduli in modo
    // asincrono (Promise.all su modules.json/feed.json) — senza attendere
    // esplicitamente il suo rendering, il ciclo di Tab qui sotto può
    // eseguirsi PRIMA che la card Cybersecurity esista nel DOM, producendo
    // un fallimento a cascata su tutti i controlli successivi del blocco.
    // Stesso principio di attesa già applicato altrove nel file (es. dopo
    // ogni navigazione che monta contenuto asincrono).
    await page.waitForSelector(".sl-home-page__modules-grid");

    await suite.test("flusso da tastiera: Sidebar -> Moduli -> Cybersecurity (Invio) -> selettore", async () => {
      let focused = null;
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
        if (focused === "Apri modulo Cybersecurity") break;
      }
      assert.equal(focused, "Apri modulo Cybersecurity", "il focus non ha raggiunto la card Cybersecurity entro 15 Tab");

      await page.keyboard.press("Enter");
      // Cybersecurity ospita ora 4 scenari (Oversharing, Keylogger,
      // Phishing, Evil Twin Wi-Fi): il click/Invio porta al selettore
      // #/modules/cybersecurity, non più direttamente allo scenario.
      await page.waitForFunction(() => window.location.hash === "#/modules/cybersecurity");
      await page.waitForSelector(".sl-module-scenarios-page__grid");
    });

    await suite.test("flusso da tastiera: dal selettore raggiunge Oversharing (Invio)", async () => {
      let focused = null;
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label"));
        if (focused === "Apri modulo Oversharing") break;
      }
      assert.equal(focused, "Apri modulo Oversharing", "il focus non ha raggiunto la card Oversharing entro 15 Tab");

      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.location.hash === "#/scenario/oversharing");
      await page.waitForSelector(".sl-profile-timeline");
    });

    await suite.test("flusso da tastiera: raggiunge il primo post del Feed e lo apre con Invio", async () => {
      let focused = null;
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label") || "");
        if (focused.startsWith("Apri immagine del post di")) break;
      }
      assert.ok(focused && focused.startsWith("Apri immagine del post di"), "il focus non ha raggiunto l'immagine di un post entro 25 Tab");

      await page.keyboard.press("Enter");
      await page.waitForSelector(".sl-media-viewer-overlay");
    });

    await suite.test("flusso da tastiera: naviga con le frecce e chiude con Escape", async () => {
      await page.keyboard.press("ArrowRight");
      const position = await page.locator(".sl-media-viewer__position").textContent();
      assert.equal(position.trim(), "2 di 12");

      await page.keyboard.press("Escape");
      await page.waitForSelector(".sl-media-viewer-overlay", { state: "detached" });
    });

    await suite.test("flusso da tastiera: torna alla Home cliccando 'Home' in Sidebar", async () => {
      await page.click(".sl-sidebar__link[href='#/home']");
      await page.waitForFunction(() => window.location.hash === "#/home");
    });

    await context.close();
  }

  await browser.close();
  await server.close();
  return suite.summary();
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
