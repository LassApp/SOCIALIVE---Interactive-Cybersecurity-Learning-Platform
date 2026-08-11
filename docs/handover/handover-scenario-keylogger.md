# SOCIALIVE — Handover: Scenario Keylogger (fake-login-capture)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** primo scenario reale con un `type` diverso da `"profile-timeline"` — prima vera
prova del pattern Registry di `scenarioEngine.js`, promesso ma solo teoricamente validato da
Fase 5. Introduce anche il primo modulo della Home con più di uno scenario reale
(Cybersecurity: Oversharing + Keylogger), e la prima modalità di layout "immersiva"
(`chrome:"none"`) in `scenarioPageController.js`.
**Tag di riferimento suggerito:** `v1.4.0-scenario-keylogger`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari + i tre interventi incrementali su Oversharing (toggle privacy,
  MediaViewer generico, eliminazione toggle lucchetto): ✅ completi, invariati.
- **Scenario Keylogger: ✅ COMPLETATO E VERIFICATO END-TO-END.** Il docente può ora aprire
  Cybersecurity dalla Home, scegliere tra due scenari (Oversharing, Keylogger), e nel secondo
  vedere un login fittizio indistinguibile da quello reale che, al submit, genera e scarica un
  file `.txt` con le credenziali digitate — nessuna rivelazione in-app, nessun dato mai uscito
  dal browser.
