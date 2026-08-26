# SOCIALIVE — Handover: Fix collisione bottone/titolo + "Rispondi" inline (Phishing)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** seconda revisione post-produzione dello scenario Phishing, richiesta dal docente
dopo l'uso reale in aula (la prima revisione — bottone di uscita, full-screen, cartelle, stato
"letta" — è già committata sul repository reale, commit `a65a334 "fix bug mail"`). Non introduce
una nuova "Fase" numerata: estende `phishingSimulationRenderer.js`/`scenario-page.css`, quindi
impatta lo scenario Phishing e, per il bottone di uscita, ogni futuro scenario `chrome:"none"`.
**Baseline di partenza (verificata clonando il repository reale, non per assunzione):** commit
`a65a3340b6ad082a64af11bbb619fece6c4fe68c` ("fix bug mail").
**Tag di riferimento suggerito:** `v1.5.1-fix-titolo-e-rispondi-email`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari + interventi su Oversharing + scenario Keylogger + scenario
  Phishing + Supabase Auth + prima revisione post-produzione ("fix bug mail"): ✅ completi,
  **già committati sul repository reale** (verificato clonando il repo all'inizio di questa
  sessione, non fidandosi del solo prompt di continuità — che infatti dichiarava erroneamente il
  bottone di uscita già spostato a destra: non lo era, vedi §4/§9).
- **Questa sessione: ✅ COMPLETATA E VERIFICATA DAL DOCENTE** ("test superati"). Due richieste
  affrontate, entrambe con alternative proposte e confermate dal docente PRIMA di scrivere
  codice (stesso metodo del progetto):
  1. Collisione visiva tra il titolo "MailTime" e il bottone di uscita "×" — diagnosticata
     leggendo il codice reale (nessuno screenshot necessario), corretta spostando il bottone.
  2. Funzionalità "Rispondi" inline sulle email del finto client di posta.
- **Verifica**: sintassi (`node --check`) e bilanciamento parentesi CSS eseguiti da questa sessione
  su tutti i file toccati; **verifica visiva/funzionale reale (incl. i 7 nuovi controlli
  Playwright) eseguita dal docente in locale** — confermata superata ("test superati").
- **File consegnati come download in questa sessione, non ancora committati dal docente sul
  repository** (nessuna credenziale di push disponibile qui, invariato da sempre) — vedi §3 per
  l'elenco esatto e §9 per la nota operativa.

---

## 2. Obiettivi completati

### 2.1 — Collisione bottone di uscita / titolo "MailTime"

- **Diagnosi via codice, non per assunzione**: il bottone `.sl-scenario-page__immersive-exit`
  (`css/layouts/scenario-page.css`) era `position:fixed; top:space-4; left:space-4` — lo stesso
  angolo in cui `.sl-phishing__topbar` colloca il proprio `<h1>` "MailTime" (padding
  `space-4`/`space-5`, nessun posizionamento proprio). Un elemento `fixed` viene dipinto sopra il
  contenuto in flusso normale nello stesso punto: il bottone (opaco, `z-index:500`) copriva
  letteralmente le prime lettere del titolo. Confermato leggendo entrambi i file CSS/JS, **senza
  bisogno di uno screenshot** dal docente.
- **Correzione**: bottone spostato a `right: var(--sl-space-4)`. Verificato (leggendo tutte le
  regole `position:fixed/absolute` di Phishing e Keylogger) che nessuna delle 5 viste di Phishing
  né la vista di Keylogger hanno alcun elemento ancorato in alto a destra — zero rischio di una
  collisione equivalente dall'altro lato. Scelta anche perché coerente con la convenzione già
  stabilita nel Design System: il bottone × di `MediaViewer` è già `top/right`.
- **Alternativa scartata, motivata**: spostare il titolo invece del bottone (la richiesta
  letterale iniziale del docente) avrebbe richiesto che ogni futuro renderer `chrome:"none"`
  "ricordasse" di lasciare libero l'angolo in alto a sinistra — in contrasto con la ragione stessa
  per cui il bottone vive in `scenario-page.css` (concern trasversale, nessun renderer deve
  conoscerlo). Il docente ha confermato l'alternativa A (sposta il bottone) dopo aver visto la
  motivazione.
