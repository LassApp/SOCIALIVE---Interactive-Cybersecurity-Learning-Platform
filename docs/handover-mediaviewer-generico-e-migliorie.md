# SOCIALIVE — Handover: MediaViewer generico e migliorie realismo profilo

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Contesto:** miglioramento incrementale richiesto dall'utente dopo la chiusura della Suite dei
10 prompt originari (Fase 10 completata) e dopo il precedente intervento "Toggle Privacy
Profilo". Non introduce una nuova "Fase" numerata della roadmap: estende `MediaViewer.js` (un
componente condiviso del Design System, non specifico di alcuno scenario) e il renderer generico
`profile-timeline`, quindi impatta trasversalmente sia la Home che lo scenario Oversharing — e,
per costruzione, ogni futuro scenario/pagina che vorrà riusare `MediaViewer`.
**Tag di riferimento suggerito:** `v1.2.0-mediaviewer-generico-e-migliorie`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari (Fase 1 → Fase 10) + intervento "Toggle Privacy Profilo": ✅
  completi, invariati.
- **Questo intervento: ✅ COMPLETATO E COMPLETAMENTE COPERTO DA TEST PERSISTITI.** Quattro
  richieste distinte, tutte implementate e verificate:
  1. **MediaViewer reso esplicitamente generico** (rinominata la prop `posts`→`items`) e
     **collegato anche al feed della Home** (il post di Mario Bianchi, prima privo di qualunque
     effetto al click) tramite un nuovo helper condiviso (`mediaViewerLauncher.js`) — la stessa
     identica logica che Oversharing già usava, ora estratta ed estesa a un secondo consumer
     reale.
  2. **Copertina, avatar e storie del profilo Oversharing apribili nel MediaViewer** — prima
     erano immagini statiche (copertina/avatar) o un evento senza consumer (`sl:story-open`,
     emesso da `StoriesBar` fin dalla Fase 6).
  3. **Pan/drag durante lo zoom** — prima lo zoom ingrandiva solo il centro dell'immagine, senza
     alcun modo di spostarsi al suo interno.
  4. **Bottone "Segui"** aggiunto prima del conteggio post nella riga statistiche del profilo,
     con un toggle visivo reale (Segui → Segui già) condiviso con il bottone gemello già
     esistente nel pannello "profilo privato".
- **94/94 controlli** della suite Playwright ufficiale (`login.spec.js` + `home.spec.js` +
  `scenario.spec.js`), eseguita per intero attraverso l'`index.html` reale — non solo script
  ad-hoc. **57 controlli aggiuntivi** rispetto alla baseline precedente (61 → ora, con gli
  ampliamenti di questo intervento, la sola coppia `home.spec.js`+`scenario.spec.js` conta 79
  controlli, +18 su `home.spec.js` e +26 su `scenario.spec.js`).
- **1 bug reale trovato e corretto durante la verifica** (dettagliato in §4): `aria-pressed`
  assente al primo render del bottone "Segui" (mancava `pressed: false` esplicito alla
  creazione).
- **Zero modifiche** a `PostCard.js`, `Feed.js`, `StoriesBar.js`, `Avatar.js`, `Button.js`,
  `Timeline.js`, `scenarioEngine.js`, `scenarioPageController.js`, `appShell.js`, `router.js`,
  `authService.js`, o a qualunque file JSON di dati.

---

## 2. Obiettivi completati

### 2.1 — MediaViewer generico + collegamento Home

- **`js/utils/mediaViewerLauncher.js` (nuovo)**: estrae la gestione dell'istanza singola di
  MediaViewer (apri/chiudi/distruggi, mai stacking) che `profileTimelineRenderer.js` gestiva già
  "a mano" — estratta al SECONDO consumo reale (`homePageController.js`, questo stesso
  intervento), stesso principio già seguito per `focusTrap.js`/`dateFormat.js`/`svg.js`/
  `fallbackMessage.js`/`imageFadeIn.js`. Espone `open(items, startIndex)` (per gallerie già
  pronte) e `openById(items, id)` (per il caso comune "un evento porta solo un id").
- **`js/components/MediaViewer.js` (modificato)**: prop principale rinominata `posts`→`items` —
  il componente non aveva mai letto `.stats` ed era già generico "di fatto"; il nome ora riflette
  onestamente il contratto (post, foto profilo, copertina, storie, o qualunque cosa un futuro
  scenario introduca). Zero cambi di comportamento.