- **105/105 controlli automatizzati eseguiti**: 19 su un harness dedicato al Keylogger (fedeltà
  delle credenziali nel file, unicità della `"@"`, disclaimer, chrome immersivo, regressione
  puntuale) + 86 sulla suite ufficiale persistita (`tests/`, ri-eseguita per intero attraverso
  l'`index.html` reale — non solo il nuovo codice).
- **2 scoperte di processo rilevanti** durante la verifica (dettagliate in §4/§9): una versione
  non aggiornata di `profileTimelineRenderer.js` nel mount di riferimento, e un bug preesistente
  e indipendente in `data/home/feed.json` — nessuno dei due introdotto da questo intervento,
  entrambi corretti/segnalati secondo la rispettiva pertinenza.
- **Nessuna riga di codice che intercetti input reali, effettui chiamate di rete, o persista
  dati fuori dal browser del docente** — vincolo etico rispettato e verificato esplicitamente.

---

## 2. Obiettivi completati

### Dati
- `data/scenarios/keylogger/scenario.json` (nuovo): `type: "fake-login-capture"`, `chrome: "none"`,
  `dataRefs.logTemplate`.
- `data/scenarios/keylogger/log-template.json` (nuovo): tag/livelli di log, pool di nomi modulo
  (mai contenenti `"@"`, per costruzione), template dei messaggi generativi, riga di cattura,
  disclaimer finale — tutti i contenuti esternalizzati, zero stringhe letterali nel codice.
- `data/modules.json` (modificato): il modulo `cybersecurity` passa da un singolo `scenarioId` a
  un array `scenarios: [...]`, con Oversharing e Keylogger entrambi `available: true` (verificato
  end-to-end, raccomandazione di go-live — vedi §4).

### Generatore del log (utility pura)
- `js/utils/keyloggerLogGenerator.js` (nuovo): `generateFakeLog(template, username, password, now)`
  → `{ fileName, content }`. Timestamp cronologici terminanti esattamente al momento del click,
  blocco di cattura posizionato al 55–75% del file, 90–120 righe totali. **Garanzia verificata
  su 200 esecuzioni ripetute**: il file contiene sempre e solo una `"@"`, esclusivamente sulla
  riga di cattura — nessun rumore generato può mai introdurne una per caso (pool esadecimali/
  testuali privi del carattere).

### Estensione additiva del login
- `js/components/LoginForm.js` (modificato): nuova prop `emailValidation: 'strict'|'loose'`
  (default `'strict'`, invariato per il login reale). In modalità `'loose'` la validità richiede
  solo la presenza di `"@"` — nessun dominio verificabile richiesto, perché il docente digita
  credenziali di fantasia decise al momento in aula. Zero duplicazione di markup/CSS/
  accessibilità: il componente resta lo stesso, riusato as-is.

### Renderer del nuovo type
- `js/scenarios/renderers/fakeLoginCaptureRenderer.js` (nuovo): monta `LoginForm` in modalità
  `loose`, genera e scarica il file via `Blob`+`<a download>` al submit (finta latenza di
  ~800ms, deviazione dichiarata dal principio "niente latenza finta" per le ragioni pedagogiche
  spiegate nel file), poi sostituisce il form con un messaggio neutro ("Accesso completato.") —
  nessuna rivelazione in-app in nessun momento. Annuncio `aria-live` del download avvenuto.
- `css/scenarios/fake-login-capture.css` (nuovo): solo layout di pagina, il form riusa
  `login-form.css` invariato.

### Layout immersivo (chrome:"none")
- `js/pages/scenarioPageController.js` (modificato): legge il campo `scenario.chrome` **prima**
  di scegliere lo scheletro da montare — se `"none"`, monta il renderer a piena viewport senza
  `AppHeader`/`Sidebar`; altrimenti (default, incl. Oversharing) comportamento invariato dalle
  fasi precedenti. La fetch dedicata per leggere `chrome` è un cache-hit su quella già eseguita
  internamente da `scenarioEngine.loadScenario()` (stesso URL, cache di
  `localJsonRepository.js`): **zero richieste di rete aggiuntive**.
- `css/layouts/scenario-page.css` (modificato): nuova regola `.sl-scenario-page__immersive`
  (centraggio verticale full-viewport, stesso principio già usato da `login-page.css`).

### Navigazione multi-scenario
- `js/pages/moduleScenariosPageController.js` (nuovo): rotta `#/modules/:moduleId`, selettore
  che riusa `ModuleCard.js` **senza alcuna modifica** (stessa interfaccia
  `{moduleId, title, available}` già esistente, qui applicata a scenari invece che a moduli di
  primo livello).
- `css/layouts/module-scenarios-page.css` (nuovo): layout della rotta, con una duplicazione
  dichiarata (non accidentale) rispetto a `home-page.css` — vedi §4/§10.
- `js/pages/homePageController.js` (modificato): `handleModuleOpen` instrada verso il selettore
  se il modulo ha `scenarios` (array), invece di navigare direttamente allo scenario come prima.
- `index.html` (modificato): 2 nuovi `<link>`, import/registrazione del nuovo renderer e delle
  due nuove rotte (`#/modules/:moduleId`, invariata `#/scenario/:scenarioId`).

### Verifica (Playwright, Chromium reale, server locale — mai `file://`)
- **19 controlli dedicati**: navigazione Home→selettore→Keylogger, `chrome:"none"` rispettato
  (0 `AppHeader`/`Sidebar`), brand/tagline reali riusati, validazione `loose` (email senza `"@"`
  → errore; email senza dominio ma con `"@"` → valida), download reale intercettato e letto,
  fedeltà di username/password (incl. virgolette sfuggite), unicità della `"@"`, disclaimer
  presente, lunghezza plausibile, nessun redirect forzato, nessuna rivelazione in-app,
  smontaggio pulito, **regressione su Oversharing e sul login reale** (`strict` ancora rifiuta
  email senza dominio).
- **86 controlli sulla suite ufficiale persistita** (`login.spec.js` 15 + `home.spec.js` 26 +
  `scenario.spec.js` 45), ri-eseguita per intero attraverso l'`index.html` reale dopo aver
  aggiornato i 2 test che assumevano la vecchia navigazione diretta Cybersecurity→Oversharing
  (vedi §4 per il dettaglio della correzione).
- 6 screenshot ispezionati: selettore scenari, login fittizio Light/Dark/mobile 375px, stato
  "Accesso in corso…", stato finale neutro — nessuna anomalia, nessun elemento "scolastico"
  visibile.
- File di log reale generato e ispezionato manualmente (non solo per asserzioni): rumore
  credibile, riga di cattura fedele e ricercabile con `Ctrl+F "@"`, disclaimer onesto in fondo.

---

## 3. Architettura attuale

```
socialive/
├── index.html                                    # ♻️ MODIFICATO — +2 <link>, +1 renderer, +1 rotta
├── data/
│   ├── modules.json                              # ♻️ MODIFICATO — cybersecurity: scenarios[]
│   └── scenarios/
│       ├── oversharing/...                       (invariato)
│       └── keylogger/                            # ⭐ NUOVA cartella
│           ├── scenario.json                     # ⭐ NUOVO
│           └── log-template.json                 # ⭐ NUOVO
│
├── css/
│   ├── scenarios/
│   │   ├── profile-timeline.css                  (invariato)
│   │   └── fake-login-capture.css                # ⭐ NUOVO
│   └── layouts/
│       ├── scenario-page.css                     # ♻️ MODIFICATO — + .sl-scenario-page__immersive
│       ├── home-page.css                         (invariato)
│       └── module-scenarios-page.css             # ⭐ NUOVO
│
└── js/
    ├── core/router.js                            (INVARIATO)
    ├── pages/
    │   ├── loginPageController.js                (INVARIATO)
    │   ├── homePageController.js                 # ♻️ MODIFICATO — handleModuleOpen
    │   ├── scenarioPageController.js             # ♻️ MODIFICATO — supporto chrome:"none"
    │   ├── moduleScenariosPageController.js      # ⭐ NUOVO
    │   └── shared/appShell.js                    (INVARIATO)
    ├── scenarios/
    │   ├── scenarioEngine.js                     (INVARIATO — zero modifiche per il nuovo type)
    │   └── renderers/
    │       ├── profileTimelineRenderer.js        (INVARIATO nel comportamento — vedi §4/§9
    │       │                                        per una discrepanza di mount scoperta e
    │       │                                        risolta durante la verifica)
    │       └── fakeLoginCaptureRenderer.js        # ⭐ NUOVO
    ├── repositories/localJsonRepository.js        (INVARIATO)
    ├── utils/
    │   ├── dom.js · storage.js · focusTrap.js · dateFormat.js · fallbackMessage.js · svg.js ·
    │   │   imageFadeIn.js · mediaViewerLauncher.js  (INVARIATI)
    │   └── keyloggerLogGenerator.js              # ⭐ NUOVO
    └── components/
        ├── LoginForm.js                           # ♻️ MODIFICATO — prop additiva emailValidation
        └── ...                                    (tutti gli altri, INVARIATI)

tests/
├── home.spec.js                                   # ♻️ MODIFICATO — 1 test aggiornato (nuova navigazione)
└── scenario.spec.js                               # ♻️ MODIFICATO — blocco flusso da tastiera esteso
```

**Nessuna modifica** a `router.js`, `authService.js`, `localJsonRepository.js`, `scenarioEngine.js`,
`appShell.js`, `loginPageController.js`, `ModuleCard.js`, `PageContainer.js`, `Button.js`,
`Input.js`, `Avatar.js`, o a qualunque file di Oversharing (dati, CSS) — riusati esattamente come
sono. **Il comportamento del renderer Oversharing non cambia**: la ricostruzione descritta al
punto §4/§9 riporta il file al suo stato corretto già esistente, non introduce alcuna modifica
funzionale.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| `type: "fake-login-capture"`, non `"keylogger"` | Descrive la forma dell'interazione (login fittizio → cattura → rivelazione fuori app), non lo scenario specifico — coerente con `"profile-timeline"`; un futuro scenario "Password Security" potrebbe riusarlo |
| Un solo template di cattura (non due varianti natural/forced) | Resa superflua dalla validazione email obbligatoria lato form: se il campo contiene sempre `"@"`, non serve mai un marcatore sintetico che rischierebbe di alterare un'email vera con una seconda `"@"` |
| Garanzia di unicità della `"@"` a due livelli (form + pool di rumore) | Il form garantisce che la `"@"` ci sia sempre; il generatore garantisce che il rumore non ne introduca mai una per caso — nessuno dei due meccanismi da solo basterebbe |
| Disclaimer finale senza il carattere `"@"` letterale | Verificato con un test dedicato: usarlo nel testo del disclaimer stesso introdurrebbe una seconda occorrenza — riformulato con "la chiocciola delle email" per mantenere l'unicità netta e prevedibile in una demo live |
| `emailValidation` come prop additiva di `LoginForm.js`, non un nuovo componente | L'unica differenza reale col login vero è la regola di validazione — estendere il componente esistente (default invariato) evita di duplicare markup/CSS/accessibilità già risolti lì |
| Finta latenza di submit (~800ms), deviazione dichiarata dal principio "niente latenza finta" (Fase 4) | Quel principio riguardava un backend fittizio dentro l'app REALE; questo scenario è dichiaratamente un'intera ricostruzione didattica — omettere la latenza indebolirebbe il realismo che è l'obiettivo esplicito |
| `chrome:"none"` letto con una fetch dedicata in `scenarioPageController.js`, non un parametro nuovo per `scenarioEngine.js` | Zero modifiche all'engine (resta ignaro del layout); la seconda fetch di `scenario.json` fatta da `loadScenario()` è un cache-hit garantito dalla cache condivisa di `localJsonRepository.js` — zero costo di rete aggiuntivo |
| Nessuna rivelazione in-app in nessun momento (messaggio neutro "Accesso completato.") | Requisito esplicito: il "colpo di scena" deve avvenire SOLO quando il docente apre il file fuori dall'app — un badge o un colore diverso in-app anticiperebbe la lezione |
| `modules.json`: `scenarios` array invece di `scenarioId` singolare | Cybersecurity ha ora 2 scenari reali — un campo singolare non potrebbe più rappresentarlo; nessun modulo residuo usa ancora il vecchio campo (sostituito per intero, non affiancato) |
| Riuso di `ModuleCard.js` per il selettore scenari, zero variante dedicata | Stessa funzione (card cliccabile con badge disponibile/in arrivo) del caso "moduli di primo livello" — comporlo di nuovo sarebbe la duplicazione che il progetto vieta esplicitamente |
| `.sl-module-scenarios-page__grid` duplica `.sl-home-page__modules-grid` (debito dichiarato) | Unificarle in questo step avrebbe richiesto toccare anche i selettori CSS test-adiacenti in un intervento già ampio — candidata esplicita a un file condiviso futuro (`module-grid.css`), vedi §10 |

---

## 5. Attività rimanenti

**Nessuna attività aperta sull'implementazione del Keylogger stesso** — completo e verificato
end-to-end. Punti indipendenti, pre-esistenti o emersi durante la verifica:

1. **Bug preesistente, fuori scope, scoperto durante la verifica** (§9): `data/home/feed.json`
   referenzia ancora `assets/images/home/post_mario_bianchi.jpg` (path non esistente) invece di
   `assets/images/home/mountain-placeholder.svg`, come invece dichiarato completato
   dall'handover di Fase 10. **Non corretto in questo intervento** (fuori dallo scope
   "Keylogger" esplicitamente richiesto) — segnalato qui perché indipendente ma reale.
