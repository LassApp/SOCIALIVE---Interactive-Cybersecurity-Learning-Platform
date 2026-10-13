# SOCIALIVE — Handover: navigazione (Sidebar a fisarmonica, tasto Home, PixelProf) e pulizia aree

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / Product & UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Performance Engineer del progetto.
**Contesto:** secondo intervento sulla Home, dopo la conferma delle assunzioni del primo (aree segnaposto da eliminare,
descrizioni d'area e saluto approvati). Parte dal repository reale aggiornato (HEAD `16e2e75` "new homepage", che contiene
già la consegna precedente).
**Tag di riferimento suggerito:** `v1.6.0-navigazione-home`

---

## 1. Stato del progetto

- **Completato e verificato** (server locale, Chromium reale, `index.html` reale): aree segnaposto eliminate, Sidebar a
  fisarmonica, voce PixelProf, tasto Home nella barra superiore.
- **Suite: 331/331** (login 19, home 75, sidebar 26, scenario 82, phishing 35, token 38, llm 56). Console priva di errori,
  nessuna richiesta verso host esterni se non cliccando PixelProf.
- **In attesa di una tua scelta (nessun codice scritto):** nuovo nome della piattaforma, con nuovo logo e favicon — vedi §5.
- **Ancora da fare sul tuo repository, dall'intervento precedente:** i 3 file del vecchio feed non sono stati eliminati
  (`git rm data/home/feed.json assets/images/home/post_mario_bianchi.jpg assets/images/home/mountain-placeholder.svg`).
- Non toccati: `data/users.json`, `router.js`, `authService.js`, tutti i renderer e i dati degli scenari, `PageContainer`,
  `index.html`.

---

## 2. Obiettivi completati

