# SOCIALIVE — Handover di fine Fase 8 (Dati)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Data logica di chiusura fase:** fine Fase 8 (Prompt #8 della Suite — "Dati").
**Tag di riferimento suggerito:** `v0.8.0-fase8-dati`

---

## 1. Stato del progetto

- Fasi 1–7: ✅ complete (vedi handover dedicati).
- **Fase 8 — Dati: ✅ COMPLETATA.** Obiettivo del Prompt #8 ("Spostare tutti i contenuti nei
  JSON. Separare completamente dati e logica") raggiunto chiudendo l'ultimo punto rimasto
  segnalato come "decisione sospesa" per 4 fasi consecutive (Fase 4 → Fase 7): il feed demo della
  Home era ancora hardcoded in `homePageController.js`. Durante l'audit è emerso un secondo punto
  non ancora esplicitamente segnalato in nessun handover precedente: l'elenco dei 6 moduli/
  categorie e la mappa moduleId→scenarioId, anch'essi letterali nello stesso file.
- **Scoperta di processo rilevante** (dettagliata in §9): `data/modules.json` e
  `data/home/feed.json` risultavano già presenti tra i file del progetto fin dall'inizio di
  questa fase — con un contenuto identico, carattere per carattere, a quello progettato da zero
  in questa sessione. Erano quindi "dati a riposo": esistevano ma nessun codice li leggeva ancora
  (nessuna riga in `homePageController.js` li importava). Questa fase li ha resi realmente
  "vivi" collegandoli tramite `localJsonRepository.js`. Nessun impatto sul contenuto consegnato,
  ma una dichiarazione iniziale errata ("nuovo" invece di "già esistente") è stata corretta nella
  stessa conversazione — vedi §9 per l'analisi completa.
