# SOCIALIVE — Handover: Allegato PDF sulla email Voltrea (scenario Phishing)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** miglioramento incrementale richiesto da Erasmo sullo scenario Phishing già esistente
(`type: "phishing-simulation"`). Non tocca l'email target (Banca Centrale Sicura) né la logica di
rivelazione: arricchisce solo l'email di riempimento Voltrea con un allegato scaricabile
realistico.
**Tag di riferimento suggerito:** `v1.x-allegato-bolletta-voltrea`

---

## 1. Stato del progetto

- Piattaforma stabile: 4 scenari reali (Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi),
  autenticazione locale, Sidebar a flyout — invariati.
- **Questo intervento: ✅ COMPLETATO E VERIFICATO END-TO-END.** L'email "Voltrea" nello
  scenario Phishing (email di riempimento, `isTarget: false`) ora porta un allegato PDF reale:
  una simulazione di bolletta luce con dati cliente, periodo di fatturazione, grafici di consumo
  e spesa, dettaglio voci di costo, e footer con disclaimer didattico — esattamente come
  richiesto.
- **156/156 controlli Playwright superati** attraverso il vero `index.html` (150 preesistenti +
  6 nuovi dedicati all'allegato) — nessuna regressione su login/home/scenario/phishing.
- **1 bug reale trovato e corretto durante la verifica**: il server di test (`tests/helpers/
  server.js`) non aveva mai servito un file `.pdf` prima d'ora e mancava della relativa voce
  MIME — serviva `application/octet-stream` invece di `application/pdf`. Corretto (vedi §4).


### Revisione rispetto alla prima consegna
Questa versione sostituisce la precedente. Cambiamenti: (1) brand `EnergiaPlus` → `Voltrea`,
propagato in `inbox.json` (mittente, indirizzo, corpo, allegato), nome dell'asset
(`bolletta-voltrea-ottobre-2026.pdf`) e test; (2) cinque codici del PDF allungati di 2 caratteri;
(3) indirizzo di fornitura sostituito con uno verificato come inesistente a Santeramo in Colle.
**Zero modifiche di codice applicativo**: renderer e CSS sono data-driven e non citano il brand.
**Se hai già applicato la prima consegna**: elimina `assets/documents/phishing/bolletta-energiaplus-ottobre-2026.pdf`
e sostituisci i file elencati in §3.

---

## 2. Obiettivi completati

### PDF — `assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf` (nuovo)
Bolletta luce a una pagina, generata con reportlab, che riproduce il linguaggio visivo di una vera
utility italiana (fascia brand verde, distinta dal blu/indaco di SocialAlive per non creare
confusione tra i due "prodotti" dentro la stessa demo):
- **Dati cliente e fornitura**: intestatario, codice fiscale, codice cliente, codice di
  migrazione, codice POD, indirizzo di fornitura (Via del Ginepro 18, 70029 Santeramo in Colle
  (BA)), tipo di contratto, potenza impegnata, tensione. **I cinque codici sono volutamente
  NON validi** (vedi §4): ciascuno ha 2 caratteri in più rispetto al formato reale, così da non
  poter coincidere con un codice esistente.
- **Riepilogo consumi**: consumo fatturato (214 kWh), media giornaliera, consumo annuo stimato.
- **Due grafici a barre**: andamento consumi (kWh) e andamento spesa (€) sugli ultimi 6 mesi —
  gli importi mensili sono calcolati con la stessa formula del totale in bolletta (materia +
  trasporto + oneri, IVA 10%), quindi internamente coerenti, non numeri a caso.
- **Dettaglio importi**: spesa per la materia energia, spesa per il trasporto e la gestione del
  contatore, oneri di sistema, subtotale, IVA, totale — tabella con importi verificati (i valori
  si sommano correttamente).
- **Modalità di pagamento**: addebito automatico, IBAN, data di addebito — coerente col testo
  della email ("L'importo verrà addebitato automaticamente il giorno 15 del mese").
- **Footer**: disclaimer a scopo didattico in ogni pagina, che dichiara esplicitamente che
  "Voltrea" è un marchio di fantasia, che tutti i dati anagrafici/codici/importi sono
  inventati e non riferiti ad alcuna persona reale, e che il file non è mai stato inviato ad
  alcun server esterno.
- **Tutti i dati sono inventati**: nome, codice fiscale, codice cliente, codice di migrazione,
  indirizzo, IBAN, numero bolletta — nessuno corrisponde a una persona, utenza o fornitura reale.

### Dati — `data/scenarios/phishing/inbox.json` (modificato)
Aggiunto un campo opzionale `attachment` (oggi presente solo sull'email `email-003`, Voltrea):
```json
"attachment": {
  "fileName": "Bolletta_Voltrea_Ottobre_2026.pdf",
  "url": "assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf",
  "sizeLabel": "6 KB"
}
```
`fileName` è sia il nome mostrato nel biglietto sia il nome con cui il browser salva il file
(attributo `download`, disaccoppiato dal nome reale su disco — stesso principio già usato per
`assets/`); `url` è il percorso reale dell'asset statico; `sizeLabel` è la didascalia visibile.

### Renderer — `js/scenarios/renderers/phishingSimulationRenderer.js` (modificato)
- **Indicatore graffetta nella riga di inbox** (`buildEmailRow`): icona decorativa
  (`aria-hidden`) accanto all'orario, visibile SOLO sulla riga che porta un `attachment` — stesso
  pattern di qualunque client di posta reale. Il nome accessibile della riga guadagna ". Con
  allegato." in coda, così l'informazione arriva anche a chi naviga con uno screen reader senza
  affidarsi alla sola icona.
- **Biglietto allegato nel dettaglio email** (`buildEmailDetailView` + nuova
  `buildAttachmentCard()`): un vero `<a href="…" download="…">`, non un bottone con download
  simulato via Blob — a differenza del log del Keylogger (generato al volo con dati variabili),
  questa bolletta è un documento fisso con dati già decisi una volta per tutte, quindi un asset
  statico incluso nel progetto è la scelta più semplice e coerente (stesso principio già seguito
  per le immagini in `assets/`): nessuna libreria di generazione PDF lato client da vendorizzare,
  zero codice a runtime oltre a un link. Icona documento inline (stesso linguaggio "outline,
  stroke 1.5px" già usato da ogni altra icona del progetto), nome file, didascalia "PDF — 6 KB".
- Renderizzato SOLO quando `email.attachment` è presente — condizione identica a quella già usata
  due righe sotto per `ctaLabel`.
- Nuovo import: `svgNode` da `../../utils/svg.js` (riusato as-is, zero modifiche a quel file).

### Stile — `css/scenarios/phishing-simulation.css` (modificato)
- `.sl-phishing__email-attachment-indicator` (+ wrapper `-timestamp-group`): la graffetta
  nell'inbox, 14×14px, `color: var(--sl-color-text-secondary)`.
- `.sl-phishing__attachment` (+ `-icon`/`-text`/`-name`/`-meta`): il biglietto nel dettaglio —
  superficie "sollevata" (`bg-elevated` + `border-subtle` + `radius-md`), stesso trattamento già
  dato altrove nel Design System a un blocco secondario dentro un flusso di testo; icona in
  `--sl-color-error-text` (il classico rosso da icona PDF, già verificato su bg-elevated per il
  voce "Esci" di ProfileMenu — nessuna nuova verifica di contrasto necessaria, l'icona resta
  comunque puramente decorativa). `align-self: flex-start`: il biglietto non si allarga mai a
  piena colonna.
- **Zero nuovi accostamenti colore**: ogni token riusato era già verificato in un contesto
  identico altrove nel progetto.

### Test — `tests/phishing.spec.js` (modificato, +6 controlli) e `tests/helpers/server.js` (modificato)
Nuovo blocco dedicato "Allegato PDF sull'email Voltrea": indicatore presente SOLO sulla riga
giusta, nome accessibile corretto, biglietto con nome/didascalia corretti, `href`/`download`
corretti E il file scaricato è davvero un PDF valido (richiesta HTTP reale con
`page.request.get()`, verifica status 200 + `content-type: application/pdf` + firma binaria
`%PDF-`), le altre 4 email restano senza biglietto, e — coerente con la disciplina etica già
applicata ad ogni scenario — nessuna richiesta esce verso un host esterno durante l'intero flusso.
`tests/helpers/server.js`: aggiunta la voce `.pdf: application/pdf` a `MIME_TYPES` (bug reale
trovato proprio da questo nuovo test, vedi §9).

---

## 3. Architettura — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf` | ⭐ **NUOVO** | Bolletta simulata, dati inventati |
| `data/scenarios/phishing/inbox.json` | ♻️ **MODIFICATO** | +campo `attachment` su `email-003` |
| `js/scenarios/renderers/phishingSimulationRenderer.js` | ♻️ **MODIFICATO** | Indicatore inbox + biglietto allegato + import `svgNode` |
| `css/scenarios/phishing-simulation.css` | ♻️ **MODIFICATO** | Stile indicatore + biglietto |
| `tests/phishing.spec.js` | ♻️ **MODIFICATO** | +6 controlli dedicati |
| `tests/helpers/server.js` | ♻️ **MODIFICATO** | +MIME type `.pdf` (bug reale corretto) |
| `docs/handover/handover-allegato-bolletta-phishing.md` | ⭐ **NUOVO** | Questo documento |

**Nessuna modifica** a `bank-site.json`, `reveal.json`, `scenario.json` (dello scenario Phishing),
`scenarioEngine.js`, `router.js`, `appShell.js`, `authService.js`, `index.html` (nessun nuovo
`<link>`/import da registrare — tutti i file toccati erano già collegati), né a qualunque altro
scenario o componente condiviso.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Asset statico, non generazione dinamica in JS | I dati della bolletta sono fissi (decisi una volta, non dipendenti da input dell'utente) — un file in `assets/` è la scelta più semplice, coerente con come il progetto già tratta immagini statiche. Generarlo a runtime avrebbe richiesto vendorizzare una libreria PDF client-side senza alcun beneficio reale. |
| Vero `<a href download>`, non un Blob | Stesso principio "usa l'elemento nativo quando basta" già seguito ovunque nel progetto (es. i link di Sidebar): un link reale dà comportamento di download corretto gratuitamente, senza codice a runtime. Il Blob del Keylogger resta giustificato lì perché quel contenuto è generato dinamicamente (rumore casuale + credenziali digitate) — qui non c'è nulla da generare. |
| `download` disaccoppiato dal nome file reale su disco | Stesso principio già usato da `mediaViewerLauncher.js` (dato vs presentazione): il nome asset su disco (`bolletta-voltrea-ottobre-2026.pdf`, kebab-case, coerente con le convenzioni di naming del progetto) può restare stabile anche se in futuro cambiasse il nome mostrato/scaricato. |
| Allegato SOLO su Voltrea, non sull'email target | Richiesta esplicita di Erasmo. L'email target (banca) mantiene il proprio flusso invariato (CTA → finto sito → rivelazione) — l'allegato è un elemento di realismo sulla email di riempimento, non un secondo vettore d'attacco introdotto di iniziativa. |
| Codice fiscale con carattere di controllo calcolato correttamente | Un dato palesemente sbagliato nel formato avrebbe rotto la sospensione dell'incredulità che è l'obiettivo esplicito del progetto — il costo di calcolarlo bene è minimo. |
| Brand rinominato da "EnergiaPlus" a "Voltrea" | Su richiesta di verifica: "EnergiaPlus" non risultava come nome esatto, ma esistono fornitori reali molto vicini ("E-plus Energia", "Plus Energy", "Enplus Italia"). Anche "Zefiro Energia" e "Lumina Energia" (candidati scartati) risultano reali. "Voltrea" (parola coniata, come Wekiwi/Pulsee/Illumia) non ha dato alcun riscontro in nessuna ricerca. La verifica web non può escludere ogni piccola S.r.l. omonima: il disclaimer nel footer del PDF resta la tutela residua. |
| Cinque codici con +2 caratteri (migrazione, POD, codice fiscale, cliente, IBAN) | Garantisce per costruzione che nessun codice possa coincidere con uno reale (lunghezze fisse: migrazione 14, POD 15, CF 16, IBAN 27). Resta plausibile a colpo d'occhio: è proprio il punto didattico — chi non verifica formato e lunghezza dei dati "ufficiali" di un'email è esposto al phishing. |
| Indirizzo "Via del Ginepro 18, 70029 Santeramo in Colle (BA)" | Verificato sullo stradario comunale (geoplan.it): la via NON compare tra le vie di Santeramo (l'unica occorrenza trovata è a Matera). Il primo indirizzo usato ("Via Aldo Moro") era invece una via reale di Santeramo: sostituito. |
| Colore "Voltrea" (verde) deliberatamente distinto dal brand SocialAlive | Evita che il documento sembri "prodotto dalla piattaforma stessa" invece che da un mittente esterno simulato — coerente con la logica già usata per lo sfondo fisso di MediaViewer ("un elemento del mondo simulato non deve confondersi con il chrome di SOCIALIVE"). |

---

## 5. Attività rimanenti

Nessuna attività aperta su questo specifico intervento. Punti pre-esistenti e indipendenti,
invariati:
1. Icon sprite (`assets/icons/icons.svg`) — debito noto e invariato.
2. `js/config/env.js` per una futura riattivazione di Supabase — runbook già pronto
   (`come-riattivare-supabase.md`).
3. Integrazione CI per `tests/` — non ancora collegata.
4. Eventuali nuovi scenari futuri della Long Term Vision (Social Engineering, Fake News, ecc.).

---

## 6. Prossima fase

Nessuna fase numerata pendente. Prossimo passo naturale, se utile: applicare lo stesso principio
("allegato realistico su una email di riempimento") ad altri scenari email-based futuri, oppure
proseguire con una delle direzioni generali già note (consolidamento CI/anti-regressione, o
espansione con un nuovo scenario).

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La piattaforma ha 4 scenari reali (Oversharing, Keylogger, Phishing, Evil Twin
Wi-Fi), autenticazione locale, Sidebar a flyout. Su richiesta di Erasmo, l'email "Voltrea"
dello scenario Phishing (email di riempimento, non l'email target della banca) ora porta un
allegato PDF scaricabile: una bolletta luce simulata con dati cliente/fornitura, periodo di
fatturazione, due grafici (consumi kWh e spesa €), dettaglio voci di costo, footer con
disclaimer didattico. Tutti i dati (nome, codice fiscale, codice cliente, codice di migrazione,
indirizzo, IBAN) sono inventati. Il documento di handover completo è allegato: consideralo la
fonte di verità primaria.

FILE NUOVI: assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf,
docs/handover/handover-allegato-bolletta-phishing.md.
FILE MODIFICATI: data/scenarios/phishing/inbox.json (+campo "attachment" su email-003),
js/scenarios/renderers/phishingSimulationRenderer.js (indicatore graffetta in inbox + biglietto
allegato nel dettaglio, vero <a href download> verso l'asset statico — non un Blob generato al
volo), css/scenarios/phishing-simulation.css, tests/phishing.spec.js (+6 controlli),
tests/helpers/server.js (aggiunta voce MIME ".pdf" — bug reale trovato durante la verifica: il
server di test non aveva mai servito un PDF prima d'ora).

VERIFICA ESEGUITA: suite completa (login.spec.js + home.spec.js + scenario.spec.js +
phishing.spec.js) eseguita attraverso il vero index.html — 156/156 controlli superati (150
preesistenti + 6 nuovi), incl. una richiesta HTTP reale che verifica che il file scaricato sia
un PDF valido (status 200, content-type application/pdf, firma binaria %PDF-) e che nessuna
richiesta esca verso host esterni durante l'apertura/download dell'allegato.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant e Full Stack
Architect. Prima di modificare index.html o authService.js, verifica sempre che ogni import
corrisponda a un export reale. Non azzerare mai data/users.json senza conferma esplicita di
Erasmo. Clona sempre il repository reale prima di modificare qualcosa — mai fidarti della sola
narrazione di una chat precedente. Mai duplicare componenti/moduli per la stessa funzione;
interfaccia uniforme create(props)→{element,update,destroy}; eventi "sl:nome-evento";
documentazione in italiano; propone sempre un'architettura motivata e attendi conferma prima di
scrivere codice; test reali (mai mock), verificati anche attraverso l'index.html reale; ogni
consegna include una tabella file NUOVO/MODIFICATO con percorso esatto.

STATO: nessuna attività pendente su questo intervento. Indica la prossima priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** in questa sessione (Playwright,
Chromium reale, server locale, mai `file://`, credenziali di test separate da quelle reali di
Erasmo).

### Test funzionali
- [x] Inbox: solo la riga Voltrea mostra l'indicatore graffetta.
- [x] Nome accessibile della riga Voltrea include "Con allegato.".
- [x] Apertura Voltrea → biglietto con nome file e didascalia "PDF — 6 KB" corretti.
- [x] `href`/`download` del biglietto corretti; il file richiesto via HTTP risponde 200,
  `content-type: application/pdf`, e i primi byte sono la firma `%PDF-` (file realmente valido,
  non solo un link che punta a un percorso qualunque).
- [x] Le altre 4 email (incl. quella target della banca) restano senza biglietto allegato.
- [x] VINCOLO ETICO: apertura e download dell'allegato non generano alcuna richiesta verso host
  esterni.
- [x] Regressione: 32/32 su `phishing.spec.js` (flusso a 5 viste, CTA banca, rivelazione, uscita,
  cartelle, "Rispondi", regressione Oversharing/Keylogger) — tutti verdi.
- [x] Regressione totale: 156/156 su `login.spec.js` + `home.spec.js` + `scenario.spec.js` +
  `phishing.spec.js`.

### Test UI
- [x] Biglietto allegato verificato via screenshot in Light e Dark — leggibile in entrambi,
  nessun nuovo accostamento colore fuori soglia.
- [x] Icona graffetta nell'inbox verificata via screenshot — posizionata correttamente accanto
  all'orario, non altera l'allineamento della riga.
- [ ] Breakpoint mobile (375px) specifico per il biglietto allegato — non verificato con uno
  screenshot dedicato in questo intervento (rischio basso: il biglietto usa `align-self:
  flex-start` + `max-width:100%`, stesso pattern responsive già verificato altrove nella pagina).

### Test UX
- [x] Nessun movimento forzato del focus all'apertura dell'email con allegato.
- [x] Il biglietto comunica lo stato "scaricabile" sia visivamente (icona+bordo) sia via
  `aria-label` esplicito, mai il solo colore come segnale.

### Test tecnici
- [x] `node --check` su tutti i file `.js` nuovi/modificati.
- [x] JSON validato sintatticamente (`inbox.json`).
- [x] Console priva di errori JS nel flusso completo.
- [x] Nessun path relativo rotto — nessuna modifica a `index.html` necessaria (nessun nuovo
  `<link>`/import da registrare).

### Test di regressione
- [x] Oversharing e Keylogger ancora raggiungibili e invariati (verificato esplicitamente nella
  suite phishing, blocco di regressione già esistente).
- [x] Suite completa (156/156) rieseguita attraverso l'`index.html` reale dopo ogni modifica.

---

## 9. Criticità

- **Bug reale trovato e corretto durante questo intervento**: `tests/helpers/server.js` non aveva
  mai servito un file `.pdf` prima d'ora (nessuno scenario precedente ne aveva bisogno) — la
  voce MIME mancante faceva rispondere il server di test con `application/octet-stream` invece di
  `application/pdf`. Un browser reale gestisce comunque correttamente un `<a download>` con quel
  content-type generico (il download "funziona" comunque), ma un test che verifica l'header per
  davvero lo avrebbe altrimenti segnalato come falso negativo permanente. Corretto aggiungendo
  `.pdf: "application/pdf"` a `MIME_TYPES`.
- **Nessuna criticità aperta relativa al contenuto del PDF o all'integrazione nello scenario.**

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento.

### Refactoring consigliati
- 🟢 Nessuno: l'intervento riusa esclusivamente pattern già esistenti (`svgNode()`, elementi
  nativi `<a download>`, token del Design System già verificati) — zero nuova indirection.

### Ottimizzazioni future
- 🟢 Se in futuro altri scenari email-based (es. un secondo Phishing, o Social Engineering)
  avessero bisogno dello stesso pattern "biglietto allegato scaricabile", `buildAttachmentCard()`
  è già scritta in una forma generica (riceve `{ fileName, url, sizeLabel }`) e potrebbe essere
  estratta in un'utility condivisa al SECONDO consumo reale — non anticipato ora (YAGNI, stesso
  criterio già seguito in tutto il progetto).

### Rischi architetturali
- 🟢 **Nessun rischio nuovo**: l'intervento è puramente additivo (un campo dati opzionale, un
  ramo condizionale nel renderer, un file statico) — zero modifiche a componenti condivisi,
  routing, autenticazione o allo scenario target (banca).

### Priorità
- 🟢 Bassa: nessun elemento ad alta o media priorità residuo su questo intervento.

### Obiettivo
Questo intervento è chiuso end-to-end: implementazione, verifica reale attraverso l'`index.html`
reale (156/156), e documentazione — coerente con l'architettura consolidata del progetto, senza
debito residuo introdotto.
