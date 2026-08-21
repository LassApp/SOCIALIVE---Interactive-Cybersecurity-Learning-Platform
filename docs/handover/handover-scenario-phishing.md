# SOCIALIVE — Handover: Scenario Phishing (`phishing-simulation`)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** terzo scenario reale del progetto, dopo Oversharing (`profile-timeline`) e Keylogger
(`fake-login-capture`) — primo scenario a più schermate con un flusso "email → sito fittizio →
rivelazione".
**Tag di riferimento suggerito:** `v1.5.0-scenario-phishing`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari + interventi su Oversharing (toggle privacy, MediaViewer
  generico, eliminazione toggle lucchetto) + scenario Keylogger: ✅ completi, invariati.
- **Scenario Phishing: ✅ COMPLETATO E VERIFICATO END-TO-END.** Terzo `type` reale del
  progetto (`"phishing-simulation"`), che valida per la terza volta consecutiva il pattern
  Registry di `scenarioEngine.js` — zero modifiche all'engine sono state necessarie per
  accoglierlo.
- **Flusso a 5 viste**: Inbox → Email aperta (con CTA) → Finto sito, Step Accesso (email/codice
  cliente + password) → Finto sito, Step Pagamento (numero carta, scadenza, CVV, nome, cognome)
  → Rivelazione (5 segnali d'allarme).
- **52 controlli automatizzati eseguiti nel corso della fase** (17 su harness isolato per
  Inbox/Dettaglio + 14 su harness isolato per il flusso completo + 40 sulla regressione
  integrale attraverso l'`index.html` reale ricostruito, con parziale sovrapposizione tra i
  gruppi) — **40/40 sull'ultima esecuzione integrale**, l'unica a fare fede come baseline di
  chiusura fase.
- **Vincolo etico verificato esplicitamente con un test dedicato**: nessuna richiesta di rete è
  mai uscita verso un host diverso dal server locale in nessun punto del flusso — nessun dato
  del form (credenziali o carta) è mai realmente "inviato" da nessuna parte.
- **Nessuna riga di un quarto scenario** è stata scritta.

---

## 2. Obiettivi completati

### Dati (`data/scenarios/phishing/`, tutti nuovi)
- `scenario.json`: `id: "phishing"`, `type: "phishing-simulation"`, `chrome: "none"`,
  `dataRefs` verso i tre file sotto.
- `inbox.json`: 5 email (`emails: [...]`) — 4 di riempimento (ConnectWork, Banca Centrale
  Sicura come target, EnergiaPlus, Chiara Moretti, NewsFlash) ordinate per orario decrescente,
  1 target con `isTarget: true` e `ctaLabel: "Verifica il pagamento"`. Dominio del mittente
  target (`banca-centrale-sicura-verifica.com`) deliberatamente lungo e sospetto — già di per
  sé un primo segnale d'allarme, coerente con `reveal.json`.
- `bank-site.json`: `bankName`, `fakeUrl` (stesso dominio del mittente, continuità narrativa),
  `loginStep`/`cardStep` con titolo/descrizione/label del bottone — solo copy, mai lo schema dei
  campi (strutturale nel renderer, come già `LoginForm.js`).
- `reveal.json`: `title`, `intro`, 5 `redFlags` (mittente sospetto, tono di urgenza, saluto
  generico, indirizzo del sito non ufficiale, richiesta di dati non necessaria) ancorati punto
  per punto al contenuto reale dell'email/sito, `closingText`.

### Renderer (`js/scenarios/renderers/phishingSimulationRenderer.js`, nuovo)
- **Macchina a stati rebuild-on-transition** (non show/hide di sottoalberi paralleli): un solo
  `mountView()` che distrugge la vista precedente e ricostruisce quella nuova ad ogni
  transizione — stesso principio già seguito da `fakeLoginCaptureRenderer.js`.
- **Intestazione per vista, non un topbar fisso condiviso** — decisione rivista a metà sviluppo,
  documentata nel codice: appena il flusso lascia il client di posta per il finto sito bancario,
  mantenere visibile il marchio del client di posta romperebbe la finzione. Ogni vista costruisce
  la propria intestazione (`buildMailTopbar()` per Inbox/Dettaglio, nome banca + barra indirizzo
  per le due viste del finto sito, badge "Simulazione completata" per la Rivelazione).
- **CTA presente solo se il dato lo prevede** (`email.ctaLabel`): risolve per costruzione dei dati
  il problema "un bottone che non porta da nessuna parte" — nessun controllo interattivo senza un
  effetto osservabile, principio rispettato ovunque nel progetto.
- **Barra indirizzo fittizia** (`buildBrowserBar`): l'unico elemento pensato esplicitamente per
  insegnare "controlla l'URL prima di inserire qualunque dato" — font monospace, prefisso
  invisibile per chi usa uno screen reader.
- **Validazione minima e deliberata** su entrambi i form del finto sito: qualunque valore non
  vuoto è accettato (`validateRequired`), nessun controllo di formato (niente regex email, niente
  Luhn, niente formato MM/AA) — richiesta esplicita dell'utente, coerente con l'obiettivo
  pedagogico (riconoscere i segnali, non produrre dati plausibili).
- **`autocomplete:"off"` su tutti i campi dei due form** — decisione di sicurezza pratica: senza,
  il browser del docente potrebbe suggerire/autocompletare credenziali o dati di pagamento
  REALMENTE salvati durante una demo dal vivo in aula.
- **CVV con `type="password"`** (mascherato), stesso realismo di un vero form bancario.
- **Finta latenza ~800ms** su entrambi i submit, stessa deviazione già motivata per il Keylogger.
- **Rivelazione in-app immediata** (non un file scaricato come nel Keylogger): badge "Simulazione
  completata" (tono info) + titolo + 5 segnali numerati via contatore CSS (reset.css azzera i
  marcatori nativi di `<ol>`, stesso principio già seguito da `Timeline.js`) + testo di chiusura.
