# SOCIALIVE — Handover di fine Fase 10 (Audit Finale)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Data logica di chiusura fase:** fine Fase 10 (Prompt #10 della Suite — "Audit Finale").
**Tag di riferimento suggerito:** `v1.0.0-fase10-audit-finale`
**Nota:** questa è l'**ultima fase pianificata dalla Suite originaria di 10 prompt**. Questo
documento contiene quindi, oltre al consueto resoconto di fase, un consuntivo complessivo
sull'intero progetto (§1) e una proposta motivata per la fase successiva non pianificata
originariamente (§6/§7).

---

## 1. Stato del progetto

### 1.1 Consuntivo complessivo — Suite dei 10 prompt originari: ✅ COMPLETATA

| Fase | Titolo | Stato |
|---|---|---|
| 1 | Fondamenta (architettura, convenzioni, piano componenti/JSON) | ✅ |
| 2 | Design System e UI Core (14 componenti, 2 servizi, token, temi) | ✅ |
| 3 | Autenticazione (auth reale, routing hash-based, guardie di sessione) | ✅ |
| 4 | Home della piattaforma (AppHeader+Sidebar+Feed+Moduli) | ✅ |
| 5 | Sistema Scenari (scenarioEngine, routing parametrico, appShell) | ✅ |
| 6 | Scenario Oversharing (profilo, StoriesBar, Timeline, 12 post) | ✅ |
| 7 | Post e Media Viewer (visualizzatore immersivo, zoom, navigazione) | ✅ |
| 8 | Dati (esternalizzazione Home in JSON — **dichiarata, non applicata**, vedi §1.3) | ⚠️→✅ |
| 9 | Rifinitura UX (13 interventi, suite Playwright persistita) | ⚠️→✅ |
| 10 | Audit Finale (chiusura discrepanze, revisione architetturale a 6 assi) | ✅ |

Il progetto ha oggi un **ciclo applicativo reale e completo**: login → guardia di sessione →
Home (moduli + feed, entrambi data-driven) → apertura dello scenario Cybersecurity/Oversharing
(profilo realistico, storie, feed, archivio annuale) → apertura di un post nel Media Viewer
(zoom, navigazione, chiusura) → logout → redirect. Un solo scenario è oggi realmente popolato
(Oversharing); l'architettura è progettata per accoglierne altri senza modifiche strutturali
(Repository/Adapter, Scenario Engine a registro, routing parametrico — tutti già validati con
un secondo caso reale, il Media Viewer, nel corso del progetto).

### 1.2 Fase 10 — cosa è stato fatto (in questa fase, in due tempi)

**Prima parte della fase** (sessione precedente a questo documento, riportata dal prompt di
continuità come fonte di verità): audit trasversale a 6 assi (qualità architetturale, debito
tecnico, riutilizzabilità, performance, accessibilità, predisposizione Supabase) + 3 bug reali
trovati e corretti:
1. `homePageController.js` non leggeva ancora `data/modules.json`/`data/home/feed.json` come
   l'handover di Fase 8 dichiarava — riscritto per davvero.
2. Gli interventi 🟢 #11/#12 di Fase 9 (fade-in immagini, micro-transizione ProfileMenu) erano
   dichiarati completi ma mai scritti — implementati per davvero (`js/utils/imageFadeIn.js`
   nuovo, `global.css`/`profile-menu.css` modificati).
3. 5 occorrenze di "Prof. Anna Ferrari" (nome placeholder bandito dalla Fase 3) in
   `style-guide.html` — **dichiarate corrette nel prompt di continuità consegnato per questa
   sessione**.