2. **Duplicazione CSS dichiarata**: `.sl-module-scenarios-page__grid`/`.sl-home-page__modules-grid`
   — candidata a estrazione condivisa, vedi §10.
3. Gap generali già noti e invariati da Fase 10: icon sprite, `js/config/env.js` (Supabase),
   integrazione CI, controllo anti-regressione per contenuti testuali banditi, immagini reali di
   Oversharing ancora placeholder (gestite dall'utente).
4. **Terzo scenario reale** (Phishing, Social Engineering, Password Security, ecc. — Long Term
   Vision): il pattern Registry di `scenarioEngine.js` è oggi validato con **due** `type` diversi
   (non più solo teoricamente, come segnalato apertamente in Fase 10) — un terzo scenario, con lo
   stesso `type` di uno dei due esistenti o con un terzo tipo nuovo, sarebbe la prova successiva.

---

## 6. Prossima fase

Nessuna fase numerata pendente. Le direzioni generali restano quelle già proposte in chiusura di
Fase 10, ora aggiornate:

- **Consolidamento**: correggere `data/home/feed.json` (punto 1 di §5, indipendente da questo
  intervento ma reale); unificare la griglia moduli/scenari duplicata (punto 2); integrazione CI
  per `tests/`; controllo anti-regressione per contenuti testuali banditi.
- **Espansione**: terzo scenario reale — con **due** pattern di riferimento oggi disponibili
  (`profile-timeline` per contenuti "sfoglia un profilo", `fake-login-capture` per contenuti
  "form fittizio → file locale") invece di uno solo.

**Punto di ripartenza esatto per un futuro terzo scenario**: se riusa `fake-login-capture` (es.
un login fittizio con un tema diverso), zero modifiche a codice — solo un nuovo
`data/scenarios/<id>/` + `log-template.json` + voce in `modules.json`. Se introduce un terzo
`type`, il punto di estensione è identico a quello già usato qui: un nuovo renderer registrato in
`index.html`, zero modifiche a `scenarioEngine.js`/`scenarioPageController.js` a meno di un
bisogno di layout genuinamente nuovo (come lo è stato `chrome:"none"` in questo intervento).

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa, seguita da tre interventi su Oversharing
(toggle privacy, MediaViewer generico, eliminazione toggle lucchetto) e ora da un nuovo scenario
reale: KEYLOGGER (type "fake-login-capture") — il primo con un type diverso da
"profile-timeline". Il documento di handover completo è allegato: consideralo la fonte di verità
primaria.

COSA FA LO SCENARIO KEYLOGGER: un login fittizio (riusa LoginForm.js con una nuova prop additiva
emailValidation:"loose" — richiede solo "@", non un dominio) che, al submit, genera e scarica
localmente (Blob + <a download>, MAI una richiesta di rete) un file .txt di log fittizio
contenente le credenziali digitate. Il file contiene ~90-120 righe di rumore generato
proceduralmente (mai in grado di contenere "@" per costruzione) + una riga di cattura fedele alle
credenziali (con la "@" naturale del campo email, garantita dalla validazione a monte — nessun
marcatore sintetico) + un disclaimer finale che rivela la natura didattica. Nessuna rivelazione
avviene DENTRO l'interfaccia: dopo il download il form si sostituisce con "Accesso completato.",
un messaggio neutro. La rotta usa un nuovo campo scenario.json ("chrome":"none") che fa montare
scenarioPageController.js SENZA AppHeader/Sidebar, per massimizzare il realismo del finto login.

NAVIGAZIONE CAMBIATA: il modulo Cybersecurity nella Home ha ora 2 scenari (Oversharing,
Keylogger) — cliccarlo porta a un nuovo selettore (#/modules/:moduleId, nuovo page controller
moduleScenariosPageController.js che riusa ModuleCard.js as-is), non più direttamente a
Oversharing. data/modules.json è stato aggiornato di conseguenza (campo "scenarios": [...] invece
di "scenarioId" singolare).

FILE NUOVI: data/scenarios/keylogger/{scenario,log-template}.json,
js/utils/keyloggerLogGenerator.js, js/scenarios/renderers/fakeLoginCaptureRenderer.js,
css/scenarios/fake-login-capture.css, js/pages/moduleScenariosPageController.js,
css/layouts/module-scenarios-page.css.
FILE MODIFICATI: js/components/LoginForm.js (prop additiva), js/pages/scenarioPageController.js
(supporto chrome:"none", additivo/retrocompatibile), css/layouts/scenario-page.css (+1 regola),
data/modules.json, js/pages/homePageController.js (handleModuleOpen), index.html,
tests/home.spec.js e tests/scenario.spec.js (2 test aggiornati per la nuova navigazione, NON
bug — comportamento cambiato deliberatamente).

VERIFICA ESEGUITA: 105/105 controlli reali (19 harness dedicato Keylogger + 86 suite ufficiale
persistita, ri-eseguita per intero attraverso l'index.html reale con Chromium reale). Garanzia
verificata su 200 esecuzioni ripetute del generatore: il file contiene SEMPRE e SOLO una "@",
esclusivamente sulla riga di cattura.

SCOPERTE DI PROCESSO DURANTE LA VERIFICA (leggi con attenzione, non ripartire da assunzioni):
1. Il mount di riferimento del progetto conteneva una versione NON aggiornata di
   profileTimelineRenderer.js (con il vecchio toggle-lucchetto, rimosso in un intervento
   precedente) — stessa classe di errore già documentata 4 volte nella storia del progetto
   (Fase 6/8/9/10: un file mai realmente sincronizzato con l'ultimo stato narrato). Corretto
   ricostruendo il file dal contenuto più recente della conversazione, non dal mount. VERIFICA
   SEMPRE il contenuto reale di profileTimelineRenderer.js prima di assumerne lo stato.
2. data/home/feed.json ha un bug preesistente e INDIPENDENTE da questo intervento (referenzia
   ancora assets/images/home/post_mario_bianchi.jpg, path inesistente, invece di
   mountain-placeholder.svg come Fase 10 dichiarava) — non corretto qui (fuori scope), segnalato
   per una fase futura di consolidamento.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" (NON "Prof. Anna Ferrari").

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant e Full Stack
Architect. Motiva ogni decisione prima di implementarla. Mai duplicare componenti/moduli per la
stessa funzione; interfaccia uniforme create(props)→{element,update,destroy} per i componenti UI,
(container,params)→destroy per i page controller; eventi "sl:nome-evento"; componenti "dumb";
documentazione in italiano; test reali (mai mock) verificati anche attraverso l'index.html reale;
per ogni file dichiara sempre NUOVO/MODIFICATO/GIÀ ESISTENTE, verificato sui file reali, non per
assunzione; handover completo a 10 sezioni + file .md separato ad ogni milestone.

STATO: nessuna attività pendente sul Keylogger. Prossimi passi possibili: (A) consolidamento
(correggere feed.json, unificare la griglia moduli/scenari duplicata, CI, anti-regressione testi
banditi) o (B) espansione (terzo scenario reale — oggi 2 pattern di riferimento disponibili,
profile-timeline e fake-login-capture).

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** in questa sessione (Playwright,
Chromium reale, server locale ricostruito, mai `file://`).

### Test funzionali
- [x] Click su Cybersecurity → selettore con 2 card (Oversharing, Keylogger).
- [x] Click su Keylogger → `#/scenario/keylogger`, `chrome:"none"` rispettato (0 AppHeader/Sidebar).
- [x] Brand "SocialAlive" e tagline reali (LoginForm riusato as-is).
- [x] Email senza `"@"` → errore "deve contenere \"@\""; email senza dominio ma con `"@"` → valida
  (validazione `loose`, non `strict`).
- [x] Submit valido → download reale di un file `.txt` con nome plausibile.
- [x] Username/password riportati fedelmente nel file (incl. virgolette sfuggite).
- [x] La riga di cattura è l'**unica** occorrenza di `"@"` nel file (verificato anche su 200
  esecuzioni ripetute del generatore, non solo nel test end-to-end).
- [x] Disclaimer finale presente, rivela la natura didattica.
- [x] Lunghezza del file plausibile (90–120 righe di log).
- [x] Nessun redirect forzato dopo il download; nessuna rivelazione delle credenziali in-app.
- [x] Regressione: Oversharing ancora raggiungibile con `AppHeader`/`Sidebar` (chrome standard).
- [x] Regressione: login reale (`strict`) rifiuta ancora un'email senza dominio valido.
- [x] Regressione (suite ufficiale, 86 controlli): autenticazione, Home data-driven, profilo
  Oversharing, toggle Post/Archivio, bottone Segui/visibilità, MediaViewer (post/avatar/copertina/
  storie/zoom/pan), flusso completo da tastiera Home→selettore→Oversharing→Feed→MediaViewer.

### Test UI
- [x] Screenshot selettore scenari, login fittizio Light/Dark/mobile 375px, stato "in corso",
  stato finale — nessuna anomalia, nessun elemento "scolastico" visibile.
- [x] Nessun overflow orizzontale a 375px.
- [ ] Breakpoint intermedi (768–1024px) specifici della schermata Keylogger — non verificati in
  questo intervento (rischio basso: layout identico a `login-page.css`, già verificato a quei
  breakpoint in Fase 9).

### Test UX
- [x] Nessuna parola "keylogger"/rivelazione visibile nel testo dell'interfaccia in nessun
  momento del flusso.
- [x] Stato di submit ("Accesso in corso…") coerente con un login reale.
- [x] Annuncio `aria-live` del download avvenuto.

### Test tecnici
- [x] `node --check` su tutti i file `.js` nuovi/modificati.
- [x] JSON validati sintatticamente.
- [x] Console priva di errori JS inaspettati (tollerato solo il 404 preesistente e indipendente
  di `post_mario_bianchi.jpg`, non introdotto da questo intervento — vedi §9).
- [x] Nessun path relativo rotto in `index.html`.

### Test di regressione
- [x] Suite ufficiale completa (86/86) ri-eseguita attraverso `index.html` reale — inclusi i 2
  test aggiornati per riflettere la nuova navigazione (comportamento cambiato deliberatamente,
  non una regressione non intenzionale).
- [x] `profileTimelineRenderer.js`: ri-verificato per intero (45/45 su `scenario.spec.js`) dopo
  la ricostruzione dalla versione corretta — comportamento confermato identico a quello
  documentato nell'ultimo intervento su Oversharing.

---

## 9. Criticità

- **Scoperta di processo (impatto medio, corretta in questa sessione)**: il mount di riferimento
  del progetto conteneva una versione **non aggiornata** di `profileTimelineRenderer.js` (con il
  vecchio toggle-lucchetto, eliminato in un intervento precedente — "handover-rimozione-toggle-
  lucchetto.md"). È la **quinta occorrenza** di questa classe di errore nella storia del
  progetto (Fase 6: `<link>` mancanti; Fase 8: `homePageController.js` non riscritto; Fase 9: 2
  interventi dichiarati ma mai scritti; Fase 10: correzione di `style-guide.html` non applicata).
  Scoperta SOLO perché la suite ufficiale persistita (`tests/scenario.spec.js`) conteneva
  asserzioni sul comportamento corretto (`follow-button`/`follow-status`) che hanno fallito
  contro la versione stale — ulteriore prova, aggiunta alle quattro precedenti, che la suite
  persistita è la rete di sicurezza più efficace contro questa specifica classe di errore.
- **Bug preesistente e indipendente, non corretto (fuori scope)**: `data/home/feed.json`
  referenzia un path immagine inesistente (`post_mario_bianchi.jpg`). Segnalato in §5 per una
  futura fase di consolidamento, non toccato qui.
- **Duplicazione CSS dichiarata** (`.sl-module-scenarios-page__grid`): debito minore, motivato in
  §4, candidato a un intervento di unificazione futuro (§10).
- **Breakpoint intermedi non verificati specificamente per la schermata Keylogger** (rischio
  basso, layout identico a `login-page.css` già verificato).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento sullo scope Keylogger stesso.
- 🟡 **`data/home/feed.json` con path immagine non valido** — preesistente, indipendente, non
  corretto in questo intervento (fuori scope dichiarato).

### Refactoring consigliati
- 🟡 **Unificare `.sl-module-scenarios-page__grid`/`.sl-home-page__modules-grid`** in un file CSS
  condiviso (es. `css/components/module-grid.css`) — duplicazione dichiarata in §4, non
  affrontata in questo step per contenere il raggio della modifica.
- 🟢 Nessun altro refactoring identificato: il resto dell'intervento è additivo (nuovo renderer,
  nuova utility, una prop additiva, un campo dati additivo).

### Ottimizzazioni future
- 🟢 **Precaricamento/verifica dei breakpoint intermedi** per la schermata Keylogger — rischio
  basso, layout condiviso con `login-page.css` già verificato altrove.
- 🟢 **Formalizzare un test grep-based anti-regressione** per la classe di errore "mount non
  sincronizzato con l'ultimo stato reale" (proposta già presente nell'handover di Fase 10,
  ancora più pertinente dopo questa quinta occorrenza).

### Rischi architetturali
- 🟢 **Nessun rischio nuovo di rilievo**: `chrome:"none"` è additivo e retrocompatibile
  (verificato: Oversharing, privo del campo, ottiene esattamente il comportamento di sempre);
  `emailValidation` su `LoginForm.js` è additivo (default invariato); `scenarios` array su
  `modules.json` sostituisce per intero il vecchio campo, nessun modulo residuo lo usa ancora.
- 🟢 **Pattern Registry di `scenarioEngine.js` ora validato con un SECONDO `type` reale**
  (non più solo teoricamente, come segnalato in Fase 10 §10): zero modifiche all'engine sono
  state necessarie per accogliere `"fake-login-capture"` — la promessa architetturale di Fase 5
  è ora confermata da un secondo caso reale, non solo dal primo.

### Priorità
- 🟡 Media: correggere `data/home/feed.json` (bug reale, indipendente, in una prossima fase di
  consolidamento).
- 🟢 Bassa: unificare la duplicazione CSS della griglia moduli/scenari; formalizzare un test
  anti-regressione per i mount non sincronizzati.

### Obiettivo
Questo intervento chiude end-to-end il primo scenario reale con un `type` diverso da
`"profile-timeline"`, validando concretamente (non solo teoricamente) l'estendibilità
architetturale promessa fin dalla Fase 1. Eredita per la prossima fase una piattaforma con due
pattern di scenario di riferimento, una suite di test ufficiale ampliata a 86 controlli, e due
scoperte di processo che rafforzano — non intaccano — la disciplina di verifica già consolidata
nel progetto.
