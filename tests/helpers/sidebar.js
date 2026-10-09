/**
 * helpers/sidebar.js
 * -----------------------------------------------------------------------
 * Percorso reale (mouse e DOM veri) per raggiungere gli scenari dalla
 * Sidebar a due livelli: voce "Scenari" → categoria (Cybersecurity, AI)
 * → scenario. Estratto perché serve identico a più suite (home,
 * phishing, scenario, sidebar, token) — stesso principio "si estrae al
 * secondo consumo reale" già seguito per helpers/auth.js.
 *
 * hover, non click, sul trigger "Scenari": un click() di Playwright
 * genera un vero mousemove che fa scattare "mouseenter" PRIMA del click
 * stesso; Sidebar.js apre il flyout all'hover e poi handleTriggerClick(),
 * vedendo isOpen già true, lo richiuderebbe subito (per un utente reale
 * con mouse vale lo stesso: il click è riservato al caso tastiera/touch,
 * dove l'hover non esiste). hover() riproduce fedelmente il percorso
 * mouse.
 *
 * Le categorie (gruppi) NON si aprono all'hover ma solo per click/Invio/
 * Spazio — vedi rationale in Sidebar.js.
 */

/** Apre il flyout "Scenari" con l'hover (percorso mouse reale). */
async function openScenariosFlyout(page) {
  await page.hover(".sl-sidebar__trigger");
  await page.waitForSelector(".sl-sidebar__flyout:not([hidden])");
}

/**
 * Espande una categoria del flyout (se non lo è già) e attende che la
 * sua lista di scenari sia visibile. Il flyout deve essere già aperto.
 * @param {import('playwright').Page} page
 * @param {string} groupLabel es. "Cybersecurity", "AI"
 */
async function expandSidebarGroup(page, groupLabel) {
  const trigger = page.locator(".sl-sidebar__group-trigger", {
    hasText: new RegExp(`^\\s*${groupLabel}\\s*$`),
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const listId = await trigger.getAttribute("aria-controls");
  await page.waitForSelector(`#${listId}:not([hidden])`);
}

/** Percorso completo: flyout → categoria → click sullo scenario. */
async function openScenarioViaSidebar(page, groupLabel, scenarioLabel) {
  await openScenariosFlyout(page);
  await expandSidebarGroup(page, groupLabel);
  await page
    .locator(".sl-sidebar__group-list a.sl-sidebar__link", {
      hasText: new RegExp(`^\\s*${scenarioLabel}\\s*$`),
    })
    .click();
}

module.exports = { openScenariosFlyout, expandSidebarGroup, openScenarioViaSidebar };
