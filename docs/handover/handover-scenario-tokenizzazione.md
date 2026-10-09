# SOCIALIVE — Handover: Scenario "Tokenizzazione" (LLM) + Sidebar a due livelli

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** nuovo scenario reale, il quinto `type` distinto della piattaforma
(`token-prediction`), primo scenario del nuovo modulo **AI**. Introduce anche la
riorganizzazione della Sidebar: la voce "Moduli" diventa "Scenari" e il suo flyout passa da
un elenco piatto a **due livelli** (categorie → scenari).
**Data:** 9 ottobre 2026.
**Tag di riferimento suggerito:** `scenario-tokenizzazione` (numero SemVer da assegnare
sull'ultimo tag reale del repository).

---

## 1. Stato del progetto

- Suite originaria (Fase 1 → 10) e scenari precedenti (Oversharing, Keylogger, Phishing,
  Evil Twin Wi-Fi): ✅ invariati nel comportamento.
- **Scenario Tokenizzazione: ✅ COMPLETATO E VERIFICATO** nell'ambiente di sviluppo (clone
  del repository GitHub, Chromium reale, server locale — mai `file://`).
- **Sidebar a due livelli: ✅ COMPLETATA E VERIFICATA.** "Scenari" → Cybersecurity
  (Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi) · AI (Tokenizzazione).
- **210/210 controlli Playwright** nell'ambiente di verifica: login 19 · home 27 ·
  scenario 78 · phishing 35 · sidebar 13 (nuova) · token 38 (nuova). La suite NON è stata
  eseguita con le tue credenziali reali: nella sandbox si usa un utente di prova con
  password temporanea, creato solo in quella copia di lavoro e **non consegnato** — in
  particolare `data/users.json` non è tra i file di questa consegna.
- Nessuna richiesta di rete esterna: verificato da un test dedicato (come per ogni scenario).

---

## 2. Obiettivi completati

### Scenario Tokenizzazione
- **Idea didattica realizzata:** lo studente assiste alla nascita di una frase un token alla
  volta. A ogni passo il finto modello assegna una percentuale a ciascun candidato successivo
  con un'animazione live, sceglie quello con la percentuale più alta e, con **Prosegui**, la
  frase avanza fino a un token finale. **Rigenera** rifà *solo* il calcolo del passo
  corrente: stesso punto dell'albero, distribuzione diversa, e può vincere un altro
  candidato — è il modo in cui lo studente vede il valore del contesto.
- **Albero di dati ampio e dinamico:** 198 frasi possibili, radice "Oggi" con 5 strade,
  frasi da 3 a 9 token, da 2 a 5 candidati per passo, tutte chiuse da un token finale
  (`.` o `!`, che compare tra i candidati come il token di fine sequenza degli LLM).
  Il file `token-tree-frasi.txt` (consegnato a parte, solo per rilettura, non fa parte del
  repository) elenca tutte le frasi.
- **Percentuali con decimali:** tre decimali ("87,412%"), nessun candidato sotto 0,001%,
  somma *sempre* esattamente 100,000% — anche in ogni fotogramma dell'animazione.
- **Animazione live:** le barre condividono lo stesso 100% e si ridistribuiscono in tempo
  reale (quando una sale le altre scendono), con oscillazioni che si spengono fino al
  risultato (~2,2 s).
- **Tokenizzazione vera ("Mostra token"):** ogni parola si apre nei suoi token reali con gli
  ID (BPE `o200k_base`, lo schema di GPT-4o), sia nella frase sia sotto ogni candidato. Es.:
  "Oggi" → "O" + "ggi"; "2026" → "202" + "6".
- **Schermata finale:** frase completa grande + il confronto parole/token
  ("4 parole · 9 token reali"), pulsante **Ricomincia**.

