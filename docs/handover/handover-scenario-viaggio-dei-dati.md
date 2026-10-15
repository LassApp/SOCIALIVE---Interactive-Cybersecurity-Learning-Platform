# SOCIALIVE — Handover: Scenario "Viaggio dei dati" (area Reti)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Motion Designer / Full Stack Architect del progetto.
**Contesto:** nuova **area Reti** con il suo primo scenario, il sesto `type` distinto della
piattaforma (`packet-journey`). Un dato viene scomposto in pacchetti, che attraversano una rete di
nodi per strade e in tempi diversi e vengono ricomposti nell'ordine corretto. L'animazione è
avanzabile con "Prosegui" in 3 passi. Lo scenario è stato approvato in forma di mockup animato
prima di scrivere i file veri (richiesta esplicita, in deroga al prompt iniziale).
**Data:** 15 ottobre 2026.
**Tag di riferimento suggerito:** `scenario-viaggio-dei-dati` (numero SemVer da assegnare
sull'ultimo tag reale del repository).

---

## 1. Stato del progetto

- Suite precedente (Cybersecurity: Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi; AI:
  Tokenizzazione, Allucinazioni) e redesign Home/Sidebar: ✅ invariati nel comportamento.
- **Scenario Viaggio dei dati: ✅ COMPLETATO E VERIFICATO** nell'app reale (`index.html`, Chromium
  reale, server locale).
- **385/385 controlli** della suite `tests/` (era 344): 38 nuovi in `packet.spec.js`, 3 in più nelle
  suite esistenti (il resto è data-driven e cresce da solo con la nuova area). Eseguita per intero
  su una **copia di prova con credenziali usa e getta**: `data/users.json` reale non è stato
  toccato e nessuna credenziale reale è stata usata.
- Prova a **tempo reale** (senza orologio finto): passo 1 in 2,6 s, passo 2 in 7,8 s, passo 3 in
  4,6 s, nessun errore in console.
- **Nessuna richiesta di rete verso l'esterno**, verificata da un controllo dedicato.

---

## 2. Obiettivi completati

### Cosa fa lo scenario
- **Stato iniziale:** il dato è un anello di 4 archi colorati, con la scritta "Dato".
- **Passo 1, Suddivisione:** gli archi si staccano e si contraggono in 4 pacchetti numerati, che si
  dispongono a ventaglio (da sinistra a destra: 1, 2, 3, 4) con i connettori tratteggiati dal dato.
- **Passo 2, Instradamento:** dissolvenza sulla mappa a 12 nodi e 23 collegamenti. I pacchetti si
  raccolgono in Partenza e partono a intervalli. Entrano tutti dal Nodo d'ingresso e divergono su 4
  percorsi diversi, ciascuno con la sua linea colorata (corsie parallele sui tratti condivisi), con
  un impulso su ogni nodo attraversato e una breve sosta di smistamento. Arrivano nell'ordine
  **3, 1, 4, 2** (diverso da quello di partenza) e si dispongono nel vassoio "Ordine di arrivo".
- **Passo 3, Ricomposizione:** i pacchetti salgono in riga nell'ordine di arrivo, si riordinano per
  numero (1, 2, 3, 4) e si fondono di nuovo nell'anello, che ritrova la stessa sequenza di colori
  iniziale; spunta verde e impulso finale.
