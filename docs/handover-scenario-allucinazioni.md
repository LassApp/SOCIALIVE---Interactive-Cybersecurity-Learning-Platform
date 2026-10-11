# SOCIALIVE — Handover: Scenario Allucinazioni (llm-response-cycle)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** secondo scenario della categoria AI, dopo Tokenizzazione. Introduce il sesto `type`
di scenario (`llm-response-cycle`) e il primo componente generico nuovo dopo la Suite originaria:
`Dropdown`, previsto in Fase 1 §4 e mai costruito per mancanza di un consumer reale.
**Commit di partenza (repo reale clonato prima di scrivere):** `34c7c58 tokenizzazione fase finale`.
**Tag di riferimento suggerito:** `v1.9.0-scenario-allucinazioni`

---

## 1. Stato del progetto

- Suite dei 10 prompt + interventi su Oversharing + scenari Keylogger, Phishing, Evil Twin Wi-Fi,
  Tokenizzazione: ✅ invariati nel comportamento.
- **Scenario Allucinazioni: ✅ COMPLETATO E VERIFICATO END-TO-END.** Dalla Sidebar
  (Scenari → AI → Allucinazioni) il docente sceglie una domanda e, con tre switch (Risposta esatta,
  Nessuna risposta, Risposta allucinata), vede il ciclo di un LLM come un cerchio: Richiesta →
  "Elaborazione" → Risposta → "genera risposta" → di nuovo Richiesta, esattamente come nello
  schizzo a mano.
- Mockup approvato prima del codice (canvas di design); la sua unica modifica richiesta in fase di
  approvazione è stata integrata: **ogni passo che si accende spegne il precedente** e **la risposta
  compare solo a cerchio chiuso**.
- **266/266 controlli** sulla suite completa eseguita sul repo reale clonato (210 preesistenti +
  56 nuovi): login 19, home 27, scenario 78, phishing 35, sidebar 13, token 38, **llm 56**.
- Verifica con **test di mutazione**: introducendo apposta due difetti (illuminazione cumulativa e
  risposta mostrata prima del tempo) la nuova suite ha fallito 8 controlli — i test sanno fallire.

---

## 2. Obiettivi completati

- **Tre esiti alla stessa domanda**
  - *Risposta esatta* e *Risposta allucinata*: percorso completo, identico per il ciclo (a un LLM non
    importa che la risposta sia vera, importa che la generi).
  - *Nessuna risposta*: l'animazione si ferma alla freccia "Elaborazione in corso…", la Risposta
    resta vuota ("Nessun output"), la freccia di ritorno è tratteggiata: il cerchio resta aperto.
- **Sequenza a passi** (uno ogni `stepMs`, 2 s, configurabile in `scenario.json`):
  `request → process → answer → generate → complete` (esatta/allucinata);
  `request → process → stalled` (silenzio). Si accende una sola parte alla volta.