**Seconda parte della fase** (questa sessione — chiusura e consegna): prima di scrivere
qualunque riga dell'handover, ho rieseguito la stessa disciplina di verifica già raccomandata
esplicitamente dal prompt di continuità stesso ("prima di fidarti della narrazione di un
handover, VERIFICA il file reale") — **applicandola anche al prompt di continuità in arrivo**,
non solo ai file di codice. Risultato: **il punto 3 sopra non era vero**. `style-guide.html`
conteneva ancora tutte e 5 le occorrenze di "Prof. Anna Ferrari" non corrette. Ho inoltre
trovato un secondo problema non segnalato da nessun handover precedente: il docstring in testa a
`tests/home.spec.js` era rimasto quello di Fase 9 (descriveva `homePageController.js` come
ancora hardcoded), in contraddizione diretta con il corpo dello stesso file, già aggiornato per
verificare la riscrittura reale di Fase 10. Entrambi corretti in questa sessione — vedi §4 per il
dettaglio della verifica e §9 per l'implicazione di processo.

### 1.3 Nota di continuità storica (per chi legge questo documento senza aver letto gli altri 9)

Questo progetto ha una caratteristica ricorrente, utile da conoscere prima di fidarsi di
qualunque affermazione sullo "stato attuale": **un handover può descrivere un lavoro non
realmente applicato al codice.** È già accaduto, in ordine cronologico:
- Fase 6: 3 file CSS consegnati ma mai collegati in `index.html` (scoperto dal deploy reale
  dell'utente, non dai test).
- Fase 8: `homePageController.js` dichiarato riscritto a JSON esterni, in realtà rimasto
  hardcoded fino a Fase 9/10.
- Fase 9: 2 interventi (`imageFadeIn.js`, animazione ProfileMenu) dichiarati completi nell'
  handover, mai scritti nel codice — scoperti solo eseguendo realmente la suite persistita in
  Fase 10.
- Fase 10 (questa stessa fase, primo giro): la correzione di `style-guide.html` dichiarata nel
  prompt di continuità, non applicata al file reale — scoperta durante la stesura di questo
  handover, prima di dare per buono quel punto.

La costante in tutti i quattro casi: **il codice reale è sempre stato l'unica fonte di verità
affidabile**, mai la narrazione di un documento precedente. Questo documento stesso va quindi
letto con lo stesso scetticismo metodologico da chi lo riprenderà in futuro — è per questo che
§9 propone un intervento strutturale (non solo un'ennesima correzione puntuale) per rendere
questa classe di errore più difficile da ripetere.

---

## 2. Obiettivi completati (Fase 10)

Solo funzionalità/correzioni realmente implementate e verificate in questa fase.

1. **`homePageController.js` riscritto per davvero**: legge `data/modules.json` e
   `data/home/feed.json` tramite `localJsonRepository.js` (nessuna nuova astrazione), pattern
   asincrono identico a `scenarioPageController.js` (guardia `destroyed`, `aria-busy`,
   fallback di errore condiviso). `home-page.css` aggiornato con il wrapper
   `.sl-home-page__dynamic`. `tests/home.spec.js` aggiornato per verificare il comportamento
   reale (moduli/post caricati da JSON, non più hardcoded).
2. **`js/utils/imageFadeIn.js` (nuovo)**: fade-in idempotente sulla stessa `src` — applicato a
   `PostCard.js` (immagine del post, Home e Oversharing) e a
   `js/scenarios/renderers/profileTimelineRenderer.js` (copertina del profilo). `css/base/
   global.css` riceve le classi condivise `.sl-fade-in-image`/`.sl-fade-in-image--loaded`
   (`--sl-duration-slow`, zero nuovo rischio di CLS: le due immagini che le usano hanno già lo
   spazio riservato da interventi precedenti).
3. **Micro-transizione di apertura per `ProfileMenu`**: `@keyframes sl-profile-menu-in` in
   `css/components/profile-menu.css` (fade + 4px, più leggera delle 8px+scale già usate da
   `Modal`, coerente con la differenza di funzione già motivata in Fase 2).
4. **Audit a 6 assi completato e verificato** (qualità architetturale, debito tecnico,
   riutilizzabilità, performance, accessibilità, predisposizione Supabase) — nessun bug
   ulteriore trovato oltre a quelli elencati qui, tutte le verifiche puntuali (isolamento dei
   livelli, parità dei token `--sl-color-*` tra i due temi, assenza di accesso diretto a
   `localStorage` fuori da `storage.js`, assenza di import di `services/` fuori da `ThemeSwitch`
   tra i componenti UI) **ri-verificate con `grep` in questa sessione, non solo riportate per
   fiducia nel prompt di continuità** — vedi §4 per l'elenco dei controlli eseguiti.
5. **`style-guide.html`: 5 occorrenze di "Prof. Anna Ferrari" corrette in "Prof. Erasmo
   Lassandro"** — questa volta realmente applicate al file (non solo dichiarate). Sintassi del
   modulo JS inline verificata (`node --check` su un estratto del `<script type="module">`).
6. **`tests/home.spec.js`: docstring corretto** — il commento in testa al file descriveva ancora
   lo stato pre-riscrittura (dati hardcoded), in contraddizione con il corpo del file
   sottostante (già verificava il comportamento data-driven). Aggiornato per riflettere lo stato
   reale, con una nota esplicita sulla natura dell'errore per chi rilegge la storia del file.

**Nessuna modifica** a `router.js`, `authService.js`, `localJsonRepository.js`, `scenarioEngine.js`,
`appShell.js`, `scenarioPageController.js`, `loginPageController.js`, né a nessun componente UI
non citato sopra (`AppHeader`, `Sidebar`, `Modal`, `Feed`, `Card`, `Badge`, `Button`, `Input`,
`Avatar`, `ThemeSwitch`, `Loader`, `LoginForm`, `Skeleton`, `ModuleCard`, `PageContainer`,
`StoriesBar`, `Timeline`, `MediaViewer`) — riusati esattamente come sono, coerente con lo scope
di un audit di chiusura (correggere discrepanze reali, non introdurre funzionalità).

---

## 3. Architettura attuale (stato finale del progetto, fine Fase 10)

```
socialive/
├── index.html
├── style-guide.html                         # ♻️ Fase 10 — nome placeholder corretto
├── README.md
├── .gitignore
├── docs/
│   └── handover/
│       ├── fase2-design-system-ui-core.md
│       ├── fase3-autenticazione.md
│       ├── fase4-home.md
│       ├── fase5-sistema-scenari.md
│       ├── fase6-scenario-oversharing.md
│       ├── fase7-post-media-viewer.md
│       ├── fase8-dati.md
│       ├── fase9-rifinitura-ux.md
│       └── fase10-audit-finale.md           # ⭐ NUOVO — questo documento
│
├── data/
│   ├── users.json · roles.json
│   ├── modules.json                         # letto realmente da homePageController.js da questa fase
│   ├── home/
│   │   └── feed.json                        # idem
│   └── scenarios/oversharing/
│       ├── scenario.json · profile.json · stories.json · posts.json
│
├── assets/
│   ├── images/home/mountain-placeholder.svg
│   └── posts/oversharing/                   # 18 placeholder a tinta unita — gestiti dall'utente
│
├── css/
│   ├── tokens/ (colors · spacing · typography · radius · shadows · motion)
│   ├── themes/ (theme-light.css · theme-dark.css — parità token verificata, diff vuoto)
│   ├── base/
│   │   ├── reset.css
│   │   └── global.css                       # ♻️ Fase 9/10 — route transition + fade-in immagini
│   ├── components/ (20 file — incl. avatar♻️, stories-bar⭐, timeline⭐, media-viewer⭐,
│   │                  page-container♻️, module-card, post-card♻️,
│   │                  profile-menu.css ♻️ Fase 10 — keyframes apertura)
│   ├── scenarios/
│   │   └── profile-timeline.css
│   └── layouts/
│       ├── login-page.css
│       ├── home-page.css                    # ♻️ Fase 10 — wrapper .sl-home-page__dynamic
│       └── scenario-page.css
│
└── js/
    ├── core/router.js
    ├── pages/
    │   ├── loginPageController.js
    │   ├── homePageController.js            # ♻️ Fase 10 — riscritto per davvero (data-driven)
    │   ├── scenarioPageController.js
    │   └── shared/appShell.js
    ├── scenarios/
    │   ├── scenarioEngine.js
    │   └── renderers/profileTimelineRenderer.js   # ♻️ Fase 10 — fade-in copertina
    ├── repositories/localJsonRepository.js
    ├── adapters/localAuthAdapter.js
    ├── services/themeService.js · authService.js
    ├── utils/
    │   ├── dom.js · storage.js · focusTrap.js · dateFormat.js
    │   ├── fallbackMessage.js · svg.js          (Fase 9)
    │   └── imageFadeIn.js                       # ⭐ NUOVO Fase 10 — scritto per davvero
    └── components/ (20 componenti — AppHeader, Sidebar, ProfileMenu, Feed,
                      PostCard ♻️ Fase 10, Card, Badge, Avatar, Button, Input, Modal,
                      ThemeSwitch, Loader, LoginForm, Skeleton, ModuleCard, PageContainer,
                      StoriesBar, Timeline, MediaViewer)

tests/                                          # persistita da Fase 9, MAI referenziata da index.html
├── package.json · .gitignore · README.md
├── helpers/ (server.js · testKit.js · auth.js)
├── login.spec.js
├── home.spec.js                              # ♻️ Fase 10 — corpo (apertura fase) + docstring (chiusura fase)
├── scenario.spec.js
└── run-all.js
```

**Nessuna cartella nuova introdotta in questa fase.** `js/config/env.js` (predisposizione
Supabase, Fase 1 §11) **resta non costruito** — gap dichiarato, non un'omissione silenziosa
(vedi §9/§10).

---

## 4. Decisioni progettuali

### 4.1 Decisioni prese nella prima parte della fase (riportate dal prompt di continuità)
- **`homePageController.js`**: riscrittura reale invece di un ulteriore rinvio — il punto era
  aperto da 3 handover consecutivi (Fase 8→9→10) ed era la fonte della più grande discrepanza
  documentazione/codice del progetto.
- **`imageFadeIn.js` come utility condivisa**, non duplicata in due componenti: stesso principio
  già seguito per `focusTrap.js`/`dateFormat.js`/`svg.js`/`fallbackMessage.js` — estrarre al
  secondo consumo reale, non per anticipazione.
- **Micro-transizione di `ProfileMenu` più leggera di `Modal`** (4px vs 8px+scale): un popover
  ancorato deve sentirsi meno "importante" di un dialogo centrale con overlay.

### 4.2 Decisioni e verifiche di questa sessione (chiusura fase)

- **Metodo**: prima di scrivere questo handover, ho ri-verificato con `grep`/`node --check` ogni
  affermazione del prompt di continuità che fosse falsificabile con il codice reale, non solo
  quelle segnalate come incerte. Nello specifico:
  - `grep -rl "Anna Ferrari" /mnt/project/` → trovato ancora presente in `style-guide.html`
    (5/5 occorrenze), nonostante la dichiarazione di correzione. **Corretto.**
  - Confronto testuale tra il docstring e il corpo di `tests/home.spec.js` → trovata la
    contraddizione descritta in §1.2/§2.6. **Corretto.**
  - `grep -l "applyImageFadeIn"`, `grep -n "sl-fade-in-image"`, `grep -n
    "sl-profile-menu-in"`, `grep -n "createLocalJsonRepository\|modules.json"` sui file
    interessati → tutte le altre affermazioni della prima parte della fase **confermate reali**,
    non solo dichiarate.
  - `node --check` su tutti i file `.js` nuovi/modificati (`imageFadeIn.js`, `PostCard.js`,
    `profileTimelineRenderer.js`, `homePageController.js`, `home.spec.js`) e sull'estratto del
    modulo inline di `style-guide.html` → tutti sintatticamente validi.
  - Bilanciamento parentesi `{`/`}` su `global.css`/`profile-menu.css`/`home-page.css` → tutti
    bilanciati (controllo minimo, non un vero parser CSS — sufficiente per escludere un errore
    grossolano di copia/incolla).
  - `diff` tra l'elenco dei token `--sl-color-*` dichiarati in `theme-light.css` e
    `theme-dark.css` → **vuoto**, confermando numericamente la "parità totale" già dichiarata
    dall'audit.
  - `grep` sui componenti UI per import da `../services/` → solo `ThemeSwitch.js` (più
    `router.js`, che è infrastruttura `core`, non un componente — nessuna violazione).
  - `grep` per accesso diretto a `localStorage` fuori da `storage.js` → nessuna occorrenza reale
    nel codice applicativo (un solo falso positivo: un commento testuale in `authService.js` che
    *menziona* la parola "localStorage" senza chiamarlo direttamente; l'unico altro risultato,
    `login_spec.js`, è un file di test che ispeziona legittimamente `localStorage` per
    verificare la persistenza della sessione — non è codice applicativo).

- **Non è stata eseguita, in questa sessione, la suite Playwright con un browser reale**
  (`npm test` in `tests/`): l'ambiente di questa specifica sessione di chat non ha una
  disponibilità confermata di Chromium/Playwright già installato (a differenza di quanto
  riportato per le sessioni di sviluppo precedenti, con `/opt/pw-browsers/`), e non è stato
  ricostruito l'intero albero di cartelle scrivibile necessario a un'esecuzione end-to-end
  realistica solo per una verifica di chiusura. Le due correzioni applicate in questa sessione
  sono comunque **non comportamentali** (un commento e un file di QA mai referenziato
  dall'app/dai test): non invalidano il risultato "60/60" già riportato come eseguito realmente
  nella prima parte della fase. **Raccomandazione esplicita** (vedi §9): ri-eseguire `npm test`
  in un ambiente con browser disponibile prima di considerare la baseline definitiva.

---

## 5. Attività rimanenti

La Suite originaria dei 10 prompt è **completa**. Ciò che segue non è "roadmap non finita" ma
lavoro **esplicitamente fuori scope della Suite originaria**, già segnalato nelle fasi precedenti
o emerso da questo stesso audit:

1. **Immagini reali di Oversharing** (Fase 6, non bloccante per il codice): 18 file ancora
   placeholder a tinta unita in `assets/posts/oversharing/`, gestiti autonomamente dall'utente.
2. **Icon sprite** (`assets/icons/icons.svg`): debito tecnico noto e invariato dalla Fase 2.
3. **`js/config/env.js` / `SUPABASE_URL` / `SUPABASE_ANON_KEY`**: previsti da Fase 1 §11, mai
   costruiti — nessun consumer reale li richiede prima della vera migrazione Supabase.
4. **Integrazione CI** della suite `tests/` (es. GitHub Actions): tecnicamente pronta
   (`npm install && npm test`), non ancora collegata a un workflow — SOCIALIVE non ha oggi una
   pipeline CI/CD.
5. **Ri-esecuzione dal vivo di `npm test`** in un ambiente con browser Chromium disponibile, per
   riconfermare la baseline dopo le due correzioni non comportamentali di questa sessione (vedi
   §4.2) — raccomandato prima del deploy, non bloccante.
6. **Secondo scenario reale** (Phishing, Social Engineering, Fake News, Password Security,
   Deepfake, Malware, Ransomware, QR Code, Cyberbullismo, Privacy, Identity Theft — Long Term
   Vision del progetto): nessuno di questi è nella Suite originaria dei 10 prompt, ma è
   l'estensione naturale prevista fin dalla Fase 1 (`data/scenarios/<id>/` + voce in
   `modules.json`, zero modifiche a `components/`/`services/`/`scenarioEngine.js` se il nuovo
   scenario riusa `type: "profile-timeline"`; un nuovo renderer isolato se introduce un tipo di
   interazione diverso, es. una chat-simulation per Social Engineering).
7. **Salvaguardia anti-regressione per contenuti testuali banditi** (nome placeholder "Prof.
   Anna Ferrari" e simili): oggi nessun controllo automatico lo impedirebbe di ricomparire in un
   file non coperto da `tests/` (es. `style-guide.html`) — vedi §9/§10 per la proposta concreta.

---

## 6. Prossima fase

**Non esiste una "Fase 11" nella Suite originaria**: il Prompt #10 era l'ultimo pianificato. Da
qui in avanti, la continuazione del progetto è guidata dalla **Long Term Vision** (nuovi scenari
sulla stessa piattaforma), non da un prompt residuo della Suite.

**Punto di ripartenza esatto**: l'intera piattaforma (autenticazione, routing, Design System,
Scenario Engine, Media Viewer) è stabile, verificata, e coperta da una suite di test persistita.
Il lavoro futuro si divide in due categorie indipendenti, che possono procedere in qualunque
ordine o in parallelo:

- **(A) Consolidamento** — voci 1/2/3/4/5/7 di §5: nessuna richiede decisioni architetturali,
  sono rifiniture/gap dichiarati.
- **(B) Espansione** — voce 6 di §5: il **primo vero banco di prova** dell'estendibilità
  promessa fin dalla Fase 1 ("aggiungere un nuovo scenario simile a Oversharing richiede solo:
  1. creare `data/scenarios/<id>/`; 2. una voce in `modules.json`; zero modifiche a
  `components/`/`services/`/`pages/`"). Consiglio di iniziare da **Phishing** o **Password
  Security**: entrambi si prestano a un primo tipo di scenario DIVERSO da
  `"profile-timeline"` (es. una simulazione email o un piccolo quiz interattivo), quindi il
  primo caso reale in cui `scenarioEngine.registerRenderer()` accoglie un secondo `type` — la
  vera verifica del pattern Registry, oggi validato solo con un `type` singolo.

Prima decisione da motivare, prima di scrivere codice: la struttura dati e il `type` del nuovo
scenario (analogamente a quanto fatto in Fase 5 per `"profile-timeline"`).

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
NUOVO, MODIFICATO o GIÀ ESISTENTE — verificalo controllando i file di progetto disponibili PRIMA
di dichiarare qualcosa, non per assunzione — e (b) il percorso esatto, con tabella riassuntiva
dopo ogni consegna.

CONVENZIONE OBBLIGATORIA DI FINE FASE: l'handover va SEMPRE prodotto come file .md separato, e a
fine fase va consegnata una cartella .zip con TUTTI i file prodotti/modificati in quella fase.

LEZIONE DI PROCESSO, CONFERMATA UNA QUARTA VOLTA IN FASE 10 (non ignorare): un handover o un
prompt di continuità può descrivere una correzione non realmente applicata al codice. È già
successo in Fase 6 (link CSS mancanti in index.html), Fase 8 (homePageController.js non
riscritto nonostante l'handover lo dichiarasse), Fase 9 (2 interventi dichiarati ma mai scritti),
e di nuovo in Fase 10 stessa (una correzione a style-guide.html dichiarata nel prompt di
continuità ma non applicata al file reale, scoperta solo verificandolo con grep prima di scrivere
il successivo handover). REGOLA: prima di dare per buona qualunque affermazione su "cosa è stato
già fatto", verificala con grep/lettura diretta del file reale — non fidarti mai della sola
narrazione, nemmeno della tua stessa narrazione di un turno precedente nella stessa conversazione.

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework/libreria UI.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main. Non hai credenziali per pushare: prepara i file, l'utente li applica
lui stesso.

NOTE TECNICHE DI AMBIENTE: verifica SEMPRE quali strumenti sono realmente disponibili in questa
sessione (shell, Node, npm, Playwright/Chromium) prima di assumerli — non dare per scontato che
coincidano con una sessione precedente. Se serve eseguire l'app o i test reali, il mount dei file
di progetto potrebbe essere FLAT (non rispecchiare la struttura a cartelle): ricostruiscila a
mano verificando gli import relativi di ciascun modulo con grep, non assumendo i path da un
handover precedente.

STATO: **Suite originaria dei 10 prompt (Fase 1 → Fase 10) COMPLETATA.** Il progetto ha un ciclo
applicativo reale end-to-end: login → guardia di sessione → Home (moduli e feed data-driven da
data/modules.json e data/home/feed.json) → scenario Cybersecurity/Oversharing (profilo
realistico, storie, feed di 12 post, vista Archivio annuale) → Media Viewer (apertura, zoom,
navigazione, chiusura) → logout. Un solo scenario reale (Oversharing); l'architettura
(Repository/Adapter, Scenario Engine a registro, routing parametrico) è pronta per accoglierne
altri senza modifiche strutturali. Suite di test Playwright persistita in tests/ (60 controlli,
ultima esecuzione reale confermata nella prima parte di Fase 10). Il documento di handover
completo di Fase 10 (10 sezioni, allegato a questo prompt) è la fonte di verità primaria — in
particolare la sua sezione 1.3 sulla storia ricorrente di handover che descrivono correzioni non
applicate: NON ripartire da assunzioni su "cosa è già stato fatto", verifica sempre.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" — NON "Prof. Anna Ferrari" (nome bandito, ORA rimosso anche dall'ultima
occorrenza residua in style-guide.html, corretta in Fase 10).

IMMAGINI OVERSHARING: ancora placeholder a tinta unita, gestite dall'utente, zero modifiche di
codice previste.

GAP DICHIARATI (non bloccanti, vedi §5/§10 dell'handover di Fase 10): icon sprite
(assets/icons/icons.svg), js/config/env.js per Supabase, integrazione CI per tests/, un controllo
automatico anti-regressione per contenuti testuali banditi (nessuna rete di sicurezza impedisce
oggi la ricomparsa di un nome placeholder in un file non coperto dalla suite, es.
style-guide.html — proposta concreta nella sezione Debito Tecnico dell'handover di Fase 10).

DA FARE ORA — scegli una delle due direzioni indipendenti (o entrambe, in ordine qualsiasi):

DIREZIONE A — Consolidamento (nessuna decisione architetturale nuova richiesta):
1. Ri-eseguire dal vivo `npm test` in tests/ (browser reale) per riconfermare la baseline dopo
   le due correzioni non comportamentali applicate in chiusura di Fase 10.
2. Valutare l'introduzione di un controllo grep-based persistito in tests/ contro la
   ricomparsa di contenuti testuali banditi (proposta nella sezione Debito Tecnico di Fase 10).
3. Integrazione CI (GitHub Actions o equivalente) per tests/.

DIREZIONE B — Espansione (Long Term Vision, richiede decisioni architetturali motivate prima
del codice):
1. Progettare il secondo scenario reale (consigliato: Phishing o Password Security — entrambi
   naturali per un primo "type" DIVERSO da "profile-timeline", il vero banco di prova del
   pattern Registry di scenarioEngine.js, oggi validato con un solo type).
2. Struttura dati in data/scenarios/<id>/, nuova voce in modules.json, nuovo renderer in
   js/scenarios/renderers/ SOLO se il type è realmente nuovo — zero modifiche a
   scenarioEngine.js/router.js/appShell.js se il pattern esistente si conferma sufficiente.

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container,params)→destroy per i
page controller; eventi "sl:nome-evento"; componenti "dumb"; documentazione in italiano;
verificare sempre con la suite Playwright persistita (tests/) e con grep sui file reali, mai per
assunzione; handover completo a 10 sezioni + zip di tutti i file della fase a fine fase.

Indica quale direzione preferisci (A, B, o entrambe in un ordine specifico) prima che io proceda.
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Tutti i controlli persistiti in `tests/` (60, ultima esecuzione reale riportata nella
  prima parte della fase): bootstrap/guardie/login/logout (`login.spec.js`), composizione Home
  data-driven/fade-in/skip-link/ProfileMenu (`home.spec.js`), profilo Oversharing/toggle Feed-
  Archivio/MediaViewer/flusso da tastiera completo (`scenario.spec.js`).
- [x] `style-guide.html`: modulo inline sintatticamente valido dopo la correzione (verificato con
  `node --check` su un estratto — non un test funzionale a schermo in questa sessione).
- [ ] **Ri-esecuzione dal vivo di `npm test`** con browser reale, in un ambiente che lo consenta —
  non eseguita in questa sessione (vedi §4.2/§9). Le due correzioni di chiusura fase sono
  non comportamentali, ma la conferma reale resta consigliata prima del deploy.
- [ ] Verifica visiva di `style-guide.html` dopo la correzione del nome (screenshot reale) — non
  eseguita in questa sessione, rischio basso (sostituzione testuale 1:1, nessuna struttura DOM
  toccata).

### Test UI
- [x] (Da fasi precedenti, invariati) Light/Dark/mobile 375px/breakpoint 768–1024px su tutte le
  pagine reali — nessuna modifica di layout introdotta in questa fase.

### Test UX
- [x] (Da fasi precedenti, invariati) Focus visibile solo da tastiera, transizioni coerenti con
  `prefers-reduced-motion`, skip-link, flusso completo da tastiera Home→Scenario→MediaViewer.

### Test tecnici
- [x] `node --check` su tutti i file `.js` nuovi/modificati in questa fase (`imageFadeIn.js`,
  `PostCard.js`, `profileTimelineRenderer.js`, `homePageController.js`, `home.spec.js`).
- [x] Sintassi del modulo inline di `style-guide.html` verificata dopo la correzione.
- [x] Bilanciamento parentesi su tutti i CSS modificati.
- [x] `diff` vuoto tra i token `--sl-color-*` di `theme-light.css`/`theme-dark.css`.
- [x] Nessun accesso diretto a `localStorage` fuori da `storage.js` nel codice applicativo
  (verificato con grep, un solo falso positivo testuale in un commento, un solo uso legittimo in
  un file di test).
- [x] Nessun componente UI importa da `services/` fuori da `ThemeSwitch.js`.

### Test di regressione
- [x] Nessun file toccato in questa fase è consumato da `router.js`/`authService.js`/
  `localJsonRepository.js`/`scenarioEngine.js`/`appShell.js` in modo da poter introdurre una
  regressione sul flusso principale — le modifiche sono isolate (un commento, un file di QA non
  referenziato dall'app, e le correzioni già isolate della prima parte della fase).
- [ ] Regressione integrale della suite (60/60) non ri-eseguita dal vivo in questa sessione —
  vedi sopra.

---

## 9. Criticità

**La criticità più rilevante di questa fase non è un bug nel prodotto: è un bug nel processo di
documentazione stesso, confermato per la quarta volta.** Un prompt di continuità — lo strumento
pensato esplicitamente per trasferire con fedeltà lo stato del progetto tra una sessione e la
successiva — ha dichiarato una correzione (`style-guide.html`) che non era stata realmente
applicata al file. La causa non è malafede né distrazione isolata: è un **gap strutturale di
copertura**. Le correzioni di Fase 9 (fade-in, ProfileMenu) erano state scoperte proprio perché
la suite Playwright persistita conteneva test che le davano per assunte — l'esecuzione reale le
ha smascherate automaticamente. `style-guide.html`, invece, **non ha alcuna copertura di test**
(è uno strumento di QA interno, esplicitamente escluso dallo scope dell'app reale e quindi mai
finito dentro `tests/`): un'affermazione falsa su di esso non viene mai contraddetta da
un'esecuzione automatica, solo da una lettura manuale — ed è infatti l'unico dei quattro casi
storici (Fase 6/8/9/10) non catturato da un'esecuzione di test, ma solo da una verifica manuale
con `grep` fatta apposta per questo handover.

**Implicazione concreta**: la sicurezza offerta dalla suite persistita è reale ma parziale —
copre l'app spedita, non gli strumenti di sviluppo accessori. Propongo (§10) un intervento
minimo e a basso costo per chiudere anche questo angolo.

Criticità minori, tutte già gestite in questa fase o dichiarate senza rischio residuo:
- Ri-esecuzione dal vivo della suite non eseguita in questa sessione (§4.2/§8) — rischio basso,
  correzioni non comportamentali, ma non ancora confermato con un'esecuzione reale.
- Gap Supabase (`env.js`) — dichiarato da Fase 1, nessun consumer reale lo richiede oggi.
- Immagini reali di Oversharing — gestite dall'utente, indipendenti dal codice.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessun nuovo compromesso introdotto in questa fase. Le correzioni applicate (riscrittura
  Home, fade-in/animazione, nome placeholder, docstring) chiudono debito preesistente, non ne
  aprono di nuovo.

### Refactoring consigliati
- 🟡 **Introdurre un controllo persistito anti-regressione per contenuti testuali banditi**
  (proposta concreta, nuova in questa fase): un piccolo script (es.
  `tests/content-guard.spec.js`, nessuna dipendenza da browser/Playwright — un semplice
  `grep`/lettura file su tutto il repository) che fallisce se stringhe esplicitamente bandite
  (a partire da "Anna Ferrari") compaiono in QUALUNQUE file versionato, incluso
  `style-guide.html` e la documentazione stessa dove non pertinente. Costo di implementazione
  minimo (un file, nessuna nuova dipendenza), beneficio diretto: la classe di bug che si è
  ripetuta 4 volte diventerebbe rilevabile con `npm test` invece che solo con una lettura
  manuale occasionale.
- 🟢 **Formalizzare la ri-esecuzione della suite come ultimo passo obbligatorio di ogni
  handover**, non solo come raccomandazione in prosa: es. una riga di checklist esplicita in
  cima a questo stesso template di handover ("suite eseguita dal vivo in questa sessione: sì/no
  + esito"), per rendere impossibile dichiarare una baseline senza dichiarare anche se è stata
  ri-verificata o solo riportata.

### Ottimizzazioni future
- 🟢 Bundling/unificazione delle richieste CSS — deliberatamente non affrontato (confermato
  ancora valido in Fase 10): richiederebbe un build step in contrasto con il vincolo "nessun
  bundler" di Fase 1.
- 🟢 Pan/drag nello zoom di `MediaViewer` — nessun bisogno reale col dataset attuale.
- 🟢 Integrazione CI (GitHub Actions) per `tests/` — tecnicamente pronta, non collegata.

### Rischi architetturali
- 🟢 **Nessun rischio architetturale nuovo**: tutte le modifiche di questa fase sono correttive
  o additive (utility condivisa, classi CSS condivise, correzione testuale, correzione di
  commento) — zero cambi di interfaccia pubblica su componenti/service/repository.
- 🟢 **Pattern Registry (Scenario Engine) ancora validato con un solo `type` reale**
  (`"profile-timeline"`): l'estendibilità promessa da Fase 1 resta, ad oggi, una proprietà
  architetturale verificata solo per costruzione (Open/Closed rispettato nel codice), non ancora
  da un secondo caso reale con un `type` diverso — la vera prova arriverà solo con il primo
  scenario di tipo differente (vedi §6).
- 🟡 **Copertura di test asimmetrica tra "app reale" e "strumenti di QA interni"** (vedi §9): non
  un rischio per l'app spedita, ma un punto cieco strutturale nel processo di verifica del
  progetto stesso.

### Priorità
- 🟡 Media: introdurre il controllo anti-regressione per contenuti testuali banditi (§10,
  Refactoring consigliati) — costo minimo, chiude un punto cieco reale, ricorrente.
- 🟡 Media: ri-eseguire `npm test` dal vivo in un ambiente con browser prima del deploy finale.
- 🟢 Bassa: tutto il resto (icon sprite, Supabase env.js, CI, immagini reali) — nessuna
  bloccante per lo stato attuale del prodotto.

### Obiettivo
La Suite originaria dei 10 prompt si chiude qui. Chi riprenderà il progetto per la Long Term
Vision (nuovi scenari) eredita una piattaforma stabile, un Design System maturo, un pattern di
estendibilità progettato ma verificato con un solo caso reale, e una lezione di processo
ripetuta quattro volte che vale la pena non dimenticare: **verificare sempre il codice reale,
mai la narrazione di chi lo ha scritto prima — inclusa la propria, in un turno precedente della
stessa conversazione.**