- **Pulsanti:** "Prosegui" (disattivato durante l'animazione, come in Tokenizzazione) e, dopo il
  passo 3, "Ricomincia".
- **Contorno:** area "Reti" in Home (icona nuova, descrizione, badge "1 scenario"), nella Sidebar
  (fisarmonica esclusiva) e nella ricerca della Home ("viaggio" individua l'area).

### Accessibilità e movimento
- Didascalia del passo in regione `role="status"`; secondo annuncio nascosto per l'esito (ordine di
  arrivo, dato ricostruito).
- `prefers-reduced-motion`: la rete di sicurezza CSS NON copre animazioni guidate da JavaScript;
  il renderer legge la preferenza a ogni passo e salta direttamente allo stato finale.
- Il colore non è l'unico segnale: ogni pacchetto porta il numero in testo.
- Focus: dal bottone alla scena mentre il bottone è disabilitato, poi a "Prosegui" (o "Ricomincia"
  a fine corsa), solo se l'utente non l'ha spostato altrove.

### Verifica
- **38 controlli** in `tests/packet.spec.js` (dati e utilità pure, renderer a orologio finto,
  movimento ridotto, degrado, smontaggio, richieste esterne). L'ordine di arrivo è osservato **nel
  tempo** (si avanza l'orologio a passi di 25 ms e si registra quando ciascun pacchetto entra nel
  vassoio), non dedotto a posteriori.
- **Contrasto** dei 4 colori sulla superficie, misurato nel browser in Light e Dark (soglia 3:1 per
  elementi grafici, WCAG 1.4.11) e ricalcolato a parte con uno script:

  | Token -500 | Light su bianco | Dark su `#1a1c21` |
  |---|---|---|
  | primary (Dark: -400) | 4,30:1 | 5,21:1 |
  | warning | 3,73:1 | 4,57:1 |
  | success | **3,01:1** | 5,66:1 |
  | error | 4,04:1 | 4,22:1 |

  Nessun accostamento nuovo rispetto al Design System; `success` in Light è al limite della soglia
  (vedi §9).
- Screenshot ispezionati: passi 1, 2, 3 in Light, passo 3 in Dark, 375 px, Home con la nuova area.

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `js/scenarios/renderers/packetJourneyRenderer.js` | ⭐ **NUOVO** | Renderer del type `packet-journey`: scena SVG a livelli, 4 funzioni di fotogramma `f(t)`, un solo loop `requestAnimationFrame`, macchina a stati, a11y |
| `js/utils/packetRoute.js` | ⭐ **NUOVO** | Logica pura: easing, corsie parallele, linee temporali, ranghi di arrivo, `validatePacketNetwork()` |
| `css/scenarios/packet-journey.css` | ⭐ **NUOVO** | Layout di pagina e stile della scena SVG (solo token `--sl-*`) |
| `data/scenarios/viaggio-dei-dati/scenario.json` | ⭐ **NUOVO** | Metadati e `dataRefs.network` |
| `data/scenarios/viaggio-dei-dati/network.json` | ⭐ **NUOVO** | Nodi, collegamenti, 4 pacchetti (percorso, velocità, partenza, colore), testi, didascalie, annunci |
| `assets/icons/areas/reti.svg` | ⭐ **NUOVO** | Icona dell'area (tre nodi collegati), usata come maschera CSS |
| `tests/packet.spec.js` | ⭐ **NUOVO** | 38 controlli |
| `docs/handover/handover-scenario-viaggio-dei-dati.md` | ⭐ **NUOVO** | Questo documento |
| `data/modules.json` | ♻️ **MODIFICATO** | + area `reti` in coda (id, titolo, descrizione, icona, 1 scenario) |
| `index.html` | ♻️ **MODIFICATO** | + `<link>` a `packet-journey.css`, + import e `registerRenderer("packet-journey", …)` |
| `tests/run-all.js` | ♻️ **MODIFICATO** | + `packet.spec.js` |
| `tests/package.json` | ♻️ **MODIFICATO** | + script `test:packet` |
| `tests/home.spec.js` | ♻️ **MODIFICATO** | Badge atteso: "1 scenario" al singolare (prima nessuna area ne aveva uno solo) |
| `tests/phishing.spec.js` | ♻️ **MODIFICATO** | L'elenco della Sidebar include "Viaggio dei dati" |
| `tests/scenario.spec.js` | ♻️ **MODIFICATO** | Idem |
| `tests/sidebar.spec.js` | ♻️ **MODIFICATO** | 2 aree → 3 (stati dei gruppi, conteggi, chevron, `aria-controls`) + **1 test nuovo** sull'area Reti |

**Nessuna modifica** a `scenarioEngine.js`, `scenarioPageController.js`, `router.js`, `appShell.js`,
`Sidebar.js`, `AreaCard.js`, `homePageController.js`, `Button.js`, `Card.js`, `Badge.js`, ai token e
ai temi: Home e Sidebar leggono `modules.json`, quindi l'area compare da sola. È la seconda prova
concreta (dopo AI) dell'estendibilità promessa fin dalla Fase 1.

```
socialive/
├── index.html                                   # ♻️ +link, +import, +registerRenderer
├── assets/icons/areas/reti.svg                  # ⭐
├── css/scenarios/packet-journey.css             # ⭐
├── data/
│   ├── modules.json                             # ♻️ + area "reti"
│   └── scenarios/viaggio-dei-dati/
│       ├── scenario.json                        # ⭐
│       └── network.json                         # ⭐
├── js/
│   ├── utils/packetRoute.js                     # ⭐
│   └── scenarios/renderers/packetJourneyRenderer.js   # ⭐
└── tests/
    ├── packet.spec.js                           # ⭐
    └── run-all.js · package.json · home / phishing / scenario / sidebar .spec.js   # ♻️
```

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Ogni passo è una **funzione pura del tempo** `render(passo, t)` con un solo loop rAF | Fotogrammi deterministici, un solo loop per tutta la scena, "movimento ridotto" = una chiamata a fine passo, interruzione = smettere di chiamarla, test a orologio finto |
| Solo `transform`, `opacity`, `stroke-dashoffset`; lunghezze dei percorsi calcolate una volta | Nessuna lettura di layout nel loop; fluidità |
| Niente transizioni CSS sulla scena | Arriverebbero in ritardo rispetto ai fotogrammi JS |
| Il tempo di arrivo **non è nei dati**: deriva da lunghezza × velocità + sosta + partenza | Un solo parametro per pacchetto da regolare; l'ordine di arrivo diverso da quello di partenza è **validato** (`validatePacketNetwork`), non sperato |
| **Corsie parallele** sui collegamenti condivisi (offset con giunzione a spigolo limitata) | Altrimenti l'ultimo percorso nasconderebbe gli altri sul tratto Partenza → Nodo |
| Dato = anello di **4 archi** nello stesso colore dei pacchetti | L'ordine corretto si legge dai colori nella ricomposizione, non solo dai numeri |
| Layout fisso su **4 pacchetti** (validato) | Ventaglio e quadranti sono disegnati per 4: supportare N richiederebbe un layout generico, senza consumer reale (YAGNI) |
| Colori nei dati come **nome del token** (`primary`/`success`/`warning`/`error`/`info`), mai CSS libero | Un JSON non può iniettare stili e i colori restano quelli verificati |
| `packetRoute.js` separato dal renderer | Logica pura con ingressi e uscite chiari, testabile senza DOM (stesso criterio di `tokenProbability.js`) |
| Geometria dell'anello, del ventaglio e del vassoio **nel renderer**, topologia e tempi **nei dati** | Il primo è resa grafica, il secondo è contenuto |
| Mappa **orizzontale** (Partenza a sinistra, Arrivo a destra) invece che verticale come nello schizzo | La LIM è 16:9; stessa topologia (12 nodi, un solo ingresso, rete magliata) |
| "Prosegui" disattivato con `disabled` + focus alla scena (pattern di Tokenizzazione) | Coerenza con lo scenario già in produzione; nel mockup era `aria-disabled`, l'aspetto è identico |
| Pulsante "Ricomincia" dopo il passo 3 | Il docente può ripetere la demo senza ricaricare la pagina (aggiunta richiesta nel prompt, approvata col mockup) |
| Badge dell'area (`Reti`) con il componente `Badge` esistente; scena dentro una `Card` con padding azzerato | Nessun nuovo componente; Card e Badge riusati |
| `window.matchMedia("(prefers-reduced-motion: reduce)")` letta a ogni passo | La rete di sicurezza CSS non copre le animazioni JS; la lettura a ogni passo recepisce un cambio a metà sessione |
| Test a **orologio finto** (`page.clock`), ordine di arrivo osservato nel tempo | Nessun controllo dipende dalla velocità della macchina |
| La logica pura è testata importandola **nel browser** (`import()` dal server di test) | I file `.js` del progetto sono moduli ES e i test sono CommonJS: si evita di dipendere dal rilevamento automatico dei moduli di Node |

---

## 5. Attività rimanenti

**Nessuna attività aperta sullo scenario.** Punti indipendenti:

1. **Scritta tagliata "Min…"** in basso a destra del secondo schizzo (`2.jpeg`): non è stata
   interpretata e **non è nello scenario**. Da chiarire se doveva comparire qualcosa.
2. Gap generali già noti e invariati: icon sprite unificato, integrazione CI di `tests/`,
   `js/config/env.js` (Supabase), controllo anti-regressione per contenuti testuali banditi.
3. Eventuale **secondo scenario dell'area Reti** (es. "Il Nodo smista", "Cosa succede se un
   pacchetto si perde"): il type `packet-journey` e la validazione sono riusabili, vedi §6.

---

## 6. Prossima fase

Nessuna fase numerata pendente. Direzioni possibili:

- **Espansione:** altri scenari dell'area Reti. Se riusano la stessa scena (4 pacchetti, mappa a
  nodi) basta un nuovo `data/scenarios/<id>/` con `scenario.json` + `network.json` e una voce in
  `modules.json`: zero codice. Se servono più pacchetti o un'altra coreografia, il punto di
  estensione è il layout in `packetJourneyRenderer.js` (oggi dimensionato per 4) e
  `PACKET_COUNT` in `packetRoute.js`.