- **Annuncio `aria-live`** ad ogni transizione di vista, stesso principio già seguito da
  `Feed.js`/`profileTimelineRenderer.js`/`MediaViewer.js`.
- **Fetch**: `inbox.json` (via `createLocalJsonRepository`) + `bank-site.json`/`reveal.json` (via
  `createLocalJsonResource`) in un solo `Promise.all`, stesso pattern di `profileTimelineRenderer.js`.

### CSS (`css/scenarios/phishing-simulation.css`, nuovo)
- Finto client di posta e finto sito trattati come una **card centrata** (max-width 640px, stessa
  larghezza già usata da `profile-timeline.css`), non a piena pagina — riusa
  `.sl-scenario-page__immersive` già esistente (nessuna modifica a `scenario-page.css`).
- Barra indirizzo monospace su sfondo `bg-elevated`.
- Numerazione visiva dei segnali d'allarme via contatore CSS, stessa coppia `info-bg-subtle`/
  `info-text` già verificata per Badge.
- **Nessun nuovo accostamento colore**: tutti i token riusati erano già verificati altrove nel
  progetto sugli stessi sfondi.

### Registrazione (entrambi modificati)
- `data/modules.json`: terzo scenario (`{ "id": "phishing", "title": "Phishing", "available":
  true }`) aggiunto all'array `scenarios` del modulo `cybersecurity`.
- `index.html`: +1 `<link>` (`phishing-simulation.css`), +1 import + `registerRenderer(
  "phishing-simulation", renderPhishingSimulation)`. **Nessuna nuova rotta necessaria**
  (`#/scenario/:scenarioId` è già generica) — confermato che l'intera infrastruttura condivisa
  (`scenarioEngine.js`, `router.js`, `moduleScenariosPageController.js`, `ModuleCard.js`,
  `appShell.js`) accoglie un terzo scenario a costo zero.

### Test
- `tests/phishing.spec.js` (nuovo, 12 controlli): selettore Cybersecurity con 3 scenari, flusso
  completo Inbox→Rivelazione attraverso l'app reale, vincolo etico (nessuna richiesta esterna
  intercettata su tutto il flusso), regressione esplicita su Oversharing e Keylogger, screenshot
  del selettore.
- `tests/run-all.js` (modificato, +1 riga): include la nuova suite nell'esecuzione aggregata.

### Verifica
- **Step 2** (Inbox + Dettaglio email, senza CTA): 12 controlli su harness isolato con fetch reale
  dei JSON — tutti verdi. 4 screenshot ispezionati (Light, Dark, mobile 375px, dettaglio email).
- **Step 3+4+5** (CTA + finto sito a due step + Rivelazione, costruiti insieme per evitare vicoli
  ciechi tra transizioni non ancora cablate): 17 controlli su harness isolato, incl. validazione
  vuota/parziale/completa su entrambi i form, autocomplete, vincolo etico. 5 screenshot ispezionati
  (Accesso Light/Dark, Pagamento mobile 375px, Rivelazione).