### Sidebar
- Voce **"Scenari"** (ex "Moduli") con flyout a due livelli: categorie a disclosure che si
  aprono con click/Invio/Spazio (mai con l'hover), scenari elencati *sotto* la categoria.
  La categoria che contiene lo scenario della pagina corrente nasce aperta.
- Liste con vera semantica (`<ul>` con soli `<li>`), `aria-expanded`/`aria-controls` sui gruppi.
- Nuovo modulo **AI** in `data/modules.json`.

### Verifica (Chromium reale, `index.html` reale)
- Dati: albero (ogni nodo con figli ha ≥ 2 candidati, ogni frase finisce con un token
  finale, lunghezze e ramificazione variabili), vocabolario (copre ogni token, i pezzi
  ricompongono esattamente il testo con e senza spazio, ID validi), coerenza fra regola di
  spaziatura e tokenizzazione su tutte le 198 frasi.
- Logica: 20.000 estrazioni del generatore (somma esatta, minimo 0,001%, vincitore netto,
  code lunghe e candidati dominanti presenti), 5.000 coppie "Rigenera" (sempre diverse),
  generatore iniettabile e rete di sicurezza, 3.000 fotogrammi d'animazione (somma 100%).
- Interfaccia: macchina a stati, un solo vincitore = percentuale più alta, badge "Scelto",
  animazione con inversioni di direzione (movimento pieno) e senza (movimento ridotto),
  Rigenera/Prosegui/Ricomincia, vista token confrontata con il vocabolario, tastiera
  (focus che segue il ciclo Invio → calcolo → Invio), mobile 375px senza overflow, degrado
  controllato (albero o vocabolario non raggiungibili), smontaggio durante il calcolo.
- Ispezione visiva degli screenshot di sviluppo: flyout, calcolo in corso, risultato con vista
  token, frase completa (Light e Dark) e vista token a 375px. Due difetti trovati così e
  corretti: l'interruttore "Mostra token" senza stato premuto visibile, il dato parole/token
  finale troppo piccolo per la LIM.

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `data/scenarios/tokenizzazione/scenario.json` | ⭐ NUOVO | `type: "token-prediction"`, `dataRefs.tree/vocab` |
| `data/scenarios/tokenizzazione/token-tree.json` | ⭐ NUOVO | albero delle frasi (solo parole e struttura) |
| `data/scenarios/tokenizzazione/token-vocab.json` | ⭐ NUOVO (generato) | tokenizzazione reale `o200k_base`, forme `plain`/`spaced` |
| `js/utils/tokenProbability.js` | ⭐ NUOVO | generatore delle percentuali (interi in millesimi di punto) |
| `js/utils/tokenText.js` | ⭐ NUOVO | regole di spaziatura (`needsSpaceBefore`, `joinTokens`) |
| `js/utils/tokenMotion.js` | ⭐ NUOVO | fotogrammi dell'animazione (`distributionAtProgress`) |
| `js/scenarios/renderers/tokenPredictionRenderer.js` | ⭐ NUOVO | renderer del nuovo type |
| `css/scenarios/token-prediction.css` | ⭐ NUOVO | stile dello scenario |
| `tools/build-token-vocab.js`, `tools/package.json`, `tools/package-lock.json` | ⭐ NUOVI | strumento di sviluppo che genera `token-vocab.json` |
| `tests/token.spec.js`, `tests/sidebar.spec.js`, `tests/helpers/sidebar.js` | ⭐ NUOVI | copertura dello scenario e della sidebar |
| `js/components/Sidebar.js` | ♻️ MODIFICATO | secondo livello del flyout (additivo) |
| `css/components/sidebar.css` | ♻️ MODIFICATO | stile dei gruppi |
| `js/pages/shared/appShell.js` | ♻️ MODIFICATO | "Scenari", gruppi per modulo, gruppo corrente aperto |
| `data/modules.json` | ♻️ MODIFICATO | + modulo `ai` (+8 righe) |
| `index.html` | ♻️ MODIFICATO | +1 `<link>`, +1 import, +1 `registerRenderer` (3 righe) |
| `tests/home.spec.js`, `phishing.spec.js`, `scenario.spec.js` | ♻️ MODIFICATI | nuovo percorso sidebar (helper), etichette |
| `tests/run-all.js`, `tests/package.json` | ♻️ MODIFICATI | + suite sidebar e token |
| `docs/handover/handover-scenario-tokenizzazione.md` | ⭐ NUOVO | questo documento |

**Nessuna modifica** a `router.js`, `scenarioEngine.js`, `scenarioPageController.js`,
`authService.js`, `localJsonRepository.js`, a nessun altro componente del Design System, né
ai file degli altri scenari. `data/users.json` non è toccato dalla consegna.

**Applicazione ai file critici — leggere prima di sovrascrivere.** `index.html` e
`data/modules.json` consegnati derivano dal `main` di GitHub *al momento del clone*. Se il
tuo locale è diverso, non sovrascrivere: applica solo queste aggiunte.

- `index.html`:
  1. dopo `<link … css/scenarios/fake-captive-portal.css />` →
     `<link rel="stylesheet" href="css/scenarios/token-prediction.css" />`
  2. dopo l'import di `renderFakeCaptivePortal` →
     `import { renderTokenPrediction } from "./js/scenarios/renderers/tokenPredictionRenderer.js";`
  3. dopo `registerRenderer("fake-captive-portal", renderFakeCaptivePortal);` →
     `registerRenderer("token-prediction", renderTokenPrediction);`
- `data/modules.json`: dopo il blocco `cybersecurity`, un modulo
  `{ "id": "ai", "title": "AI", "available": true, "scenarios": [ { "id": "tokenizzazione", "title": "Tokenizzazione", "available": true } ] }`.
  L'ordine dei moduli è l'ordine delle categorie nel flyout.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| `type: "token-prediction"`, non `"tokenizzazione"` | Descrive la forma dell'interazione, come `fake-login-capture`: un futuro scenario AI con un altro albero lo riusa senza codice |
| Le percentuali **non** stanno nel JSON | Senza contesto la scelta è casuale: sono generate a runtime; il JSON contiene solo parole e struttura, quindi resta leggibile e modificabile a mano |
| Interi in millesimi di punto (100% = 100000) | Elimina per costruzione gli errori di virgola mobile: la somma è sempre esattamente 100,000%, anche nei fotogrammi intermedi |
| Distribuzione = softmax su punteggi casuali con "nitidezza" variabile | Riproduce la forma reale degli LLM (un dominante, code lunghissime): produce sia 0,001% sia >95%, sia distribuzioni ravvicinate |
| Vincitore con ≥ 5 punti sul secondo; "Rigenera" ≥ 1 punto di scarto | Il vincitore deve leggersi dalla LIM senza ambiguità; il pulsante non deve mai sembrare rotto |
| Il token finale (`.`, `!`) è un candidato come gli altri | Una frase può chiudersi presto, come nei modelli reali (token di fine sequenza); ogni percorso radice→foglia è una frase completa |
| Albero ricorsivo a profondità e ampiezza libere; regole verificate da test | Un albero modificato a mano non può produrre frasi che non finiscono o scelte con un solo candidato senza far fallire un test |
| Spaziatura ricavata da regole (`tokenText.js`), non da flag nel JSON | Evita rumore e dimenticanze nei dati; una sola funzione serve sia al testo mostrato sia alla scelta della forma del token nel vocabolario |
| Vocabolario con forme `plain` e `spaced`, generato da `tools/` | Un tokenizer vero distingue "giornata" da " giornata" (ID diversi); generare entrambe evita di duplicare la regola di spaziatura nello script |
| Token reali `o200k_base` via `gpt-tokenizer@4.0.0`, solo come strumento di sviluppo | ID e suddivisioni autentici, senza dipendenze nell'app (nessun bundler, nessuna libreria a runtime); il JSON generato è deterministico |
| Semplificazione dichiarata: i candidati animati sono parole | Leggibilità in aula; "Mostra token" mostra quanto i due livelli differiscano |
| Animazione in `tokenMotion.js` (funzione pura) | Testabile da sola; il renderer si limita a dipingere i valori |
| Movimento ridotto: **semplificato, non eliminato** | L'animazione è la sostanza dello scenario, non una decorazione; con "riduci animazioni" parte da quote uguali e riempie in 0,6 s senza oscillare. Il CSS di sicurezza globale non copre valori calcolati in JS: la scelta è esplicita nel codice |
| Durate dedicate (2200 ms / 600 ms), fuori dai token `--sl-duration-*` | Come Skeleton e Loader: quei token sono per transizioni di interfaccia, non per una sequenza narrativa commentabile a voce |
| Annuncio `aria-live` una sola volta, a passo concluso | Annunciare durante il conteggio sommerge lo screen reader; il vincitore è marcato dal testo "Scelto", non dal solo colore |
| Focus: dopo Prosegui/Rigenera passa al gruppo dei candidati e a calcolo finito torna su Prosegui (solo se il focus è "libero") | I bottoni si disattivano durante il calcolo e farebbero perdere il focus; il ciclo Invio → attesa → Invio funziona da tastiera |
| Chrome standard (Sidebar e header presenti) | Nessuna illusione da preservare, a differenza del Keylogger; il docente tiene la navigazione a portata |
| Modulo **AI** separato da Cybersecurity | Richiesta esplicita; allinea il modello dati alla sidebar (un modulo = una categoria) |
| Sidebar: categorie a disclosure che si aprono solo con click/tastiera | Il flyout si apre già all'hover: una lista che si allunga sotto il puntatore farebbe "scappare" i bersagli |
| Sidebar: stessa convenzione del chevron del trigger principale (">" chiuso, "v" aperto) | Il disegno base punta a destra; un primo tentativo di invertirla è stato scartato dopo verifica nel browser |
| Sidebar: figli del flyout in `<li>`; gruppi con classi `sl-sidebar__link sl-sidebar__group-trigger` | Semantica di lista corretta; stesse regole CSS di link e trigger senza duplicazioni |
| `appShell` legge `#/scenario/:id` solo per aprire la categoria giusta; nessuna voce risulta "attiva" | Comportamento preesistente invariato (un test lo vieta); qui si decide solo quale gruppo mostrare aperto |
| Profondità massima della sidebar: due livelli | Un terzo livello non ha consumer reali (YAGNI) |
| Test della sidebar in `tests/helpers/sidebar.js` e `sidebar.spec.js` | Il percorso Scenari → categoria → scenario serviva identico a 5 suite (estrazione al secondo consumo reale) |
| Nessun nuovo componente condiviso | La barra del candidato resta locale al renderer finché non esiste un secondo consumer |

**Contrasto WCAG, verificato numericamente prima del CSS** (unico accostamento nuovo: le
barre, soglia 1.4.11 ≥ 3:1): Light — riempimento su binario 3.41:1, su sfondo 4.30:1;
riempimento "perdente" su binario 3.10:1, su sfondo 3.91:1. Dark — 4.05:1 / 5.21:1 /
3.38:1 / 4.36:1. Il testo riusa coppie già verificate.

---

## 5. Attività rimanenti

Nessuna sull'implementazione dello scenario. Da fare **da parte tua**:

1. Applicare i file (vedi §3, con cautela su `index.html` e `data/modules.json`).
2. Eseguire `npm test` in `tests/` con le tue credenziali (`SL_TEST_EMAIL`/`SL_TEST_PASSWORD`).
3. Prova visiva su LIM reale: leggibilità di percentuali, barre e vista token dall'ultimo banco.
4. `cd tools && npm install` solo se modifichi l'albero (poi `npm run build:token-vocab`).

Punti indipendenti e invariati: icon sprite, `js/config/env.js` (Supabase), integrazione CI.

---

## 6. Prossima fase

Nessuna fase numerata pendente. Direzioni naturali:

- **Espansione AI:** un secondo scenario del modulo AI (es. allucinazioni, prompt injection).
  Se riusa `token-prediction` basta una nuova cartella `data/scenarios/<id>/` con albero
  e vocabolario più una voce in `modules.json` — zero codice. Se serve un'interazione
  diversa, nuovo renderer registrato in `index.html`.
- **Consolidamento:** verifica 768–1024px del nuovo scenario (vedi §9), aggiornamento di
  `tests/README.md` (non toccato), CI per `tests/`.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"), piattaforma didattica usata solo dal docente e proiettata in classe. Deve sembrare
un vero prodotto, senza elementi "scolastici" visibili (eccezione dichiarata: lo scenario
Tokenizzazione è esplicitamente una visualizzazione didattica). Il documento di handover
allegato è la fonte di verità primaria.

RUOLO: Lead Software Architect, Senior Front-end/UI Engineer, UX Designer, Accessibility
Specialist (WCAG), Cybersecurity Awareness Consultant, Full Stack Architect. Prima PROPONI e
attendi conferma (rispondo con "Continua"/"procedi"), poi implementa a piccoli step verificati.
Mai duplicare componenti; interfaccia create(props)→{element,update,destroy} per i componenti,
(container,params)→destroy per i page controller; eventi "sl:nome-evento"; componenti "dumb";
solo prop additive sui componenti condivisi; estrazione al SECONDO consumo reale (YAGNI);
documentazione, commenti e testi UI in italiano; ogni nuovo accostamento colore verificato
numericamente; ogni consegna con tabella NUOVO/MODIFICATO e percorsi esatti; handover a 10
sezioni come .md separato + .zip di tutti i file a fine fase.

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework, nessun bundler. Hosting GitHub
Pages (branch main), repository lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform.
Non hai credenziali per pushare: prepari i file, li applico io.

REGOLE DI PROCESSO (lezioni pagate care): clona SEMPRE il repository reale prima di modificare
— mai fidarsi di handover, memoria o file incollati. Prima di consegnare file critici
(index.html, authService.js, data/users.json) verifica il contenuto reale; non toccare mai
data/users.json senza mia conferma esplicita. Dove un test può dimostrare una cosa, scrivi il
test: la suite Playwright è la fonte di verità.

STATO: scenario Tokenizzazione (type "token-prediction", modulo AI) completo e verificato;
Sidebar a due livelli ("Scenari" → Cybersecurity | AI) completa. 5 type di scenario: profile-
timeline, fake-login-capture, phishing-simulation, fake-captive-portal, token-prediction. Suite
Playwright 210/210 nell'ambiente di sviluppo (login 19, home 27, scenario 78, phishing 35,
sidebar 13, token 38).