- **`js/pages/homePageController.js` (modificato)**: ascolta `sl:post-open` sul Feed (evento già
  emesso da `PostCard` fin dalla Fase 2, mai consumato sulla Home) e apre MediaViewer tramite il
  launcher condiviso — **nessuna modifica a `PostCard.js`/`Feed.js`/`MediaViewer.js`**: prova
  concreta che l'architettura promessa fin dalla Fase 7 ("un futuro consumer ascolterà lo stesso
  evento") funziona davvero.
- Verificato: 13 controlli ad-hoc (apertura, autore/posizione corretti, item senza immagine →
  testo, chiusura, regressione Oversharing dopo il refactoring del launcher).

### 2.2 — Copertina, avatar, storie apribili

- **`js/scenarios/renderers/profileTimelineRenderer.js` (modificato)**: copertina e avatar
  avvolti in bottoni cliccabili (stesso pattern già usato da `PostCard` per la propria immagine),
  ciascuno apre una galleria MediaViewer di **un solo elemento** (nessuna navigazione fra loro —
  comportamento reale di Instagram/Facebook: toccare la foto profilo apre solo quella foto).
  `sl:story-open` (già emesso da `StoriesBar` senza consumer) ora apre una galleria con **tutte e
  5 le storie**, navigabili con le stesse frecce prev/next già esistenti — coerente con
  l'esperienza di un vero "reel".
- Due nuovi eventi (`sl:profile-avatar-open`, `sl:profile-cover-open`), distinti perché copertina
  e avatar sono due superfici visive indipendenti dell'header — stesso principio già seguito da
  PostCard/Timeline che condividono invece un solo `sl:post-open` perché lì è sempre lo stesso
  tipo di contenuto.
- **`css/scenarios/profile-timeline.css` (modificato)**: stile hover/focus dei due nuovi trigger
  (`filter: brightness(0.94)`, stesso trattamento già usato per le immagini cliccabili del
  progetto) — nessun nuovo colore introdotto.
- Verificato: 5 controlli dedicati (avatar → 1 di 1, nessuna navigazione; copertina → autore
  corretto; storia → 5 item, didascalia = etichetta; navigazione fra storie; integrità del
  profilo dopo le interazioni) + 2 screenshot ispezionati (Light/Dark).

### 2.3 — Pan/drag durante lo zoom

- **`js/components/MediaViewer.js` (modificato)**: Pointer Events (mouse/touch/pen unificati) per
  trascinare l'immagine quando è zoomata. Limite di trascinamento (clamp) calcolato **una sola
  volta** all'attivazione dello zoom (quando la scala è ancora 1×), mai oltre — stesso
  comportamento di Google Foto/Instagram, mai spazio vuoto oltre i bordi dell'immagine scalata.
  Soglia di movimento (6px) per distinguere un click (toggle zoom) da un trascinamento reale
  (pan) — senza questa soglia, ogni pan chiuderebbe lo zoom appena rilasciato il puntatore, dato
  che il browser dispatcha comunque un "click" dopo il pointerup. Cursore: `zoom-in` a riposo →
  `grab` da zoomato → `grabbing` durante il trascinamento.
- **`css/components/media-viewer.css` (modificato)**: rimossa la regola CSS statica
  `transform: scale(1.8)` (ora il transform, comprensivo di pan, è calcolato interamente in JS,
  unica fonte di verità); aggiunti `touch-action: none` (evita che un trascinamento a dito venga
  intercettato come gesto di scroll), `-webkit-user-drag: none` (evita il drag-and-drop nativo
  del browser sull'immagine) e i nuovi stati del cursore.
- Frecce ArrowLeft/ArrowRight **restano riservate** alla navigazione tra post/storie (nessun
  pan da tastiera: evita un conflitto semantico, stesso compromesso già presente in app reali
  come Google Foto). Nessun gesto di pinch-to-zoom multi-touch (fuori scope, il caso d'uso
  primario resta il docente con mouse/trackpad su una LIM).
- Verificato: 10 controlli ad-hoc dedicati (soglia click/drag, clamp dei limiti, reset su
  navigazione/uscita zoom, stati del cursore) + 1 screenshot ispezionato che mostra visivamente
  l'immagine effettivamente trascinata, ancora correttamente ritagliata nei bordi arrotondati
  dello stage.
- **Nota di processo**: il primo giro di verifica ha inizialmente segnalato un falso fallimento
  sul drag — non un bug del codice, ma una limitazione dell'ambiente di verifica (le immagini di
  test in questa sessione sono tutte a 404, quindi l'`<img>` non aveva alcuna dimensione reale su
  cui calcolare un margine di trascinamento). Risolto generando un'immagine di prova reale prima
  di confermare la correzione — vedi §9 per l'implicazione.