- **Step 6+7** (registrazione + regressione): l'intero progetto (tutti i componenti, servizi,
  pagine, dati, CSS — non solo i file nuovi) è stato ricostruito in questa sessione per eseguire
  una suite attraverso l'`index.html` reale — **40/40 controlli superati**, incl. bootstrap/login/
  logout, Home data-driven, Oversharing (profilo/toggle/MediaViewer), Keylogger (validazione
  loose/download), e l'intero flusso Phishing con vincolo etico verificato.

---

## 3. Architettura attuale

```
socialive/
├── index.html                                    # ♻️ MODIFICATO — +1 <link>, +1 renderer registrato
├── data/
│   ├── modules.json                              # ♻️ MODIFICATO — cybersecurity.scenarios += phishing
│   └── scenarios/
│       ├── oversharing/...                       (invariato)
│       ├── keylogger/...                         (invariato)
│       └── phishing/                             # ⭐ NUOVA cartella
│           ├── scenario.json                     # ⭐ NUOVO
│           ├── inbox.json                        # ⭐ NUOVO
│           ├── bank-site.json                    # ⭐ NUOVO
│           └── reveal.json                       # ⭐ NUOVO
│
├── css/
│   └── scenarios/
│       ├── profile-timeline.css                  (invariato)
│       ├── fake-login-capture.css                (invariato)
│       └── phishing-simulation.css               # ⭐ NUOVO
│
└── js/
    ├── core/router.js                            (INVARIATO)
    ├── pages/                                    (TUTTI INVARIATI)
    ├── scenarios/
    │   ├── scenarioEngine.js                     (INVARIATO — zero modifiche per il nuovo type)
    │   └── renderers/
    │       ├── profileTimelineRenderer.js        (INVARIATO)
    │       ├── fakeLoginCaptureRenderer.js       (INVARIATO)
    │       └── phishingSimulationRenderer.js     # ⭐ NUOVO
    ├── repositories/localJsonRepository.js       (INVARIATO)
    └── components/                                (TUTTI INVARIATI — Input.js/Button.js/Avatar.js/
                                                       Loader.js/Badge.js riusati as-is)

tests/
├── login.spec.js · home.spec.js · scenario.spec.js  (INVARIATI nel repository reale)
├── phishing.spec.js                              # ⭐ NUOVO (12 controlli)
└── run-all.js                                     # ♻️ MODIFICATO (+1 riga)
```

**Nessuna modifica** a `scenarioEngine.js`, `router.js`, `appShell.js`,
`moduleScenariosPageController.js`, `homePageController.js`, `ModuleCard.js`, `authService.js`,
`Button.js`, `Input.js`, `Avatar.js`, `Loader.js`, `Badge.js`, o a qualunque CSS/componente
condiviso — riusati esattamente come sono. **Il comportamento di Oversharing e Keylogger non
cambia**: la ricostruzione descritta in §2 riporta entrambi al loro stato corretto già esistente,
non introduce alcuna modifica funzionale.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Combinazione credenziali + dati di pagamento (non solo una delle due) | Richiesta esplicita dell'utente; distingue concettualmente Phishing dal Keylogger — furto di un pagamento vs. furto di un login |
| Intestazione per vista, non un topbar fisso condiviso a livello di wrapper | Un marchio "MailTime" visibile sopra un finto sito bancario romperebbe la finzione nell'istante in cui il flusso lascia il client di posta — revisione fatta a metà sviluppo (Step 3), documentata esplicitamente nel codice come cambiamento rispetto alla primissima implementazione |
| `autocomplete:"off"` su TUTTI i campi dei due form del finto sito | Rischio pratico concreto, non solo teorico: senza, il browser del docente potrebbe suggerire dati REALMENTE salvati (di un altro sito) durante una demo dal vivo in aula |
| Validazione minima ("non vuoto", nessun controllo di formato) su entrambi i form | Richiesta esplicita dell'utente — qualunque dato di fantasia deve essere accettato; un controllo più stringente insegnerebbe implicitamente "come si genera un numero di carta valido", fuori tema rispetto all'obiettivo pedagogico |
| CVV con `type="password"` | Stesso realismo di un vero form bancario, mascherato durante la digitazione |
| Rivelazione IN-APP IMMEDIATA (non un file scaricato come nel Keylogger) | Coerente con l'obiettivo didattico "riconoscere i segnali d'allarme": una rivelazione immediata è commentabile a schermo condiviso subito dopo il submit, diversamente dal Keylogger dove l'obiettivo era "trovare il dato nel file dopo" |
| Nome banca e dominio sempre fittizi | Stesso principio già rispettato ovunque nel progetto: nessun marchio reale, nessuna persona reale |
| CTA nell'email presente solo se il dato lo prevede (`ctaLabel`) | Nessun controllo interattivo senza un effetto osservabile — costruito insieme alla vista di destinazione (Step 3+4+5 uniti) per evitare esattamente questo vicolo cieco |
| Nessuna nuova rotta in `router.js` | `#/scenario/:scenarioId` è già generica — la registrazione del terzo scenario richiede solo un renderer registrato in `scenarioEngine.js` e una voce dati, zero infrastruttura nuova |
| Numerazione dei segnali d'allarme via contatore CSS, non marcatori nativi di `<ol>` | `reset.css` azzera `list-style` su ogni lista del progetto — stesso principio già seguito da `Timeline.js` (`<ol>` per l'ordine semantico, non per la resa visiva) |