| Richiesta | Esito |
|---|---|
| Eliminare le aree "in arrivo" (Yoga, Nissan GT-R, Beatbox, Fotografia, Ricette) senza lasciare riferimenti | ✅ rimosse da `data/modules.json`; nessun riferimento residuo in codice, dati o test (verificato con `grep`; restano solo nei vecchi handover, che sono storia). La regola `available:false` resta nel codice ma è testata con dati sintetici |
| Descrizioni d'area, descrizioni degli scenari, "Benvenuto" | ✅ confermati come erano |
| Sidebar "apri e chiudi a fisarmonica" | ✅ vedi sotto |
| Nuova voce **PixelProf** (https://lassapp.github.io/PixelProf/) | ✅ |
| Tasto Home (icona casa) accanto al logo, sempre visibile | ✅ su ogni pagina con barra; negli scenari immersivi vedi sotto |
| Valutare un nuovo nome + logo + favicon | ⏳ valutazione consegnata (§5), serve la tua scelta |

**Sidebar a fisarmonica.** "Scenari" si apre e si chiude **in linea** (click, Invio o Spazio) e spinge in basso le voci
successive; dentro ci sono le aree, anch'esse a fisarmonica con i loro scenari. Le aree sono **esclusive** (aprirne una
chiude l'altra). Non c'è più apertura all'hover, né chiusura automatica quando il mouse esce o il focus si sposta: resta
com'è lasciata. Animazione di apertura breve (come ProfileMenu), azzerata da `prefers-reduced-motion`.

**PixelProf.** Voce tra "Scenari" e "Impostazioni", con icona di link esterno. Si apre in una **nuova scheda** con
`rel="noopener noreferrer"` (la sessione resta nella scheda di SocialAlive e il sito esterno non riceve `window.opener`);
nome accessibile "PixelProf (si apre in una nuova scheda)". L'URL non è nel codice: sta in
`data/external-links.json` (aggiungere un altro strumento = una riga). Sono accettati **solo URL https**; `javascript:`,
`data:` e `http:` vengono scartati. Se il file non si carica, la Sidebar funziona senza la voce.

**Tasto Home.** Icona casa 44×44px subito dopo il marchio, vero `<a href="#/home">` con nome "Vai alla Home"; sulla Home è
marcato come pagina corrente (`aria-current`). Presente su Home, Oversharing, Tokenizzazione, Allucinazioni, visibile
anche a 375px, primo elemento raggiungibile con Tab dopo lo skip-link. **Negli scenari immersivi** (Keylogger, Phishing,
Evil Twin Wi-Fi) la barra non c'è per scelta di realismo: lì l'uscita verso la Home è il bottone "×" già esistente,
sempre visibile (verificato per tutti e tre). Un'icona a forma di casa accanto a un finto login ne romperebbe l'illusione.

---

## 3. Architettura attuale

```
├── data/
│   ├── modules.json                  # ♻️ MODIFICATO — solo Cybersecurity e AI
│   └── external-links.json           # ⭐ NUOVO — link esterni della Sidebar (PixelProf)
├── css/components/
│   ├── sidebar.css                   # ♻️ MODIFICATO — pannello in linea al posto del flyout
│   └── app-header.css                # ♻️ MODIFICATO — gruppo marchio + tasto Home
├── js/
│   ├── components/Sidebar.js         # ♻️ MODIFICATO — riscritto: fisarmonica + voci esterne
│   ├── components/AppHeader.js       # ♻️ MODIFICATO — prop additive homeRoute/homeActive
│   ├── pages/shared/appShell.js      # ♻️ MODIFICATO — tasto Home, link esterni da dati
│   ├── pages/homePageController.js   # ♻️ MODIFICATO — solo un commento
│   └── utils/scenarioCatalog.js      # ♻️ MODIFICATO — solo commenti (nessun nome di area citato)
└── tests/
    ├── helpers/sidebar.js            # ♻️ MODIFICATO — openScenariosFlyout → openScenariosMenu (click, idempotente)
    ├── sidebar.spec.js               # ♻️ MODIFICATO — riscritta (13 → 26)
    ├── home.spec.js                  # ♻️ MODIFICATO — tasto Home, fisarmonica, aree segnaposto sintetiche (65 → 75)
    ├── scenario.spec.js              # ♻️ MODIFICATO — percorso da tastiera e selettori del pannello
    └── phishing.spec.js              # ♻️ MODIFICATO — percorso Sidebar
```

Classi rinominate: `.sl-sidebar__flyout` → `.sl-sidebar__panel`, `.sl-sidebar__flyout-item` → `.sl-sidebar__panel-item`.
`.sl-sidebar__trigger`, `.sl-sidebar__group-trigger`, `.sl-sidebar__group-list` invariate.

**Come applicare:** copiare i file dello zip mantenendo i percorsi (non c'è `users.json`); eseguire i `git rm` del §1.

---

## 4. Decisioni progettuali

| Decisione | Motivazione |
|---|---|
| **"Scenari" nasce SEMPRE chiusa, anche dentro uno scenario** (l'area corrente è già aperta quando la apri) | Trovato dai test: con la fisarmonica aperta di default, su Oversharing la Sidebar mostrava la parola "Oversharing" accanto al finto profilo, violando "nessun elemento didattico visibile". Con il flyout il problema non esisteva (chiuso finché non lo si apriva) |
| Aree **esclusive** (vera fisarmonica) | con più aree la Sidebar non cresce oltre lo schermo; un solo punto da cambiare se le vuoi indipendenti: `createExclusiveGroup()` in `Sidebar.js` |
| Nessuna chiusura con Escape/perdita di focus | in una fisarmonica lo stato lo decide solo l'utente |
| Chiuso = `[hidden]` (nessuna animazione di chiusura) | fuori da Tab e dall'albero di accessibilità senza codice in più; stesso principio di Modal/ProfileMenu |
| Link esterni **da dati**, solo `https:` | "i contenuti non devono essere scritti nel codice"; un file di dati non è mai fidato fino a un `href` |
| Etichetta "PixelProf" (non "Pixelprof") | è il nome del progetto e dell'URL; modificabile in `external-links.json` |
| `AppHeader`: tasto Home solo se arriva `homeRoute` | estensione additiva: la style guide e ogni consumer che non lo passa restano identici |
| Tasto Home = `<a>` | semantica di link gratuita, nessun codice di routing in un componente "dumb" |
| Immersivi: nessun tasto Home, resta il "×" | realismo (vincolo di progetto) + la via d'uscita esiste già ed è testata |
| Nessun nuovo accostamento colore | tasto Home: `text-primary` su `bg-surface` (17.05:1 / 16.04:1); icona link esterno: `text-secondary` (6.11:1 / 7.48:1) |

---

## 5. Attività rimanenti

**Decisione aperta — il nome.** SocialAlive aveva senso per il vecchio design (finto social); oggi la piattaforma ha
aree, scenari e un nome che non la descrive più. **Non ho scritto codice**: serve la scelta del nome, poi logo e favicon.

*Quanto costa rinominare (misurato sul repository):* il nome è visibile in **7 stringhe** — `LoginForm.js` (titolo `<h1>`),
`AppHeader.js` (marchio + segnaposto "Cerca in …"), `router.js` (`APP_NAME`, titolo di ogni scheda), `index.html`
(`<title>`) e i due disclaimer dei file di log scaricati da Keylogger ed Evil Twin Wi-Fi — più `style-guide.html`, `README`,
una menzione in `phishing/inbox.json` e nel PDF della bolletta (da controllare se visibile) e le asserzioni dei test sul titolo
(~10 righe). Piano: **un unico punto** per il nome (file di configurazione) invece di sette stringhe, nuovo `favicon.svg`,
logo in SVG riusabile (marchio + versione solo icona), test aggiornati. Restano invariati, di proposito: il prefisso CSS `sl-`
e le chiavi `sl-theme`/`sl-session` (rinominarli farebbe perdere tema e sessione per nessun beneficio). Il nome del
repository GitHub è facoltativo: cambiarlo cambia l'URL di GitHub Pages.

*Candidati* (verifica web **indicativa**, non una ricerca di marchio):

| Nome | Idea | Pro | Contro / esito del controllo |
|---|---|---|---|
| **Ribalta** | la ribalta è il bordo illuminato del palcoscenico: gli scenari sono "scene" portate in aula e messe in luce | italiano, breve, distintivo, regge Cybersecurity, AI e aree future; tono sobrio; logo semplice (arco di luci) | non dice "formazione" (serve un sottotitolo); **non ancora verificato** |
| **Specchio** | lo scenario ti mostra a te stesso (oversharing, password, un'AI che sbaglia) | italiano, evocativo | molto generico e diffuso; **non ancora verificato** |
| **ScenaLab** | laboratorio di scenari | dice cosa fa | area semantica affollata: ScenoLab (hub di scenografia), SCENARLAB (laboratori di cinema), Colpo di Scena Lab (teatro) — nessun omonimo esatto trovato |
| **AulaLive** | aula + "live", continuità con SocialAlive | familiare | "Aula LIVE" è già il nome di una classe virtuale (Elevate K-12) e fa pensare a lezioni in streaming |
| **DigiProf** | stessa famiglia di PixelProf | coerente con il resto dei tuoi strumenti | esiste il progetto europeo Digi-Prof (competenze digitali dei docenti); "Digi" generico |

**Raccomandazione: Ribalta**, perché è l'unica opzione che non collide con progetti educativi già noti, non lega la
piattaforma a un tema (cyber) né al social, ed è coerente con la metafora che l'app già usa (scenari proiettati davanti a
una classe). Prima di adottarlo, qualunque sia: controllo del marchio (UIBM/EUIPO), dominio e nome su GitHub.
Concetto di logo/favicon per Ribalta: arco semicircolare di luci (tre raggi) in bianco su quadrato arrotondato blu
`primary-600` (stessa coppia già verificata 5.77:1), stesso linguaggio outline 24px delle altre icone.

Altre attività, a bassa priorità: sotto i 768px la barra di ricerca resta nascosta (invariato).

---

## 6. Prossima fase

Scegli il nome (o un altro), poi: (1) verifica del nome scelto; (2) configurazione unica del marchio; (3) logo SVG e
favicon; (4) sostituzione nelle 7 stringhe, nei dati e nei test; (5) screenshot Light/Dark della barra e della pagina
di login. Un solo intervento, ~1 sessione.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning Platform"), piattaforma
didattica usata dal docente e proiettata in classe. Allego l'handover: è la fonte di verità, ma VERIFICA SEMPRE il
repository reale (lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform) prima di fidarti di qualunque handover.

STATO: Home = saluto + una card per area (Cybersecurity, AI) da data/modules.json via js/utils/scenarioCatalog.js, con
ricerca-filtro. Sidebar a FISARMONICA: "Scenari" (sempre chiusa all'avvio, anche dentro uno scenario, per non mostrare il
titolo dello scenario) → aree esclusive → scenari; voce esterna PixelProf da data/external-links.json (solo https, nuova
scheda, noopener). Barra superiore: tasto Home (icona casa) accanto al marchio (AppHeader, prop homeRoute); negli scenari
immersivi (chrome:"none") non c'è barra: l'uscita è il "×" di scenarioPageController.js. Aree segnaposto eliminate da
modules.json. Suite: 331/331 (login 19, home 75, sidebar 26, scenario 82, phishing 35, token 38, llm 56).

DA FARE: scegliere il nuovo nome della piattaforma (raccomandato: Ribalta; alternative: Specchio, ScenaLab, AulaLive,
DigiProf), poi marchio in un unico punto di configurazione, logo SVG, favicon, 7 stringhe visibili
(LoginForm, AppHeader x2, router APP_NAME, index.html <title>, 2 log-template) + test + README/style-guide. Restano il
prefisso CSS "sl-" e le chiavi di storage "sl-*".

REGOLE: stack HTML/CSS/JS nativo; componenti create(props)→{element,update,destroy}; page controller (container,params)→
destroy; eventi "sl:nome"; componenti "dumb"; estensioni additive; token --sl-*; ogni NUOVO accostamento colore verificato
numericamente (Light e Dark); ".classe[hidden]{display:none}" se la classe dichiara display; non toccare data/users.json;
credenziali di test solo da SL_TEST_EMAIL/SL_TEST_PASSWORD (in sandbox: usa-e-getta); nessun elemento didattico visibile
dentro gli scenari; proponi e attendi conferma prima di implementare; handover a 10 sezioni (.md) + zip a fine intervento.

NOTE DI AMBIENTE: Chromium della sandbox compatibile con Playwright globale 1.56 (tests/node_modules del repo è 1.62.1:
usare NODE_PATH al globale). La Sidebar si apre con click (aprire = openScenariosMenu in tests/helpers/sidebar.js).
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Fisarmonica: chiusa all'avvio; click/Invio/Spazio aprono e chiudono; l'hover non apre nulla; apertura in linea (le voci
  successive scendono, nulla esce dalla colonna); aree esclusive; chiudere "Scenari" nasconde tutto e conserva lo stato.
- [x] Il pannello non si chiude da solo (mouse fuori, focus altrove).
- [x] Dentro Oversharing: "Scenari" chiusa, titolo dello scenario non visibile in Sidebar; aprendola, Cybersecurity già aperta.
- [x] PixelProf: ordine delle voci, href/target/rel, nome accessibile, nessuna richiesta esterna prima del click, nuova scheda
  sull'URL giusto con `window.opener` nullo, nessun `sl:navigate`; `javascript:`/`data:`/`http:` scartati; file dati assente → nessun errore.
- [x] Tasto Home: posizione dopo il marchio, nome accessibile, ≥ 44px, icona SVG, `aria-current` su Home, primo dopo lo skip-link;
  su Oversharing/Tokenizzazione/Allucinazioni porta alla Home; sugli immersivi nessuna barra ma "×" verso la Home (3/3).
- [x] Area con `available:false` (dati sintetici): assente da Home, Sidebar e ricerca.
- [ ] Applicazione sul **repository reale** e `npm test` con le **credenziali reali** (da fare in locale).

### Test UI
- [x] Screenshot ispezionati: Sidebar aperta Light e Dark (con Cybersecurity espansa, PixelProf, tasto Home).
- [ ] Non ispezionati a vista: barra a 375px con il tasto Home (verificata solo da asserzioni di posizione/dimensione).
- [ ] Verifica su un deploy reale di GitHub Pages.

### Test UX
- [x] Tab: skip-link → Home → ricerca → profilo → Sidebar; focus visibile sul tasto Home.

### Test tecnici
- [x] Console senza errori; nessun 404; nessuna richiesta esterna in Home.

### Test di regressione
- [x] 331/331 su 7 suite; le suite di scenario non sono state modificate nei contenuti (solo selettori/percorso Sidebar).

---

## 9. Criticità

- **Il nome** è l'unica decisione aperta e blocca logo/favicon.
- **Verifica del nome solo indicativa:** ho cercato tre nomi sul web; Ribalta e Specchio non sono ancora stati controllati.
- **Tasto Home e immersivi:** non c'è un tasto casa negli scenari immersivi (scelta di realismo); se lo vuoi anche lì, va
  deciso come renderlo discreto (es. visibile solo al passaggio del mouse).
- **Ricerca:** nessun effetto fuori dalla Home e nascosta sotto i 768px (invariato).
- **File del vecchio feed ancora da eliminare** sul repository (§1).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Prima del caricamento dei dati "Scenari" è un link `href="#"` (comportamento preesistente, ~ms); non è un bottone finché `modules.json` non risolve.

### Refactoring consigliati
- 🟡 **Marchio in un unico punto** (oggi 7 stringhe sparse): lo si fa con il rinominare.
- 🟡 **Igiene del repository** (preesistente): `tests/node_modules` e `tests/screenshots/` sono versionati; `tests/README.md` e `README.md` radice sono obsoleti.
- 🟢 `Sidebar.js` conserva un'icona `icon` per voce mai usata da nessun consumer (prop preesistente).

### Ottimizzazioni future
- 🟢 Frecce su/giù tra le intestazioni della fisarmonica (pattern WAI-ARIA opzionale).
- 🟢 Ricerca disponibile anche sotto i 768px e dalle altre pagine.

### Rischi architetturali
- 🟢 Nessuno nuovo: tutte le estensioni sono additive e testate; la regola di visibilità delle aree resta in un solo punto (`scenarioCatalog.js`).

### Priorità
- 🟡 Media: marchio unico + nome (sblocca identità visiva); igiene repo.
- 🟢 Bassa: il resto.

### Obiettivo
Navigazione coerente su qualunque schermata (Home sempre a un click), Sidebar compatta e controllata dal docente, nessun
contenuto di area scritto nel codice e nessuna anticipazione degli scenari durante la proiezione.