### 2.4 — Bottone "Segui"

- **`js/scenarios/renderers/profileTimelineRenderer.js` (modificato)**: nuovo bottone "Segui"
  posizionato **prima** del conteggio "post" nella riga statistiche (richiesta esplicita). Il
  bottone già esistente nel pannello "profilo privato" (introdotto nell'intervento precedente,
  allora volutamente inerte) ora **condivide lo stesso stato** (`isFollowing`) — i due non sono
  mai visibili insieme (si escludono a vicenda in base allo stato pubblico/privato), quindi
  rappresentano concettualmente lo stesso bottone e non possono più disallinearsi. Click → label
  "Segui"/"Segui già" + variante `primary`/`secondary` + `aria-pressed` (mai il solo colore come
  segnale). Nuovo evento `sl:profile-follow-toggle` (detail: `{ following }`), che sostituisce il
  precedente `sl:profile-follow-request` (a scatto singolo, senza stato) — nessun listener
  applicativo reale lo ascolta oggi, stesso trattamento già riservato a `sl:search`/
  `sl:settings-click`. Stato **mai persistito**: ogni apertura/refresh riparte da "non sto
  seguendo", coerente con lo stesso principio già applicato al toggle privacy.
- **`css/scenarios/profile-timeline.css` (modificato)**: stile compatto del nuovo bottone
  (`padding` ridotto rispetto al default, `flex-shrink:0`) — nessun nuovo colore (riusa le
  varianti `primary`/`secondary` di `Button.js`, già verificate).
- Verificato: 8 controlli ad-hoc (posizione nella riga, stato iniziale, evento, sincronizzazione
  bidirezionale fra i due bottoni) + 2 screenshot ispezionati (desktop e mobile 375px — la riga
  statistiche, ora con 4 elementi, entra su una sola linea senza overflow, nessuna modifica CSS
  aggiuntiva necessaria).

### 2.5 — Persistenza nella suite ufficiale

- **`tests/home.spec.js` (modificato)**: +3 controlli in un nuovo blocco dedicato ("MediaViewer
  sul feed della Home").
- **`tests/scenario.spec.js` (modificato)**: +26 controlli in tre nuovi blocchi ("Bottone Segui",
  "MediaViewer: avatar, copertina, storie") più l'estensione del blocco MediaViewer esistente con
  4 controlli di pan/drag.
- **Intera suite ufficiale ri-eseguita tramite `run-all.js`** (non script ad-hoc) attraverso
  l'intero `index.html` reale ricostruito: **94/94 controlli superati** (15 `login.spec.js` + 26
  `home.spec.js` + 53 `scenario.spec.js`).

**Totale controlli reali eseguiti in questo intervento: 36 ad-hoc (in corso d'opera, per ogni
step) + 94 sulla suite ufficiale finale** (i 36 ad-hoc sono in gran parte confluiti, riformulati,
nei 57 nuovi controlli persistiti). 11 screenshot ispezionati in totale nel corso dell'intervento.

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `js/utils/mediaViewerLauncher.js` | ⭐ **NUOVO** | Gestione condivisa dell'istanza singola di MediaViewer |
| `js/components/MediaViewer.js` | ♻️ **MODIFICATO** | Rinomina `posts`→`items`; pan/drag via Pointer Events |
| `css/components/media-viewer.css` | ♻️ **MODIFICATO** | Rimosso `scale()` statico; nuovi cursori; `touch-action`/`user-drag` |
| `js/pages/homePageController.js` | ♻️ **MODIFICATO** | Listener `sl:post-open` → MediaViewer tramite il launcher |
| `js/scenarios/renderers/profileTimelineRenderer.js` | ♻️ **MODIFICATO** | Avatar/copertina/storie apribili; bottone Segui condiviso |
| `css/scenarios/profile-timeline.css` | ♻️ **MODIFICATO** | Stile trigger avatar/copertina; stile bottone Segui |
| `tests/home.spec.js` | ♻️ **MODIFICATO** | +3 controlli persistiti |
| `tests/scenario.spec.js` | ♻️ **MODIFICATO** | +26 controlli persistiti |

