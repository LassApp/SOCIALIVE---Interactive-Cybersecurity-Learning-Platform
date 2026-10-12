# SOCIALIVE — Handover: Redesign della Home (piattaforma didattica)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / Product & UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Performance Engineer del progetto.
**Contesto:** intervento post-Suite richiesto dall'utente. La Home smette di essere un finto feed social e
diventa la home di una piattaforma di formazione, con accesso alle aree e agli scenari.
**Verificato su:** repository reale clonato da GitHub (HEAD `5e9ff36` "new scenario allucinazioni",
11/10/2026), non su handover o file incollati in chat.
**Tag di riferimento suggerito:** `v1.5.0-redesign-home`

---

## 1. Stato del progetto

- **Redesign della Home: ✅ completato e verificato end-to-end** attraverso l'`index.html` reale (server locale,
  Chromium reale, mai `file://`).
- **Baseline prima di toccare il codice: 266/266** (login 19, home 27, sidebar 13, scenario 78, phishing 35,
  token 38, llm 56). **Dopo l'intervento: 308/308** (login 19, home 65, sidebar 13, scenario 82, phishing 35,
  token 38, llm 56). Console priva di errori, nessuna richiesta ≥ 400, nessuna richiesta verso host esterni.
- Aggiunte richieste dall'utente durante l'intervento: **icone per le aree** (Cybersecurity: scudo con spunta;
  AI: scintille) e **barra di ricerca funzionante come filtro** (nome di area o di scenario → compare l'area che
  lo contiene).
- Il mockup è stato **scartato su indicazione dell'utente** ("nessun mockup, procedi"): la tela di design creata
  durante la proposta è incompleta e privata, non serve più.
- **Differenze tra il prompt dell'intervento e il repository reale** (trattate come differenze di nomenclatura,
  non come bug; da confermare):
  1. il flyout della Sidebar si chiama **"Scenari"** (ex "Moduli", rinominato all'arrivo dell'area AI), non "Moduli";
  2. `data/modules.json` contiene 8 voci: 5 segnaposto non disponibili (Yoga, Nissan GT-R R34/R35, Beatbox,
     Fotografia, Ricette) + **Cybersecurity (4 scenari) + AI (2 scenari)**. **Non esiste un'area "Cyberbullismo"**
     (citata solo come esempio nel prompt).
- Zero modifiche a `router.js`, `authService.js`, `data/users.json`, `scenarioEngine.js`, `scenarioPageController.js`,
  a tutti i renderer e ai dati degli scenari, a `Sidebar.js`, `AppHeader.js`, `PageContainer.js`.

---

## 2. Obiettivi completati

Criteri di accettazione del prompt → evidenza.

| # | Criterio | Esito | Evidenza |
|---|---|---|---|
| 1 | `#/home` non mostra più feed, post, profili, storie | ✅ | test "nessun contenuto da social network in Home" (0 occorrenze di `.sl-feed/.sl-post-card/.sl-stories-bar/.sl-profile-timeline/.sl-timeline/MediaViewer`) |
| 2 | Tutte le aree e tutti gli scenari raggiungibili e funzionanti | ✅ | 6 test, uno per scenario disponibile: click sul link in Home → hash corretto → wrapper dell'engine montato, senza "Impossibile caricare"/"in preparazione"; suite di scenario/phishing/token/llm invariate e verdi |
| 3 | Aree/scenari dai JSON, nessun contenuto letterale nel JS | ✅ | `modules.json` → `scenarioCatalog.js` → `AreaCard`; test con `modules.json` intercettato e alterato (area aggiunta, icona non sicura, scenario non disponibile) |
| 4 | AppHeader, Sidebar (flyout), ProfileMenu, ThemeSwitch, ricerca, logout, skip-link | ✅ | `sidebar.spec` 13/13 + 3 test Sidebar conservati in `home.spec`; skip-link e ProfileMenu (nome, ThemeSwitch, animazione, Esc) conservati; logout da ProfileMenu in `login.spec`; **la ricerca ora è funzionale** |
| 5 | Light e Dark verificati con screenshot ispezionati | ✅ (con riserva) | ispezionati a vista: desktop Light, desktop Dark, 375px Light, 900px, ricerca attiva. Generati ma **non ispezionati a vista**: 375px Dark, 768px, 1024px (per questi c'è l'asserzione automatica di assenza di overflow) |
| 6 | Nessun codice morto/file orfano residuo | ✅ | catena di consumer verificata con `grep` — vedi §4 |
| 7 | Suite completa verde, test home riscritti, regressioni invariate | ✅ | 308/308 |
| 8 | Handover completo | ✅ | questo documento |

