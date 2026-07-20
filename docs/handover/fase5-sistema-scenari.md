# SOCIALIVE — Handover di fine Fase 5 (Sistema Scenari)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Data logica di chiusura fase:** fine Fase 5 (Prompt #5 della Suite — "Sistema Scenari").
**Tag di riferimento suggerito:** `v0.5.0-fase5-sistema-scenari`

---

## 1. Stato del progetto

- Fase 1 (Fondamenta), Fase 2 (Design System e UI Core), Fase 3 (Autenticazione), Fase 4 (Home):
  ✅ complete (vedi handover dedicati).
- **Fase 5 — Sistema Scenari: ✅ COMPLETATA** in 5 step incrementali. Il motore generico di
  scenari (`scenarioEngine.js`) esiste, è registrato in bootstrap, ed è raggiungibile end-to-end
  dalla Home: click su "Cybersecurity" → `#/scenario/oversharing` → renderer placeholder dedicato
  con titolo/descrizione reali letti da `scenario.json`.
- **Primo caso reale di rotta parametrica** del progetto (`#/scenario/:scenarioId`), guardia di
  sessione condivisa con le rotte esatte, verificata con lo stesso rigore del flusso di
  autenticazione di Fase 3.
- **97 controlli automatizzati Playwright** eseguiti nel corso della fase (16+15+24+22+20), tutti
  verdi; 6 screenshot ispezionati (Home Light/Dark/375px/ProfileMenu aperto, placeholder scenario
  Light/Dark).
- **Nessuna riga del vero contenuto Oversharing** (profilo, stories, timeline, post reali,
  immagini) è stata scritta — resta rigorosamente Fase 6, come da roadmap. Il renderer di questa
  fase è un placeholder dichiarato.

---

## 2. Obiettivi completati

Solo funzionalità realmente implementate e verificate.

### Step 1 — Dati e accesso: risorsa singola
- `data/scenarios/oversharing/scenario.json`: metadati minimi (`id`, `type`, `title`,
  `description`) — **`dataRefs` omesso di proposito**: punterebbe a `profile.json`/`feed.json`/
  `posts.json`/`stories.json`, che non esistono ancora (Fase 6).
- `js/repositories/localJsonRepository.js` (**modificato**): estratta la logica di fetch+cache
  condivisa in `fetchJson()`; aggiunta la seconda fabbrica `createLocalJsonResource({ url })` per
  risorse JSON singole (non collezioni). `createLocalJsonRepository` invariata nel comportamento.
- Verificato: 16 controlli (7 di regressione su users/roles, 9 nuovi su `createLocalJsonResource`
  incl. caso di errore su URL inesistente e recupero della cache dopo un fallimento).

### Step 2 — Motore di scenario
- `js/scenarios/scenarioEngine.js`: `registerRenderer(type, renderer)` + `loadScenario(scenarioId,
  container) → Promise<destroy>`. Dispatch tramite `Map`, **zero `if/switch`** sui tipi concreti.
- Stati non felici centralizzati nell'engine: `type` non registrato → "in preparazione"; fetch
  fallito o `type` assente → "Impossibile caricare" + `console.error`; `id` disallineato →
  `console.warn` non bloccante (il rendering procede comunque).
- Nessun nuovo file CSS per i due messaggi di fallback (stile inline con token `--sl-*`, stesso
  trattamento già riservato da `router.js` a "Pagina non trovata").
- Verificato: 15 controlli (renderer registrato, fallback "in preparazione", errore di fetch,
  warning su id disallineato, `type` assente, `destroy()` che non tocca contenuto non proprio del
  container).

### Step 3 — Routing parametrico
- `js/core/router.js` (**modificato**): aggiunto un secondo elenco `parameterizedRoutes` (pattern
  con segmenti `:nome`, compilati a regex), verificato **dopo** la `Map` a corrispondenza esatta
  esistente. Firma dei controller estesa da `(container) => destroy` a `(container, params) =>
  destroy` — **additiva**, zero impatti sui controller esistenti.
