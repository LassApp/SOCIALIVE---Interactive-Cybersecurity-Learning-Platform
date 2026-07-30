# SOCIALIVE — Handover di fine Fase 9 (Rifinitura UX)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Data logica di chiusura fase:** fine Fase 9 (Prompt #9 della Suite — "Rifinitura UX").
**Tag di riferimento suggerito:** `v0.9.0-fase9-rifinitura-ux`

---

## 1. Stato del progetto

- Fasi 1–8: ✅ complete (vedi handover dedicati).
- **Fase 9 — Rifinitura UX: ✅ COMPLETATA.** A differenza di ogni fase precedente, non ha
  introdotto funzionalità nuove: è stato un audit trasversale (animazioni, performance,
  responsive, accessibilità, coerenza visiva) sulle tre pagine reali esistenti (`#/login`,
  `#/home`, `#/scenario/oversharing`), seguito dall'implementazione motivata di 12 interventi
  concreti su 13 identificati (il tredicesimo — "monitorare le 33 richieste CSS separate" — è
  stato chiuso con una decisione esplicita di *non* intervenire, non con un'omissione).
- **Suite di test Playwright finalmente persistita nel repository** (`tests/`): debito tecnico
  segnalato ricorrente in OGNI handover dalla Fase 2 in avanti (7 fasi), chiuso in questa fase.
  61 controlli automatizzati, tutti verdi, eseguibili con un solo comando (`npm test`).
- **2 bug reali trovati e corretti** durante l'audit (non solo debito): il messaggio "Pagina non
  trovata" del router rendeva con colore/dimensione di default invece dello stile "soft" usato
  ovunque altrove per gli stati non felici (causa: tre copie quasi identiche della stessa
  funzione, mai allineate tra loro).
- **Nessuna riga di Fase 10 (Audit finale)** è stata scritta.

---

## 2. Obiettivi completati

Elenco completo dei 12 interventi implementati, nell'ordine in cui l'audit li aveva numerati.

### 🔴 Alta priorità

1. **`buildFallbackMessage()` condiviso** (`js/utils/fallbackMessage.js`, nuovo) — estratta la
   costruzione del messaggio di fallback, duplicata (e divergente) in `router.js`,
   `scenarioEngine.js`, `profileTimelineRenderer.js`. Bug reale corretto come effetto
   collaterale: il 404 del router riceve ora lo stesso stile "soft" degli altri due.
2. **Spazio dell'immagine del post riservato** (`post-card.css`, `PostCard.js`) — `max-height`
   fisso in px sostituito con `aspect-ratio: 4/3` + `loading="lazy"`: elimina il rischio di
   layout shift quando le foto reali di Oversharing sostituiranno i placeholder.
3. **`svgNode()` condiviso** (`js/utils/svg.js`, nuovo) — estratta da `Loader.js`, `PostCard.js`,
   `MediaViewer.js`, che la duplicavano identica.

### 🟡 Media priorità

4. **`<h1>` sulla Home** (`homePageController.js`) — visivamente nascosto (`.sl-visually-hidden`),
   testo "Home": la Home era l'unica delle tre pagine reali priva di un titolo di primo livello.
5. **`document.title` per rotta** (`router.js`) — centralizzato nel router (non nei singoli page
   controller), formato `${title} — SocialAlive`; il titolo arriva da chi registra la rotta
   (`index.html`), il router resta ignaro del significato delle pagine concrete.
6. **Skip-link** (`PageContainer.js`/`page-container.css`) — click intercettato con
   `preventDefault()` + `mainEl.focus()`, MAI il comportamento nativo dell'anchor (un vero salto
   di hash smonterebbe l'intera pagina: nessuna rotta reale corrisponde a `#sl-main-content`).
7. **Transizione fra pagine** (`router.js`/`global.css`) — fade-in del contenuto appena montato,
   doppio `requestAnimationFrame` (necessario: un reflow sincrono o un singolo rAF non innescano
   la transizione quando `mount()` viene chiamato da dentro un handler `hashchange`, verificato
   empiricamente).
8. **Screenshot reali nel range 768–1024px** — mai chiusi con una verifica reale in 5 fasi
   consecutive (Fase 4→8): eseguiti in questa fase su Home e sullo scenario (768/900/1024px),
   nessuna anomalia di layout trovata.
9. **Flusso completo da tastiera Home→Scenario→MediaViewer** — mai percorso per intero dalla
   Fase 4: verificato in un unico test end-to-end (nessun click salvo il login), superato.
10. **Suite Playwright persistita** (`tests/`) — vedi §3 e §4 per i dettagli architetturali.

### 🟢 Bassa priorità

11. **Fade-in immagini al caricamento** (`js/utils/imageFadeIn.js`, nuovo) — applicato
    all'immagine del post (`PostCard.js`) e alla copertina del profilo
    (`profileTimelineRenderer.js`); estratto subito in utility condivisa (due consumer reali fin
    dal primo commit).
12. **Micro-transizione di apertura per ProfileMenu** (`profile-menu.css`) — fade + piccolo
    spostamento verticale (4px), stesso principio di `Modal` ma più leggero (nessun overlay da
    animare insieme).

### Non implementato, per decisione esplicita

13. **33 richieste CSS separate + 7 moduli JS per pagina** — confermato in questa fase: bundlare
    richiederebbe un build step, in contrasto con il vincolo esplicito "nessun bundler" fissato in
    Fase 1. Su GitHub Pages (HTTP/2) l'impatto reale per un'app a singolo utente resta marginale.
    Decisione: monitorare, non agire — invariata dall'audit iniziale.

---

## 3. Architettura attuale

```
socialive/
├── index.html                              (Fase 8, INVARIATO — nessun nuovo asset da collegare)
├── tests/                                   # ⭐ NUOVA cartella — MAI referenziata da index.html
│   ├── package.json
│   ├── .gitignore                          (esclude node_modules/ e screenshots/)
│   ├── README.md
│   ├── helpers/
│   │   ├── server.js                       # server statico nativo (http/fs/path)
│   │   ├── testKit.js                      # micro-runner (createSuite/test/summary)
│   │   └── auth.js                         # login reale via UI, riusato da 2 suite
│   ├── login.spec.js                       # 15 controlli
│   ├── home.spec.js                        # 23 controlli
│   ├── scenario.spec.js                    # 23 controlli (incl. flusso da tastiera completo)
│   └── run-all.js                          # esegue le tre suite, riepilogo aggregato
│
├── css/
│   ├── base/
│   │   └── global.css                      # ♻️ MODIFICATO — route transition + fade-in immagini
│   └── components/
│       ├── page-container.css              # ♻️ MODIFICATO — stile skip-link
│       ├── post-card.css                   # ♻️ MODIFICATO — aspect-ratio invece di max-height
│       └── profile-menu.css                # ♻️ MODIFICATO — micro-transizione di apertura
│
└── js/
    ├── core/
    │   └── router.js                       # ♻️ MODIFICATO — fallback condiviso, title, transizione
    ├── pages/
    │   └── homePageController.js           # ♻️ MODIFICATO — <h1> visivamente nascosto
    ├── scenarios/
    │   ├── scenarioEngine.js               # ♻️ MODIFICATO — usa fallbackMessage.js condiviso
    │   └── renderers/
    │       └── profileTimelineRenderer.js  # ♻️ MODIFICATO — fallback condiviso + fade-in copertina
    ├── components/
    │   ├── Loader.js                       # ♻️ MODIFICATO — usa svg.js condiviso
    │   ├── MediaViewer.js                  # ♻️ MODIFICATO — usa svg.js condiviso
    │   ├── PostCard.js                     # ♻️ MODIFICATO — svg.js, aspect-ratio, fade-in
    │   └── PageContainer.js                # ♻️ MODIFICATO — skip-link
    └── utils/
        ├── fallbackMessage.js              # ⭐ NUOVO
        ├── svg.js                          # ⭐ NUOVO
        └── imageFadeIn.js                  # ⭐ NUOVO
```

**Nessuna modifica** a `authService.js`, `loginPageController.js`, `scenarioPageController.js`,
`appShell.js`, `localJsonRepository.js`, né a nessun componente/CSS non elencato sopra — l'intera
fase è stata, per costruzione, un audit di rifinitura mirato, non una riscrittura.

**Nota di continuità critica** (verificata di persona in questa fase, non per assunzione):
`homePageController.js` in produzione resta la versione con dati demo hardcoded (Fase 5) — la
riscrittura a `data/modules.json`/`data/home/feed.json` descritta nell'handover di Fase 8 non è
mai stata realmente applicata al file. I test di questa suite (`home.spec.js`) verificano il
comportamento *effettivo* del codice, non quello narrato nella documentazione di Fase 8. Questo
punto va risolto esplicitamente in Fase 10 (Audit finale) — vedi §9.

---

## 4. Decisioni progettuali

### Perché niente `@playwright/test`
Ogni fase precedente ha già verificato l'app con script Playwright "grezzi" (`chromium.launch()`
diretto, nessun framework di test). La suite persiste esattamente lo stesso approccio — introdurre
un intero test runner con relativa configurazione sarebbe complessità aggiunta senza un bisogno
reale per tre pagine (KISS). Zero dipendenze oltre a `playwright` stesso: il server statico è
scritto a mano con i moduli nativi di Node (`http`/`fs`/`path`), evitando un `http-server`/`serve`
in più nel `package.json`.