**Cosa vede ora il docente:** intestazione "Benvenuto, *nome dalla sessione*", sottotitolo, sezione "Aree di formazione"
con una card per area (icona, titolo, badge "N scenari", descrizione, elenco degli scenari come link diretti da 52px).
Il badge diventa "1 di 4 scenari" quando la ricerca filtra l'elenco.

**Ricerca (comportamento):** ignora maiuscole, accenti, spazi e punteggiatura ("wifi" = "Wi-Fi" = "wi fi").
Se il testo corrisponde al nome di un'**area** compare l'area con **tutti** i suoi scenari; se corrisponde solo a uno
o più **scenari** compare l'area che li contiene con i **soli scenari corrispondenti**; altrimenti l'area è nascosta.
Nessun risultato → messaggio visibile «Nessun risultato per «…»». Risultato annunciato da una regione `aria-live`
("1 area e 1 scenario trovati"). Svuotare la barra ripristina tutto. Le aree segnaposto non sono cercabili.

---

## 3. Architettura attuale

```
socialive/
├── index.html                                  # ♻️ MODIFICATO — +1 <link> (area-card.css); nessun import toccato
├── data/
│   ├── modules.json                            # ♻️ MODIFICATO — campi ADDITIVI "description" e "icon" su Cybersecurity e AI
│   └── home/feed.json                          # 🗑️ ELIMINATO
├── assets/
│   ├── icons/areas/
│   │   ├── cybersecurity.svg                   # ⭐ NUOVO — scudo con spunta (outline 24px, stroke 1.5)
│   │   └── ai.svg                              # ⭐ NUOVO — tre scintille
│   └── images/home/
│       ├── post_mario_bianchi.jpg              # 🗑️ ELIMINATO (unico consumer: feed.json)
│       └── mountain-placeholder.svg            # 🗑️ ELIMINATO (era GIÀ orfano: nessun consumer)
├── css/
│   ├── components/area-card.css                # ⭐ NUOVO
│   └── layouts/home-page.css                   # ♻️ MODIFICATO — riscritto (colonna 960px, griglia auto-fit)
├── js/
│   ├── utils/scenarioCatalog.js                # ⭐ NUOVO — catalogo aree→scenari + filtro di ricerca (funzioni pure)
│   ├── components/AreaCard.js                  # ⭐ NUOVO — compone Card + Badge
│   ├── pages/homePageController.js             # ♻️ MODIFICATO — riscritto
│   ├── pages/shared/appShell.js                # ♻️ MODIFICATO — buildScenarioGroups usa il catalogo condiviso
│   ├── utils/mediaViewerLauncher.js            # ♻️ MODIFICATO — solo commenti
│   └── components/MediaViewer.js               # ♻️ MODIFICATO — solo commenti
└── tests/
    ├── home.spec.js                            # ♻️ MODIFICATO — riscritta (27 → 65 controlli)
    ├── scenario.spec.js                        # ♻️ MODIFICATO — +4 controlli migrati dalla home (78 → 82)
    └── README.md                               # ♻️ MODIFICATO — solo le righe che riguardano la home
```

**Rotta, router, shell:** invariati. La Home monta ancora `appShell + PageContainer`; la classe radice
`.sl-home-page__content` è rimasta la stessa (le suite sidebar/llm/token la usano per riconoscere "la Home è montata").

**Come applicare:** copiare i file NUOVI/MODIFICATI sul repository mantenendo i percorsi; eliminare i 3 file:

```bash
git rm data/home/feed.json assets/images/home/post_mario_bianchi.jpg assets/images/home/mountain-placeholder.svg
```

`data/users.json` **non è nello zip e non va toccato.** Per eseguire i test: `SL_TEST_EMAIL`/`SL_TEST_PASSWORD` impostate
(`cd tests && npm test`). Gli screenshot rigenerati in `tests/screenshots/` non sono consegnati (vedi §10).

---

## 4. Decisioni progettuali

### Esito dell'analisi d'impatto (Fase 0) — catena di consumer verificata con grep

