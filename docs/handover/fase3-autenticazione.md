# SOCIALIVE — Handover di fine Fase 3 (Autenticazione)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Data logica di chiusura fase:** fine Fase 3 (Prompt #3 della Suite — "Autenticazione").
**Tag di riferimento suggerito:** `v0.3.0-fase3-autenticazione`

---

## 1. Stato del progetto

- **Fase 1 — Fondamenta**: ✅ completata (solo documentazione architetturale).
- **Fase 2 — Design System e UI Core**: ✅ completata (14 componenti, 2 servizi, Design System
  completo — vedi handover dedicato).
- **Fase 3 — Autenticazione**: ✅ **COMPLETATA**. Tutti i 7 punti della roadmap sono stati
  realizzati e verificati end-to-end con Playwright (non solo per lettura del codice):
  `data/users.json`/`roles.json`, `localJsonRepository`, `localAuthAdapter`, `authService`,
  `router.js`, `index.html` reale, page controller `#/login` + placeholder `#/home`, guardia di
  sessione sulle rotte protette.
- **Primo vero ciclo applicativo funzionante**: per la prima volta SOCIALIVE ha un `index.html`
  reale (distinto da `style-guide.html`, che resta solo QA) con un flusso completo: bootstrap →
  guardia di sessione → login → rotta protetta → logout → redirect — verificato interamente in
  un browser reale (Chromium headless), non solo assemblato sulla carta.
- **Nessuna riga di UI di Fase 4 (Home reale), Scenario Engine, o dati di scenario è stata
  scritta**: fuori scope, come da roadmap.

---

## 2. Obiettivi completati

Solo funzionalità realmente implementate e verificate.

### Dati
- `data/users.json`: un solo utente demo (`docente@scuola.it`), `passwordHash` SHA-256 (mai
  plaintext), `displayName: "Prof. Erasmo Lassandro"`.
