# SOCIALIVE — Handover: Area "Computer Essentials" · Scenario "HDD vs SSD"

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect / Performance Engineer del progetto.
**Contesto:** nuova area di piattaforma con il suo primo scenario. Primo `type` ("disk-compare")
con scene 3D e motore di animazione a esecuzioni interrompibili. Fase 1 (mockup, due iterazioni)
approvata dall'utente; questo documento chiude la Fase 2 (implementazione).
**Tag di riferimento suggerito:** `v1.6.0-computer-essentials-hdd-vs-ssd`

---

## 1. Stato del progetto

- Piattaforma con 4 aree (Cybersecurity, AI, Reti, **Computer Essentials**) e scenari già
  esistenti: tutti invariati nel comportamento.
- **Scenario "HDD vs SSD": ✅ implementato e verificato end-to-end.** Tre sotto-scenari
  (HDD vergine, HDD già utilizzato, SSD), barra dei passaggi con sblocco sequenziale, scene 3D
  con camera (zoom in/out), ingrandimento manuale a passaggio concluso, ricomposizione di un file
  frammentato, confronto affiancato HDD/SSD.
- **Suite completa: 470/470 controlli superati** (login 19, home 80, scenario 82, phishing 35,
  sidebar 39, token 38, llm 56, packet 62, **disk 59 nuovi**), eseguita attraverso l'`index.html`
  reale con Chromium reale, su una copia di lavoro con un utente di test (vedi §9).