| Elemento | Consumer trovati | Verdetto |
|---|---|---|
| `data/home/feed.json` | solo `homePageController.js` (+ commenti/test) | eliminato |
| `assets/images/home/post_mario_bianchi.jpg` | solo `feed.json` | eliminato |
| `assets/images/home/mountain-placeholder.svg` | **nessuno** (già orfano prima dell'intervento) | eliminato |
| `Feed.js`, `PostCard.js`, `Skeleton`, `feed.css`, `post-card.css` | `profileTimelineRenderer.js` (Oversharing), `style-guide.html` | **mantenuti** |
| `mediaViewerLauncher.js`, `MediaViewer.js`, `media-viewer.css` | `profileTimelineRenderer.js` | **mantenuti** (un solo consumer; vedi §10) |
| `imageFadeIn.js` | `PostCard.js`, `profileTimelineRenderer.js` | **mantenuto** |
| `.sl-home-page__content` | `home`, `sidebar`, `llm`, `token` spec | **classe mantenuta** |

**Test:** 11 controlli della vecchia `home.spec.js` descrivevano il feed (cambio **deliberato**, non regressione) e sono stati
rimossi/sostituiti. **Quattro di essi esercitavano codice ancora vivo** (aspect-ratio+`loading=lazy` di PostCard, fade-in
dell'immagine, sua idempotenza, "mi piace") ed erano coperti **solo** da `home.spec.js`: **migrati** in `scenario.spec.js`
sul feed di Oversharing. L'apertura di MediaViewer è già coperta in `scenario.spec` (post, avatar, copertina, storie, zoom, pan).

### Decisioni

| Decisione | Motivazione |
|---|---|
| **Proposta A "catalogo per aree"** (card per area con scenari come link) | rispecchia il modello dati aree→scenari, riusa `Card`/`Badge`, nessun nuovo stato persistito, leggibile su LIM. Scartate: B (tessere per scenario: serve un'icona per scenario, meno contesto), C (dashboard con "Riprendi l'ultimo scenario": nuovo stato in `localStorage`, YAGNI con 6 scenari) |
| **`scenarioCatalog.js` condiviso da Sidebar e Home** | estratto al secondo consumo reale: la regola "quali aree sono visibili" vive in un solo punto, Home e Sidebar non possono divergere (verificato da un test con area aggiunta al JSON) |
| **Aree segnaposto (`available:false`) nascoste in Home** | restano in `modules.json` ma non sono aree di formazione; la Sidebar già le nasconde. *Assunzione da confermare* — mostrarle come "In arrivo" è una modifica di poche righe |
| **Descrizioni degli scenari NON mostrate in Home** | le `description` di `scenario.json` spiegano la lezione (es. cosa rivela il Keylogger): in una pagina proiettata in aula anticiperebbero il "colpo di scena". La Home mostra solo la descrizione dell'**area** (campo nuovo, neutro) |
| **Testi delle descrizioni d'area = proposta** | "Come i comportamenti di ogni giorno online mettono a rischio dati, credenziali e identità." / "Come funzionano i modelli linguistici e quali limiti è importante conoscere." — modificabili solo in `modules.json` |
| **Icona = file SVG in `assets/` usato come maschera CSS** (`mask-image` + `currentColor`) | segue il tema Light/Dark; aggiungere un'area = un SVG + una voce JSON, nessun JS. Impostata **inline** perché un `url()` relativo in un `style` si risolve rispetto al documento (verificato anche in un sottopercorso tipo GitHub Pages). Percorso validato (solo `.svg` relativi): un URL esterno o malformato viene ignorato e si ripiega sulle iniziali — mai richieste verso host esterni |
| **Ricerca come filtro: nasconde le aree, non le ricostruisce** | `[hidden]` sulle voci della griglia, `card.update()` sul solo elenco: nessun rebuild ad ogni tasto, focus mai spostato dalla barra |
| **Badge "N di M scenari" quando filtrato** | chi cerca "Phishing" capisce che l'area ne contiene altri senza che la card li mostri tutti |
| **Scenario `available:false` → riga non cliccabile** (`aria-disabled`, nessun `href`) | mai un link verso una rotta inesistente; stesso trattamento (opacità) delle voci disabilitate di Sidebar |
| **Griglia `minmax(min(100%, 340px), 1fr)`** | il `min(100%, …)` evita 5px di overflow a 375px (colonna utile 335px) |
| **Home = unico accesso agli scenari sotto 768px** | a quella soglia Sidebar e ricerca di AppHeader sono nascoste: prima dell'intervento, su telefono la Home non portava a nessuno scenario |
| **Nessun nuovo accostamento colore** | tutte coppie già verificate; l'unica nuova (`text-secondary` su `bg-canvas`) = 5.75:1 Light / 8.23:1 Dark. Icona `text-inverse` su `primary-600` = 5.77:1 |
| **`appShell.js` ora importa il catalogo e non più `buildFallbackMessage`** | l'import precedente era inutilizzato (solo citato in un commento) — rimosso |

---

## 5. Attività rimanenti

Nessuna sull'intervento. Opzionali, in ordine di valore:

1. **Confermare le assunzioni** di §4 (aree segnaposto nascoste; testo delle descrizioni d'area; saluto "Benvenuto").
2. **Ricerca sulle altre pagine:** `sl:search` continua a non avere consumer fuori dalla Home (sulle pagine di scenario la barra non fa nulla, come prima).
3. **Ricerca sotto 768px:** la barra è nascosta a quella soglia (invariato); le card restano comunque raggiungibili.
4. Gap storici invariati: icon sprite, integrazione CI, secondo scenario con tipo non ancora coperto, ecc.

---

## 6. Prossima fase

Nessuna fase numerata pendente. **Punto di ripartenza:** aggiungere un'area = un file SVG in `assets/icons/areas/` + una
voce in `data/modules.json` (`id`, `title`, `available:true`, `description`, `icon`, `scenarios[]`); compare in Home e nel
flyout senza toccare il codice (test di estensibilità incluso).

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning Platform"),
piattaforma didattica usata dal docente e proiettata in classe. Allego l'handover del redesign della Home:
è la fonte di verità. VERIFICA SEMPRE il repository reale (lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform)
prima di fidarti di qualunque handover — è già successo più volte che descrivessero lavoro non applicato.

STATO: la Home (#/home) è una home di piattaforma didattica: saluto + una card per AREA (icona, titolo, badge,
descrizione, scenari come link) letta da data/modules.json tramite js/utils/scenarioCatalog.js (condiviso con
il flyout "Scenari" della Sidebar). La barra di ricerca di AppHeader filtra aree/scenari (sl:search ascoltato
in homePageController.js). Il finto social network vive SOLO nello scenario Oversharing. Suite: 308/308
(login 19, home 65, sidebar 13, scenario 82, phishing 35, token 38, llm 56).
Aree reali: Cybersecurity (Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi) e AI (Tokenizzazione, Allucinazioni);
5 voci segnaposto non disponibili (Yoga, Nissan GT-R, Beatbox, Fotografia, Ricette) restano in modules.json ma non
compaiono in Home né in Sidebar. NON esiste un'area Cyberbullismo.

REGOLE: stack HTML/CSS/JS nativo; componenti create(props)→{element,update,destroy}; page controller
(container,params)→destroy; eventi "sl:nome"; componenti "dumb"; estensioni additive; token --sl-*; ogni NUOVO
accostamento colore verificato numericamente (Light e Dark); pattern ".classe[hidden]{display:none}" se la classe
dichiara display; proponi e attendi conferma prima di implementare; piccoli step verificati con Playwright reale
attraverso index.html; non toccare data/users.json; credenziali di test solo da SL_TEST_EMAIL/SL_TEST_PASSWORD
(in sandbox: credenziali usa-e-getta); documentazione in italiano; per ogni file dichiara NUOVO/MODIFICATO/ELIMINATO
verificato sul repo; handover a 10 sezioni (.md) + zip a fine intervento.

NOTE DI AMBIENTE: nello sandbox il Chromium è compatibile con Playwright globale 1.56 (tests/node_modules del repo è
1.62.1: usare NODE_PATH al globale); il flyout della Sidebar nei test si apre con .hover(); dopo un cambio rotta
attendere un selettore esclusivo della nuova pagina (es. .sl-home-page__content .sl-area-card).

Indica la prossima priorità.
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Una card per area di `modules.json`, nell'ordine del file; descrizione e badge corretti; aree segnaposto assenti.
- [x] Ogni scenario disponibile è un `<a href="#/scenario/:id">` e **si apre davvero** dalla Home (6/6).
- [x] Icone: `mask-image` punta al file, file servito (200), glifo 32×32.
- [x] Ricerca: scenario, area, area corta, maiuscole/accenti/punteggiatura, più scenari nella stessa area, nessun risultato, segnaposto non cercabili, svuotamento, annuncio `aria-live`, click su un risultato filtrato, azzeramento al ritorno in Home.
- [x] Ricerca digitata prima del caricamento di `modules.json` → applicata al primo render.
- [x] Dati alterati: area aggiunta (4 card), area senza icona/descrizione (iniziali), scenario non disponibile (riga non cliccabile), icona con URL esterno (ignorata, nessuna richiesta), parità con il flyout della Sidebar, ricerca sull'area aggiunta.
- [x] `modules.json` a 500 → saluto presente, messaggio condiviso, nessun crash. Navigazione via prima della risposta → nessun componente orfano.
- [ ] Applicazione dei file sul **repository reale** e `npm test` con le **credenziali reali** (da fare in locale: in sandbox sono state usate credenziali usa-e-getta).

### Test UI
- [x] Light, Dark, 375px, 900px, ricerca attiva — ispezionati a vista.
- [ ] **Non ispezionati a vista** (solo asserzione di assenza di overflow): 375px Dark, 768px, 1024px.
- [x] Nessun overflow orizzontale a 375/768/900/1024/1280px.
- [ ] LIM/proiettore reale: leggibilità non verificata fuori da screenshot.

### Test UX
- [x] Tab raggiunge il primo scenario dopo la Sidebar, focus visibile (outline), Invio apre lo scenario.
- [x] Target di tocco ≥ 44px a 375px; a 375px la Home è l'unico accesso agli scenari.
- [x] Digitare non sposta il focus dalla barra.

### Test tecnici
- [x] Console priva di errori; nessuna richiesta ≥ 400; **nessuna richiesta verso host esterni** durante la Home.
- [x] Testo cercato inserito come testo (nessuna iniezione HTML).
- [x] Icone risolte correttamente anche in un sottopercorso (simulato `/socialive-sub/`).
- [ ] Verifica su un **deploy reale** di GitHub Pages.

### Test di regressione
- [x] 308/308 (7 suite) attraverso l'`index.html` reale; le suite di scenario non sono state modificate (tranne +4 migrati in `scenario.spec`).

---

## 9. Criticità

- **Assunzioni da confermare** (§4): aree segnaposto nascoste; testi delle descrizioni d'area; "Benvenuto" (maschile) nel saluto.
- **Il prompt dell'intervento citava "Moduli" e "Cyberbullismo"**: nel repository reale il flyout è "Scenari" e l'area Cyberbullismo non esiste.
- **Verifica visiva parziale** (§8): 375px Dark, 768px e 1024px non ispezionati a vista.
- **Ricerca non disponibile sotto 768px** e senza effetto fuori dalla Home (invariato: era già così).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Un titolo di scenario non disponibile (`available:false`) è cercabile ma non cliccabile — coerente con la Sidebar; nessun scenario lo è oggi.

### Refactoring consigliati
- 🟡 **Igiene del repository (preesistente, fuori scope):** `tests/node_modules` (180 file) e `tests/screenshots/` (14 PNG, ora obsoleti per la Home) sono **versionati**; `tests/.gitignore` non esiste, nonostante `tests/README.md` dica il contrario; `socialive-revert-local-auth.zip` è versionato nella radice; `data/scenarios/oversharing/scenario-page.css` è un CSS dentro `data/`. Proposta: `git rm -r --cached tests/node_modules tests/screenshots` + `tests/.gitignore`, e valutare gli altri due file.
- 🟡 **Documentazione preesistente obsoleta:** `README.md` radice fermo alla Fase 2; `tests/README.md` parla di quattro suite (`run-all.js` ne esegue sette). Aggiornate solo le righe sulla Home.
- 🟢 La stringa di rotta `#/scenario/` è ora nel catalogo (fonte unica per i link) ma resta anche nella regex di `appShell.getCurrentScenarioId()` e nella registrazione in `index.html`: estrarre solo se compare un terzo consumer.

### Ottimizzazioni future
- 🟢 Evidenziare nel testo la parte che corrisponde alla ricerca (oggi: nessun `<mark>`, l'area/scenario compare e basta).
- 🟢 Indicare quali scenari si aprono a schermo intero (`chrome:"none"`) richiederebbe leggere `scenario.json` o duplicare il dato in `modules.json`.
- 🟢 Tessere o "Riprendi l'ultimo scenario" (proposte B/C) se il numero di scenari crescesse.

### Rischi architetturali
- 🟢 `mediaViewerLauncher.js` ora ha **un solo consumer** (`profileTimelineRenderer.js`): non è codice morto, ma l'estrazione non è più giustificata dal "secondo consumo".
- 🟢 Le icone sono caricate come maschere: se un file SVG manca (404) il cerchio resta vuoto (il ripiego sulle iniziali scatta solo se `icon` è assente o non valido).

### Priorità
- 🟡 Media: igiene repo (`tests/node_modules`, `tests/screenshots`) — fa comparire come "modificati" i PNG ad ogni esecuzione.
- 🟢 Bassa: tutto il resto.

### Obiettivo
Home allineata al modello reale della piattaforma, con una sola fonte di verità (catalogo) condivisa con la Sidebar e
nessun contenuto di area/scenario scritto nel codice.