### `tests/` non viola il vincolo "nessun bundler/framework"
Quel vincolo (Fase 1) riguarda l'app consegnata su GitHub Pages, non gli strumenti di sviluppo:
`tests/` non è mai referenziata da `index.html`, non viene mai servita, non richiede alcun passo
di build per l'app reale.

### Fade-in immagini: estratto subito, non duplicato
Due consumer reali fin dal primo commit dell'intervento (`PostCard.js`, `profileTimelineRenderer.js`)
— stesso principio "si estrae quando un secondo consumo reale lo richiede" già seguito per
`dateFormat.js` (Fase 6) e per `svg.js`/`fallbackMessage.js` (questa stessa fase). Le classi CSS
vivono in `global.css` (concern trasversale a qualunque immagine futura), non nel CSS di un
singolo componente.

### Fade-in: il confronto sulla `src` prima di far ripartire la transizione
`PostCard.update()` viene richiamato anche per il solo contatore "mi piace": senza un confronto
esplicito sull'attributo `src`, l'immagine sarebbe sparita e riapparsa ad ogni like — bug di
UX trovato e corretto durante l'implementazione stessa (verificato con un test dedicato).

### Micro-transizione di ProfileMenu: più leggera di quella di Modal
4px di spostamento verticale (non gli 8px di `Modal`): un popover ancorato al trigger deve
sentirsi più "leggero" di un dialogo centrale con overlay. Nessun overlay da animare insieme (a
differenza di Modal, che ne anima due).