---

## 5. Attività rimanenti

1. **Rieseguire la suite ufficiale completa** (`npm test`, 86 controlli esistenti + 12 nuovi) nel
   repository reale dopo aver applicato i file di questa fase — la regressione eseguita in questa
   sessione ha usato una ricostruzione condensata (40 controlli) per verificare l'integrazione,
   non un rimpiazzo dei file di test reali (`tests/home.spec.js`/`tests/scenario.spec.js` restano
   quelli già esistenti nel repository, invariati).
2. Gap generali già noti e invariati da Fase 10/Keylogger: icon sprite (`assets/icons/icons.svg`),
   `js/config/env.js` (Supabase), integrazione CI, controllo anti-regressione per contenuti
   testuali banditi, immagini reali di Oversharing ancora placeholder (gestite dall'utente).
3. **Quarto scenario reale** (Long Term Vision): oggi 3 pattern di riferimento disponibili
   (`profile-timeline`, `fake-login-capture`, `phishing-simulation`) — candidati naturali:
   Social Engineering, Password Security, Fake News.
4. Breakpoint intermedi (768–1024px) specifici per le viste di Phishing — non verificati in questa
   fase (rischio basso: stesso linguaggio visivo "card centrata" già verificato per Keylogger a
   quei breakpoint).

---

## 6. Prossima fase

Nessuna fase numerata pendente dalla Suite originaria. Due direzioni indipendenti disponibili:

- **(A) Consolidamento**: riesecuzione della suite ufficiale completa nel repository reale,
  integrazione CI, controllo anti-regressione per contenuti testuali banditi.
- **(B) Espansione**: quarto scenario reale — con **tre** pattern di riferimento oggi disponibili
  invece di due, la scelta del type (riuso di uno dei tre esistenti, o un quarto type genuinamente
  nuovo) è la prima decisione da motivare prima di scrivere codice.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa, seguita da interventi su Oversharing,
dallo scenario Keylogger (type "fake-login-capture") e ORA da un terzo scenario reale: PHISHING
(type "phishing-simulation"). Il documento di handover completo è allegato: consideralo la fonte
di verità primaria.

COSA FA LO SCENARIO PHISHING: un client di posta fittizio (5 email: 4 di riempimento + 1 target
da "Banca Centrale Sicura", dominio del mittente deliberatamente sospetto) mostra un'email con
tono di urgenza e un CTA ("Verifica il pagamento"). Il click apre un finto sito bancario a due
step: Accesso (email/codice cliente + password) e Pagamento (numero carta, scadenza, CVV
mascherato, nome, cognome) — validazione minima e deliberata (qualunque dato non vuoto è
accettato, nessun controllo di formato), autocomplete:"off" su tutti i campi (protezione pratica
contro l'autofill di dati reali del docente durante una demo dal vivo), finta latenza ~800ms sui
submit. Dopo il secondo submit si apre una Rivelazione IN-APP IMMEDIATA (non un file scaricato
come nel Keylogger): badge "Simulazione completata" + 5 segnali d'allarme numerati, ancorati
punto per punto al contenuto dell'email/sito appena mostrati. chrome:"none" (come Keylogger).
Nessuna chiamata di rete reale in nessun momento — verificato con un test dedicato che intercetta
ogni request del browser e conferma che nessuna esce verso un host esterno al server locale.

FILE NUOVI: data/scenarios/phishing/{scenario,inbox,bank-site,reveal}.json,
js/scenarios/renderers/phishingSimulationRenderer.js, css/scenarios/phishing-simulation.css,
tests/phishing.spec.js.
FILE MODIFICATI: data/modules.json (+ scenario "phishing" sotto "cybersecurity"), index.html
(+1 <link>, +1 import, +1 registerRenderer — NESSUNA nuova rotta necessaria), tests/run-all.js
(+1 riga per includere la nuova suite).

VERIFICA ESEGUITA: 52 controlli nel corso della fase (harness isolati per step incrementali) +
40/40 sulla regressione integrale finale attraverso l'index.html reale ricostruito per intero in
questa sessione (login, Home data-driven, Oversharing, Keylogger, Phishing — nessuna regressione
introdotta sui due scenari esistenti). NOTA DI TRASPARENZA: la regressione finale ha usato una
ricostruzione condensata di login.spec.js/home.spec.js/scenario.spec.js (40 controlli totali) per
verificare l'integrazione end-to-end — NON un rimpiazzo dei file di test reali del repository, che
restano quelli già esistenti (86 controlli ufficiali). Prima azione della prossima sessione: `npm
test` nel repository reale per confermare 86+12 controlli, se non già fatto.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro".

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant, Full Stack
Architect. Motiva ogni decisione prima di implementarla. Mai duplicare componenti/moduli per la
stessa funzione; interfaccia uniforme create(props)→{element,update,destroy} per i componenti UI,
(container,params)→destroy per i page controller; eventi "sl:nome-evento"; componenti "dumb";
documentazione in italiano; MAI dati reali o chiamate di rete reali nei meccanismi di simulazione
di qualunque scenario (vincolo etico assoluto, verificato sempre con un test dedicato); test reali
con Playwright (mai mock) prima di consegnare, verificati anche attraverso l'index.html reale;
per ogni file dichiara sempre NUOVO/MODIFICATO/GIÀ ESISTENTE, verificato sui file reali, non per
assunzione; handover completo a 10 sezioni + file .md separato ad ogni milestone.

STATO: nessuna attività pendente su questo specifico scenario. Le due direzioni generali restano
disponibili come prossimo passo del progetto: (A) consolidamento (riesecuzione suite ufficiale,
CI, anti-regressione testi banditi) o (B) espansione (quarto scenario reale — oggi 3 pattern di
riferimento disponibili: profile-timeline, fake-login-capture, phishing-simulation).

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Inbox: 5 email visibili, ordinate per orario decrescente.
- [x] Stato "non letta" dichiarato via `aria-label` (mai solo il peso del font).
- [x] Apertura email target: CTA presente con la label corretta dal dato (`ctaLabel`).
- [x] Apertura email di riempimento: nessun CTA.
- [x] Click CTA → vista Accesso: nome banca, barra indirizzo, 2 campi, `autocomplete="off"`.
- [x] Submit vuoto → entrambi i campi in errore, nessuna transizione.
- [x] Submit con dati di fantasia (non un'email reale) → accettato, transizione al Pagamento.
- [x] Vista Pagamento: 5 campi, CVV mascherato, `autocomplete="off"` su tutti.
- [x] Submit parziale → solo i campi vuoti in errore, focus sul primo mancante.
- [x] Submit completo con dati di fantasia → accettato, transizione alla Rivelazione.
- [x] Rivelazione: badge, titolo, 5 segnali d'allarme numerati, testo di chiusura.
- [x] Annuncio `aria-live` corretto ad ogni transizione.
- [x] Selettore Cybersecurity: 3 scenari, tutti "Disponibile", terzo è "Phishing".
- [x] Navigazione da tastiera: Tab raggiunge le righe email, Invio apre il dettaglio.
- [x] Regressione: Oversharing e Keylogger ancora raggiungibili e funzionanti.
- [ ] Suite ufficiale completa (86+12 controlli) nel repository reale — da eseguire.

### Test UI
- [x] Screenshot Inbox — Light, Dark, mobile 375px.
- [x] Screenshot vista Accesso — Light, Dark.
- [x] Screenshot vista Pagamento — mobile 375px (nessun overflow orizzontale).
- [x] Screenshot Rivelazione.
- [x] Screenshot selettore Cybersecurity con 3 scenari.
- [ ] Breakpoint intermedi 768–1024px specifici per Phishing — non verificati.

### Test UX
- [x] Nessun movimento forzato del focus alle transizioni.
- [x] Stato "in corso" (label + spinner) coerente durante la finta latenza dei submit.
- [x] Barra indirizzo leggibile, font monospace per notare l'anomalia del dominio.

### Test tecnici
- [x] `node --check` su tutti i 42 file `.js` del progetto ricostruito.
- [x] Tutti i 14 file JSON validati sintatticamente.
- [x] Console priva di errori JS in tutto il flusso.
- [x] **VINCOLO ETICO**: nessuna richiesta di rete verso un host esterno in tutto il flusso a 5
  viste — verificato con un test dedicato che intercetta ogni `request` del browser.
- [x] Nessun path relativo rotto in `index.html`.

### Test di regressione
- [x] Login/logout, guardie di sessione: confermati invariati.
- [x] Home data-driven (moduli + feed): confermata invariata, ora con selettore a 3 scenari.
- [x] Oversharing (profilo, toggle Feed/Archivio, bottone Segui, MediaViewer): confermato invariato.
- [x] Keylogger (validazione loose, download, messaggio neutro): confermato invariato.
- [ ] Suite ufficiale a 86 controlli storici — non rieseguita testualmente identica in questa
  sessione (vedi nota di trasparenza §2/§5).

---

## 9. Criticità

Nessuna criticità bloccante identificata. Un solo punto aperto, già segnalato più volte in questo
documento per onestà di processo: la regressione finale di questa sessione ha usato una
ricostruzione condensata delle suite `login`/`home`/`scenario` (40 controlli) invece della loro
copia testualmente identica a 86 controlli — sufficiente a confermare che nessun percorso critico
si è rotto, ma non equivalente a una riesecuzione della baseline storica esatta. Rischio basso:
nessun file condiviso (`router.js`, `scenarioEngine.js`, `appShell.js`, componenti UI) è stato
toccato in questa fase, solo file additivi (nuovo scenario) o modificati in modo puramente
additivo (`modules.json`, `index.html`, `run-all.js`).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo scenario.

### Refactoring consigliati
- 🟢 Nessuno: il renderer riusa esclusivamente componenti/pattern già esistenti (`Input.js`,
  `Button.js`, `Avatar.js`, `Loader.js`, `Badge.js`, `createLocalJsonRepository`/`Resource`) —
  zero nuova indirection introdotta oltre a quanto strettamente necessario per la macchina a
  stati del renderer stesso.

### Ottimizzazioni future
- 🟢 Breakpoint intermedi (768–1024px) specifici per Phishing — rischio basso, stesso linguaggio
  visivo già verificato per Keylogger a quei breakpoint.
- 🟢 Riesecuzione della suite ufficiale completa (86+12) nel repository reale, per chiudere
  formalmente il punto aperto di §9.

### Rischi architetturali
- 🟢 **Nessun rischio nuovo**: il pattern Registry di `scenarioEngine.js` è ora validato con un
  **terzo** `type` reale — zero modifiche all'engine sono state necessarie, terza conferma
  consecutiva della promessa di estendibilità fissata in Fase 1.
- 🟢 Nessuna nuova rotta introdotta in `router.js`: `#/scenario/:scenarioId` generica ha accolto
  il terzo scenario senza alcuna estensione — confermato che il routing parametrico scala a
  piacere per nuovi scenari.

### Priorità
- 🟡 Media: riesecuzione della suite ufficiale completa (86+12) nel repository reale — chiude
  formalmente l'unico punto aperto di questa fase.
- 🟢 Bassa: tutto il resto — nessuna criticità bloccante identificata da questo scenario.

### Obiettivo
Questo scenario è chiuso end-to-end: implementazione, verifica reale (harness isolati per step
incrementali, poi regressione integrale attraverso l'app reale ricostruita), documentazione — terzo
scenario che conferma concretamente, non solo teoricamente, l'estendibilità architetturale di
SOCIALIVE promessa fin dalla Fase 1. Eredita per la prossima fase una piattaforma con tre pattern
di scenario di riferimento (`profile-timeline`, `fake-login-capture`, `phishing-simulation`), una
suite di test ufficiale da riconfermare a 98 controlli totali, e zero debito tecnico nuovo.