DETTAGLI CHIAVE DELLO SCENARIO: albero token-tree.json (198 frasi, token finali "." e "!" come
candidati); percentuali generate a runtime in js/utils/tokenProbability.js (interi in millesimi
di punto, 100% = 100000, minimo 0,001%, vincitore ≥ 5 punti, Rigenera ≥ 1 punto di scarto);
animazione pura in js/utils/tokenMotion.js (2200 ms; movimento ridotto 600 ms senza
oscillazioni); vocabolario token-vocab.json generato da tools/build-token-vocab.js (o200k_base,
forme plain/spaced) — da rigenerare se si modifica l'albero (il test fallisce altrimenti);
regole di spaziatura in js/utils/tokenText.js. Fasi del renderer in root.dataset.phase:
calculating → revealed → complete.

DETTAGLI CHIAVE DELLA SIDEBAR: data/modules.json → ogni modulo available con "scenarios" diventa
un gruppo del flyout; i gruppi si aprono solo con click/Invio/Spazio; il gruppo dello scenario
corrente (hash #/scenario/:id) nasce aperto; nessuna voce risulta "attiva" sulle pagine di
scenario (un test lo impone). Classi: .sl-sidebar__trigger (voce principale, UNICA),
.sl-sidebar__group-trigger, .sl-sidebar__group-list. Helper di test: tests/helpers/sidebar.js.

NOTE DI AMBIENTE (sandbox): shell /bin/sh — niente brace expansion, niente <( ), rsync assente,
niente apici annidati in node -e (usa file di script); niente pkill -f con pattern; server e
Playwright nella STESSA chiamata; tests/node_modules del repo è a Playwright 1.62.1 ma la
sandbox ha Chromium compatibile con il Playwright globale 1.56.0 → togli tests/node_modules dalla
copia di lavoro e usa NODE_PATH=/home/claude/.npm-global/lib/node_modules. Per i test imposta
SL_TEST_EMAIL/SL_TEST_PASSWORD con un utente di prova creato SOLO nella copia di lavoro
(users.json della copia riscritto con l'hash di una password temporanea): mai le mie credenziali
reali, mai consegnare quel users.json.

DA FARE ORA: indicami cosa preferisci — (A) un secondo scenario del modulo AI, (B)
consolidamento (verifica 768–1024px, tests/README.md, CI), o altro.
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Apertura da Sidebar (Scenari → AI → Tokenizzazione): h1 unico, frase "Oggi" + segnaposto, 5 candidati, comandi disattivi durante il calcolo.
- [x] Un solo vincitore = percentuale più alta, badge "Scelto", tre decimali, somma 100,000%.
- [x] Animazione live: ogni fotogramma somma 100,000%, valori che cambiano, inversioni di direzione.
- [x] Rigenera: stessi candidati, frase invariata, percentuali diverse; in 15 rigenerazioni il vincitore cambia almeno una volta.
- [x] Prosegui: il vincitore entra nella frase, i nuovi candidati sono i figli di quel nodo.
- [x] Frase completa: ogni passo sceglie il più probabile, risultato fra le 198 frasi generabili, token finale, "N parole · M token reali".
- [x] Ricomincia: ritorno al primo passo (segnaposto incluso).
- [x] Vista token: pezzi e ID uguali a `token-vocab.json` (chip e candidati).
- [x] Sidebar: 2 categorie chiuse su Home, apertura indipendente, richiusura, Invio/Spazio, Escape, categoria corrente aperta, navigazione fino a Tokenizzazione.
- [x] Regressione: login, home, scenario (Oversharing, Keylogger, Evil Twin), phishing, flusso da tastiera Home→flyout→categoria→scenario→MediaViewer.
- [ ] **Da te:** `npm test` in `tests/` con le tue credenziali reali.

### Test UI
- [x] Light e Dark: calcolo in corso, risultato, vista token, frase completa, flyout (ispezionati a occhio, non solo via asserzioni).
- [x] Mobile 375px: nessun overflow, né col risultato né con la vista token né a frase completa.
- [ ] Breakpoint 768–1024px del nuovo scenario — non verificati (vedi §9).
- [ ] **Da te:** leggibilità dalla LIM reale (percentuali, barre, vista token).

### Test UX
- [x] Focus: Invio → calcolo → Invio funziona da tastiera.
- [x] "Riduci animazioni": calcolo < 1,5 s, nessuna oscillazione, somma sempre 100%.
- [ ] **Da te:** il ritmo (~2,2 s) è adatto alla narrazione in aula? È una costante in `tokenMotion.js`.

### Test tecnici
- [x] Nessuna richiesta esterna, nessuna risposta HTTP in errore, nessun errore JavaScript.
- [x] Degrado controllato: albero mancante → messaggio; vocabolario mancante → scenario ok senza "Mostra token".
- [x] Smontaggio durante il calcolo senza errori né animazioni orfane.
- [x] `node --check` su tutti i file JavaScript nuovi/modificati; JSON validi.

### Test di regressione
- [x] 210/210 nell'ambiente di verifica (vedi §1).

---

## 9. Criticità

- **Allineamento locale ↔ GitHub:** `index.html` e `modules.json` consegnati partono dal
  `main` di GitHub al momento del clone. Se il tuo locale è avanti o diverso, usa le
  aggiunte minime elencate in §3 invece di sovrascrivere.
- **`token.spec.js` richiede ora le credenziali di test** (login reale), come le altre suite.
  La parte sui dati e sulle utility ne avrebbe fatto a meno, ma è nello stesso file.
- **Verifiche con attese fisse:** alcuni test usano `waitForTimeout` (300–400 ms per le
  transizioni CSS, 2600 ms per l'animazione interrotta). Su macchine molto lente potrebbero
  richiedere margini maggiori.
- **Parole ≠ token:** nella schermata finale i "token reali" contano anche gli spazi che il
  tokenizer separa dai numeri (es. " 06" → " " + "06"). È il comportamento reale di
  `o200k_base`, ma può sorprendere: "Oggi 06 ottobre 2026!" = 4 parole, 9 token.
- **Semplificazione didattica:** il modello reale non sceglie sempre il più probabile
  (campiona, con una "temperatura"), e prevede pezzi, non parole. Lo scenario mostra la
  scelta del più probabile, come da richiesta.
- **Breakpoint 768–1024px** del nuovo scenario e della flyout a due livelli: non verificati
  con screenshot (solo 1280px e 375px).
- **Flyout alta:** con molti scenari espansi il pannello potrebbe superare l'altezza dello
  schermo; oggi (6 righe + 2 categorie) non accade.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Durate dell'animazione come costanti in `tokenMotion.js`, fuori dai token di motion: scelta motivata, ma non configurabile da dati.
- 🟢 Regole di spaziatura (`tokenText.js`) tarate sull'italiano e sulla punteggiatura dell'albero attuale; un nuovo segno (parentesi aperta, apostrofo) richiede di estenderle e di aggiungere un test.
- 🟢 `appShell.js` legge `window.location.hash` per aprire la categoria corrente: accoppia la shell al formato della rotta `#/scenario/:id`.

### Refactoring consigliati
- 🟢 `tokenPredictionRenderer.js` (~400 righe) è ancora leggibile; se arrivasse un secondo consumer della "barra candidato", estrarla come componente (non prima).
- 🟡 Test con attese fisse (vedi §9): sostituirli con attese su condizioni osservabili se diventassero fragili in CI.

### Ottimizzazioni future
- 🟢 Vista "albero" opzionale (le strade non scelte che si spengono): non richiesta, valutare solo se il docente la vuole.
- 🟢 Durata dell'animazione regolabile dal docente (es. in Impostazioni).

### Rischi architetturali
- 🟡 **Flyout con molte categorie/scenari:** oggi senza altezza massima né scroll; con la crescita prevista (decine di scenari) servirà `max-height` + scroll interno.
- 🟢 **Sidebar limitata a due livelli** per scelta (YAGNI): un terzo livello richiederebbe di rivedere `Sidebar.js`.
- 🟢 **Pattern Registry:** ora 5 `type` distinti registrati, zero modifiche a `scenarioEngine.js` per l'ultimo — la promessa di estendibilità è confermata da un quinto caso reale.

### Priorità
- 🟡 Media: verifica 768–1024px e altezza massima della flyout, prima che gli scenari crescano.
- 🟢 Bassa: tutto il resto.

### Obiettivo
Intervento chiuso end-to-end: dati, logica, interfaccia, sidebar, copertura di test e
documentazione, senza modifiche ai componenti condivisi se non additive.