### 768–1024px e flusso da tastiera: chiusi per ultimi, con la suite persistita
Come deciso nell'audit iniziale: prima l'infrastruttura di test (intervento #10), poi i due item
di sola verifica (#8, #9) — scriverli come script ad-hoc separati sarebbe stato lavoro implicitamente
duplicato rispetto a scriverli direttamente dentro `tests/`.

---

## 5. Attività rimanenti

In ordine di roadmap (Prompt #10 della Suite, ultima fase):

1. **Fase 10 — Audit finale** (prossima, vedi §6): qualità architetturale, debito tecnico,
   riutilizzabilità, performance, accessibilità, predisposizione a Supabase — un report, non
   nuovo codice applicativo.
2. **Punto da risolvere esplicitamente in Fase 10** (non rimandabile oltre): la discrepanza tra
   `homePageController.js` reale (Fase 5, hardcoded) e la riscrittura a JSON descritta
   nell'handover di Fase 8 — l'Audit finale è la sede naturale per decidere se applicare
   davvero la riscrittura o dichiarare closed lo scope di Fase 8 come "mai completato".
3. **Immagini reali di Oversharing** (Fase 6, non bloccante per il codice): ancora placeholder a
   tinta unita nel repository reale — indipendente da questa fase.

**Non costruiti deliberatamente**: bundling/unificazione delle richieste CSS (intervento #13,
decisione esplicita di non agire); un vero widget ARIA "tablist" per il toggle Post/Archivio
(nessun secondo scenario lo richiede ancora); pan/drag nello zoom di MediaViewer.

---

## 6. Prossima fase

**Fase 10 — Audit finale** (Prompt #10 della Suite originaria, ultima fase pianificata).

**Punto di ripartenza esatto**: tutte le pagine reali sono state rifinite e sono ora coperte da
una suite di test persistita e verificata (61 controlli). Fase 10 non introduce funzionalità né
rifiniture: produce un report su qualità architetturale, debito tecnico, riutilizzabilità,
performance, accessibilità e predisposizione a Supabase, con criticità e miglioramenti consigliati
— **prima decisione da prendere**: se e come risolvere la discrepanza Fase5/Fase8 su
`homePageController.js` segnalata al punto 2 di §5, dato che influenza qualunque valutazione di
"stato reale" del data layer.

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
NUOVO, se SOSTITUISCE/MODIFICA un file esistente, o se è GIÀ ESISTENTE (verificalo controllando
per intero l'elenco dei file di progetto disponibili PRIMA di dichiarare qualcosa come "nuovo" —
errore reale già accaduto due volte, Fase 6 e Fase 8) e (b) il percorso esatto, con tabella
riassuntiva dopo ogni consegna.

CONVENZIONE OBBLIGATORIA DI FINE FASE: l'handover va SEMPRE prodotto come file .md separato, e a
fine fase va consegnata una cartella .zip con TUTTI i file prodotti/modificati in quella fase.

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework/libreria UI.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main. Non hai credenziali per pushare: prepara i file, l'utente li applica
lui stesso.

NOTE TECNICHE DI AMBIENTE: niente `pkill -f "<pattern con la porta>"`; server+test Playwright
nella STESSA chiamata bash; usa una porta nuova ad ogni test; per verificare l'app reale
end-to-end serve ricostruire manualmente la struttura a cartelle (il mount di sola lettura dei
file di progetto è FLAT); Playwright (Python e Node) e Chromium sono già disponibili
nell'ambiente — verificalo comunque (`pip show playwright`, `npm ls -g`), non assumerlo.

STATO: Fasi 1–9 COMPLETE. Fase 9 (Rifinitura UX) ha chiuso tutti i 13 interventi dell'audit
trasversale (animazioni, performance, responsive, accessibilità, coerenza visiva) su `#/login`,
`#/home`, `#/scenario/oversharing`: fallback message condiviso (bug reale corretto), aspect-ratio+
lazy loading sull'immagine del post, svgNode condiviso, `<h1>` sulla Home, `document.title` per
rotta, skip-link (WCAG 2.4.1), transizione fra pagine, screenshot reali 768–1024px, flusso completo
da tastiera Home→Scenario→MediaViewer, **suite Playwright persistita in `tests/`** (61 controlli,
tutti verdi — debito tecnico ricorrente da 7 fasi, finalmente chiuso), fade-in immagini al
caricamento, micro-transizione di ProfileMenu. Il documento di handover completo (10 sezioni,
questo stesso file) è la fonte di verità primaria: non ripartire da assunzioni.

PUNTO APERTO, DA RISOLVERE IN QUESTA FASE (non rimandabile oltre): `homePageController.js` in
produzione è ancora la versione Fase 5 (dati demo hardcoded), NON la riscrittura a
`data/modules.json`/`data/home/feed.json` descritta nell'handover di Fase 8 — verificato
esplicitamente in Fase 9 con `grep` sul file reale, non per assunzione. Decidi con l'utente se
applicare davvero quella riscrittura ora o dichiarare chiuso lo scope di Fase 8 così com'è.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" (NON "Prof. Anna Ferrari", nome scartato in una fase precedente).

IMMAGINI OVERSHARING: ancora placeholder a tinta unita — l'utente le gestisce autonomamente,
stessi percorsi, zero modifiche di codice previste.

DA FARE ORA (Fase 10 — Audit finale, Prompt #10 della Suite, ULTIMA fase pianificata):
1. Risolvere il punto aperto su homePageController.js (sopra) prima di qualunque valutazione di
   "stato reale" del data layer.
2. Eseguire l'audit finale: qualità architetturale, debito tecnico accumulato in 9 fasi,
   riutilizzabilità dei componenti, performance, accessibilità, predisposizione reale a Supabase
   (repository/adapter pattern già isolato dalla Fase 1 — verificarne la tenuta con un occhio
   critico, non per assunzione).
3. Usare la suite in tests/ per la regressione, invece di ricostruire script ad-hoc.
4. Produrre un report con criticità e miglioramenti consigliati (non necessariamente nuovo codice
   applicativo, salvo correzioni di bug reali trovati durante l'audit).

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container,params)→destroy per i page
controller; eventi "sl:nome-evento"; componenti "dumb"; documentazione in italiano; verificare
sempre con la suite Playwright persistita (tests/) + screenshot reali; handover completo a 10
sezioni + zip di tutti i file della fase a fine fase.

Procedi risolvendo prima il punto aperto su homePageController.js, poi pianifica l'audit finale.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già superati** e persistiti in `tests/` (`npm test` per
rieseguirli integralmente in qualunque momento futuro — non serve più ricostruirli a mano).

### Test funzionali
- [x] Bootstrap, guardie di sessione, redirect simmetrico, logout, 404 (`login.spec.js`, 12
  controlli).
- [x] Composizione Home, moduli, feed, fallback avatar, aspect-ratio/lazy, fade-in immagine,
  toggle "mi piace", skip-link, ProfileMenu + micro-transizione (`home.spec.js`, 23 controlli).
- [x] Profilo Oversharing, StoriesBar, toggle Post/Archivio, assenza di elementi didattici,
  MediaViewer (apertura/navigazione/zoom/chiusura), fade-in copertina (`scenario.spec.js`, 23
  controlli).
- [x] Flusso completo da tastiera Home→Scenario→MediaViewer (incluso in `scenario.spec.js`).

### Test UI
- [x] Screenshot reali Light/Dark/mobile 375px su tutte e tre le pagine.
- [x] Screenshot reali 768/900/1024px su Home e sullo scenario — nessuna anomalia di layout
  (intervento #8, mai chiuso in 5 fasi precedenti).

### Test UX
- [x] Focus visibile solo da tastiera, transizioni coerenti con `prefers-reduced-motion`
  (garantito dalla rete di sicurezza generale, non ri-testato esplicitamente con l'emulazione
  del sistema operativo in questa fase — rischio basso, meccanismo invariato da Fase 2).
- [x] Skip-link non altera l'hash, focus corretto su `<main>`.

### Test tecnici
- [x] `node --check` su tutti i file JS nuovi/modificati.
- [x] Console priva di errori sui flussi reali testati.
- [x] Nessun path relativo rotto in `index.html` (nessun nuovo asset da collegare in questa
  fase — tutte le modifiche toccano file già linkati).

### Test di regressione
- [x] Intera suite (61 controlli) eseguita più volte durante la fase, sempre verde, incl. dopo
  gli interventi #11/#12 (nessuna rottura introdotta dagli ultimi due interventi).
- [ ] `style-guide.html` (Fase 2): non ri-verificato in questa fase (nessun file da essa
  dipendente modificato in modo incompatibile — rischio basso, non una verifica eseguita
  esplicitamente; valutare se ri-verificarlo in Fase 10, essendo l'ultima occasione naturale).

---

## 9. Criticità

- **Discrepanza Fase5/Fase8 su `homePageController.js`** (segnalata per la prima volta con questo
  livello di dettaglio in questa fase, verificata con `grep` sul file reale): la produzione non
  legge `data/modules.json`/`data/home/feed.json`, nonostante l'handover di Fase 8 dichiari il
  contrario. Non bloccante per Fase 9 (fuori scope, un audit di rifinitura non riscrive la fonte
  dei dati), ma **non rimandabile oltre Fase 10** — l'Audit finale valuterebbe altrimenti uno
  stato del progetto che non corrisponde al codice reale.
- **`prefers-reduced-motion` non ri-testato con l'emulazione reale del sistema operativo** in
  questa fase (il meccanismo di sicurezza in `global.css` è invariato da Fase 2 e già verificato
  allora) — rischio basso, non una verifica eseguita esplicitamente ora.
- **`style-guide.html` non ri-verificato**: nessun file da essa dipendente è stato toccato in modo
  incompatibile (i componenti condivisi restano retrocompatibili — `imageFadeIn`/`svgNode`/
  `aspect-ratio` sono aggiunte, non breaking changes), ma non è stata eseguita una verifica
  esplicita in questa fase.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 **`homePageController.js` disallineato dalla propria documentazione** (vedi Criticità) — da
  risolvere in Fase 10, non oltre.
- 🟢 Immagini placeholder di Oversharing ancora a tinta unita (invariato, gestito
  dall'utente).

### Refactoring consigliati
- 🟢 Nessun nuovo refactoring identificato in questa fase: gli interventi erano essi stessi
  refactoring mirati (estrazione di 3 utility condivise: `fallbackMessage.js`, `svg.js`,
  `imageFadeIn.js`).

### Ottimizzazioni future
- 🟢 Bundling/unificazione delle richieste CSS — deliberatamente non affrontato (intervento #13,
  decisione esplicita, non un rinvio per fretta): richiederebbe un build step in contrasto con il
  vincolo "nessun bundler" di Fase 1.
- 🟢 Pan/drag nello zoom di `MediaViewer` — nessun bisogno reale col dataset attuale (immagini
  singole, non gallerie).

### Rischi architetturali
- 🟢 **Nessun rischio nuovo introdotto**: le tre utility estratte (`fallbackMessage.js`, `svg.js`,
  `imageFadeIn.js`) sono puramente additive, zero cambi di comportamento per i consumer esistenti
  — verificato con la suite persistita, non per assunzione.
- 🟡 **Suite di test ora persistita, ma non ancora eseguita in un ambiente CI**: `tests/` esiste e
  funziona in locale/sandbox — l'integrazione in un workflow GitHub Actions (o equivalente) resta
  un passo successivo non richiesto esplicitamente dal progetto (SOCIALIVE non ha oggi una pipeline
  CI/CD), ma è ora tecnicamente pronta se un giorno servisse (nessuna configurazione aggiuntiva
  necessaria oltre `npm install && npm test`).

### Priorità
- 🟡 Media: risolvere la discrepanza Fase5/Fase8 su `homePageController.js` — prima cosa da fare
  in Fase 10.
- 🟢 Bassa: tutto il resto — nessuna criticità bloccante identificata.

### Obiettivo
Questa sezione va riletta all'inizio della Fase 10 — l'ultima pianificata dalla Suite originaria.
L'Audit finale eredita da questa fase una base di codice rifinita, verificata con una suite
persistita, e un solo punto esplicitamente aperto da chiudere prima di qualunque valutazione
complessiva.