- Guardia di sessione condivisa identica tra rotte esatte e parametriche.
- Verificato: 24 controlli (regressione completa del flusso di Fase 3 — bootstrap, guardia
  `#/home`, redirect simmetrico da `#/login` autenticato, logout centralizzato, 404 — + guardia su
  rotta parametrica, `params.scenarioId` corretto, pattern non corrispondenti correttamente
  respinti a 404, `mount()`/`destroy()` del controller precedente).

### Step 4 — Estrazione di appShell + collegamento Cybersecurity
- `js/pages/shared/appShell.js` (**nuovo**): estrae l'orchestrazione AppHeader↔ProfileMenu↔
  Sidebar↔logout scritta in `homePageController.js` (Fase 4) — secondo consumo reale
  (`scenarioPageController`, Step 5), non anticipazione. Ownership di `appHeader`/`sidebar`
  passata ad `appShell`: il page controller chiama `shell.destroy()` una sola volta.
- `js/pages/homePageController.js` (**modificato**): usa `createAppShell({ activeSidebarId:
  "home" })`; modulo Cybersecurity ora `available: true`, collegato a `#/scenario/oversharing`
  tramite una mappa `MODULE_TO_SCENARIO` separata dai dati passati a `ModuleCard` (che resta
  invariata, zero modifiche). Le altre 5 categorie restano `available: false`.
- Verificato: 22 controlli + 4 screenshot ispezionati (desktop Light, desktop Dark, mobile 375px,
  ProfileMenu aperto) — nessuna regressione visiva, click su Cybersecurity naviga correttamente,
  remount pulito, ProfileMenu/logout funzionanti sulla Home riorganizzata.

### Step 5 — Page controller e renderer del primo scenario
- `js/scenarios/renderers/profileTimelineRenderer.js` (**nuovo, placeholder dichiarato**): mostra
  titolo/descrizione REALI letti da `scenario.json` + un avviso onesto di sviluppo in corso.
  Nessun dato hardcoded specifico di "Oversharing": un futuro secondo scenario con lo stesso
  `type` lo riuserebbe senza modifiche.
- `js/pages/scenarioPageController.js` (**nuovo**): rotta `#/scenario/:scenarioId`, riusa
  `appShell` (nessuna voce di Sidebar dedicata: `activeSidebarId` omesso) + `PageContainer` +
  `scenarioEngine.loadScenario()`. Un unico nodo (`mainContent`) è condiviso tra `PageContainer`
  (a cui viene passato come `main`) e l'engine (a cui viene passato come punto di mount) — evita
  di violare l'incapsulamento di `PageContainer` con un `querySelector` sulla sua struttura interna.
- `css/layouts/scenario-page.css` (**nuovo**, dichiaratamente temporaneo): layout della rotta +
  aspetto del placeholder — nessun nuovo accostamento colore (info-bg-subtle/info-text già
  verificato per il tono "info" di Badge).
- `index.html` (**modificato**): registra `profile-timeline` → `renderProfileTimeline` PRIMA di
  registrare le rotte; aggiunge `#/scenario/:scenarioId` come rotta protetta; aggiunge il link a
  `scenario-page.css`.
- Verificato: 20 controlli end-to-end (renderer reale — non il fallback generico —, `appShell`
  riusato senza voce Sidebar attiva, fallback generico dell'engine attraverso il vero page
  controller su un `type` non registrato, errore di fetch attraverso il vero page controller,
  ritorno alla Home via Sidebar, ProfileMenu/logout dalla pagina di scenario, **caso limite di
  navigazione rapida via prima che il fetch dello scenario risolva** — nessun placeholder residuo,
  nessun AppHeader duplicato) + 2 screenshot ispezionati (placeholder Light/Dark).

**Totale controlli automatizzati eseguiti in Fase 5: 97, tutti verdi.**

---

## 3. Architettura attuale