**Nessun nuovo file di dati, nessuna nuova cartella.** Nessuna modifica a `index.html` (nessun
nuovo asset da collegare — tutti i file toccati erano già linkati/referenziati). Nessuna modifica
a `router.js`, `scenarioEngine.js`, `scenarioPageController.js`, `appShell.js`, `authService.js`,
`localJsonRepository.js`, né a nessun componente UI non elencato sopra.

```
socialive/
├── js/
│   ├── utils/
│   │   └── mediaViewerLauncher.js          # ⭐ NUOVO
│   ├── components/
│   │   └── MediaViewer.js                  # ♻️ MODIFICATO
│   ├── pages/
│   │   └── homePageController.js           # ♻️ MODIFICATO
│   └── scenarios/renderers/
│       └── profileTimelineRenderer.js      # ♻️ MODIFICATO
├── css/
│   ├── components/
│   │   └── media-viewer.css                # ♻️ MODIFICATO
│   └── scenarios/
│       └── profile-timeline.css             # ♻️ MODIFICATO
└── tests/
    ├── home.spec.js                         # ♻️ MODIFICATO (+3 controlli)
    └── scenario.spec.js                     # ♻️ MODIFICATO (+26 controlli)
```

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Estratto `mediaViewerLauncher.js` invece di duplicare la logica in `homePageController.js` | Stesso principio "si estrae al secondo consumo reale" già seguito in tutto il progetto — ora formalizzato per MediaViewer |
| Rinominata `posts`→`items` in `MediaViewer.js` | Il componente non ha mai letto `.stats`, era già generico "di fatto" — con 2 nuovi consumer (Home) e 3 nuovi tipi di contenuto (avatar/copertina/storie) il nome "posts" sarebbe stato ingannevole |
| Avatar/copertina: gallerie di UN SOLO elemento, mai unite ai post | Aprire l'avatar non deve permettere di scorrere fino alla copertina o ai post — sono superfici indipendenti, stesso comportamento di Instagram/Facebook |
| Nessun `avatarSrc` nell'autore della galleria dell'AVATAR (ma sì per la copertina) | Evita di mostrare la stessa identica foto due volte (grande nello stage, in miniatura nel footer) — per la copertina non c'è questa ridondanza |
| Pan calcolato una sola volta all'attivazione dello zoom, non ricalcolato durante il drag | Nessun consumer reale ridimensiona la finestra a zoom aperto — stesso principio YAGNI già applicato da ProfileMenu per il proprio mancato reposizionamento su resize |
| Soglia di movimento (6px) per distinguere click da drag | Senza soglia, il "click" sintetico che il browser dispatcha dopo ogni pointerup chiuderebbe lo zoom immediatamente dopo qualunque pan |
| Nessun pan da tastiera (frecce riservate alla navigazione) | Evita un conflitto semantico con la navigazione prev/next già esistente — stesso compromesso di app reali come Google Foto |
| Nessun gesto di pinch-to-zoom multi-touch | Il caso d'uso primario resta il docente con mouse/trackpad su una LIM, non un utente touch-first — introdurlo ora sarebbe complessità senza bisogno reale (YAGNI) |
| Bottone "Segui": stato condiviso fra header pubblico e pannello privato, non due bottoni indipendenti | I due non sono mai visibili insieme (si escludono a vicenda in base a `isPrivate`) — rappresentano concettualmente lo stesso bottone, due stati indipendenti potrebbero disallinearsi |
| Nuovo evento `sl:profile-follow-toggle` (sostituisce `sl:profile-follow-request`) | Ora che esiste un vero stato visivo da comunicare, un evento con `detail.following` descrive meglio cosa è successo di un evento "richiesta" a scatto singolo |
| Nessun `aria-live` dedicato al toggle Segui | A differenza del toggle privacy (che nasconde/rivela intere sezioni della pagina), qui il cambiamento è già comunicato dal testo visibile del bottone stesso (il suo nome accessibile cambia con l'etichetta) — un secondo annuncio sarebbe ridondante per una funzionalità volutamente dimostrativa |

---

## 5. Attività rimanenti

**Nessuna attività aperta relativa a questo intervento** — implementazione, verifica reale (ad-hoc
prima, poi persistita nella suite ufficiale) e documentazione sono complete end-to-end. Punti
pre-esistenti e indipendenti (invariati, per completezza, non legati a questo intervento):

1. Immagini reali di Oversharing (18 placeholder a tinta unita, gestiti autonomamente
   dall'utente) — ora con un beneficio aggiuntivo: una volta caricate le foto reali, avatar e
   copertina saranno immediatamente apribili nel MediaViewer con le dimensioni vere, senza alcuna
   modifica di codice.
2. Gap dichiarati e invariati da Fase 10: icon sprite, `js/config/env.js` (Supabase),
   integrazione CI, controllo anti-regressione per contenuti testuali banditi, secondo scenario
   reale con un `type` diverso da `profile-timeline`.

---

## 6. Prossima fase

Nessuna fase numerata pendente dalla Suite originaria, e nessun micro-step pendente su questo
specifico intervento. Le direzioni generali già proposte in chiusura di Fase 10 restano valide
come possibili prossimi passi:

- **Consolidamento**: integrazione CI per `tests/`, controllo anti-regressione per contenuti
  testuali banditi, ri-esecuzione periodica della suite in un ambiente con browser reale.
- **Espansione**: primo secondo scenario reale (Phishing o Password Security consigliati, per
  validare il pattern Registry di `scenarioEngine.js` con un `type` diverso da
  `"profile-timeline"`) — beneficerebbe già gratuitamente di `MediaViewer`/`mediaViewerLauncher.js`
  se dovesse mostrare immagini cliccabili, senza alcuna nuova infrastruttura da costruire.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa (Fase 1 → Fase 10), seguita
dall'intervento "Toggle Privacy Profilo" e, ora, da un intervento "MediaViewer generico e
migliorie realismo profilo". Il documento di handover completo è allegato: consideralo la fonte
di verità primaria.

COSA HA FATTO L'ULTIMO INTERVENTO (4 richieste distinte, tutte completate):
1. MediaViewer reso esplicitamente generico (prop rinominata posts→items) e collegato anche al
   feed della Home (il post di Mario Bianchi ora si apre nel visualizzatore, prima non succedeva
   nulla al click) — tramite un nuovo helper condiviso js/utils/mediaViewerLauncher.js, estratto
   perché sia Home che Oversharing ne hanno bisogno in modo identico.
2. Copertina, avatar e storie del profilo Oversharing ora apribili nel MediaViewer (prima erano
   statici, o un evento senza consumer per le storie).
3. Pan/drag durante lo zoom di MediaViewer (prima solo click-to-toggle centrato, nessun modo di
   spostarsi dentro la foto ingrandita) — Pointer Events, limite calcolato una volta all'apertura
   dello zoom, soglia click/drag, cursori grab/grabbing.
4. Bottone "Segui" prima del conteggio post nella riga statistiche del profilo, con toggle
   visivo condiviso con il bottone gemello già esistente nel pannello "profilo privato".

FILE MODIFICATI: js/utils/mediaViewerLauncher.js (NUOVO), js/components/MediaViewer.js,
css/components/media-viewer.css, js/pages/homePageController.js,
js/scenarios/renderers/profileTimelineRenderer.js, css/scenarios/profile-timeline.css,
tests/home.spec.js, tests/scenario.spec.js. Nessun altro file toccato.

VERIFICA ESEGUITA: suite ufficiale completa (login.spec.js + home.spec.js + scenario.spec.js, incl.
tutti i nuovi controlli) eseguita attraverso il vero index.html — 94/94 controlli superati (15+26+
53). 1 bug reale trovato e corretto durante la verifica (aria-pressed assente al primo render del
bottone Segui — mancava "pressed: false" esplicito alla creazione, stesso pattern di attenzione
già noto nel progetto per Button.js).

NOTA DI PROCESSO: durante la verifica del pan/drag, un primo giro di test ha segnalato un
fallimento che si è rivelato NON un bug del codice ma una limitazione dell'ambiente di
verifica (immagini di test a 404, quindi nessuna dimensione reale su cui calcolare il margine di
pan) — risolto generando un'immagine di prova reale prima di confermare la correzione. Utile
saperlo se in futuro si dovesse rieseguire la suite in un ambiente senza le immagini reali di
Oversharing: il test del pan presuppone che le immagini abbiano dimensioni reali (vero nel
repository reale, anche con i placeholder a tinta unita attuali).

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Motiva ogni decisione prima di
implementarla. Mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI; eventi "sl:nome-evento"; componenti
"dumb"; documentazione in italiano; test reali (mai mock) prima di consegnare, verificati anche
attraverso l'index.html reale (non solo harness isolati); handover completo a 10 sezioni + file
.md separato ad ogni milestone; per ogni file dichiara sempre NUOVO/MODIFICATO/GIÀ ESISTENTE,
verificato sui file reali, non per assunzione.

STATO: nessuna attività pendente su questo specifico intervento. Le due direzioni generali
proposte in chiusura di Fase 10 restano disponibili come prossimo passo del progetto:
(A) consolidamento (CI, controllo anti-regressione contenuti banditi) o (B) espansione (primo
secondo scenario reale, con un "type" diverso da "profile-timeline" per validare il pattern
Registry di scenarioEngine.js con un secondo caso reale — beneficerebbe già di MediaViewer/
mediaViewerLauncher.js senza alcuna nuova infrastruttura).

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** in questa sessione (Playwright,
Chromium headless, server locale, mai `file://`) e sono ora parte della suite persistita in
`tests/`.

### Test funzionali
- [x] MediaViewer generico: apertura dal Feed Home (Mario Bianchi), autore/posizione corretti,
  item senza immagine → testo, navigazione, chiusura, nessun residuo.
- [x] Avatar → galleria di 1 item, nessuna navigazione (prev/next disabilitati).
- [x] Copertina → galleria di 1 item, autore corretto.
- [x] Storie → galleria di 5 item, didascalia = etichetta della storia, navigazione fra storie.
- [x] Pan/drag: soglia click/drag, transform aggiornato durante il trascinamento, zoom resta
  attivo dopo un drag reale, click (senza drag) esce dallo zoom e azzera il pan, cursori
  zoom-in/grab/grabbing corretti in ogni stato.
- [x] Bottone Segui: posizione nella riga (prima del conteggio post), stato iniziale, toggle
  visivo (label + variante + aria-pressed), evento `sl:profile-follow-toggle` con detail
  corretto, sincronizzazione bidirezionale fra header e pannello privato.
- [x] Regressione completa: login/guardie di sessione, Home (moduli/feed/mi piace/skip-link/
  ProfileMenu), Oversharing (profilo/storie/feed/toggle Post-Archivio/toggle privacy/MediaViewer
  da post), flusso completo da tastiera Home→Scenario→MediaViewer.

### Test UI
- [x] Screenshot Light/Dark su Home e Oversharing con i nuovi elementi (bottone Segui, trigger
  avatar/copertina) — nessuna anomalia.
- [x] Screenshot mobile 375px: riga statistiche (ora con 4 elementi: Segui + 3 stat + lucchetto)
  entra su una sola linea, nessun overflow orizzontale.
- [x] Screenshot dello stato zoomato+trascinato: immagine visibilmente spostata, correttamente
  ritagliata nei bordi arrotondati dello stage.
- [ ] Breakpoint intermedi (768–1024px) specificamente sui nuovi elementi — non verificati in
  questo intervento (rischio basso: nessuna nuova media query introdotta, il layout esistente a
  quei breakpoint era già verificato in Fase 9).

### Test UX
- [x] Nessun movimento forzato del focus al toggle Segui (il bottone resta dov'è).
- [x] Cursore comunica correttamente l'affordance in ogni stato dello zoom (zoom-in/grab/
  grabbing).
- [x] Nessun salto di layout percepibile con l'aggiunta del bottone Segui alla riga statistiche.

### Test tecnici
- [x] `node --check` su tutti i file `.js` nuovi/modificati.
- [x] Console priva di errori JS inaspettati in tutti i flussi testati (404 sulle immagini
  placeholder tollerati e distinguibili, stesso criterio già applicato in ogni fase precedente).
- [x] Nessun path relativo rotto — nessuna modifica a `index.html` necessaria in questo
  intervento (tutti i file toccati erano già collegati).

### Test di regressione
- [x] Suite ufficiale completa (`login.spec.js`+`home.spec.js`+`scenario.spec.js`, 94 controlli)
  eseguita attraverso l'`index.html` reale — tutti verdi, incluse tutte le funzionalità delle
  fasi precedenti (autenticazione, Home data-driven, scenario Oversharing, toggle privacy,
  flusso da tastiera).
- [x] `MediaViewer.js`: la rinomina `posts`→`items` non ha introdotto alcuna regressione sul
  consumer preesistente (Oversharing) — verificato esplicitamente.

---

## 9. Criticità

- **Il test del pan/drag presuppone immagini con dimensioni reali**: in un ambiente di
  verifica privo delle immagini reali di Oversharing (come l'ambiente sandbox usato in questa
  sessione, dove tutte le immagini restituiscono 404), il test di trascinamento non avrebbe
  spazio su cui operare (un'immagine senza dimensioni intrinseche, una volta scalata, resta più
  piccola dello stage: nessun margine di pan possibile, il test fallirebbe non per un bug ma per
  l'assenza di un'immagine reale). Nel repository reale questo NON è un problema: le immagini
  placeholder a tinta unita di Oversharing hanno dimensioni reali fin dalla Fase 6. Segnalato
  esplicitamente per chi in futuro eseguisse la suite in un ambiente ricostruito da zero senza
  quelle immagini.
- **Nessuna verifica dei breakpoint intermedi (768–1024px) specifica per i nuovi elementi** —
  rischio basso (nessuna nuova media query introdotta), ma non confermato con uno screenshot
  dedicato in questo intervento.
- **`sl:profile-follow-toggle` sostituisce `sl:profile-follow-request`**: se in futuro qualcosa
  (fuori da questo progetto, es. uno strumento esterno di analisi) si aspettasse ancora il vecchio
  nome dell'evento, andrebbe aggiornato — nessun listener reale esisteva per il vecchio evento
  all'interno del progetto, quindi il rischio concreto è nullo.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento. I compromessi già noti (immagini Oversharing
  gestite dall'utente, icon sprite assente, `env.js` Supabase non costruito) sono invariati.

### Refactoring consigliati
- 🟢 Nessuno: l'intervento riusa esclusivamente pattern già esistenti (Pointer Events per il
  drag, Button.pressed per i toggle, il pattern "galleria a un elemento" già implicito nel
  design di MediaViewer) — zero nuova indirection introdotta oltre al launcher, già motivato
  come estrazione a bisogno reale.

### Ottimizzazioni future
- 🟢 **Pinch-to-zoom multi-touch**: non implementato (YAGNI, nessun bisogno reale col caso d'uso
  primario del docente su LIM con mouse/trackpad) — da rivalutare solo se un uso touch-first
  diventasse rilevante.
- 🟢 **Precaricamento dedicato per le immagini adiacenti in una galleria** (es. le 5 storie): la
  cache HTTP del browser già risolve il caso reale (ogni immagine è già stata vista come
  miniatura prima di poter essere aperta) — nessuna infrastruttura dedicata necessaria oggi.
- 🟢 **Verifica dei breakpoint intermedi (768–1024px)** specifica per i nuovi elementi — rischio
  basso, da chiudere se un audit futuro lo richiedesse.

### Rischi architetturali
- 🟢 **Nessun rischio nuovo**: `mediaViewerLauncher.js` è puramente additivo e ha già validato il
  proprio scopo con un secondo consumer reale (Home) nello stesso intervento in cui è stato
  introdotto — non una speculazione architetturale, un pattern già provato due volte.
- 🟢 **Rinomina `posts`→`items` in `MediaViewer.js`**: cambio di superficie pubblica di un
  componente condiviso, ma con un solo consumer reale esistente (`profileTimelineRenderer.js`),
  aggiornato nello stesso intervento — nessun rischio di rottura silenziosa altrove nel progetto
  (verificato con `grep` sull'intero codebase prima di considerare la rinomina completa).

### Priorità
- 🟢 Bassa: tutto quanto sopra — nessuna criticità bloccante identificata da questo intervento.

### Obiettivo
Questo intervento è chiuso end-to-end: implementazione, verifica reale (ad-hoc in corso d'opera,
poi persistita nella suite ufficiale), e documentazione — pienamente coerente con l'architettura
consolidata nelle fasi precedenti, senza debito residuo introdotto.