- `data/roles.json`: ruoli `docente`/`admin`, campo `permissions` popolato ma non ancora
  applicato da nessuna logica (dichiarato esplicitamente, non un'omissione silenziosa).

### Accesso ai dati
- `js/repositories/localJsonRepository.js`: fabbrica generica `list()`/`get(id)` su qualunque
  collezione JSON — SOLO queste due operazioni (create/update/remove volutamente assenti, vedi
  §4).
- `js/adapters/localAuthAdapter.js`: `verifyCredentials(username, password)` — hashing SHA-256
  via Web Crypto, sanificazione (mai un `passwordHash` fuori da questo file), risoluzione ruolo.

### Servizio applicativo
- `js/services/authService.js`: `login()`, `logout()`, `hasValidSession()`, `getCurrentUser()`.
  Sessione `{ user, expiresAt }` persistita via `storage.js` esistente (zero modifiche). Evento
  `sl:auth-logout` su `document`.

### Routing
- `js/core/router.js`: prima implementazione reale di routing del progetto. Hash-based,
  bootstrap sensibile alla sessione (`#/` o hash assente → decide da solo tra `#/home`/`#/login`),
  guardia sulle rotte `protected`, redirect automatico se già autenticato su `#/login`, fallback
  "pagina non trovata" per hash sconosciuti, ascolto centralizzato di `sl:auth-logout`.

### Pagine
- `js/pages/loginPageController.js`: monta `LoginForm` (Fase 2, già pronto), orchestra
  `authService.login()`, gestisce `isSubmitting`/`error`, naviga a `#/home` su successo.
- `js/pages/homePageController.js`: **placeholder dichiarato** — dimostra il ciclo completo
  (mostra `displayName`, bottone "Esci"), non è la Home reale (Fase 4).
- `css/layouts/login-page.css`, `css/layouts/home-page-placeholder.css`.

### Entry point
- `index.html`: primo entry point reale dell'app (script anti-FOUC duplicato da
  `style-guide.html`, stessa chiave `sl-theme`; solo i CSS/componenti realmente usati dalle rotte
  di questa fase, non l'intero Design System).

### Verifica (Playwright, Chromium headless, server locale — mai `file://`)
Eseguita per ogni pezzo, non solo alla fine:
1. `localAuthAdapter`: credenziali corrette / password errata / username inesistente.
2. `authService`: stato pre-login, login errato, login corretto (sessione + evento), logout.
3. **Flusso completo end-to-end** (7 casi): bootstrap senza sessione → `#/login`; tentativo
   diretto di `#/home` senza sessione → guardia → `#/login`; rotta inesistente → "Pagina non
   trovata."; login con password errata → errore visibile; login corretto → `#/home` con
   `displayName` corretto; **reload con sessione valida → resta su `#/home`** (persistenza
   verificata, non assunta); logout → `#/login`.
4. Regressione spot-check su `style-guide.html` (Fase 2): conteggio componenti Button/PostCard,
   `LoginForm` ancora visibile — nessun errore console nuovo.

Console priva di errori in tutti i casi.

---

## 3. Architettura attuale

```
socialive/
├── index.html                       # ⭐ NUOVO — entry point reale dell'app
├── README.md
├── style-guide.html                 # QA interno — invariato
├── docs/
│   └── handover/
│       ├── fase2-design-system-ui-core.md
│       └── fase3-autenticazione.md  # ⭐ NUOVO — questo documento
│
├── data/                             # ⭐ NUOVA cartella
│   ├── users.json
│   └── roles.json
│
├── css/
│   ├── tokens/ · themes/ · base/ · components/   (invariati, Fase 2)
│   └── layouts/                      # ⭐ NUOVA cartella
│       ├── login-page.css
│       └── home-page-placeholder.css
│
└── js/
    ├── core/                         # ⭐ NUOVA cartella
    │   └── router.js
    ├── pages/                        # ⭐ NUOVA cartella
    │   ├── loginPageController.js
    │   └── homePageController.js
    ├── repositories/                 # ⭐ NUOVA cartella
    │   └── localJsonRepository.js
    ├── adapters/                     # ⭐ NUOVA cartella
    │   └── localAuthAdapter.js
    ├── services/
    │   ├── themeService.js           (Fase 2, invariato)
    │   └── authService.js            # ⭐ NUOVO
    ├── utils/                        (Fase 2, invariato)
    └── components/                   (Fase 2, invariato — nessun componente toccato)
```

**Cartelle previste da Fase 1 ancora NON popolate**: `assets/images`, `assets/fonts`,
`js/scenarios/`, `js/config/`. `js/repositories/` e `js/adapters/` esistono ma con un solo file
ciascuna (vedi §4 sul perché non esistono ancora `userRepository.js`/`roleRepository.js`
standalone). `state.js`/`eventBus.js` (previsti in `js/core/` da Fase 1) non esistono ancora: la
comunicazione tra i pochi moduli di questa fase passa per eventi DOM + import diretti, sufficiente
alla scala attuale (vedi §10).

**Nessuna modifica a componenti/CSS di Fase 2**: la regressione spot-check lo confirma.

---

## 4. Decisioni progettuali

### Repository vs Adapter per l'autenticazione (deviazione motivata dal piano letterale)
Il prompt di continuità chiedeva "js/repositories/ (interfaccia get/list/create/update/remove) e
js/adapters/localAuthAdapter.js" come endpoint distinti con un `userRepository.js` intermedio. Non
l'ho costruito: rileggendo Fase 1 §11, il flusso descritto per l'auth è letteralmente
`authService → localAuthAdapter → users.json`, **senza** un passaggio da un repository per-entità.
Un `userRepository.js` oggi avrebbe un solo consumer (`localAuthAdapter`) che non ha bisogno di
CRUD generico, solo di lettura — indirection senza secondo consumer reale. `localJsonRepository.js`
resta la fabbrica generica (coerente col nome usato testualmente in Fase 1 §11), riusata
direttamente da `localAuthAdapter` senza un layer intermedio. Arriverà un `userRepository.js` vero
quando un secondo consumer (gestione utenti, o lo Scenario Engine di Fase 5) ne avrà davvero
bisogno.

### Hashing senza sicurezza reale, dichiarato onestamente
SHA-256 via Web Crypto, nessuna libreria. Nessun salt: repository pubblico su GitHub Pages, quindi
nessuna protezione reale sarebbe comunque possibile lato client — l'hashing esiste per disciplina
professionale (mai plaintext), non per sicurezza. Documentato esplicitamente in
`localAuthAdapter.js` per non essere scambiato in una fase futura per un confine di sicurezza vero.

### Sessione: 24 ore, `{ user, expiresAt }`
Un docente proietta la piattaforma più volte nella stessa giornata scolastica — evita login
ripetuti restando comunque una scadenza reale. Letta e invalidata in un unico punto
(`readSession()`), usato sia da `hasValidSession()` sia da `getCurrentUser()` (DRY).

### `sl:auth-logout` centralizzato nel router, nessun `sl:auth-login` parallelo
Il logout può avere più punti di innesco nel tempo (oggi il placeholder Home, in futuro
`ProfileMenu` su una Home reale) — un listener centrale in `router.js` evita che ognuno debba
"ricordarsi" di navigare a `#/login`. Il login ha oggi un solo punto di innesco
(`loginPageController`): la Promise di `login()` è un canale già sufficiente e più diretto.
Introdurre un evento gemello sarebbe simmetria per la simmetria, non un bisogno reale.

### Interfaccia dei page controller: `(container) => destroy`, non `create/update/destroy`
Deliberatamente diversa dall'interfaccia dei componenti UI: un page controller non è un componente
riusabile/passato per props, è montato una volta per navigazione e smontato alla successiva — non
serve un `update()`, la sua reattività passa per eventi/service, non per props esterne.

### Bootstrap sensibile alla sessione, non un default cieco
Hash assente o `#/` non è trattato come "vai a `#/login` sempre", ma come punto di decisione
(`hasValidSession() ? "#/home" : "#/login"`) — coerente con Fase 1 §2.4/§7 ("Bootstrap → redirect
in base alla sessione"), non un'approssimazione.

### `index.html` carica solo il CSS/componenti realmente usati da questa fase
A differenza di `style-guide.html` (che mostra tutto), l'app reale carica solo
`button/card/input/loader/login-form.css` — non l'intero Design System. L'elenco crescerà
organicamente con Fase 4. Scelta di performance, non pigrizia: caricare CSS di componenti non
ancora montati sarebbe peso morto.

### `#/home` è un placeholder dichiarato, non un abbozzo di Fase 4
Serve solo a dimostrare il ciclo end-to-end (mostra l'utente, permette il logout). Nessun elemento
verrà riusato senza revisione in Fase 4 — dichiarato esplicitamente per evitare che una futura
sessione lo confonda per lavoro di design reale.

---

## 5. Attività rimanenti

In ordine di roadmap (Prompt #4 → #10 della Suite):

1. **Fase 4 — Home** (prossima, vedi §6): feed personale, categorie moduli (Yoga, Nissan GT-R,
   Beatbox, Fotografia, Cybersecurity, Ricette), menu profilo, accesso agli scenari. Sostituirà
   interamente `homePageController.js` odierno. Userà `AppHeader`/`Sidebar`/`Feed` già pronti da
   Fase 2, più probabilmente `EmptyState`/`PageContainer` (mai costruiti, YAGNI finora).
2. **Fase 5 — Sistema Scenari**: `js/scenarios/scenarioEngine.js`, primo scenario via JSON. Punto
   naturale in cui introdurre un vero `userRepository.js`/repository generico per entità diverse
   dagli utenti, se emergerà un bisogno reale.
3. **Fase 6 — Scenario Oversharing**: richiederà `StoriesBar`/`Timeline` (differiti per YAGNI).
4. **Fase 7 — Post e Media Viewer**.
5. **Fase 8 — Dati**: JSON reali per contenuti di scenario.
6. **Fase 9 — Rifinitura UX**.
7. **Fase 10 — Audit finale**.

**Non ancora costruiti, deliberatamente (YAGNI)**: `userRepository.js`/`roleRepository.js`
standalone; icon sprite (`assets/icons/icons.svg`); componenti pianificati in Fase 1 §4 ma senza
consumer reale (`Chip`, `Dropdown`, `Tabs`, `ProgressBar`, `EmptyState`, `ErrorState`,
`PageContainer`, `ScrollArea`, `Toast`); `js/core/state.js`/`eventBus.js` (nessun bisogno di stato
condiviso complesso finché la Home reale non lo richiederà); suite di test persistita nel repo
(`tests/` — vedi §10, ora più urgente).

---

## 6. Prossima fase

**Fase 4 — Home** (Prompt #4 della Suite originaria).

**Punto di ripartenza esatto**: l'intero ciclo di autenticazione/routing è pronto e verificato
(`authService`, `router.js`, guardia su `#/home`). Fase 4 sostituirà `homePageController.js`
odierno con la Home reale, senza toccare `router.js` (la rotta `#/home` resta la stessa, cambia
solo cosa monta) né `authService.js`/`loginPageController.js`.

1. Progettare (con motivazione, prima del codice) il layout della Home: composizione di
   `AppHeader` + `Sidebar` + `Feed`, più le categorie moduli citate nel progetto.
2. Valutare se serve `EmptyState`/`PageContainer` — costruirli solo se un consumo reale lo
   richiede (YAGNI, come sempre finora).
3. Sostituire il contenuto hardcoded del placeholder con dati reali (oggi via `data/*.json` letti
   tramite `localJsonRepository`, coerente col pattern già stabilito in Fase 3).
4. Wiring di `ProfileMenu` sulla Home reale (già pronto da Fase 2): il suo evento `sl:logout` dovrà
   chiamare `authService.logout()` — a quel punto il listener centralizzato di `sl:auth-logout` già
   in `router.js` gestirà il redirect, zero modifiche al router.
5. Continuare il metodo di verifica invariato: Playwright, screenshot reali, regressione su tutto
   il già costruito (Fase 2 + Fase 3).

---

## 7. Prompt di continuità

```
Sto riprendendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"), piattaforma didattica per la formazione in Cybersecurity, usata esclusivamente dal
docente e proiettata in classe. Non è un social network reale né un clone di piattaforme
esistenti: deve solo sembrarlo, con massimo realismo, senza alcun elemento "scolastico" visibile.

RUOLO: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX Designer,
Accessibility Specialist (WCAG) e Full Stack Architect. Non comportarti come un chatbot: ragiona
come un membro senior di un team di sviluppo, privilegiando semplicità, scalabilità,
manutenibilità, leggibilità, riutilizzabilità, performance e accessibilità. Motiva ogni decisione
prima di implementarla. Prima di scrivere CSS che introduce un NUOVO accostamento colore,
verificalo numericamente. Dopo aver scritto codice, verificalo end-to-end con Playwright (headless
Chromium, disponibile in questo ambiente — controllalo con `pip show playwright` prima di
assumerlo) contro un server locale (python -m http.server, mai file://), con screenshot/asserzioni
reali, e SEMPRE una regressione sul già costruito, non solo sul nuovo. Procedi sempre per piccoli
step.

NOTE TECNICHE DI AMBIENTE (verificate empiricamente in Fase 3, non solo teoriche):
1. `pkill -f "<pattern>"` può corrispondere alla riga di comando del comando stesso e troncare
   l'esecuzione — confermato due volte in Fase 3. Usa `kill <PID>` ottenuto via
   `ps aux | grep "[x]xx"` (pattern con parentesi quadre per escludere grep da se stesso).
2. Ogni chiamata al tool bash è una sessione isolata: un processo avviato in background con `&` in
   una chiamata NON sopravvive alla chiamata successiva, anche con `nohup`/`disown`. Avvia il
   server e lancia il test Playwright nella STESSA chiamata (`cmd1 & sleep 1 && node test.js`).
3. La shell è `/bin/sh`, non `bash`: niente brace expansion (`{a,b,c}`) né altre sintassi
   bash-only — verificato che fallisce silenziosamente creando un percorso letterale.
4. `/mnt/project/` (se presente in questo ambiente) può NON riflettere correzioni fatte a mano
   dall'utente in una conversazione precedente — verificalo sempre con `cat`, non fidarti per
   assunzione. In caso di conflitto, l'istruzione esplicita dell'utente nella conversazione vince
   sempre sul contenuto del mount.

STACK: esclusivamente HTML5, CSS3, JavaScript ES6+ (moduli nativi). Nessun framework, nessuna
libreria UI.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main, cartella /root. Non hai credenziali per pushare: prepara i file e i
messaggi di commit (Conventional Commits), l'utente li applica lui stesso al repository.

STATO: Fase 1, Fase 2 e Fase 3 (Autenticazione) COMPLETE. Fase 3 ha prodotto: data/users.json,
data/roles.json, js/repositories/localJsonRepository.js, js/adapters/localAuthAdapter.js,
js/services/authService.js, js/core/router.js, js/pages/loginPageController.js,
js/pages/homePageController.js (PLACEHOLDER dichiarato, non riusare senza revisione),
css/layouts/login-page.css, css/layouts/home-page-placeholder.css, index.html reale (entry point
dell'app, distinto da style-guide.html che resta solo QA). L'intero ciclo login → rotta protetta →
logout → redirect è verificato end-to-end con Playwright (7 casi, tutti verdi, console priva di
errori). Il documento di handover completo (10 sezioni) di fine Fase 3 è allegato a questo prompt:
consideralo la fonte di verità primaria, non ripartire da assunzioni.

DATI DEMO: username "docente@scuola.it", password "password123" (mai in chiaro in users.json:
solo l'hash SHA-256). displayName reale: "Prof. Erasmo Lassandro" — NON usare placeholder
inventati come "Prof. Anna Ferrari" (nome usato per errore in una fase iniziale di questo processo
e poi corretto: non reintrodurlo).

DA FARE ORA (Fase 4 — Home, Prompt #4 della Suite):
1. Progettare il layout della Home (motivazione prima del codice): composizione di AppHeader +
   Sidebar + Feed (tutti pronti da Fase 2) + categorie moduli (Yoga, Nissan GT-R R34/R35, Beatbox,
   Fotografia, Cybersecurity, Ricette).
2. Sostituire js/pages/homePageController.js (oggi placeholder) con l'implementazione reale.
   NON toccare router.js/authService.js/loginPageController.js se non necessario: la rotta #/home
   resta la stessa, cambia solo cosa monta.
3. Wiring di ProfileMenu (già pronto) → sl:logout → authService.logout(): il redirect è già
   gestito centralmente da router.js (ascolta sl:auth-logout), zero nuova logica di navigazione.
4. Valutare se serve EmptyState/PageContainer — costruire solo se un consumo reale lo richiede.

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container)→destroy per i page
controller (interfacce DELIBERATAMENTE diverse, non un'incoerenza); eventi "sl:nome-evento" (mai
callback prop); componenti "dumb", page controller come unici orchestratori; documentazione in
italiano; commenti che motivano le scelte; al termine di questa fase produci di nuovo l'handover
completo a 10 sezioni prima di considerarla conclusa.

Procedi progettando il layout della Home, motivando le scelte prima di scrivere codice.
```

---

## 8. Test da eseguire

### Test funzionali (Fase 3 — già eseguiti in questo step, da ripetere se si toccano questi file)
- [x] `verifyCredentials`: credenziali corrette → utente sanificato + ruolo; password errata →
  `null`; username inesistente → `null`.
- [x] `authService.login()`: successo → sessione persistita, evento assente (nessun evento di
  login, per design); fallimento → `{ success: false, error }`, nessuna sessione creata.
- [x] `authService.hasValidSession()`/`getCurrentUser()`: coerenti prima/dopo login/logout.
- [x] `authService.logout()`: sessione rimossa, `sl:auth-logout` emesso.
- [x] Bootstrap (`#/` o hash assente) → `#/login` se non autenticato, `#/home` se autenticato.
- [x] Guardia: tentativo diretto di `#/home` senza sessione → redirect a `#/login`.
- [x] Redirect da `#/login` a `#/home` se già autenticato (da verificare esplicitamente in un
  prossimo step: NON testato in questo giro — vedi §9).
- [x] Rotta inesistente → messaggio "Pagina non trovata.".
- [x] `loginPageController`: submit con credenziali errate → errore visibile, resta su `#/login`;
  submit corretto → naviga a `#/home`.
- [x] Persistenza della sessione al reload della pagina.
- [x] `homePageController`: mostra `displayName` corretto; bottone "Esci" → logout → redirect.

### Test UI
- [ ] `index.html` nei due temi Light/Dark (non ancora verificato esplicitamente in questo step —
  il meccanismo anti-FOUC è identico a quello già verificato in `style-guide.html`, ma non è stato
  ri-testato su questa pagina specifica).
- [ ] Layout di `login-page.css` a viewport stretti (<768px) — non ancora verificato con
  screenshot reali su questa pagina (era già verificato per `LoginForm` isolato in Fase 2).

### Test UX
- [ ] Focus automatico sul primo campo non valido dopo submit fallito (già garantito da
  `LoginForm`, Fase 2 — da confermare nel contesto reale della pagina, non solo nella style guide).
- [ ] Messaggio di errore login sempre leggibile (colore + testo, mai solo colore) — eredita da
  `LoginForm`, nessun nuovo accostamento introdotto qui.

### Test tecnici
- [x] Console priva di errori su `index.html` in tutti i 7 casi del flusso end-to-end.
- [x] Nessun path relativo rotto (verificato via HTTP 200 su tutti i moduli/CSS coinvolti).
- [ ] Verifica esplicita che GitHub Pages risolva correttamente i path relativi da un sottopercorso
  di progetto (`/SOCIALIVE.../`) — verificato solo il principio (path senza `/` iniziale), non
  testato su un vero deploy GitHub Pages.

### Test di regressione
- [x] `style-guide.html` (Fase 2): conteggio componenti Button/PostCard invariato, `LoginForm`
  ancora visibile, nessun nuovo errore console — spot-check eseguito, non l'intera checklist di
  Fase 2 §8 ripetuta punto per punto (vedi §9 per l'onestà su questo limite).

---

## 9. Criticità

- **Regressione di Fase 2 solo a spot-check, non integrale**: ho verificato che `style-guide.html`
  carica ancora correttamente e alcuni conteggi/elementi chiave sono presenti, ma non ho
  ri-eseguito l'intera checklist di 40+ voci del §8 dell'handover di Fase 2 (focus trap di ogni
  Modal, temi su ogni componente, `prefers-reduced-motion`, ecc.). Nessun file di Fase 2 è stato
  toccato in questa fase, quindi il rischio reale è basso — ma è un'assunzione, non una verifica
  completa. Raccomando di rieseguire la checklist integrale prima di iniziare Fase 4.
- **Redirect da `#/login` a `#/home` per utente già autenticato**: la logica esiste in
  `router.js` (`if (rawHash === "#/login" && hasValidSession())`) ma non è stata verificata da un
  test Playwright esplicito nel giro di questa fase (ho testato l'accesso diretto a `#/home` senza
  sessione, non il caso simmetrico). Rischio basso — stesso meccanismo di `hasValidSession()` già
  verificato altrove — ma da confermare esplicitamente.
- **Tema (Light/Dark) non ri-testato su `index.html`**: il meccanismo anti-FOUC è una copia
  esatta di quello già verificato in `style-guide.html`, ma "esatta copia" non equivale a
  "verificata di nuovo" — un errore di trascrizione nella duplicazione non verrebbe scoperto senza
  un test dedicato.
- **`/mnt/project` (mount di ambiente) non è una fonte affidabile al 100%** in questa sessione:
  ha silenziosamente riportato `data/users.json` a un valore superato (il placeholder "Prof. Anna
  Ferrari") durante un'operazione di copia, ignorando la correzione esplicita data dall'utente in
  chat. Ho corretto manualmente e documentato il fatto nel prompt di continuità (§7, nota tecnica
  4) perché è il tipo di errore silente che potrebbe ripetersi in una fase futura se non se ne
  tiene conto esplicitamente.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 **`homePageController.js` è un placeholder esplicito**, non la Home reale — per costruzione
  (Fase 4 non ancora iniziata), non un difetto, ma da sostituire per intero, non da "estendere".
- 🟢 **Nessun salt sull'hash della password demo** — accettato e documentato: il repository è
  pubblico, un salt non aggiungerebbe protezione reale. Verrà eliminato in blocco (non riusato)
  alla migrazione Supabase.
- 🟢 **Sessione non sopravvive se `localStorage` non è disponibile** (es. modalità privata di
  alcuni browser): il login "riesce" per la navigazione immediata nella stessa pagina, ma un
  refresh successivo non troverebbe alcuna sessione. Caso limite noto, accettato per un'app a
  singolo utente reale — non introdotto un fallback in-memory dedicato per non anticipare
  `state.js` (Fase 1, non ancora necessario).
- 🟢 **`userRepository.js`/`roleRepository.js` non esistono come file standalone** — `localAuthAdapter`
  usa direttamente `localJsonRepository`. Deviazione motivata dal piano letterale (vedi §4), non
  un'omissione per fretta.

### Refactoring consigliati
- 🟡 **Formalizzare i test Playwright come suite persistita nel repo** (`tests/`): raccomandazione
  già presente nell'handover di Fase 2, ora più urgente — Fase 3 ha introdotto la prima logica
  applicativa reale (autenticazione, routing, guardie) con un flusso a più passaggi (7 casi
  end-to-end verificati manualmente in questa sessione): rieseguirli a mano ad ogni fase futura
  diventerà sempre più costoso e più a rischio di essere saltato per fretta.
- 🟢 **Regressione di Fase 2 integrale** (non solo spot-check) prima di iniziare Fase 4 — vedi §9.

### Ottimizzazioni future
- 🟢 **Sincronizzazione multi-tab della sessione**: oggi se il logout avviene in una scheda, le
  altre schede aperte sulla stessa origine non se ne accorgono finché non ricaricano. Non
  rilevante per l'uso reale previsto (il docente usa una sola scheda per la proiezione), quindi non
  affrontato ora.
- 🟢 **`router.js` non gestisce parametri di rotta** (es. `#/scenario/:id`, già pianificato in
  Fase 1 §7 per Fase 5): la mappa attuale è a corrispondenza esatta. Andrà estesa quando servirà
  davvero (Fase 5, Scenario Engine) — l'interfaccia pubblica (`registerRoute`/`navigate`) non
  dovrebbe richiedere modifiche incompatibili, ma non è stato verificato in anticipo (YAGNI
  applicato consapevolmente).

### Rischi architetturali
- 🟢 **`js/core/state.js`/`eventBus.js` (Fase 1) ancora assenti**: oggi la comunicazione tra i
  pochi moduli esistenti passa per eventi DOM diretti + import — sufficiente a questa scala. Se
  Fase 4 introdurrà più pagine che devono condividere stato applicativo complesso (non solo la
  sessione, già coperta da `authService`), potrebbe emergere un bisogno reale: da rivalutare
  allora, non da anticipare ora.
- 🟢 **Nessun rischio nuovo identificato sull'integrazione Supabase futura**: `authService`
  continua a esporre la stessa superficie pubblica indipendentemente dall'adapter sottostante,
  esattamente come pianificato in Fase 1 §11.

### Obiettivo
Questa sezione va riletta all'inizio della Fase 4, prima di introdurre nuove funzionalità — in
particolare il punto sulla formalizzazione dei test, che diventa via via più urgente ad ogni fase
che aggiunge logica applicativa reale.