```
socialive/
├── index.html                              # ♻️ MODIFICATO — registra renderer + rotta scenario
├── data/
│   ├── users.json · roles.json             (Fase 3, invariati)
│   └── scenarios/
│       └── oversharing/
│           └── scenario.json               # ⭐ NUOVO (solo metadati, dataRefs omesso)
│
├── css/
│   ├── tokens/ · themes/ · base/ · components/   (Fase 2/4, invariati)
│   └── layouts/
│       ├── login-page.css                  (Fase 3, invariato)
│       ├── home-page.css                   (Fase 4, invariato)
│       └── scenario-page.css               # ⭐ NUOVO (dichiaratamente temporaneo)
│
└── js/
    ├── core/
    │   └── router.js                       # ♻️ MODIFICATO — rotte parametriche
    ├── pages/
    │   ├── loginPageController.js          (Fase 3, INVARIATO)
    │   ├── homePageController.js           # ♻️ MODIFICATO — usa appShell, Cybersecurity available
    │   ├── scenarioPageController.js       # ⭐ NUOVO
    │   └── shared/
    │       └── appShell.js                 # ⭐ NUOVO
    ├── scenarios/
    │   ├── scenarioEngine.js               # ⭐ NUOVO
    │   └── renderers/
    │       └── profileTimelineRenderer.js  # ⭐ NUOVO (placeholder dichiarato)
    ├── repositories/
    │   └── localJsonRepository.js          # ♻️ MODIFICATO — + createLocalJsonResource
    ├── adapters/ · services/ · utils/      (Fase 2/3, invariati)
    └── components/                         (Fase 2/4, invariati — nessun componente toccato)
```

**Cartelle previste da Fase 1 ancora non popolate**: `assets/images`, `assets/fonts`,
`js/config/`. `data/scenarios/oversharing/` contiene oggi solo `scenario.json`:
`profile.json`/`feed.json`/`posts.json`/`stories.json` restano riservati a Fase 6, come da piano
originario di Fase 1 §9.

**Nessuna modifica** a componenti/CSS di Fase 2, a `PageContainer.js`/`ModuleCard.js`/
`module-card.css` (Fase 4), né a `authService.js`/`loginPageController.js` (Fase 3).

---

## 4. Decisioni progettuali

### Repository: due fabbriche, non una
`createLocalJsonRepository` (collezioni, invariata) e `createLocalJsonResource` (risorsa singola,
nuova) condividono la stessa cache/fetch (`fetchJson`, DRY) — introdotta perché
`scenario.json` è un oggetto singolo, non un array con `id` da cercare: forzarlo dentro
l'abstrazione a collezione sarebbe stato un'astrazione impropria.

### Scenario Engine: registro, non `if/switch`
`registerRenderer(type, renderer)` + dispatch tramite `Map`, stesso principio già usato da
`router.registerRoute()` verso le pagine — un nuovo `type` (o un secondo scenario con lo stesso
`type` già registrato, es. una futura "Privacy" con `profile-timeline`) richiede zero modifiche a
`scenarioEngine.js`.