- **Consolidamento:** vedi §10 (spezzare il renderer, centralizzare le durate della coreografia).

**Punto di ripartenza esatto:** il renderer e le utility sono autosufficienti; per cambiare
contenuti (nodi, percorsi, velocità, testi) si modifica solo `network.json` e `validatePacketNetwork`
segnala subito un dato incoerente (percorso non valido, colore non ammesso, ordine di arrivo uguale
a quello di partenza).

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). Dopo le aree Cybersecurity e AI e il redesign di Home/Sidebar, è stata aggiunta
l'area RETI con lo scenario "Viaggio dei dati" (type "packet-journey"): un dato (anello di 4
archi colorati) si scompone in 4 pacchetti numerati (passo 1), che attraversano una mappa di 12
nodi per strade e in tempi diversi e arrivano fuori ordine (passo 2: ordine di arrivo 3,1,4,2),
poi si riordinano e ricostruiscono il dato (passo 3). Si avanza con "Prosegui"; dopo il passo 3
compare "Ricomincia". Il documento di handover completo è allegato: consideralo la fonte di
verità primaria, ma VERIFICA SEMPRE i file reali (clona il repository
lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform) prima di dare per fatto qualcosa.

ARCHITETTURA DELLO SCENARIO: js/scenarios/renderers/packetJourneyRenderer.js (scena SVG a
livelli; ogni passo è una funzione pura del tempo render(passo,t); UN solo loop requestAnimationFrame;
prefers-reduced-motion letta dal renderer perché la rete CSS non copre le animazioni JS),
js/utils/packetRoute.js (logica pura: corsie parallele, linee temporali, validatePacketNetwork),
css/scenarios/packet-journey.css, data/scenarios/viaggio-dei-dati/{scenario,network}.json,
assets/icons/areas/reti.svg, voce "reti" in data/modules.json. I tempi di arrivo NON sono nei dati:
derivano da lunghezza del percorso × velocità + sosta + partenza; la validazione impone che
l'ordine di arrivo differisca da quello di partenza. Il layout è dimensionato per esattamente 4
pacchetti (validato). Colori dei pacchetti = nome del token (primary/success/warning/error/info).