- **A cerchio chiuso** le quattro parti passano allo stato uniforme `done` (il cerchio disegnato
  per intero) e compaiono il testo della risposta e la **spiegazione del diagramma** (una per esito,
  testi dell'utente in `outcomes.json`; la frase dell'esito esatto è stata corretta in "…infine
  restituisce una risposta: come un cerchio che si chiude").
- **Elenco di 10 domande** con risposta esatta e allucinata (`questions.json`); la domanda iniziale
  è casuale.
- **Scelta della domanda**: nuovo componente `Dropdown` (listbox accessibile) + pulsante
  **Casuale**, che pesca da un mazzo mescolato senza mai ripetere la domanda a schermo
  (`questionDeck.js`). Cambiare domanda riporta tutto a riposo.
- **Cerchio responsivo**: arcature disegnate in CSS (si ridimensionano senza deformarsi), layout
  deciso con `@container` (la Sidebar rende la pagina stretta anche su schermi larghi); sotto 720px
  le etichette delle frecce vanno in verticale. Verificato a 1280, 768 e 375px per tutte le
  domande × tre esiti: nessun testo tagliato, nessuna sovrapposizione, nessun overflow.
- **Accessibilità**: stato sempre anche nel testo (etichetta "Elaborazione" → "Elaborazione in
  corso…", "—" / "Nessun output"), regione `aria-live` che annuncia ogni passo e l'esito, switch con
  `aria-pressed`, menu con pattern listbox e tastiera completa (Invio/Spazio, frecce, Home/End,
  Esc, Tab), `riduci animazioni` rispettato.
- **Vincolo etico**: nessuna richiesta di rete oltre ai tre JSON locali (verificato), nessuna
  persistenza.

---

## 3. Architettura attuale

| File | Stato | Note |
|---|---|---|
| `data/scenarios/allucinazioni/scenario.json` | ⭐ NUOVO | `type: "llm-response-cycle"`, `stepMs`, `dataRefs` |
| `data/scenarios/allucinazioni/questions.json` | ⭐ NUOVO | 10 domande: `id`, `text`, `exact`, `hallucinated` |
| `data/scenarios/allucinazioni/outcomes.json` | ⭐ NUOVO | 3 esiti (`exact`, `silence`, `hallucination`): etichetta switch + spiegazione |
| `js/scenarios/renderers/llmResponseCycleRenderer.js` | ⭐ NUOVO | renderer del nuovo type |
| `js/components/Dropdown.js` | ⭐ NUOVO | `create(props) → { element, update, destroy, focus }`, evento `sl:change` |
| `js/utils/questionDeck.js` | ⭐ NUOVO | mazzo mescolato con "avoid", RNG iniettabile |
| `css/scenarios/llm-response-cycle.css` | ⭐ NUOVO | cerchio, stati, spiegazione |
| `css/components/dropdown.css` | ⭐ NUOVO | stile del Dropdown |
| `tests/llm.spec.js` | ⭐ NUOVO | 56 controlli |
| `docs/handover/handover-scenario-allucinazioni.md` | ⭐ NUOVO | questo documento |
| `index.html` | ♻️ MODIFICATO | +2 `<link>`, +1 import, +1 `registerRenderer("llm-response-cycle", …)` |
| `data/modules.json` | ♻️ MODIFICATO | AI: + `allucinazioni` dopo `tokenizzazione` |
| `tests/run-all.js`, `tests/package.json` | ♻️ MODIFICATI | suite `llm` registrata, script `test:llm` |
| `tests/sidebar.spec.js`, `tests/phishing.spec.js`, `tests/scenario.spec.js` | ♻️ MODIFICATI | asserzioni che elencavano le voci AI (ora 2) — comportamento cambiato volutamente, non regressione |

Nessuna modifica a `scenarioEngine.js`, `router.js`, `scenarioPageController.js`, `appShell.js`,
`Sidebar.js`: il Registry ha accolto il sesto `type` senza toccare l'engine, e la Sidebar legge
la voce da `modules.json`.

---

## 4. Decisioni progettuali

| Decisione | Motivazione |
|---|---|
| `type: "llm-response-cycle"` (descrive la forma, non lo scenario) | Uno scenario futuro con lo stesso ciclo (es. altre allucinazioni) riusa il renderer cambiando solo i JSON |
| Cerchio come griglia CSS + archi dai bordi di un `<div>` (non SVG stirato) | Si ridimensiona senza deformare punte e tratti; la freccia va da centro a centro grazie ai nodi ad altezza fissa |
| `@container` invece di media query | La larghezza utile dipende dalla Sidebar (240px), non dalla viewport |
| Colonne laterali con minimo esplicito (`--llm-side-min`) | Con solo `1fr`, su contenitore stretto la colonna centrale si prende tutto e i lati collassano (bug reale trovato nello screenshot mobile) |
| Ogni passo spegne il precedente; a fine corsa stato `done` uniforme | Richiesta esplicita (far notare i singoli passaggi); il `done` finale mostra il cerchio **chiuso**, in contrasto con il silenzio dove resta aperto |
| La risposta compare solo a `complete`; in `stalled` mostra "Nessun output" | Richiesta esplicita |
| Tempi uguali con "riduci animazioni" | I passi sono narrazione; spariscono solo le transizioni CSS (token `--sl-duration-*`) |
| Esiti e domande in JSON; i 3 id degli esiti vincolati al codice | Contenuti fuori dal codice; gli id determinano il comportamento, se mancano lo scenario non parte (fallback) |
| `Dropdown` generico, costruito ora | Primo consumer reale (YAGNI rispettato); listbox con `aria-activedescendant`, niente type-ahead (10 opzioni) |
| `questionDeck` a mazzo con `avoid`, RNG iniettabile | "Casuale" non ripete mai la domanda a schermo e tocca tutte le domande ad ogni giro; testabile in modo deterministico |
| Un solo accostamento colore nuovo (tinta del nodo acceso: primary-500 al 10% su bg-surface), verificato numericamente | Light: testo 15.02:1, etichetta 5.40:1; Dark: testo 14.11:1, etichetta 4.59:1 (tutti ≥ 4.5:1); il resto riusa accostamenti già verificati |
| Test con `page.clock` fermo e fatto avanzare a mano | Nessun controllo dipende dai tempi reali della macchina; le sequenze di 8 s si verificano al millisecondo |

---

## 5. Attività rimanenti

1. Verificare lo scenario sul **browser della LIM** reale e su un deploy GitHub Pages (vedi §9).
2. Confermare le **10 domande** e le risposte allucinate scelte (modificabili solo da JSON).
3. Immagini reali di Oversharing e gap generali già noti (icon sprite, `env.js` Supabase, CI,
   controllo anti-regressione per testi banditi): invariati, indipendenti da questo intervento.

---

## 6. Prossima fase

Nessuna fase numerata pendente. **Punto di ripartenza**: se un nuovo scenario AI ha lo stesso
ciclo richiesta/elaborazione/risposta, basta una cartella `data/scenarios/<id>/` con
`scenario.json` (stesso `type`), `questions.json`, `outcomes.json` e una voce in `modules.json`.
Direzioni generali: consolidamento (CI, test anti-regressione sui testi, aggiornamento dei README)
o nuovi scenari.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"), piattaforma didattica proiettata in classe dal solo docente: deve sembrare un prodotto
reale, stack HTML5/CSS3/JS ES6+ senza framework né bundler, repo pubblico
lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform (deploy GitHub Pages da main).
Non hai credenziali per pushare: prepara i file, li applico io.

ULTIMO INTERVENTO: scenario AI "Allucinazioni" (type "llm-response-cycle", commit di partenza
34c7c58). Cerchio Richiesta → "Elaborazione" → Risposta → "genera risposta" con tre switch (esatta,
nessuna risposta, allucinata); un passo ogni 2 s, ogni passo spegne il precedente, la risposta e la
spiegazione compaiono a cerchio chiuso; nel silenzio il cerchio resta aperto. 10 domande in JSON,
scelta con il nuovo componente Dropdown + pulsante Casuale (mazzo mescolato, mai la stessa domanda
due volte di fila). File nuovi: data/scenarios/allucinazioni/{scenario,questions,outcomes}.json,
js/scenarios/renderers/llmResponseCycleRenderer.js, js/components/Dropdown.js,
js/utils/questionDeck.js, css/scenarios/llm-response-cycle.css, css/components/dropdown.css,
tests/llm.spec.js. Modificati: index.html, data/modules.json, tests/{run-all.js,package.json,
sidebar.spec.js,phishing.spec.js,scenario.spec.js}. Verifica: 266/266 controlli (login 19, home 27,
scenario 78, phishing 35, sidebar 13, token 38, llm 56), più un test di mutazione.

REGOLE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX Designer,
Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant e Full Stack Architect. Prima
proponi e aspetta il mio "procedi", poi implementa a piccoli passi. Clona SEMPRE il repo reale prima
di modificare: "mai fidarsi della narrazione, verificare sempre il file reale". Mai duplicare
componenti; create(props)→{element,update,destroy} per i componenti, (container,params)→destroy
per i page controller; eventi "sl:nome-evento"; componenti "dumb"; solo estensioni additive ai
componenti condivisi; estrazione al secondo consumo reale; ogni nuovo accostamento di colore
verificato numericamente prima del CSS; ridichiarare ".classe[hidden]{display:none}" dove una
classe imposta "display"; documentazione, commenti e testi UI in italiano; ogni scenario ha un test
che verifica zero richieste di rete esterne. Consegna: file scaricabili con tabella
NUOVO/MODIFICATO e percorso esatto, handover .md a 10 sezioni + zip dei file della fase.
Ambiente: Playwright globale 1.56.0 (tests/node_modules nel repo è 1.62.1: lancia con NODE_PATH
globale); server e test nella stessa chiamata; mai pkill -f; per i test usa una COPIA del repo con
credenziali di prova e non toccare data/users.json del repo; SL_TEST_EMAIL/SL_TEST_PASSWORD da env.

STATO: nessuna attività pendente sull'intervento. Chiedimi come proseguire.
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Tre esiti per ogni domanda; risposta giusta (esatta/allucinata) per la domanda scelta.
- [x] Sequenza passo per passo con orologio fermo: una sola parte accesa, la precedente spenta,
  nessun passo prima di `stepMs`.
- [x] Risposta e spiegazione solo a cerchio chiuso; silenzio: resta aperto per sempre.
- [x] Switch o domanda cambiati a metà corsa: nessun timer residuo; secondo click sullo stesso
  switch: ricomincia.
- [x] "Casuale": mai la stessa domanda, tutte le 10 in 40 estrazioni.
- [x] Menu da tastiera e mouse; Dropdown standalone (`sl:change` solo se la scelta cambia).
- [ ] **Prova a mano sulla LIM** con tempi reali: i 2 s per passo sono una stima (vedi §9).

### Test UI
- [x] Light, Dark, 375px (domanda più lunga), 768px con Sidebar: nessun taglio, nessuna
  sovrapposizione, nessun overflow orizzontale — su tutte le domande e i tre esiti.
- [x] Screenshot ispezionati: riposo, elaborazione, cerchio chiuso, silenzio, menu aperto.

### Test UX
- [x] Un solo elemento acceso alla volta rende leggibili i passaggi; il cerchio chiuso (esatta/
  allucinata) e aperto (silenzio) si distinguono a colpo d'occhio, anche per la forma
  (tratteggio) e non solo per il colore.
- [ ] Verificare in aula se 2 s per passo sono giusti (regolabili da `stepMs`).

### Test tecnici
- [x] `node --check` su tutti i `.js` nuovi/modificati; JSON validi.
- [x] Console senza errori, nessuna risposta HTTP ≥400 locale, nessuna richiesta esterna.
- [x] Degrado: file mancanti o non validi → messaggio di fallback; una sola domanda → "Casuale"
  non si blocca; smontaggio a metà corsa o con menu aperto senza errori.

### Test di regressione
- [x] Intera suite sul repo reale clonato: 266/266. Le asserzioni che elencavano le voci AI sono
  state aggiornate (ora 2) e un locator ambiguo in `sidebar.spec.js` è stato reso specifico.

---

## 9. Criticità

- **Stato `done` finale (decisione da confermare):** a cerchio chiuso le quattro parti restano
  tutte in primary (senza alone), per mostrare il cerchio chiuso. Se si preferisce che a fine corsa
  si spenga tutto, è un cambio di una riga in `PART_STATES.complete`.
- **Anno di Gerry Scotti:** nei dati l'anno esatto è **1956** (non 1959, che era un'ipotesi): è il
  dato da verificare, perché una demo sulle allucinazioni non può contenere un'allucinazione.
- **CSS moderno:** `color-mix()` e `@container` richiedono browser del 2023 in poi (Chrome 111,
  Safari 16.2, Firefox 113). Da verificare sul browser della LIM; senza `color-mix` l'alone e la
  tinta del nodo acceso non si vedrebbero (resterebbe il cambio di bordo e di etichetta).
- **Ambiente di verifica:** Playwright globale 1.56.0 nel sandbox, mentre `tests/node_modules` del
  repo è 1.62.1; la suite usa `page.clock` (Playwright ≥ 1.45).
- **Non verificato:** deploy reale su GitHub Pages, Safari/Firefox (solo Chromium).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Etichette del diagramma ("Richiesta", "Risposta", "Elaborazione", "genera risposta",
  "Casuale", "Domanda") sono nel renderer, non in JSON: oggi un solo scenario le usa; il primo
  scenario con etichette diverse è il momento di spostarle in `outcomes.json`.

### Refactoring consigliati
- 🟡 `tests/README.md` è fermo a quattro suite (login, home, scenario, phishing) e non cita
  token, sidebar, llm: aggiornarlo.
- 🟢 `Dropdown` e `Input` condividono la ricetta visiva del bordo (border-strong, radius-md): se
  nascesse un terzo campo, valutare una classe condivisa.

### Ottimizzazioni future
- 🟢 Type-ahead nel `Dropdown` se l'elenco domande superasse la ventina di voci.
- 🟢 Preferenza "pausa tra i passi" regolabile dal docente direttamente nell'interfaccia (oggi
  solo da `stepMs`).

### Rischi architetturali
- 🟢 Nessuno nuovo: il Registry ha accolto il sesto `type` senza modifiche all'engine;
  `Dropdown` è additivo; nessun componente condiviso modificato.

### Priorità
- 🟡 Media: prova sul browser reale della LIM (CSS moderno).
- 🟡 Media: aggiornare `tests/README.md`.
- 🟢 Bassa: tutto il resto.

### Obiettivo
Intervento chiuso end-to-end (mockup approvato, implementazione, 56 test nuovi, regressione
266/266, handover) senza debito bloccante.