### Stati non felici centralizzati nell'engine
"in preparazione" (type non registrato) e "impossibile caricare" (errore di fetch) sono
responsabilità dell'engine, non dei singoli renderer — stesso principio già seguito da
`router.js` per "Pagina non trovata". Nessun nuovo file CSS per questi due messaggi transitori
(YAGNI: Fase 6 sostituirà per intero l'unico caso oggi realmente esercitato).

### Router: rotte parametriche additive, non un secondo router
Un secondo elenco (`parameterizedRoutes`) verificato DOPO la `Map` esatta esistente — nessun
impatto sul fast path di `#/login`/`#/home`. Firma dei controller estesa con un parametro
aggiuntivo (`params`), ignorato silenziosamente dai controller esistenti che non lo dichiarano.
Nessun `decodeURIComponent`: gli `scenarioId` sono identificatori applicativi interni (slug
kebab-case), non testo libero digitato da un utente — da rivalutare solo se un futuro parametro
lo richiedesse davvero (YAGNI).

### appShell: estrazione motivata da un secondo consumo reale
Stesso criterio già applicato a `focusTrap.js` (Fase 2) e alla decisione di non introdurre
`userRepository.js` (Fase 3 §4): si estrae quando un secondo bisogno REALE lo richiede, non prima.
`scenarioPageController.js` (questo stesso step) ha bisogno dell'identica orchestrazione
AppHeader↔ProfileMenu↔Sidebar↔logout scritta per la Home in Fase 4 — motivo sufficiente e reale,
non un'anticipazione ipotetica.

### Ownership: appShell possiede header/sidebar, il page controller possiede il resto
Coerente con la policy già dichiarata da `PageContainer` ("header/sidebar/main restano di
proprietà del CHIAMANTE"): il chiamante di `PageContainer` è ora sempre il page controller, che
delega la creazione/distruzione di header+sidebar ad `appShell` — `PageContainer` non se ne
accorge, non cambia.

### MODULE_TO_SCENARIO separata da MODULES
`ModuleCard` continua a ricevere solo `{ moduleId, title, available }` (zero modifiche al
componente). La mappa moduleId→scenarioId vive separata, di sola competenza del page controller:
evita che un futuro campo aggiunto a `MODULES` sembri "automaticamente" cablato dentro
`ModuleCard`, quando in realtà quel componente legge solo props ben precise.

### Contenitore condiviso in scenarioPageController, non un querySelector
Un solo nodo (`mainContent`) creato dal controller viene passato SIA a `PageContainer` (come
`main`) SIA a `loadScenario()` (come punto di mount) — evita di dover cercare la struttura DOM
interna di `PageContainer` via selettore CSS, che avrebbe violato l'incapsulamento "a convenzione"
già adottato in tutto il Design System.

### Renderer placeholder dedicato, non il fallback generico dell'engine
Oversharing avrebbe potuto restare senza renderer registrato, mostrando il fallback generico
"in preparazione" dell'engine. Si è scelto invece di registrare `profileTimelineRenderer.js` fin
da questa fase: un primo impatto dedicato (titolo/descrizione reali) è più credibile, per il
docente che verifica il collegamento Home→scenario, di un paragrafo indistinto da qualunque altro
`type` non ancora implementato. Il file resta un placeholder DICHIARATO — da riscrivere per
intero in Fase 6, non da estendere incrementalmente (stesso trattamento già riservato a
`homePageController.js` in Fase 3).

### Race condition: cleanup asincrono sicuro
`loadScenario()` è asincrono; se l'utente naviga altrove prima che il fetch risolva,
`scenarioPageController.destroy()` rimuove comunque subito l'intero sottoalbero
(`pageContainer.destroy()`), mentre il cleanup dell'engine arriva in coda non appena la Promise
risolve — `.remove()` su un nodo già staccato è un no-op sicuro, ma il cleanup del renderer (se ne
avesse uno) viene comunque invocato. Verificato esplicitamente con un test dedicato (Step 5).

### Nessun userRepository.js introdotto
Confermata la decisione di Fase 3 §4: il bisogno reale emerso in questa fase era "leggere una
risorsa JSON singola", risolto da `createLocalJsonResource`, non "un repository di entità utente"
— nessun secondo consumo reale che giustifichi l'indirection aggiuntiva.

---

## 5. Attività rimanenti

In ordine di roadmap (Prompt #6 → #10 della Suite):

1. **Fase 6 — Scenario Oversharing** (prossima, vedi §6): profilo realistico, stories, feed,
   timeline annuale, post normali e post con dettagli sensibili, immagini in
   `assets/posts/oversharing`. Sostituirà per intero `profileTimelineRenderer.js` (non
   un'estensione) e rimuoverà le regole placeholder da `scenario-page.css`. Popolerà
   `profile.json`/`feed.json`/`posts.json`/`stories.json` dentro
   `data/scenarios/oversharing/` e aggiungerà `dataRefs` a `scenario.json`. Richiederà
   `StoriesBar`/`Timeline` (differiti per YAGNI fin da Fase 1).
2. **Fase 7 — Post e Media Viewer**: apertura post (`sl:post-open`, già emesso da `PostCard` senza
   consumer), zoom immagini, `MediaViewer` (differito).
3. **Fase 8 — Dati**: esternalizzazione di TUTTI i contenuti in JSON — includerà anche la
   decisione ancora aperta dal §4/§9 dell'handover di Fase 4 sul feed demo della Home.
4. **Fase 9 — Rifinitura UX**, **Fase 10 — Audit finale**.

**Non costruiti deliberatamente (YAGNI), non dimenticati**: `userRepository.js` standalone
(confermato in questa fase come non necessario), icon sprite (`assets/icons/icons.svg`, debito
noto invariato da Fase 2), componenti mai richiesti da un consumer reale (`Chip`, `Dropdown`,
`Tabs`, `ProgressBar`, `EmptyState`, `ErrorState`, `ScrollArea`, `Toast`), una voce di Sidebar
dedicata a "Scenari" (oggi "Moduli" resta disabilitata, invariato da Fase 4), gestione di più
scenari sotto lo stesso modulo (oggi mapping 1:1).

**Icon sprite**: ancora non esiste. Non bloccante per Fase 6.

---

## 6. Prossima fase

**Fase 6 — Scenario Oversharing** (Prompt #6 della Suite originaria).

**Punto di ripartenza esatto**: `scenarioEngine`/`scenarioPageController`/`appShell` sono pronti e
verificati — Fase 6 NON deve toccarli se non per un bug reale emerso durante l'integrazione (da
verificare, non da presumere). Il lavoro di Fase 6 è quasi interamente:

1. Progettare (motivando prima del codice) la struttura di `profile.json`/`feed.json`/
   `posts.json`/`stories.json` dentro `data/scenarios/oversharing/`, e aggiungere `dataRefs` a
   `scenario.json` di conseguenza.
2. Progettare `StoriesBar`/`Timeline` (differiti per YAGNI da Fase 1) — solo ora che un consumer
   reale (Oversharing) li richiede davvero.
3. Sostituire per intero `profileTimelineRenderer.js` con l'implementazione reale: profilo utente,
   stories, feed, timeline annuale, post normali e post con dettagli sensibili — nessun elemento
   didattico visibile (requisito esplicito di progetto).
4. Rimuovere le regole placeholder da `scenario-page.css` (o l'intero file, se il nuovo layout
   della pagina di scenario non ne riusa nulla — da valutare in quel momento).
5. Popolare `assets/posts/oversharing/` con le immagini del profilo.
6. Continuare il metodo di verifica invariato: Playwright, screenshot reali, regressione su tutto
   il già costruito (Fase 2+3+4+5).

---

## 7. Prompt di continuità

```
Sto riprendendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"), piattaforma didattica per la formazione in Cybersecurity, usata esclusivamente dal
docente e proiettata in classe. Non è un social network reale: deve solo sembrarlo, con massimo
realismo, senza alcun elemento "scolastico" visibile.

RUOLO: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX Designer,
Accessibility Specialist (WCAG) e Full Stack Architect. Ragiona come un membro senior di un team
di sviluppo. Motiva ogni decisione prima di implementarla. Procedi per piccoli step.

CONVENZIONE OBBLIGATORIA DI CONSEGNA FILE: per OGNI file che consegni, indica sempre (a) se è
NUOVO o se SOSTITUISCE/MODIFICA un file già esistente nel progetto — verificalo controllando
l'elenco dei file di progetto disponibili, non per assunzione — e (b) il percorso esatto nella
struttura del progetto, con una tabella riassuntiva dopo ogni consegna.

CONVENZIONE OBBLIGATORIA DI FINE FASE: l'handover va SEMPRE prodotto come file .md separato (non
solo come testo in chat), e a fine fase va consegnata una cartella .zip contenente TUTTI i file
prodotti in quella fase (compreso l'handover .md), anche se la fase è stata suddivisa su più
conversazioni.

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework/libreria UI.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main. Non hai credenziali per pushare: prepara i file, l'utente li applica
lui stesso al repository.

NOTE TECNICHE DI AMBIENTE: niente `pkill -f "<pattern con la porta>"`; server+test Playwright
nella STESSA chiamata bash (i processi in background non sopravvivono tra chiamate separate);
shell `/bin/sh` (niente brace expansion); usa una porta nuova ad ogni test; Playwright con
Chromium pre-installato, verifica il path browser prima di assumerlo.

STATO: Fase 1, 2, 3, 4 e 5 (Sistema Scenari) COMPLETE. Fase 5 ha prodotto: data/scenarios/
oversharing/scenario.json (nuovo, solo metadati — dataRefs omesso di proposito), js/repositories/
localJsonRepository.js (modificato: + createLocalJsonResource), js/scenarios/scenarioEngine.js
(nuovo: registro renderer, loadScenario), js/scenarios/renderers/profileTimelineRenderer.js
(nuovo, PLACEHOLDER DICHIARATO — da sostituire per intero, non estendere), js/core/router.js
(modificato: rotte parametriche #/scenario/:scenarioId, firma controller additiva (container,
params)), js/pages/shared/appShell.js (nuovo: estrae AppHeader/ProfileMenu/Sidebar/logout),
js/pages/homePageController.js (modificato: usa appShell, Cybersecurity available:true collegato
a #/scenario/oversharing), js/pages/scenarioPageController.js (nuovo), css/layouts/
scenario-page.css (nuovo, dichiaratamente temporaneo), index.html (modificato: registra renderer
+ rotta). 97 controlli Playwright eseguiti nella fase, tutti verdi; 6 screenshot ispezionati. Il
documento di handover completo (10 sezioni, questo stesso file) è la fonte di verità primaria: non
ripartire da assunzioni.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" (NON "Prof. Anna Ferrari", nome scartato in una fase precedente).

DA FARE ORA (Fase 6 — Scenario Oversharing, Prompt #6 della Suite):
1. Progettare (motivando prima del codice) la struttura di data/scenarios/oversharing/
   profile.json, feed.json, posts.json, stories.json + aggiungere dataRefs a scenario.json.
2. Progettare StoriesBar/Timeline (differiti per YAGNI da Fase 1, ora richiesti da un consumer
   reale).
3. Sostituire PER INTERO js/scenarios/renderers/profileTimelineRenderer.js con l'implementazione
   reale: profilo utente, stories, feed, timeline annuale, post normali e post con dettagli
   sensibili — nessun elemento didattico visibile.
4. Rimuovere le regole placeholder da css/layouts/scenario-page.css (valutare se l'intero file
   resti utile o vada sostituito).
5. Popolare assets/posts/oversharing/ con le immagini del profilo.
6. NON toccare scenarioEngine.js/scenarioPageController.js/appShell.js/router.js se non per bug
   reali emersi durante l'integrazione (da verificare, non da presumere).

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container,params)→destroy per i page
controller; eventi "sl:nome-evento"; componenti "dumb"; documentazione in italiano; test
Playwright + screenshot reali + regressione ad ogni step; handover completo a 10 sezioni + zip di
tutti i file della fase a fine fase.

Procedi progettando la struttura dei JSON di Oversharing, motivando le scelte prima di scrivere
codice.
```

---

## 8. Test da eseguire

Checklist cumulativa aggiornata a fine Fase 5.

### Test funzionali
- [x] `createLocalJsonResource`: `get()` su risorsa valida, cache condivisa, errore su URL
  inesistente con recupero al tentativo successivo.
- [x] `createLocalJsonRepository`: regressione completa (users/roles, `list()`/`get()`, copie
  indipendenti restituite da `list()`).
- [x] `scenarioEngine`: renderer registrato invocato con `(container, scenario)` corretti;
  fallback "in preparazione" su type non registrato; fallback errore su fetch fallito/`type`
  assente; warning non bloccante su id disallineato; `destroy()` non tocca contenuto non proprio.
- [x] `router.js`: regressione completa Fase 3 (bootstrap, guardia `#/home`, redirect simmetrico,
  logout centralizzato, 404) + guardia su rotta parametrica, `params` corretti, pattern non
  corrispondenti respinti.
- [x] `appShell`: AppHeader/ProfileMenu/Sidebar/logout funzionanti sia su Home sia su pagina di
  scenario; nessuna voce Sidebar attiva sulla pagina di scenario.
- [x] Click su Cybersecurity → naviga a `#/scenario/oversharing`, monta il renderer reale con
  titolo/descrizione corretti (non il fallback generico).
- [x] Fallback generico dell'engine e messaggio di errore verificati anche attraverso il vero
  `scenarioPageController` (non solo in isolamento sull'engine).
- [x] Caso limite: navigazione rapida via da una rotta di scenario prima che il fetch risolva —
  nessun placeholder/AppHeader residuo.
- [ ] Interazione da tastiera con `ModuleCard` (Invio/Spazio) per navigare a uno scenario — testata
  in Fase 4 sul componente isolato, non ri-verificata esplicitamente in questa fase sul flusso
  integrato Home→Scenario.

### Test UI
- [x] Home in Light/Dark/375px/ProfileMenu aperto — 4 screenshot ispezionati, nessuna anomalia.
- [x] Placeholder scenario in Light/Dark — 2 screenshot ispezionati.
- [ ] Placeholder scenario a viewport mobile (375px) — non ancora verificato con screenshot reale.
- [ ] Breakpoint intermedi (768–1024px) su Home/scenario — non verificati.

### Test UX
- [x] Nessuna voce Sidebar erroneamente "attiva" sulla pagina di scenario.
- [x] ProfileMenu/logout funzionanti in modo identico su Home e su pagina di scenario (stesso
  `appShell`).
- [ ] Navigazione da tastiera end-to-end (Tab attraverso Sidebar → Moduli → click Enter su
  Cybersecurity → arrivo sulla pagina di scenario) — non eseguita per intero in questo giro.

### Test tecnici
- [x] Console priva di errori/warning inaspettati in tutti i flussi testati (i soli
  `console.error`/`console.warn` osservati sono quelli VOLUTI dal design, per i casi di errore
  testati esplicitamente).
- [x] Nessun path relativo rotto (tutti i nuovi `<link>`/import risolti correttamente).
- [x] `node --check` su tutti i nuovi/modificati file JS.

### Test di regressione
- [x] Flusso di autenticazione Fase 3 (bootstrap, guardia, login, persistenza, redirect da login
  autenticato, rotta inesistente) confermato integralmente attraverso il router estteso.
- [x] Home di Fase 4 (composizione, moduli, feed, ProfileMenu, logout) confermata dopo il refactor
  su `appShell` — nessuna regressione visiva o funzionale.
- [ ] `style-guide.html` (Fase 2): non ri-verificato in questa fase (nessun file da essa dipendente
  è stato toccato — rischio basso, ma non una verifica eseguita esplicitamente in questo giro).

---

## 9. Criticità

- **Suite di test Playwright ancora non persistita nel repository** — segnalata ricorrente da
  Fase 2, ora con 5 fasi di script accumulati (97 controlli nella sola Fase 5) mai salvati come
  parte del repo. Priorità in aumento ad ogni fase.
- **Navigazione da tastiera non testata end-to-end sul nuovo flusso Home→Scenario**: verificato
  che `ModuleCard` gestisce Invio/Spazio in isolamento (Fase 4) e che il focus trap di
  `ProfileMenu` è invariato, ma non è stato percorso con Tab l'intero flusso Sidebar→Moduli→
  Scenario da capo a fondo in questa fase.
- **`style-guide.html` non ri-verificato in Fase 5**: nessun file da essa dipendente è stato
  toccato (solo `localJsonRepository.js`, che la style guide non importa), quindi il rischio reale
  è basso — ma resta un'assunzione, non una verifica eseguita.
- **Decisione sospesa sulla fonte dei dati del feed della Home** (ricorrente da Fase 4 §4/§9): non
  affrontata in questa fase, resta da confermare prima di Fase 8.
- **Nessuna verifica su un deploy GitHub Pages reale** delle rotte parametriche: il meccanismo è
  interamente hash-based (nessuna richiesta server aggiuntiva per `#/scenario/:scenarioId`
  rispetto a `#/home`), quindi il rischio atteso è nullo, ma non è stato verificato su un deploy
  reale in questa fase (solo su server locale).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 **`profileTimelineRenderer.js` è un placeholder dichiarato**, non l'implementazione reale —
  per costruzione (Fase 6 non ancora iniziata), da sostituire per intero, non da estendere.
- 🟡 **`css/layouts/scenario-page.css` contiene regole placeholder** (`.sl-scenario-page__
  placeholder-*`) legate al renderer segnaposto — da rimuovere insieme ad esso in Fase 6.
- 🟢 **Nessuna voce di Sidebar dedicata agli scenari**: oggi "Moduli" resta genericamente
  disabilitata (invariato da Fase 4) — un futuro secondo scenario reale potrebbe motivare una voce
  dedicata, non necessaria con un solo scenario collegato.
- 🟢 **Mapping moduleId→scenarioId 1:1** (`MODULE_TO_SCENARIO`): un futuro modulo collegato a più
  scenari (fuori scope della Suite attuale, che prevede solo Oversharing) richiederebbe un
  ridisegno di quella struttura — non anticipato ora (YAGNI).
- 🟢 Feed della Home ancora hardcoded (ricorrente da Fase 4, non affrontato in questa fase).

### Refactoring consigliati
- 🟡 **Formalizzare i test Playwright come suite persistita nel repo** (`tests/`) — raccomandazione
  ripetuta da Fase 2, ora con 97 controlli aggiuntivi accumulati nella sola Fase 5.

### Ottimizzazioni future
- 🟢 **Nessun indicatore di caricamento visibile** durante `loadScenario()` (oggi il fetch locale è
  quasi istantaneo): se una connessione più lenta o uno `scenario.json` più pesante in fasi future
  rendessero la latenza percepibile, valutare un `Loader` (già pronto da Fase 2) nel wrapper
  dell'engine — `aria-busy` è già impostato correttamente in previsione di questo caso.
- 🟢 **Gruppi nominati di regex** (`(?<nome>...)`) per `compilePattern()` in `router.js`: oggi un
  array posizionale è sufficiente (un solo parametro per rotta) — da rivalutare solo se una futura
  rotta richiedesse più parametri con leggibilità compromessa dall'approccio posizionale.

### Rischi architetturali
- 🟢 **Nessun rischio nuovo di rilievo identificato**: il pattern Registry (renderer di scenario,
  rotte parametriche) è stato validato con casi reali distinti in questa stessa fase (login/home
  esatte + scenario parametrica; `profile-timeline` come primo — e oggi unico — `type`
  registrato), non solo teorizzato.
- 🟢 **`js/core/state.js`/`eventBus.js` (Fase 1) ancora assenti**: la comunicazione tra i moduli
  di Fase 5 (engine, router, appShell, page controller) passa per import diretti + eventi DOM —
  sufficiente alla scala attuale, da rivalutare solo se un secondo scenario reale (Fase 6+)
  introducesse un bisogno di stato condiviso complesso non ancora coperto.

### Priorità
- 🟡 Media: formalizzare i test Playwright come suite persistita (`tests/`) — ormai ricorrente da
  4 fasi, con volume di controlli in costante crescita.
- 🟡 Media: navigazione da tastiera end-to-end sul flusso Home→Scenario, prima di Fase 6.
- 🟢 Bassa: confermare la decisione sulla fonte dati del feed Home (rimane comunque bloccante solo
  per Fase 8, non per Fase 6).
- 🟢 Bassa: screenshot mobile del placeholder scenario (non eseguito in questo giro, rischio basso
  dato che riusa i token/layout già verificati su Home).

### Obiettivo
Questa sezione va riletta all'inizio della Fase 6, prima di introdurre nuove funzionalità, per
mantenere SOCIALIVE pulito, modulare, scalabile e facilmente manutenibile — come da regola
fondamentale di progetto.