- Layout di esecuzione: riga 1 = animazione | griglia dei cluster; riga 2 = legenda dei file |
  spiegazione con Procedi / Ripristina / Ricomincia (richiesta dell'utente dopo il mockup v2).

## 2. Obiettivi completati

**Dati (nessun contenuto nel codice).** `data/scenarios/hdd-vs-ssd/scenario.json` (type
`disk-compare`) e `disk.json`: file (nome, MB, colore, accento, trama, colore del testo), dati
preesistenti, disposizioni iniziali della griglia, copioni dei 3 sotto-scenari (titoli, testi,
operazioni), etichette, riquadro informativo, tabella e conclusione del confronto, velocità
(0.5x / 1x / 2x, default 1x) e **rapporto dei tempi HDD/SSD (`timing.ratio`, 5) con la durata
totale simulata (`hddTotalMs`, 8000)**.

**Modello puro** (`js/utils/diskModel.js`): validazione di forma con messaggi leggibili, stato del
disco per passaggio (prima/dopo) calcolato una sola volta, fasi separate per ogni operazione
(scrittura e cancellazione dello stesso file si animano entrambe: era il difetto del mockup v1 per
la pizza sull'SSD), ordine di lettura volutamente non crescente, conteggio dei gruppi.

**Motore di animazione** (`js/utils/animationTimeline.js`): "esecuzioni" interrompibili
(`begin()` annulla la precedente e risolve subito le sue attese pendenti), `wait`/`frames`,
**un solo moltiplicatore** `factor() = (movimento ridotto ? 0.1 : 1) / velocità`, letto a ogni
attesa e scritto anche in `--k` per le animazioni CSS.

**Scene 3D** (`js/utils/diskScene3d.js`, `diskPatterns.js`): HDD (piatto con spessore, 12 settori,
braccio e testina, lente "vista logica" che compare solo da vicino) e SSD (scheda con 6 chip flash,
controller, bus elettrico animato, nessuna parte mobile), stessa interfaccia. Camera = CSS 3D:
zoom in sul settore/chip, zoom out quando serve un altro settore/chip.

**Renderer** (`js/scenarios/renderers/diskCompareRenderer.js`) e stile
(`css/scenarios/disk-compare.css`): vedi §4. **Area**: voce in `data/modules.json`, icona
`assets/icons/areas/computer-essentials.svg`, registrazione in `index.html`.

**Test**: `tests/disk.spec.js` (59 controlli, vedi §8) e aggiornamento delle attese dei test
esistenti che elencavano le 3 aree (sidebar, scenario, phishing, packet).

## 3. Architettura attuale — file coinvolti

| File | Stato |
|---|---|
| `data/scenarios/hdd-vs-ssd/scenario.json` | ⭐ NUOVO |
| `data/scenarios/hdd-vs-ssd/disk.json` | ⭐ NUOVO |
| `js/utils/diskModel.js` | ⭐ NUOVO |
| `js/utils/animationTimeline.js` | ⭐ NUOVO |
| `js/utils/diskPatterns.js` | ⭐ NUOVO |
| `js/utils/diskScene3d.js` | ⭐ NUOVO |
| `js/scenarios/renderers/diskCompareRenderer.js` | ⭐ NUOVO |
| `css/scenarios/disk-compare.css` | ⭐ NUOVO |
| `assets/icons/areas/computer-essentials.svg` | ⭐ NUOVO |
| `tests/disk.spec.js` | ⭐ NUOVO |
| `data/modules.json` | ♻️ MODIFICATO — +area `computer-essentials` in coda |
| `index.html` | ♻️ MODIFICATO — +1 `<link>`, +1 import, +1 `registerRenderer("disk-compare", …)` |
| `tests/run-all.js`, `tests/package.json` | ♻️ MODIFICATI — suite `disk` registrata, script `test:disk` |
| `tests/sidebar.spec.js` | ♻️ MODIFICATO — attese su 4 aree (stati delle fisarmoniche, chevron, conteggi) |
| `tests/scenario.spec.js`, `tests/phishing.spec.js` | ♻️ MODIFICATI — elenco dei link di scenario +"HDD vs SSD" |
| `tests/packet.spec.js` | ♻️ MODIFICATO — l'ordine delle aree è verificato sulle prime 3 (Reti non è più l'ultima) |

**Nessuna modifica** a router, `scenarioEngine`, `scenarioPageController`, `appShell`, componenti
del Design System, repository, servizi, né agli altri scenari.

## 4. Decisioni progettuali

| Decisione | Motivazione |
|---|---|
| Nuovo `type` `disk-compare`, renderer dedicato, registrato come gli altri | Nessuna modifica all'architettura (richiesta del prompt); l'engine resta ignaro del tipo |
| Stato del disco = funzione del passaggio (`prev`/`end` calcolati da `buildScript`) | Coerenza dopo qualsiasi salto avanti/indietro; nessun accumulo di effetti da annullare |
| Fasi per operazione, non diff tra stati | Una scrittura seguita dalla cancellazione dello stesso file non si compensa più: entrambe sono mostrate |
| Esecuzioni interrompibili con attese che si risolvono a `false` | Interruzione pulita: nessun timer orfano, passaggio interrotto mai segnato completato; sblocco solo dopo l'ultimo `wait` riuscito |
| Un unico moltiplicatore (`factor`) per velocità e movimento ridotto | Cambia i tempi, mai sequenza o stato finale; il rapporto HDD/SSD resta in JSON e non dipende dalla velocità |
| Geometria 48 cluster = 3 tracce × 4 settori × 4 cluster (2×2) | Il settore contiene la griglia di cluster come nello schema; l'indice di griglia coincide con la posizione fisica |
| Cluster visibili solo nella "lente" da vicino, con didascalia | Il cluster è un'unità logica, non una divisione fisica (richiesta del prompt) |
| Zoom out → sposta testina → zoom in tra settori diversi | Richiesta dell'utente (camera che esce da traccia/settore) |
| Ingrandimento manuale: clic su settore/chip, solo a passaggio concluso | Richiesta dell'utente; `aria-disabled` e suggerimento dedicato durante l'animazione; Invio/Spazio/Esc da tastiera |
| Griglia in colonna a destra solo da 1100px | Con la Sidebar da 240px, sotto quella soglia i 12 settori 2×2 non entrano senza cluster illeggibili (bug trovato dai test); sotto: una colonna nell'ordine animazione, griglia, legenda, comandi |
| Rotazione del piatto resa da riflessi, settori fermi | I settori sono indirizzi, non oggetti; far girare anche i settori avrebbe imposto alla camera di inseguirli |
| Superfici della scena fisse nei due temi | Oggetti fisici, come il Media Viewer; i token del tema restano per tutta l'interfaccia |
| Verde dei file scurito (#1f8a52 → #1b7a49) | Il bianco sul verde originale dava 4.36:1 (<4.5): ora 5.35:1. Altri contrasti in `disk-compare.css` |
| Markup SVG statico parsato con `DOMParser`, mai assemblato da dati JSON | Nessun vettore di injection; i testi dal JSON passano solo da `textContent` |
| Dati preesistenti con trama (`hatch`), file con trama diversa ciascuno | Il colore non è l'unico segnale (WCAG 1.4.1) |

## 5. Attività rimanenti

Nessuna attività aperta sull'implementazione. Punti dichiarati in §9/§10.

## 6. Prossima fase

Nessuna fase pendente. Direzioni già aperte: (A) consolidamento — vedi §10; (B) un secondo
scenario di Computer Essentials: il motore (`animationTimeline`), le scene e il renderer sono
parametrici su `disk.json`, ma un tipo di scenario diverso richiederà un renderer proprio.
**Prima di tutto**: allegare `Schema_Funzionamento_HDD.pdf` e confrontare le 3 assunzioni di §9.

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE. È stata aggiunta l'area "Computer Essentials" con lo
scenario "HDD vs SSD" (type "disk-compare"): 3 sotto-scenari (HDD vergine, HDD già utilizzato,
SSD), 4 file fissi (selfie.jpeg 5 MB blu, foto_pizza.jpeg 3 MB rosso, selfie_di_coppia.jpeg 12 MB
verde, foto_sushi.jpeg 8 MB giallo; 1 cluster = 1 MB), disco di 48 cluster (3 tracce × 4 settori
× 4 cluster), scene 3D con camera che si avvicina a settore/chip e si allontana al cambio,
barra dei passaggi con sblocco solo a completamento naturale, Procedi/Ripristina/Ricomincia,
ingranaggio velocità 0.5x/1x/2x, ingrandimento manuale solo a passaggio concluso, confronto
affiancato con rapporto tempi in JSON. Il documento di handover completo è allegato: è la fonte di
verità primaria, ma VERIFICA SEMPRE i file reali (clona il repository) prima di fidarti di una
narrazione.

FILE: data/scenarios/hdd-vs-ssd/{scenario,disk}.json, js/utils/{diskModel,animationTimeline,
diskPatterns,diskScene3d}.js, js/scenarios/renderers/diskCompareRenderer.js,
css/scenarios/disk-compare.css, assets/icons/areas/computer-essentials.svg, tests/disk.spec.js;
modificati: data/modules.json, index.html, tests/{run-all,package,sidebar.spec,scenario.spec,
phishing.spec,packet.spec}.

PUNTO APERTO: "Schema_Funzionamento_HDD.pdf" NON era disponibile durante lo sviluppo. Tre
assunzioni da confrontare con il PDF quando sarà allegato: (1) allocazione dalla traccia centrale
verso l'esterna (T1 = traccia più interna); (2) barratura (×) dei cluster cancellati; (3)
numerazione dei cluster nell'ordine di scrittura.

AMBIENTE: tests/node_modules è committato a Playwright 1.62.1 ma il Chromium del sandbox è
compatibile con il Playwright globale 1.56.0: sposta tests/node_modules altrove e imposta
NODE_PATH sull'installazione globale. Le credenziali di test arrivano da SL_TEST_EMAIL/
SL_TEST_PASSWORD (in questo sandbox ho usato una COPIA del repository con un utente di test;
data/users.json reale non è stato toccato).

REGOLE INVARIATE: mai duplicare componenti per la stessa funzione; create(props)→{element,update,
destroy}; eventi "sl:nome-evento"; componenti "dumb"; documentazione in Italiano; test reali;
per ogni file dichiara NUOVO/MODIFICATO/GIÀ ESISTENTE; handover a 10 sezioni + zip.
```

## 8. Test da eseguire

Eseguiti realmente (Playwright, Chromium, server locale, orologio finto `page.clock` per i
tempi), 59 in `tests/disk.spec.js`:

### Test funzionali
- [x] Dati: 4 file 5/3/12/8 MB con i colori richiesti; velocità 0.5/1/2; rapporto tempi dal JSON.
- [x] Modello: 5/3/12/8 cluster per file in tutti e tre i sotto-scenari; foto_sushi in **due
  gruppi (3 + 5)** (cluster 5-7 e 20-24); HDD usato 20 preesistenti + 28 liberi, sushi frammentata;
  SSD = stessa sequenza dell'HDD; scrittura e cancellazione dello stesso file in due fasi;
  ordine di lettura non crescente; validazione che rifiuta init errato, operazione e file ignoti.
- [x] Apertura dalla Sidebar, h1 unico, badge d'area; area nel catalogo con icona esistente.
- [x] Barra dei passaggi: solo il 1 selezionabile all'avvio; bloccati con lucchetto, `title` e
  testo per screen reader; sblocco solo a completamento; durante il passaggio 4 si scelgono 1-3,
  non il 5; **salto indietro che interrompe in modo pulito** (passaggio interrotto non completato,
  disco = fine del passaggio precedente, nessun residuo); **riavanzamento** con Procedi
  senza ripetere i già completati; rivedere un passaggio non cambia lo storico.
- [x] **Gating di Procedi**: disabilitato durante l'animazione, riabilitato solo alla fine,
  disabilitato all'ultimo passaggio.
- [x] Ricomincia e cambio scenario azzerano storico, passaggio e disco senza residui.
- [x] Camera: zoom in sul settore, **zoom out tra settori diversi** (sequenza in→out→in);
  indicatori Allocazione logica / Accesso fisico mai accesi insieme; testina che si sposta.
- [x] Ingrandimento manuale: solo a passaggio concluso; durante l'animazione nessun effetto;
  tastiera (Invio, Esc); riparte dalla vista d'insieme a ogni passaggio.
- [x] Lettura: porzioni disordinate poi ricomposte e fuse in "immagine ricostruita".
- [x] SSD: nessun piatto/testina/rotazione, bus elettrico e camera sul chip, scrittura **e
  cancellazione della pizza mostrate**, stessi 2 gruppi del sushi.
- [x] **Confronto**: HDD a sinistra, SSD a destra; SSD 5× più rapido in ogni istante; a fine
  corsa 8,0 s / 1,6 s simulati e stessa disposizione finale; tabella con le 6 righe richieste e
  conclusione prudente.
- [x] Velocità: ingranaggio 0.5x/1x/2x, default 1x, solo i tempi cambiano (stato finale uguale).

### Test UI
- [x] **Layout**: griglia a destra dell'animazione; legenda dei file e comandi sotto.
- [x] Light/Dark (contrasto del passaggio corrente in Dark ≥ 4.5:1); screenshot ispezionati.
- [x] 768 / 900 / 1024px: nessun overflow; 375px: una colonna, barra scorrevole, target ≥ 44px.
- [x] Coerenza dei colori tra griglia, legenda e conteggio per file; trame diverse per file.

### Test UX
- [x] Tastiera: Tab, Invio/Spazio, passaggi bloccati inerti, ingranaggio con Esc e ritorno del
  focus; annuncio vocale del cambio e del completamento passaggio; `aria-current="step"`.
- [x] **Movimento ridotto**: tempi 0.1×, rotazione ferma, Procedi con le stesse regole.

### Test tecnici
- [x] Nessun errore JS/console, nessuna risorsa locale mancante, **nessuna richiesta esterna**.
- [x] Degrado: `disk.json` mancante o non valido → messaggio condiviso e motivo in console.
- [x] Smontaggio a metà animazione: nessun errore né fotogramma in ritardo.
- [x] `node --check` su tutti i file `.js`.

### Test di regressione
- [x] Suite completa 470/470 (include login, home, sidebar, scenari esistenti).
- [ ] **Verifica visiva su LIM/proiettore reale e con un dispositivo touch**: non eseguita.
- [ ] Prestazioni su macchine datate (la scena usa 3 livelli di spessore e un SVG con trasformazioni
  CSS 3D): non misurate, solo ispezione visiva.

## 9. Criticità

- **PDF mancante** (vedi §6/§7): le 3 assunzioni sullo schema non sono verificabili.
- **Rotazione resa da riflessi, non dal piatto intero**: scelta di resa documentata; se il docente
  vuole i settori che ruotano davvero, la camera dovrà inseguire il settore (lavoro non banale).
- **Test eseguiti su una copia di lavoro** con un utente di test: `data/users.json` reale non è
  stato toccato e non conosco la password reale; la suite va rieseguita dall'utente con le sue
  credenziali (`SL_TEST_EMAIL`/`SL_TEST_PASSWORD`).
- **Attese dei test esistenti aggiornate (4 file)**: erano codificate sulle 3 aree; ora sono
  parametrate sulle 4. Non è un fallimento di funzionalità ma va tenuto presente a ogni nuova area.
- **Griglia a destra solo da 1100px**: a 768-1024px (tablet) la griglia scende sotto l'animazione.
- **Sticky header nei fullPage screenshot**: artefatto dell'acquisizione, non della pagina.

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 Pannello velocità (`settings`) duplicato da Viaggio dei dati e LLM con prefisso proprio: già
  candidato a un componente condiviso (qui è il terzo consumer).
- 🟢 Durate della coreografia (350/750/1050 ms ecc.) nel renderer: scelte di resa; non nel JSON.

### Refactoring consigliati
- 🟡 Estrarre il pannello velocità + info in un componente `SettingsPanel` (3 consumer reali).
- 🟡 `diskCompareRenderer.js` è lungo (~700 righe): la coreografia (`runStep`) e il confronto
  potrebbero diventare moduli dedicati.
- 🟢 Estrarre la sezione "2×2 cluster per settore" da `diskModel.js` se servisse un disco con
  geometria diversa (oggi è costante nel codice e validata dalla lunghezza di `init`).

### Ottimizzazioni future
- 🟢 Pinch-to-zoom e pan nello zoom manuale (non richiesti).
- 🟢 Pausa/riprendi dell'animazione (oggi si può solo interrompere saltando a un altro passaggio).

### Rischi architetturali
- 🟡 Più `type` con scene 3D in futuro: le scene sono due fabbriche con la stessa interfaccia, ma
  non c'è un'astrazione generale (YAGNI finché non c'è un terzo supporto).
- 🟢 Nessun rischio nuovo su Supabase: lo scenario legge solo JSON locali via repository.

### Priorità
- 🟡 Media: componente `SettingsPanel` condiviso; confronto con il PDF dello schema.
- 🟢 Bassa: tutto il resto.

### Obiettivo
Chiusa l'implementazione: scenario completo, area integrata, 59 nuovi controlli e regressione
completa; i punti aperti sono dichiarati e non nascosti.
