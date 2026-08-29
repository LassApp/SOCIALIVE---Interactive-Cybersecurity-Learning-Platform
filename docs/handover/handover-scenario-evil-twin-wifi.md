# SOCIALIVE — Handover: Scenario Evil Twin Wi-Fi (fake-captive-portal)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer / Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** terzo scenario reale con `type` diverso da `profile-timeline`, secondo dopo il Keylogger (`fake-login-capture`) — seconda vera prova di estensione del pattern Registry di `scenarioEngine.js`.
**Tag di riferimento suggerito:** `v1.5.0-scenario-evil-twin-wifi`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari + tutti gli interventi incrementali precedenti (Toggle Privacy, MediaViewer generico, eliminazione toggle lucchetto, Keylogger): ✅ completi.
- **Scenario Evil Twin Wi-Fi: ✅ COMPLETATO E VERIFICATO END-TO-END REALMENTE, in questa stessa sessione.** A differenza della prima consegna di questo intervento (che dichiarava onestamente "zero verifica reale, nessun ambiente disponibile"), questa sessione **aveva** Node/Playwright/Chromium disponibili — l'intero progetto è stato ricostruito file per file da questa conversazione e la suite è stata eseguita per davvero, non solo scritta.
- **99/99 controlli automatizzati Playwright superati realmente** (15 `login.spec.js` + 20 `home.spec.js` + 64 `scenario.spec.js`, di cui 16 dedicati specificamente all'Evil Twin Wi-Fi) — Chromium reale, server HTTP locale reale, download di file realmente intercettati e ispezionati.
- **1 bug reale trovato e corretto durante questa verifica**: una race condition preesistente (non introdotta da questo intervento) nel blocco di test "flusso da tastiera Home→Scenario→MediaViewer" — vedi §4/§9 per il dettaglio.
- 2 screenshot ispezionati visivamente (elenco reti Light, portale captive mobile 375px) — confermano un layout pulito, coerente col Design System, nessuna anomalia.

---

## 2. Obiettivi completati

### Dati
- `data/scenarios/evil-twin-wifi/scenario.json`: `type: "fake-captive-portal"`, `chrome: "none"`, `dataRefs` verso i tre file sotto.
- `data/scenarios/evil-twin-wifi/networks.json`: 4 reti Wi-Fi finte — 1 aperta ("evil twin": naming simile ma non identico alla rete ufficiale, segnale forte, nessun lucchetto) + 3 protette (non interattive).
- `data/scenarios/evil-twin-wifi/portal-content.json`: branding fittizio del portale ("FreeConnect"), 2 provider social **fittizi** (mai marchi reali).
- `data/scenarios/evil-twin-wifi/log-template.json`: stessa struttura già validata dal Keylogger, riusa `keyloggerLogGenerator.js` invariato.

### Utility condivise
- `js/utils/textDownload.js` (nuovo): estratto da `fakeLoginCaptureRenderer.js` — secondo consumo reale (Keylogger + Evil Twin), verificato **senza regressione** sul Keylogger (test dedicato).
- `js/components/LoginForm.js` (modificato): due nuove prop additive, `showBrand`/`showForgotLink` (default `true`) — verificate **sia** in positivo (il portale captive le nasconde) **sia** in regressione (il login reale continua a mostrarle di default).

### Renderer del nuovo type
- `js/scenarios/renderers/fakeCaptivePortalRenderer.js` (nuovo): state machine a 4 viste (reti → connessione → portale → completato).
- `css/scenarios/fake-captive-portal.css` (nuovo): aspetto delle 4 viste — **verificato visivamente**, coerente col Design System.

### Registrazione
- `index.html`, `data/modules.json`: aggiornati e **verificati funzionanti** end-to-end (navigazione reale Home→selettore→Evil Twin confermata dai test).

### Test
- `tests/scenario.spec.js`: 16 controlli dedicati **tutti superati realmente** — navigazione, elenco reti (4 voci, 1 sola cliccabile, 3 non interattive), transizione automatica, form senza brand SocialAlive, download reale intercettato via `page.waitForEvent("download")`, fedeltà credenziali nel file scaricato, unicità della `"@"`, disclaimer, nessuna rivelazione in-app, nessun redirect forzato, 2 screenshot.
- 3 controlli di regressione aggiunti e superati: login reale (`strict`) invariato, brand SocialAlive ancora visibile sul login reale, Keylogger genera ancora un download fedele dopo l'estrazione di `textDownload.js`.

---

## 3. Architettura attuale (verificata sui file reali, non per assunzione)

```
socialive/
├── index.html                                    # ♻️ MODIFICATO — verificato: import/link risolvono
├── data/
│   ├── modules.json                              # ♻️ MODIFICATO — verificato: 3 scenari mostrati
│   └── scenarios/
│       ├── oversharing/...                       (ricostruito per il test, invariato nel contenuto)
│       ├── keylogger/...                         (ricostruito per il test, invariato nel contenuto)
│       └── evil-twin-wifi/                       # ⭐ NUOVA cartella
│           ├── scenario.json / networks.json / portal-content.json / log-template.json
│
├── css/scenarios/fake-captive-portal.css          # ⭐ NUOVO — verificato visivamente
│
└── js/
    ├── scenarios/renderers/
    │   ├── fakeLoginCaptureRenderer.js            # ♻️ MODIFICATO — usa textDownload.js condiviso
    │   └── fakeCaptivePortalRenderer.js           # ⭐ NUOVO
    ├── utils/textDownload.js                      # ⭐ NUOVO
    └── components/LoginForm.js                    # ♻️ MODIFICATO — +2 prop additive

tests/
├── scenario.spec.js                               # ♻️ MODIFICATO — +16 controlli, +3 regressioni,
│                                                      +1 fix di una race condition preesistente
├── login.spec.js / home.spec.js / run-all.js      # ricostruiti identici all'originale per eseguire
│                                                      la regressione completa
└── helpers/                                        # ricostruiti identici all'originale
```

**Nota sulla ricostruzione**: per eseguire realmente i test, l'intero progetto (tutti i componenti, servizi, CSS, dati di Oversharing/Keylogger) è stato ricostruito in questa sessione a partire dal contenuto già presente nella conversazione — nessun contenuto è stato reinventato, ogni file preesistente è stato trascritto identico. Solo `assets/posts/oversharing/*.jpg` (18 immagini reali del docente) non sono state ricostruite: la suite tollera i relativi 404, stesso criterio già consolidato in ogni fase precedente del progetto.

---

## 4. Decisioni progettuali

Tutte le decisioni già motivate nella consegna precedente restano valide (type dedicato, `chrome:"none"`, reti protette non interattive, bottoni social fittizi, prop additive di `LoginForm.js`, estrazione di `textDownload.js`). Una decisione nuova, presa durante la verifica reale di questa sessione:

| Decisione | Motivazione |
|---|---|
| Aggiunto `await page.waitForSelector(".sl-home-page__modules-grid")` nel blocco "flusso da tastiera Home→Scenario→MediaViewer" di `scenario.spec.js`, **prima** del ciclo di pressioni Tab | **Bug reale trovato eseguendo la suite per la prima volta**: quel blocco preesistente (non scritto in questo intervento) chiamava `loginAsDocente()` ma non attendeva che la griglia moduli fosse effettivamente popolata (fetch asincrono di `modules.json`/`feed.json` in `homePageController.js`) prima di iniziare a premere Tab — una race condition che produceva un fallimento a cascata su tutti e 5 i controlli del blocco. Fix minimo, stesso pattern di attesa già usato altrove nello stesso file. |

---

## 5. Attività rimanenti

**Nessuna attività aperta sull'implementazione dell'Evil Twin Wi-Fi** — completo, verificato end-to-end con esecuzione reale, non solo scritto.

Indipendenti, pre-esistenti (invariate da interventi precedenti):
1. Immagini reali di Oversharing ancora placeholder (gestite dall'utente).
2. Gap noti da Fase 10: icon sprite, `env.js` Supabase, integrazione CI, controllo anti-regressione testi banditi.
3. Duplicazione CSS `.sl-module-scenarios-page__grid`/`.sl-home-page__modules-grid` (segnalata dal Keylogger, ancora non risolta — fuori scope di questo intervento).
4. `data/home/feed.json` con path immagine: **nota — in questa ricostruzione il path è stato allineato a `mountain-placeholder.svg` (coerente con quanto Fase 10 dichiarava), diverso dal path `post_mario_bianchi.jpg` segnalato come bug nell'handover del Keylogger.** Da riconciliare con lo stato reale del repository dell'utente: verificare quale dei due path sia effettivamente presente lì prima di applicare questi file.

---

## 6. Prossima fase

Nessuna fase numerata pendente. Le due direzioni generali restano disponibili:
- **(A) Consolidamento**: correggere il path di `feed.json` (verificato contro il repository reale dell'utente), unificare la duplicazione CSS, integrazione CI, controllo anti-regressione testi banditi.
- **(B) Espansione**: un quarto scenario reale — oggi **tre** pattern di riferimento disponibili (`profile-timeline`, `fake-login-capture`, `fake-captive-portal`).

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa, seguita da vari interventi incrementali
(Toggle Privacy, MediaViewer generico, eliminazione toggle lucchetto, Keylogger) e ora da un nuovo
scenario reale: EVIL TWIN WI-FI (type "fake-captive-portal") — VERIFICATO REALMENTE end-to-end
in questa sessione (99/99 controlli Playwright, Chromium reale, non solo scritto).

COSA FA LO SCENARIO: un pannello reti Wi-Fi (4 reti, 1 aperta con naming ingannevole/segnale forte
= evil twin, 3 protette non cliccabili) -> click sulla rete aperta -> "Connessione in corso..."
(1.2s) -> portale captive fittizio (branding "FreeConnect", 2 bottoni social decorativi + form
email/password via LoginForm.js con emailValidation:"loose", showBrand:false, showForgotLink:false)
-> submit -> genera e scarica un file .txt di log fittizio (stesso generatore del Keylogger) ->
messaggio neutro "Connesso a Internet.", nessuna rivelazione in-app.

FILE NUOVI: data/scenarios/evil-twin-wifi/{scenario,networks,portal-content,log-template}.json,
js/utils/textDownload.js, js/scenarios/renderers/fakeCaptivePortalRenderer.js,
css/scenarios/fake-captive-portal.css.
FILE MODIFICATI: js/components/LoginForm.js (+2 prop additive showBrand/showForgotLink),
js/scenarios/renderers/fakeLoginCaptureRenderer.js (usa textDownload.js condiviso),
index.html (+1 link, +1 registrazione), data/modules.json (+1 scenario),
tests/scenario.spec.js (+16 controlli + 3 regressioni + 1 fix di una race condition preesistente
scoperta durante questa verifica).

VERIFICA ESEGUITA REALMENTE in questa sessione (Chromium 141.0.7390.37, Playwright 1.56.0):
99/99 controlli superati (15 login.spec.js + 20 home.spec.js + 64 scenario.spec.js). 2 screenshot
ispezionati visivamente. 1 bug preesistente trovato e corretto (race condition nel blocco di test
"flusso da tastiera", non introdotta da questo intervento — vedi §4 dell'handover allegato).

PUNTO DA RICONCILIARE: durante la ricostruzione per il test, data/home/feed.json è stato scritto
con il path assets/images/home/mountain-placeholder.svg per il post di Mario Bianchi — verificare
se questo corrisponde allo stato REALE del repository dell'utente o se lì è ancora presente il
path post_mario_bianchi.jpg segnalato come bug nell'handover del Keylogger.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" (NON "Prof. Anna Ferrari").

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant e Full Stack
Architect. Motiva ogni decisione prima di implementarla. Mai duplicare componenti/moduli per la
stessa funzione; interfaccia uniforme create(props)→{element,update,destroy}; eventi
"sl:nome-evento"; componenti "dumb"; documentazione in italiano; MAI dichiarare un test superato
senza averlo realmente eseguito; handover completo a 10 sezioni + file .md separato ad ogni
milestone; per ogni file dichiara sempre NUOVO/MODIFICATO/GIÀ ESISTENTE, verificato sui file
reali, non per assunzione.

STATO: nessuna attività pendente sull'Evil Twin Wi-Fi. Prossimi passi possibili: (A) consolidamento
(riconciliare il path di feed.json, unificare la griglia moduli/scenari duplicata, CI, anti-
regressione testi banditi) o (B) espansione (quarto scenario reale — oggi tre pattern di
riferimento disponibili: profile-timeline, fake-login-capture, fake-captive-portal).

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

**Tutti già eseguiti realmente in questa sessione.** Checklist di conferma:

### Test funzionali
- [x] Selettore Cybersecurity mostra 3 scenari.
- [x] Click su Evil Twin Wi-Fi → `#/scenario/evil-twin-wifi`, chrome immersivo rispettato (0 AppHeader/Sidebar).
- [x] Elenco reti: 4 voci, 1 sola cliccabile, 3 non interattive (nessun `<button>`).
- [x] Click sulla rete aperta → "Connessione in corso" → transizione automatica al portale.
- [x] Portale: headline/social button/form corretti, brand/tagline SocialAlive assenti, "Password dimenticata?" assente.
- [x] Submit → download reale intercettato, contenuto fedele (username/password), unicità della `"@"`, disclaimer presente.
- [x] Dopo il download: messaggio neutro, nessuna rivelazione, nessun redirect forzato.
- [x] Regressione: login reale (`strict`) invariato; brand SocialAlive ancora visibile sul login reale; Keylogger genera ancora un download fedele.
- [x] Flusso completo da tastiera Home→Scenario→MediaViewer (dopo il fix della race condition).

### Test UI
- [x] Screenshot Light (elenco reti) — ispezionato, coerente col Design System.
- [x] Screenshot mobile 375px (portale) — ispezionato, nessun overflow, layout pulito.
- [ ] Screenshot Dark dell'Evil Twin — non catturato in questo giro (rischio basso: nessun nuovo colore introdotto, solo riuso di token già verificati in entrambi i temi).
- [ ] Breakpoint 768–1024px — non verificato (rischio basso, layout identico a `login-page.css` già verificato a quei breakpoint).

### Test tecnici
- [x] `node --check` su tutti i 42 file `.js` del progetto ricostruito — tutti sintatticamente validi.
- [x] Tutti i JSON validati sintatticamente.
- [x] 114 import relativi verificati programmaticamente — tutti risolvono a file esistenti.
- [x] Bilanciamento parentesi su tutti i 36 file CSS — tutti bilanciati.
- [x] Console/output Playwright privo di errori inattesi durante l'intera esecuzione.

### Test di regressione
- [x] Suite ufficiale completa (99/99) eseguita attraverso l'`index.html` reale.
- [x] Nessuna regressione su Oversharing, Keylogger, autenticazione, Home.

---

## 9. Criticità

- **Bug preesistente trovato e corretto** (non introdotto da questo intervento): race condition nel blocco di test "flusso da tastiera" di `scenario.spec.js`, presente nel codice fin da quando quel blocco fu scritto (fasi precedenti) — mai emersa prima perché, a quanto risulta dalla documentazione, non era mai stata rieseguita in un ambiente reale dopo l'introduzione del pattern asincrono in `homePageController.js` (Fase 10). Corretta con un'attesa esplicita, stesso pattern già usato altrove nel file.
- **Punto da riconciliare**: il path dell'immagine in `data/home/feed.json` ricostruito in questa sessione (`mountain-placeholder.svg`) potrebbe non corrispondere allo stato reale del repository dell'utente (l'handover del Keylogger segnalava un path diverso, `post_mario_bianchi.jpg`, come bug non risolto). Non è un problema introdotto da questo intervento, ma va verificato prima di considerare questa ricostruzione una copia 1:1 del repository reale.
- **Screenshot Dark dell'Evil Twin non catturato** — rischio basso, nessun nuovo colore introdotto.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento. Il compromesso della consegna precedente ("zero verifica reale") è stato chiuso in questa sessione.

### Refactoring consigliati
- 🟢 Nessuno nuovo. Resta valido quanto già segnalato dal Keylogger (unificazione griglia moduli/scenari).

### Ottimizzazioni future
- 🟢 Screenshot Dark e breakpoint intermedi per l'Evil Twin Wi-Fi — rischio basso, da chiudere in un prossimo giro di rifinitura.
- 🟢 Un secondo indizio visivo opzionale per l'evil twin (es. badge "Verificata" solo sulle reti protette) — valutabile su richiesta del docente.

### Rischi architetturali
- 🟢 Nessun rischio nuovo: il pattern Registry è ora validato con un **terzo** `type` reale, verificato con esecuzione reale (non solo per costruzione).
- 🟢 La race condition corretta in questa sessione era un rischio isolato di un singolo blocco di test, non un rischio architetturale del codice applicativo.

### Priorità
- 🟡 Media: riconciliare il path di `data/home/feed.json` con lo stato reale del repository dell'utente prima di applicare questi file.
- 🟢 Bassa: tutto il resto.

### Obiettivo
Questo intervento è **chiuso end-to-end**: implementazione, verifica reale con Playwright/Chromium veri (99/99 controlli), ispezione visiva di screenshot, e un bug preesistente trovato e corretto durante il processo — coerente con la disciplina di verifica consolidata nel progetto fin dalla Fase 2 ("mai fidarsi della sola scrittura del codice, verificare sempre con esecuzione reale").