- **Test di regressione dedicato** (nuovo): confronto geometrico reale (`boundingBox()`) tra
  bottone e titolo — un test che verifica l'assenza di sovrapposizione con i numeri, non solo "il
  bottone esiste".

### 2.2 — "Rispondi" inline su ogni email

- **`buildReplyBox()` (nuovo, in `phishingSimulationRenderer.js`)**: riquadro di risposta
  costruito on-demand al click su "Rispondi" (mai già presente e nascosto nel DOM — pattern
  "disclosure" già usato da AppHeader/ProfileMenu). Textarea grezza (Input.js espone solo campi a
  riga singola: introdurre un componente Textarea dedicato con un solo consumer reale avrebbe
  violato YAGNI) che riusa però `.sl-input__field`/`__label`/`__helper` — bordo, focus, stato di
  errore, disabled — già verificati in `input.css`, zero stile duplicato.
- **Disponibile su OGNI email della cartella attiva**, non solo quella target (decisione confermata
  esplicitamente dal docente tra le alternative proposte): coesiste con il bottone CTA
  sull'email di phishing (i due non si escludono a vicenda).
- **Riquadro inline, non una sesta vista**: la vista Dettaglio è già ricostruita ad ogni
  transizione (nessuno stato da preservare) — un riquadro inline ottiene lo stesso risultato
  percepito con zero stati aggiuntivi nella macchina esistente (alternativa "vista Compose
  separata" scartata, motivata e confermata dal docente).
- **Finzione end-to-end, stesso livello dei form bancari e del download di Keylogger**: nessun
  testo viene mai persistito o inviato in rete — solo una finta latenza (`FAKE_SUBMIT_DELAY_MS`,
  costante già esistente, riusata) seguita da un messaggio neutro "Risposta inviata.". Validazione
  minima (`validateRequired`, la stessa funzione già usata dai due form bancari): solo "non
  vuoto", nessun controllo di formato.
- **Accessibilità**: label reale associata (non solo placeholder), `aria-invalid`/
  `aria-describedby` sincronizzati con l'errore (stesso pattern di `Input.js`), focus spostato
  sulla textarea alla rivelazione del riquadro, annuncio `aria-live` dedicato
  (`.sl-phishing__reply-status`, distinto dallo status di cambio-vista della macchina a stati) per
  la conferma di invio.
- **Evento `sl:phishing-reply-sent`** (detail: `{ emailId }`) emesso ad ogni invio completato —
  nessun listener applicativo reale lo ascolta oggi, stesso trattamento già riservato altrove nel
  progetto a interazioni non ancora consumate (`sl:search`, ecc.), pronto per un futuro consumer.

### 2.3 — Persistenza nella suite di test

- **`tests/phishing.spec.js` esteso** con 7 nuovi controlli: 1 di regressione geometrica sul
  bottone di uscita + 6 sul "Rispondi" (presenza su email target/di riempimento, rivelazione del
  riquadro con focus corretto, validazione su campo vuoto, invio con testo → conferma + annuncio
  `aria-live`, vincolo etico — nessuna richiesta di rete generata dall'invio).
- Docstring di testa al file aggiornato per riflettere entrambe le revisioni post-produzione,
  stessa disciplina già imposta dal progetto ("mai lasciare un commento disallineato dal codice
  reale sottostante").
- **Eseguiti realmente dal docente in locale** (`headless:false`, coerente con la nota tecnica
  nota per Playwright su Windows contro Supabase) — confermato "test superati".

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `css/layouts/scenario-page.css` | **MODIFICATO** | `.sl-scenario-page__immersive-exit`: `left`→`right`; rationale del bug documentato nel commento di testa al blocco |
| `css/scenarios/phishing-simulation.css` | **MODIFICATO** | Nuovo blocco `.sl-phishing__reply-*` (area/toggle/form/field/submit/confirmation), riuso di `.sl-input__*`; nota nel docstring di testa al file |
| `js/scenarios/renderers/phishingSimulationRenderer.js` | **MODIFICATO** | Nuova funzione `buildReplyBox()`; `buildEmailDetailView()` estesa con toggle "Rispondi"/riquadro/stato/evento; docstring di testa aggiornato (sezione "RISPONDI INLINE") |
| `tests/phishing.spec.js` | **MODIFICATO** | +7 controlli (1 regressione bottone/titolo, 6 su "Rispondi"); docstring di testa aggiornato |

**Nessun file nuovo.** Nessuna modifica a `index.html` (nessun nuovo asset da collegare — tutti i
file toccati erano già linkati/referenziati). Nessuna modifica a `router.js`,
`scenarioPageController.js`, `scenarioEngine.js`, `appShell.js`, `authService.js`,
`data/scenarios/phishing/inbox.json`, `Button.js`, `Input.js`, `Loader.js`, o a qualunque altro
componente/scenario del progetto.

```
socialive/
├── css/
│   ├── layouts/
│   │   └── scenario-page.css                # ♻️ MODIFICATO
│   └── scenarios/
│       └── phishing-simulation.css           # ♻️ MODIFICATO
├── js/
│   └── scenarios/renderers/
│       └── phishingSimulationRenderer.js      # ♻️ MODIFICATO
└── tests/
    └── phishing.spec.js                       # ♻️ MODIFICATO
```

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Diagnosi della collisione via lettura del codice, non via screenshot | Le coordinate dei due elementi (bottone fixed, titolo statico) erano leggibili con certezza dai due file CSS/JS — uno screenshot avrebbe confermato un fatto già determinabile con precisione maggiore dal codice |
| Sposta il bottone (non il titolo) | Coerente con la ragione architetturale per cui il bottone vive in `scenario-page.css` (concern trasversale a ogni `chrome:"none"`, nessun renderer deve conoscerlo) — spostare il titolo avrebbe richiesto che ogni futuro scenario immersivo "sapesse" di lasciare libero quell'angolo |
| Verifica geometrica (non solo presenza) come test di regressione | Un test che verifica solo "il bottone esiste" non avrebbe mai potuto rilevare QUESTO bug (il bottone esisteva, era solo mal posizionato) — la lezione esplicita di questa sessione |
| Riquadro "Rispondi" inline, non una sesta vista | La vista Dettaglio non ha alcuno stato da preservare tra un mount e l'altro (rebuild-on-transition) — una vista Compose separata sarebbe complessità aggiunta senza un bisogno reale (YAGNI) |
| "Rispondi" su ogni email, non solo quella target | Decisione esplicita del docente: l'obiettivo è "sembrare un vero client di posta" in generale, non rinforzare solo il flusso di phishing — un secondo bottone sulla stessa email target non lo confonde, coesiste col CTA |
| Textarea grezza, non un componente Design System dedicato | Un solo consumer reale oggi (YAGNI, stesso criterio applicato in tutto il progetto) — riusa comunque le classi CSS di `Input.js` già verificate, zero duplicazione visiva |
| Validazione minima ("non vuoto") | Stesso principio già applicato ai form del finto sito bancario: non è compito di SOCIALIVE giudicare la qualità di un testo libero |
| Nessuna persistenza/rete per l'invio | Stesso vincolo etico assoluto già rispettato da Keylogger e dal finto sito bancario — verificato con un test dedicato che intercetta ogni richiesta di rete durante il flusso |

---

## 5. Attività rimanenti

**Nessuna attività aperta su questo specifico intervento** — implementazione, verifica di sintassi
(questa sessione) e verifica funzionale/visiva reale (docente, "test superati") sono complete.
Punti pre-esistenti e indipendenti, invariati:

1. **I 4 file di questa sessione non sono ancora committati sul repository reale** — vedi §9,
   nota operativa.
2. Immagini reali di Oversharing (placeholder a tinta unita, gestite autonomamente dal docente).
3. Gap dichiarati e invariati da tempo: icon sprite (`assets/icons/icons.svg`),
   `js/config/env.js` per eventuali chiavi Supabase aggiuntive, integrazione CI, controllo
   anti-regressione per contenuti testuali banditi.
4. **Progetto Supabase**: se risultasse sospeso per inattività, va riattivato dalla dashboard
   prima di un qualunque test dal vivo — non un problema di codice.

---

## 6. Prossima fase

Nessuna fase numerata pendente dalla Suite originaria. Le due direzioni generali già proposte in
chiusura delle fasi precedenti restano valide come prossimi passi:

- **Consolidamento**: applicare/committare questi 4 file sul repository reale (passo immediato,
  vedi §9); integrazione CI per `tests/`; controllo anti-regressione per contenuti testuali
  banditi.
- **Espansione**: quarto scenario reale (Social Engineering, Fake News, Password Security,
  Deepfake, Malware, Ransomware, QR Code, Cyberbullismo, Privacy, Identity Theft — Long Term
  Vision), oppure ulteriori rifiniture di realismo sugli scenari esistenti se emergessero da un
  ulteriore uso in aula.

**Punto di ripartenza esatto**: nessun lavoro a metà. Chi riprende deve solo (a) confermare che i
4 file di questa sessione siano stati applicati/committati, (b) chiedere al docente se sono emerse
altre osservazioni dall'uso in aula prima di proporre nuovo lavoro.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). Stato: Suite dei 10 prompt + interventi su Oversharing + scenario Keylogger + scenario
Phishing + Supabase Auth + due revisioni post-produzione (bottone di uscita/full-screen/cartelle/
stato-letta, poi collisione titolo/bottone + "Rispondi" inline) sono COMPLETE. Il documento di
handover completo di questa sessione è allegato: consideralo la fonte di verità primaria — non
ripartire da assunzioni sul suo contenuto né su quello di un prompt di continuità precedente (in
QUESTA sessione un prompt di continuità precedente si è rivelato impreciso su un punto verificabile
col codice: dichiarava il bottone di uscita già spostato a destra quando nel commit reale era
ancora a sinistra — causa diretta del bug segnalato dal docente).

DISCIPLINA OBBLIGATORIA, CONFERMATA UTILE ANCORA UNA VOLTA IN QUESTA SESSIONE: clona SEMPRE il
repository reale (https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform.git,
--depth 50) PRIMA di analizzare qualunque file o scrivere codice — mai fidarsi della sola
narrazione di un handover o di un prompt di continuità precedente, verificare sempre il file
reale. github.com/codeload.github.com sono raggiungibili dal sandbox; Supabase
(tnvwfptcjjymwrnpcgsi.supabase.co) e il download del browser Chromium per Playwright NON lo sono
— quindi in un ambiente sandbox equivalente puoi verificare la sintassi (node --check, bilancio
parentesi CSS) ma NON eseguire visivamente/E2E: dichiaralo sempre esplicitamente, non presentare
mai una verifica di sintassi come se fosse una verifica funzionale.

BASELINE REALE ALL'INIZIO DI QUESTA SESSIONE: commit a65a3340b6ad082a64af11bbb619fece6c4fe68c
("fix bug mail") — già conteneva le 4 correzioni della revisione post-produzione precedente
(bottone di uscita, full-screen su 5 viste, cartelle email, stato "letta").

COSA HA FATTO QUESTA SESSIONE (2 richieste del docente dopo l'uso in aula, entrambe risolte con
alternative proposte e confermate PRIMA del codice):
1. Bottone di uscita "×" spostato da top-left a top-right (css/layouts/scenario-page.css) — era
   la causa diretta della collisione visiva col titolo "MailTime" (entrambi ancorati allo stesso
   angolo), diagnosticata leggendo il codice, non con uno screenshot. Nessun'altra vista di
   Phishing/Keylogger ha elementi in alto a destra — zero rischio di nuova collisione.
2. Funzionalità "Rispondi" inline (js/scenarios/renderers/phishingSimulationRenderer.js, nuova
   funzione buildReplyBox() + estensione di buildEmailDetailView()): su OGNI email della cartella
   attiva (decisione confermata dal docente), riquadro rivelato al click (textarea + bottone
   "Invia risposta"), validazione minima (solo "non vuoto"), finta latenza + messaggio neutro
   "Risposta inviata." — nessun dato mai persistito o inviato in rete (verificato con un test
   dedicato che intercetta le richieste). CSS in css/scenarios/phishing-simulation.css riusa le
   classi già verificate di Input.js (.sl-input__field/__label/__helper), nessun nuovo componente
   Design System (un solo consumer reale, YAGNI).

FILE MODIFICATI (nessun file nuovo): css/layouts/scenario-page.css, css/scenarios/
phishing-simulation.css, js/scenarios/renderers/phishingSimulationRenderer.js,
tests/phishing.spec.js.

VERIFICA: sintassi (node --check) e bilancio parentesi CSS eseguiti in questa sessione (ambiente
sandbox, nessuna esecuzione Playwright possibile). Verifica funzionale/visiva reale (incl. i 7
nuovi controlli Playwright, headless:false) ESEGUITA DAL DOCENTE IN LOCALE — confermata superata.

STATO OPERATIVO DA VERIFICARE ALL'INIZIO DELLA PROSSIMA SESSIONE: i 4 file sono stati consegnati
come download in questa sessione — verifica clonando il repository se il docente li ha già
committati, non darlo per scontato (stessa cautela già raccomandata più volte nella storia del
progetto).

DATI DEMO LOGIN: Supabase Auth, username "docente@scuola.it", password invariata, displayName
reale "Prof. Erasmo Lassandro". Se il progetto Supabase risultasse sospeso per inattività, va
riattivato dalla dashboard prima di un test dal vivo.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant, Full Stack
Architect. Motiva ogni decisione prima di implementarla, proponi alternative reali per ogni punto
ambiguo e attendi conferma prima di scrivere codice. Mai duplicare componenti/moduli per la stessa
funzione; interfaccia uniforme create(props)→{element,update,destroy}; eventi "sl:nome-evento";
componenti "dumb"; documentazione in italiano; verifica sempre il contenuto reale dei file (clona
il repo) prima di qualunque affermazione su "cosa è già fatto"; commenti/docstring sempre allineati
al codice dopo ogni modifica; per ogni file dichiara sempre NUOVO/MODIFICATO/GIÀ ESISTENTE,
verificato sui file reali; handover completo a 10 sezioni + file .md separato a fine sessione.

STATO: nessuna attività pendente su questo intervento. Chiedi al docente se sono emerse altre
osservazioni dall'uso in aula prima di proporre nuovo lavoro, oppure procedi con una delle due
direzioni generali (consolidamento o espansione a un quarto scenario) se non ce ne sono.
```

---

## 8. Test da eseguire

Tutti i controlli funzionali/UI/UX sotto sono stati **eseguiti realmente dal docente in locale**
in questa sessione ("test superati"). Questa sessione stessa ha potuto eseguire solo i controlli
tecnici di sintassi (nessun ambiente Playwright disponibile nel sandbox).

### Test funzionali
- [x] Bottone di uscita: nessuna sovrapposizione geometrica col titolo "MailTime" (nuovo test di
  regressione con `boundingBox()`).
- [x] Bottone di uscita: presente, `aria-label` onesto, riporta a `#/home` (test preesistente,
  invariato).
- [x] "Rispondi" presente sull'email target, insieme al CTA (i due non si escludono).
- [x] "Rispondi" presente anche su un'email di riempimento senza CTA (richiesta "su tutte").
- [x] Click su "Rispondi": il toggle sparisce, il riquadro appare, focus sulla textarea.
- [x] Invio vuoto → errore "Campo obbligatorio.", nessun invio simulato.
- [x] Invio con testo → stato "Invio in corso…", poi conferma "Risposta inviata." + annuncio
  `aria-live`, form rimosso dal DOM.
- [x] Vincolo etico: nessuna richiesta di rete generata dall'invio della risposta.
- [x] Regressione: full-screen, cartelle email, stato "letta" (revisione precedente) invariati.

### Test UI
- [x] Screenshot Inbox full-screen con tab cartelle (test preesistente, invariato).
- [ ] Screenshot dedicato al riquadro "Rispondi" aperto/in stato "conferma" — non incluso
  esplicitamente nei nuovi controlli di questa sessione (i controlli sono assertivi, non
  fotografici); valutare se aggiungerlo in un prossimo giro se serve una prova visiva persistita.
- [ ] Breakpoint intermedi (768–1024px) specifici sul riquadro "Rispondi" — non verificati in
  questa sessione (rischio basso: riusa `.sl-input__field`, già verificato a quei breakpoint
  altrove nel progetto).

### Test UX
- [x] Nessun movimento di focus indesiderato (focus si sposta SOLO sulla textarea alla rivelazione
  del riquadro, come previsto).
- [x] Coerenza testo↔stato del bottone "Invia risposta" (mai il solo colore come segnale).

### Test tecnici
- [x] `node --check` su `phishingSimulationRenderer.js` e `phishing.spec.js` (questa sessione).
- [x] Bilanciamento parentesi su `scenario-page.css`/`phishing-simulation.css` (questa sessione).
- [x] Console priva di errori nel flusso reale (verificato dal docente).
- [x] Nessun path relativo rotto — nessuna modifica a `index.html` necessaria.

### Test di regressione
- [x] Suite `tests/phishing.spec.js` completa (bug etico, cartelle, stato letta, full-screen,
  bottone di uscita, "Rispondi") — confermata superata dal docente.
- [ ] Suite completa `login.spec.js`/`home.spec.js`/`scenario.spec.js` (Oversharing/Keylogger) —
  non ri-eseguita esplicitamente in questa sessione (nessun file di quegli scenari toccato,
  rischio basso ma non una verifica eseguita in questo giro).

---

## 9. Criticità

- **Prompt di continuità impreciso su un punto verificabile col codice** (già segnalato in §1/§4):
  dichiarava il bottone di uscita "già spostato a destra", quando il commit reale lo aveva ancora
  a sinistra — causa diretta e diretta del bug segnalato dal docente. Stessa classe di errore già
  documentata più volte nella storia del progetto ("un handover/prompt di continuità può
  descrivere una correzione non realmente applicata, o descriverla in modo diverso da come è
  stata realmente applicata"). Mitigata in questa sessione clonando il repository reale PRIMA di
  qualunque modifica, come da disciplina di progetto — nessun impatto sul risultato consegnato,
  ma da tenere presente.
- **Nota operativa aperta**: i 4 file di questa sessione risultano consegnati come download, non
  ancora committati da questa conversazione (nessuna credenziale di push disponibile qui) — il
  docente ha confermato "test superati" eseguendoli in locale, ma andrebbe verificato che siano
  stati applicati/committati sul repository reale prima di considerare la baseline aggiornata per
  la prossima sessione.
- **Nessuno screenshot dedicato al riquadro "Rispondi"** persistito in questa sessione (solo
  asserzioni) — rischio basso, ma segnalato per completezza (vedi §8).
- Gap generali già noti e invariati (icon sprite, `env.js` Supabase, CI, anti-regressione testi
  banditi) — indipendenti da questo intervento.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento. Entrambe le correzioni chiudono debito
  comportamentale reale (collisione visiva, assenza di una funzionalità richiesta), non ne aprono
  di nuovo.

### Refactoring consigliati
- 🟢 Nessuno specifico a questo intervento: `buildReplyBox()` è isolata in un'unica funzione
  locale al file, coerente con lo stile già stabilito da `buildBankLoginView`/`buildBankCardView`
  nello stesso renderer — nessuna nuova indirection introdotta.

### Ottimizzazioni future
- 🟢 Screenshot dedicato al riquadro "Rispondi" (aperto e in stato "confermato") — se in futuro
  si vuole una prova visiva persistita oltre alle asserzioni funzionali già presenti.
- 🟢 Se un quarto scenario reale dovesse richiedere un secondo campo multi-riga, valutare in quel
  momento (non ora, YAGNI) se estrarre un componente `Textarea.js` dedicato dal pattern già
  isolato in `buildReplyBox()` — oggi un solo consumo reale non lo giustifica.

### Rischi architetturali
- 🟢 **Nessun rischio nuovo**: il bottone di uscita resta un concern trasversale unico in
  `scenario-page.css`, ora anche geometricamente verificato contro collisioni; "Rispondi" è
  puramente additivo all'interno di un renderer già isolato dal resto dell'architettura (nessuna
  modifica a componenti condivisi, router, servizi, o schema dati `inbox.json`).
- 🟡 **Persistenza della "lezione" sul prompt di continuità**: la discrepanza di §9 non è un
  rischio di codice, ma un rischio di processo già ricorrente nella storia del progetto — mitigato
  solo dalla disciplina "clona sempre il repo reale prima di agire", non da un controllo
  automatico. Nessuna azione nuova proposta oltre a quella già raccomandata in Fase 10
  (controllo anti-regressione persistito, mai implementato).

### Priorità
- 🟢 Bassa: tutto quanto sopra — nessuna criticità bloccante identificata da questo intervento.

### Obiettivo
Questo intervento è chiuso end-to-end: diagnosi via codice reale (non per assunzione), due
decisioni proposte con alternative motivate e confermate dal docente prima dell'implementazione,
verifica di sintassi in sessione e verifica funzionale/visiva reale del docente — pienamente
coerente con la disciplina di progetto consolidata in tutte le sessioni precedenti.
