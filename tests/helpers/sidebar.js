/**
 * helpers/sidebar.js
 * -----------------------------------------------------------------------
 * Percorso reale (mouse e DOM veri) per raggiungere gli scenari dalla
 * Sidebar a fisarmonica: voce "Scenari" → area (Cybersecurity, AI) →
 * scenario. Estratto perché serve identico a più suite (home, phishing,
 * scenario, sidebar, token, llm) — stesso principio "si estrae al secondo
 * consumo reale" già seguito per helpers/auth.js.
 *
 * La Sidebar era un flyout aperto dall'hover; oggi è una FISARMONICA in
 * linea che si apre solo per click/Invio/Spazio (vedi Sidebar.js): i
 * percorsi "hover" dei test precedenti non aprono più nulla e sono stati
 * sostituiti da un click.
 *
 * Idempotenti: se la voce è già aperta NON cliccano — un click su una voce
 * già aperta la richiuderebbe (vale per le AREE: quella dello scenario
 * corrente nasce già aperta; "Scenari" invece nasce sempre chiusa).
 */

/** Apre la voce "Scenari" (se non è già aperta) e attende il pannello visibile. */
async function openScenariosMenu(page) {
  const trigger = page.locator(".sl-sidebar__trigger");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await page.waitForSelector(".sl-sidebar__panel:not([hidden])");
}

/**
 * Espande un'area del pannello (se non lo è già) e attende che la sua
 * lista di scenari sia visibile. La voce "Scenari" deve essere già aperta.
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

/** Percorso completo: "Scenari" → area → click sullo scenario. */
async function openScenarioViaSidebar(page, groupLabel, scenarioLabel) {
  await openScenariosMenu(page);
  await expandSidebarGroup(page, groupLabel);
  await page
    .locator(".sl-sidebar__group-list a.sl-sidebar__link", {
      hasText: new RegExp(`^\\s*${scenarioLabel}\\s*$`),
    })
    .click();
}

module.exports = { openScenariosMenu, expandSidebarGroup, openScenarioViaSidebar };