- **26 controlli automatizzati Playwright** eseguiti (21 sul flusso funzionale completo + 5 su un
  caso limite di race condition dedicato), tutti verdi eccetto un rumore di fondo noto e non
  imputabile a questa fase (18 errori 404 sulle immagini reali di Oversharing, assenti
  nell'ambiente di test ricostruito ad-hoc per questa sessione — non nel progetto reale, dove
  l'utente le sta gestendo separatamente). 3 screenshot ispezionati (Light/Dark/375px).
- **Nessuna riga di Fase 9 (Rifinitura UX) o Fase 10 (Audit finale)** è stata scritta.

---

## 2. Obiettivi completati

Solo funzionalità realmente implementate e verificate.

### Schema dati progettato e motivato prima del codice
- **`data/home/feed.json`**: array di post nella stessa identica forma già consumata da
  `Feed`/`PostCard` (`id, author, timestamp, content, image?, stats, liked`) — **nessuna
  trasformazione** necessaria nel controller, a differenza di `posts.json` di Oversharing (dove
  un solo profilo è autore di tutti i post e serve una funzione `toFeedPost`): qui ogni post ha
  un autore diverso, quindi l'autore va salvato inline in ogni record. Differenza voluta, non
  un'incoerenza.
- **`data/modules.json`**: aggiunto il campo opzionale `scenarioId` direttamente nel record del
  modulo (presente solo dove `available: true`) — sostituisce la mappa `MODULE_TO_SCENARIO` che
  viveva separata nel controller da Fase 5. Un'unica fonte di verità, non due file/strutture da
  tenere sincronizzati.

### Semplificazioni applicate durante la progettazione (non solo esternalizzazione 1:1)
- **Eliminato `solidCircleAvatar()`** (generatore di avatar SVG colorati inline in JS, usato per
  2 dei 3 autori demo): il terzo autore (Laura Ferretti) non aveva mai avuto un `avatarSrc` e si
  affidava già al fallback-iniziali di `Avatar.js` (verificato WCAG, 6.13:1, esistente da
  Fase 2). Continuare a generare avatar custom per 2 autori su 3 era duplicazione di un problema
  già risolto (DRY): ora **tutti e tre** gli autori demo omettono `avatarSrc` e usano lo stesso
  fallback, uniforme.
- **Estratta `MOUNTAIN_IMAGE`** (SVG generato inline in JS) in un asset reale,
  `assets/images/home/mountain-placeholder.svg`, referenziato per path in `feed.json` — coerente
  col principio di progetto "le immagini saranno archiviate nella cartella assets" e con il
  precedente già stabilito da Oversharing (Fase 6): mai markup generato in JS per contenuti
  visivi, sempre file reali in `assets/`.

### `homePageController.js` riscritto
- Rimossi: `MODULES`, `MODULE_TO_SCENARIO`, `buildDemoPosts()`, `solidCircleAvatar()`,
  `MOUNTAIN_IMAGE` — **zero contenuti letterali rimasti** in questo file.
- Aggiunta lettura via due istanze di `createLocalJsonRepository` (già esistente da Fase 3/5,
  nessuna nuova astrazione), create una sola volta a livello di modulo per condividere la cache
  interna per URL (stesso pattern già usato da `localAuthAdapter.js`).
- **Pattern asincrono** identico a quello già stabilito da `scenarioPageController.js` (Fase 5):
  il controller resta sincrono verso `router.js` (`(container, params) => destroy`, mai una
  Promise), costruisce subito lo scheletro (`appShell` + `PageContainer`) con un'area principale
  vuota e `aria-busy="true"`, e popola moduli+feed solo quando `Promise.all([...]).then(...)`
  risolve.
- **Guardia `destroyed`** contro la stessa race condition già risolta in Fase 5: se l'utente
  naviga altrove prima che il fetch risolva, il `.then()` non costruisce alcun componente — la
  guardia è stata verificata con un test Playwright dedicato (ritardo artificiale di 1.5s sulle
  due risposte JSON + navigazione immediata verso un'altra rotta protetta reale).
- Fallback di errore in caso di fetch fallito, stesso stile minimale già usato da
  `scenarioEngine.js`/`profileTimelineRenderer.js` (paragrafo con token CSS inline, nessun nuovo
  file CSS).

### Decisione presa e motivata, non eseguita
- **Sidebar (in `appShell.js`) NON esternalizzata**: le sue 3 voci sono a specchio 1:1 delle
  rotte realmente registrate in `index.html` — un `navigation.json` (previsto nel piano
  originario di Fase 1 §9) introdurrebbe un secondo posto da tenere sincronizzato con
  `router.registerRoute()`, senza eliminare l'accoppiamento reale al codice. Stesso principio
  già seguito per non creare `userRepository.js` (Fase 3 §4) e per non creare `feed.json` di
  Oversharing (Fase 6 §4): si esternalizza quando un secondo consumo reale lo richiede, non per
  simmetria con un piano originario ormai superato dai fatti.

### Verifica (Playwright, Chromium headless, server locale — mai `file://`)
- **21 controlli** sul flusso funzionale completo attraverso il vero `index.html`: bootstrap →
  login → Home (6 `ModuleCard` da `modules.json`, ordine e stato `available` corretti; 3 post da
  `feed.json`, autori corretti, immagine del primo post dal nuovo asset esterno, fallback
  iniziali su tutti gli avatar, nessun `<img>` custom) → like ottimistico → click su Cybersecurity
  → profilo Oversharing → ritorno alla Home via Sidebar (remount pulito, nessun componente
  duplicato) → logout. Console priva di errori JS (18 errori 404 sulle immagini di Oversharing
  esclusi dalla verifica, noti e non pertinenti a questa fase).
- **5 controlli dedicati** al caso limite di race condition: risposte di `modules.json`/
  `feed.json` ritardate artificialmente (1.5s) via intercettazione di rete, navigazione immediata
  verso `#/scenario/oversharing` prima della risoluzione, verifica che la risoluzione tardiva non
  produca errori né componenti orfani (nessun `ModuleCard` residuo, un solo `AppHeader`).
- 3 screenshot ispezionati (desktop Light, desktop Dark, mobile 375px): fallback iniziali (MB /
  GC / LF) coerente nei due temi, nessuna anomalia di layout.

---

## 3. Architettura attuale

```
socialive/
├── index.html                              # INVARIATO — nessun nuovo CSS/JS da collegare
├── data/
│   ├── users.json · roles.json             (Fase 3, invariati)
│   ├── modules.json                        # ♻️ GIÀ ESISTENTE — ora realmente consumato
│   │                                          (prima "a riposo": nessun codice lo leggeva)
│   ├── home/
│   │   └── feed.json                       # ♻️ GIÀ ESISTENTE — idem
│   └── scenarios/oversharing/...           (Fase 6, invariati)
│
├── assets/
│   ├── posts/oversharing/...               (Fase 6, invariati — immagini reali gestite
│   │                                          separatamente dall'utente)
│   └── images/
│       └── home/
│           └── mountain-placeholder.svg    # ⭐ NUOVO
│
├── css/                                     (Fase 2–7, TUTTO invariato — nessun file toccato)
│
└── js/
    ├── core/router.js                       (Fase 5, INVARIATO)
    ├── pages/
    │   ├── loginPageController.js          (Fase 3, INVARIATO)
    │   ├── homePageController.js           # ♻️ MODIFICATO — consuma i due JSON, pattern
    │   │                                      asincrono, zero contenuti letterali residui
    │   ├── scenarioPageController.js       (Fase 5, INVARIATO)
    │   └── shared/appShell.js              (Fase 5, INVARIATO — Sidebar non esternalizzata,
    │                                          vedi §4)
    ├── repositories/localJsonRepository.js (INVARIATO — riusato as-is, zero nuove astrazioni)
    ├── scenarios/ · adapters/ · services/ · utils/   (invariati)
    └── components/                          (Fase 2–7, TUTTO invariato — nessun componente
                                                toccato: `Avatar.js` già copriva il fallback
                                                iniziali necessario, nessuna estensione richiesta)
```

**Nessuna modifica** a `router.js`, `appShell.js`, `scenarioPageController.js`,
`loginPageController.js`, `authService.js`, `scenarioEngine.js`, `profileTimelineRenderer.js`, né
a nessun file CSS o componente — riusati esattamente come sono.

---

## 4. Decisioni progettuali

Vedi anche §2 per il dettaglio di ciascuna. In sintesi:

| Decisione | Motivazione sintetica |
|---|---|
| `feed.json`: post con autore inline, zero trasformazione | Ogni post ha un autore diverso (a differenza di Oversharing) — non c'è nulla da fattorizzare |
| `modules.json`: `scenarioId` nel record, non mappa separata | Unica fonte di verità; `ModuleCard` continua a ricevere solo `{moduleId,title,available}` |
| Eliminato `solidCircleAvatar()` | Duplicava un fallback già esistente e verificato in `Avatar.js` (DRY) |
| `MOUNTAIN_IMAGE` → asset reale in `assets/` | Coerenza con il principio di progetto e col precedente di Oversharing (Fase 6) |
| Pattern asincrono in `homePageController.js` | Identico a `scenarioPageController.js` (Fase 5) — stessa interfaccia sincrona richiesta da `router.js`, stessa guardia `destroyed` |
| Repository creati una sola volta a livello di modulo | Cache condivisa per URL, stesso pattern già usato da `localAuthAdapter.js` |
| Sidebar **non** esternalizzata | Specchio 1:1 delle rotte in `index.html`; nessun secondo consumo reale che giustifichi `navigation.json` oggi |

---

## 5. Attività rimanenti

In ordine di roadmap (Prompt #9 → #10 della Suite):

1. **Fase 9 — Rifinitura UX** (prossima, vedi §6): animazioni, performance, responsive,
   accessibilità, coerenza visiva del Design System — audit trasversale, non nuove funzionalità.
2. **Fase 10 — Audit finale**.
3. **Immagini reali di Oversharing** (Fase 6, non bloccante per il codice): gestite
   autonomamente dall'utente, stessi percorsi, zero modifiche di codice previste.
4. **Suite di test Playwright non ancora persistita nel repository** — segnalata ricorrente da
   Fase 2, ora dopo 7 fasi di script accumulati e mai salvati come parte del repo. Priorità in
   aumento costante (vedi §10).
5. **`navigation.json` per la Sidebar** — non pianificato, da riconsiderare solo se un secondo
   consumo reale (es. una vera pagina `#/modules`, filtri per ruolo) lo richiederà.

---

## 6. Prossima fase

**Fase 9 — Rifinitura UX** (Prompt #9 della Suite originaria).

**Punto di ripartenza esatto**: tutta la Home è ora data-driven, il Design System è stabile e
invariato da 8 fasi, ogni pagina reale (`#/login`, `#/home`, `#/scenario/:scenarioId`) è stata
verificata end-to-end. Fase 9 NON introduce funzionalità nuove: è un audit trasversale su
animazioni, performance, responsive, accessibilità e consistenza visiva, applicato a TUTTE le
pagine reali esistenti (non solo `style-guide.html`, che resta comunque un riferimento valido per
i token). Prima azione richiesta: produrre un elenco di interventi concreti con priorità
(motivandoli, non un elenco generico) PRIMA di scrivere qualunque modifica — coerente col metodo
di lavoro seguito in tutte le fasi precedenti.

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
in Fase 8 due file [data/modules.json, data/home/feed.json] erano già presenti nel contesto fin
dall'inizio della conversazione e sono stati inizialmente dichiarati per errore come "nuovi": il
contenuto generato coincideva comunque, ma la dichiarazione andava corretta) e (b) il percorso
esatto nella struttura del progetto, con tabella riassuntiva dopo ogni consegna.

CONVENZIONE OBBLIGATORIA DI FINE FASE: l'handover va SEMPRE prodotto come file .md separato, e a
fine fase va consegnata una cartella .zip con TUTTI i file prodotti/modificati in quella fase
(compreso l'handover stesso).

LEZIONE DI PROCESSO (Fase 6, confermata rilevante anche in Fase 8): prima di dichiarare un file
"nuovo", verificare SEMPRE l'intero elenco dei file di progetto già disponibili nel contesto — non
assumerlo dalla propria memoria del lavoro pianificato. Vale sia per index.html (Fase 6: <link>
mai collegati) sia per singoli file dati (Fase 8: modules.json/feed.json già presenti).

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework/libreria UI.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main. Non hai credenziali per pushare: prepara i file, l'utente li applica
lui stesso.

NOTE TECNICHE DI AMBIENTE: niente `pkill -f "<pattern con la porta>"`; server+test Playwright
nella STESSA chiamata bash (i processi in background non sopravvivono tra chiamate separate); usa
una porta nuova ad ogni test; Playwright con Chromium disponibile sia in Python che in Node in
questo ambiente (verificato in Fase 8: `pip show playwright` + browser in /opt/pw-browsers). Il
mount di sola lettura dei file di progetto è FLAT (non rispecchia la vera struttura a cartelle):
per un test end-to-end reale va ricostruita manualmente la struttura (css/, js/, data/, assets/)
in una cartella scrivibile prima di avviare un server locale — fatto così in Fase 8, da ripetere
allo stesso modo.

STATO: Fasi 1–8 COMPLETE. Fase 8 ha prodotto/modificato: js/pages/homePageController.js
(MODIFICATO — consuma data/modules.json e data/home/feed.json tramite localJsonRepository.js
esistente, pattern asincrono identico a scenarioPageController.js, guardia "destroyed" contro la
race condition), assets/images/home/mountain-placeholder.svg (NUOVO — estratto da un SVG
generato inline in JS). data/modules.json e data/home/feed.json erano GIÀ ESISTENTI nel progetto
(non modificati). Eliminato il generatore di avatar colorati custom (solidCircleAvatar) in favore
del fallback iniziali già esistente in Avatar.js. Sidebar (appShell.js) NON esternalizzata,
decisione motivata (specchio 1:1 delle rotte registrate in index.html, nessun secondo consumo
reale). 26 controlli Playwright eseguiti (21 flusso completo + 5 race condition), tutti verdi
eccetto 18 errori 404 sulle immagini reali di Oversharing (assenti solo nell'ambiente di test
ricostruito per la verifica, non nel progetto reale). 3 screenshot ispezionati. Il documento di
handover completo (10 sezioni, questo stesso file) è la fonte di verità primaria: non ripartire
da assunzioni.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" (NON "Prof. Anna Ferrari", nome scartato in una fase precedente).

IMMAGINI OVERSHARING: l'utente le gestisce autonomamente (foto reali pronte, da sostituire ai
placeholder a tinta unita negli stessi percorsi in assets/posts/oversharing/) — non generare
nuovi placeholder, non serve alcuna verifica di codice per questo passaggio.

DA FARE ORA (Fase 9 — Rifinitura UX, Prompt #9 della Suite):
1. Eseguire un audit trasversale (motivato, non un elenco generico) su animazioni, performance,
   responsive, accessibilità e coerenza visiva — su TUTTE le pagine reali esistenti (#/login,
   #/home, #/scenario/oversharing), non solo su style-guide.html.
2. Proporre un elenco di interventi concreti con priorità, PRIMA di scrivere qualunque codice.
3. Valutare se questo è il momento di persistere la suite di test Playwright nel repository
   (tests/) — debito tecnico segnalato ricorrente da 7 fasi, ora ancora più urgente.

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container,params)→destroy per i page
controller; eventi "sl:nome-evento"; componenti "dumb"; documentazione in italiano; test
Playwright + screenshot reali + regressione ad ogni step, verificati anche attraverso l'index.html
reale; handover completo a 10 sezioni + zip di tutti i file della fase a fine fase.

Procedi con l'audit di Fase 9, motivando le priorità prima di scrivere codice.
```

---

## 8. Test da eseguire

### Test funzionali
- [x] `data/modules.json` letto correttamente via `createLocalJsonRepository` — 6 `ModuleCard`,
  ordine e stato `available` corretti.
- [x] `data/home/feed.json` letto correttamente — 3 post, autori/contenuti/stats corretti, forma
  già compatibile con `Feed`/`PostCard` senza trasformazione.
- [x] Immagine del post-1 servita da `assets/images/home/mountain-placeholder.svg` (non più SVG
  generato in JS).
- [x] Fallback iniziali su tutti e 3 gli avatar del feed Home (nessun `<img>` custom generato).
- [x] `sl:module-open` su Cybersecurity → naviga a `#/scenario/oversharing` (mappa `scenarioId`
  letta da `modules.json`, non da una struttura separata).
- [x] `sl:post-like` ottimistico sul feed Home.
- [x] `aria-busy` presente durante il caricamento, rimosso al termine (successo o errore).
- [x] Race condition: navigazione rapida via da `#/home` con fetch ritardato → nessun errore,
  nessun componente orfano.
- [ ] Fallback di errore (`buildErrorMessage`) su fetch effettivamente fallito — verificato solo
  per costruzione logica (stesso pattern già testato altrove), non con un test dedicato che
  forza un 404 reale su `modules.json`/`feed.json` in questa fase.

### Test UI
- [x] Light/Dark/375px sulla Home aggiornata — 3 screenshot ispezionati, nessuna anomalia.
- [x] Layout moduli+feed identico visivamente al precedente (a parte gli avatar, ora a iniziali).
- [ ] Breakpoint intermedi (768–1024px) — non verificati in questa fase (rischio basso, nessuna
  modifica di layout introdotta).

### Test UX
- [x] Nessun layout shift percepibile tra stato di caricamento (area vuota, `aria-busy`) e
  contenuto popolato — il fetch locale è troppo rapido per essere osservato a occhio, ma
  verificato non produrre comunque salti di layout nei test.
- [ ] Percezione di attesa con una connessione realmente lenta (throttling) — testato solo il
  caso limite architetturale (race condition), non la percezione UX di un caricamento visibile.

### Test tecnici
- [x] `node --check` su `homePageController.js`.
- [x] JSON validati sintatticamente (`data/modules.json`, `data/home/feed.json` — invarianti,
  comunque riverificati).
- [x] SVG validato come XML ben formato (`mountain-placeholder.svg`).
- [x] Console priva di errori JS sul flusso reale completo (404 sulle immagini Oversharing escluse
  dalla verifica, note e non pertinenti).
- [x] Nessun path relativo rotto — nessuna modifica a `index.html` necessaria in questa fase.

### Test di regressione
- [x] Flusso di autenticazione (Fase 3): bootstrap, login, logout — confermato integralmente.
- [x] Collegamento Home→Cybersecurity→profilo Oversharing (Fase 5/6): confermato invariato.
- [x] Remount Home dopo navigazione di ritorno: 6 `ModuleCard` (non 12), 3 post (non 6) — nessuna
  duplicazione.
- [ ] `style-guide.html` (Fase 2): non ri-verificato in questa fase (nessun componente toccato,
  solo il page controller della Home reale — rischio basso, non una verifica eseguita
  esplicitamente).

---

## 9. Criticità

- **Errore di processo, corretto in questa stessa conversazione**: `data/modules.json` e
  `data/home/feed.json` sono stati inizialmente dichiarati "⭐ NUOVO" in questa sessione, quando
  in realtà erano già presenti tra i file di progetto fin dall'inizio della conversazione — non
  controllati prima di procedere a "crearli". Il contenuto generato indipendentemente coincideva
  esattamente (nessun impatto sul risultato consegnato), ma la dichiarazione di stato era
  scorretta — esattamente la stessa classe di errore già documentata come "nota" nella regola
  standing del progetto (il precedente con `PageContainer.js`/`page-container.css`). Corretto non
  appena rilevato, con confronto esplicito del contenuto. **Raccomandazione per le fasi future**:
  prima di dichiarare un file "nuovo", scorrere l'intero elenco dei file di progetto disponibili
  nel contesto, non fare affidamento sulla propria pianificazione del lavoro previsto.
- **Ambiente di test ricostruito manualmente ad ogni fase**: il mount di sola lettura dei file di
  progetto è flat (non rispecchia `css/`, `js/`, `data/`, `assets/` come cartelle reali) — ogni
  sessione di verifica deve ricostruire la struttura a mano prima di poter servire un
  `index.html` funzionante. In questa fase la ricostruzione ha (correttamente) escluso le
  immagini binarie di Oversharing (non presenti nel mount, gestite dall'utente), producendo 18
  errori 404 attesi e distinguibili — ma il processo di ricostruzione stesso è un punto in cui un
  errore umano (path sbagliato, file dimenticato) potrebbe introdurre falsi negativi/positivi nei
  test futuri. Da tenere presente, non necessariamente da risolvere (non è un problema del
  progetto stesso, ma dell'ambiente di verifica).
- **Suite di test Playwright ancora non persistita nel repository** — segnalata ricorrente da
  Fase 2, ora dopo 7 fasi di script accumulati (26 controlli aggiuntivi in questa sola fase) mai
  salvati come parte del repo.
- **Fallback di errore di `homePageController.js` non testato con un guasto reale** (solo per
  costruzione logica) — rischio basso, stesso pattern già verificato altrove nel progetto.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessun nuovo compromesso introdotto in questa fase. I compromessi già noti (immagini
  Oversharing gestite dall'utente, Sidebar non esternalizzata) sono decisioni esplicite e
  motivate, non scorciatoie.

### Refactoring consigliati
- 🟡 **Formalizzare i test Playwright come suite persistita nel repo** (`tests/`) — raccomandazione
  ripetuta da Fase 2, ora con 26 controlli aggiuntivi accumulati nella sola Fase 8 (7 fasi
  totali di script mai salvati). Priorità in aumento costante, prossima fase (Fase 9) è
  l'occasione naturale per affrontarla prima che il volume diventi ingestibile.

### Ottimizzazioni future
- 🟢 Nessun indicatore di caricamento visibile durante il fetch della Home (solo `aria-busy`,
  stesso principio già scelto da `scenarioEngine.js`): da rivalutare solo se una connessione
  reale più lenta rendesse la latenza percepibile — oggi il fetch locale è quasi istantaneo.
- 🟢 `data/modules.json`/`data/home/feed.json`: nessun campo `icon`/`category` (previsti nel
  piano originario di Fase 1 §9) — omessi deliberatamente per YAGNI, nessun consumer reale oggi
  (sprite icone ancora assente).

### Rischi architetturali
- 🟢 Nessun rischio nuovo di rilievo: il pattern asincrono di `homePageController.js` replica
  esattamente quello già validato da `scenarioPageController.js` in Fase 5 — secondo caso reale
  che conferma la solidità dell'approccio "controller sincrono verso il router, fetch interno
  asincrono con guardia `destroyed`", non una nuova soluzione da verificare da zero.
- 🟢 Nessun impatto sulla futura migrazione Supabase: `localJsonRepository.js` resta invariato,
  entrambi i nuovi consumer (`modules.json`, `feed.json`) passano dalla stessa interfaccia
  `list()/get()` già pronta per un domani `supabaseRepository` (Fase 1 §11).

### Priorità
- 🟡 Media: persistere la suite di test Playwright (`tests/`) — ormai ricorrente da 7 fasi, con
  volume di controlli in costante crescita (26 nella sola Fase 8).
- 🟢 Bassa: tutto il resto — nessuna criticità bloccante identificata per Fase 9.

### Obiettivo
Questa sezione va riletta all'inizio della Fase 9, prima di introdurre nuove funzionalità, per
mantenere SOCIALIVE pulito, modulare, scalabile e facilmente manutenibile — come da regola
fondamentale di progetto. In particolare, prima di Fase 9 vale la pena decidere esplicitamente
se questa è la fase in cui affrontare la persistenza della suite di test: il volume accumulato
(7 fasi) rende il rischio di regressioni non rilevate sempre più concreto ad ogni nuova modifica.