STATO DEI TEST: 385/385 (login 19, home 78, scenario 82, phishing 35, sidebar 39, token 38, llm 56,
packet 38), eseguiti su una copia con credenziali usa e getta. Per eseguirli in locale servono
SL_TEST_EMAIL / SL_TEST_PASSWORD (mai nei file). Nota ambiente: tests/node_modules del repo è
Playwright 1.62.1; l'ambiente di verifica usa quello globale 1.56.0 (NODE_PATH).

PUNTI APERTI: la scritta tagliata "Min…" nello schizzo 2.jpeg non è stata interpretata e non è
nello scenario (chiedere se serve). La riga 'success' in Light ha contrasto 3,01:1 (al limite del
3:1 grafico): se si cambia il token -500, ricontrollare.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Proponi prima, implementa dopo
la conferma ("procedi"). Mai duplicare componenti per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy}; eventi "sl:nome-evento"; componenti "dumb"; documentazione
in italiano; test reali prima di consegnare (anche attraverso l'index.html reale); ogni file con
stato NUOVO/MODIFICATO verificato sui file reali; handover a 10 sezioni in .md separato + .zip.

Indica quale direzione preferisci (nuovo scenario dell'area Reti, consolidamento del renderer, o
altro).
```

---

## 8. Test da eseguire

Tutti i controlli già **eseguiti realmente** in questa sessione (Chromium, server locale, mai
`file://`); `npm test` in `tests/` li riesegue.

### Test funzionali
- [x] `scenario.json`, `network.json`, voce in `modules.json` coerenti; icona esistente.
- [x] `validatePacketNetwork`: accetta i dati reali e rifiuta percorso non valido, colore non
  ammesso, numero di pacchetti diverso da 4, nodo di arrivo mancante, ordine di arrivo = partenza.
- [x] Corsie parallele, linea temporale (tempi, sosta nei soli nodi intermedi, estremi esatti).
- [x] Apertura dalla Sidebar (Scenari → Reti → Viaggio dei dati), h1, badge "Reti".
- [x] Passo 1: 4 pacchetti 1..4 da sinistra a destra, anello scomposto, colori distinti.
- [x] Passo 2: arrivi in tempi diversi e nell'ordine dei dati; scie complete; pacchetti nel vassoio.
- [x] Passo 3: riga nell'ordine di arrivo, riordino 1..4, anello ricostruito con la stessa
  sequenza di colori, spunta.
- [x] "Ricomincia" e secondo giro; click forzato mentre l'animazione corre ignorato.
- [x] Durata di ogni passo entro gli 8 secondi.

### Test UI
- [x] Screenshot Light (passi 1, 2, 3), Dark (passo 3), 375 px, Home con la nuova area.
- [x] Nessun overflow orizzontale a 1280, 900 e 375 px; scena 16:9; controlli impilati su mobile.
- [ ] Verifica visiva su una LIM reale (leggibilità a distanza di etichette e numeri): non
  eseguibile in sandbox.

### Test UX
- [x] "Prosegui" disattivato durante l'animazione, focus alla scena e ritorno al bottone giusto.
- [x] Movimento ridotto: ogni passo salta allo stato finale senza far avanzare il tempo.
- [ ] Ritmo percepito da una classe (7,8 s del passo 2 sono adatti?): da valutare dal vivo.

### Test tecnici
- [x] `node --check` su tutti i file JS nuovi/modificati.
- [x] Console priva di errori, nessuna risorsa locale mancante.
- [x] Nessuna richiesta verso l'esterno.
- [x] Degrado: `network.json` mancante o con percorso non valido → messaggio condiviso + motivo
  in console, nessuna scena a metà.
- [x] Prova a tempo reale (senza orologio finto): 2,6 s / 7,8 s / 4,6 s.

### Test di regressione
- [x] Suite completa **385/385** attraverso l'`index.html` reale. Baseline prima delle modifiche:
  344/344 sullo stesso ambiente.
- [x] Smontaggio a metà animazione: tornando alla Home la scena sparisce senza errori né
  fotogrammi in ritardo.

---

## 9. Criticità

- **Attese "a 2 aree" nei test esistenti**: sono emerse eseguendo la suite (12 controlli in
  `sidebar.spec.js`, 1 in `home.spec.js`, 1 in `phishing.spec.js`, 1 in `scenario.spec.js`):
  non erano regressioni del codice, ma attese scritte quando le aree erano 2. Aggiornati.
  Una delle attese era anche **un errore del test**: `"1 scenari"` invece di `"1 scenario"`; il
  badge dell'app era corretto. Prima di aggiungere un'area con un solo scenario nessun test lo
  avrebbe scoperto.
- **`success` in Light a 3,01:1**: supera la soglia grafica di WCAG 1.4.11 solo di poco. Il colore
  non è l'unico segnale (numero in testo), quindi non è bloccante, ma qualunque ritocco al token
  va ricontrollato.
- **A 375 px la scena scala in proporzione**: etichette e numeri diventano piccoli. Lo scenario è
  pensato per la LIM; su telefono è leggibile ma non ottimizzato.
- **Test eseguiti con credenziali usa e getta** su una copia: `users.json` reale non è stato usato.
  Sul tuo ambiente servono `SL_TEST_EMAIL`/`SL_TEST_PASSWORD` come per le altre suite.
- **Scritta "Min…" dello schizzo non interpretata** (vedi §5).

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto in senso stretto. Il layout fisso su 4 pacchetti è una scelta dichiarata e
  validata, non una scorciatoia nascosta.

### Refactoring consigliati
- 🟡 **`packetJourneyRenderer.js` è tra i renderer più lunghi** (~790 righe): scena, 4 funzioni di
  fotogramma e macchina a stati nello stesso file. Candidato a separare i fotogrammi in un modulo
  dedicato se un secondo scenario riusasse la scena.
- 🟡 **Durate della coreografia sparse nelle funzioni di fotogramma** (es. 450, 950, 2300, 3100 ms
  nei passi 1 e 3): raccoglierle in una tabella `MOTION` renderebbe più semplice ritoccare il ritmo
  (oggi solo le durate dei passi e del vassoio sono nominate).
- 🟢 Il ponte di `packet.spec.js` per eseguire la logica pura nel browser (`new Function` +
  `import()`) è funzionale ma insolito: sostituibile se i test passassero a ESM.

### Ottimizzazioni future
- 🟢 Il layout non è generico rispetto al numero di pacchetti: se servissero 3 o 5, vanno rese
  parametriche la divisione dell'anello e le posizioni del ventaglio.
- 🟢 Una vista ottimizzata a schermo stretto (es. mappa verticale come nello schizzo originale).

### Rischi architetturali
- 🟢 **Nessun rischio nuovo di rilievo**: nessun file condiviso è stato toccato; il registro dei
  renderer e il catalogo da `modules.json` hanno accolto il nuovo type e la nuova area senza
  modifiche, per la seconda volta di seguito.
- 🟡 Le tre suite che elencano le voci della Sidebar (`phishing`, `scenario`, `sidebar`) hanno
  ancora l'elenco dei titoli **scritto a mano**: ogni nuovo scenario le rompe finché non si
  aggiorna l'elenco. Renderle data-driven come `home.spec.js` toglierebbe il vincolo.

### Priorità
- 🟡 Media: rendere data-driven gli elenchi della Sidebar nei test (ogni nuovo scenario li rompe).
- 🟡 Media: raccogliere le durate della coreografia in una tabella.
- 🟢 Bassa: spezzare il renderer, layout parametrico, vista per schermo stretto.

### Obiettivo
Chiudere lo scenario senza introdurre debito strutturale: dati fuori dal codice e validati, logica
pura separata e testata, animazione deterministica e cancellabile, accessibilità e movimento ridotto
trattati come requisiti, nessun componente condiviso modificato.
