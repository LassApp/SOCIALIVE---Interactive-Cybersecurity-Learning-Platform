# SOCIALIVE — Handover: Allegato bolletta + email "le mie password" (scenario Phishing)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Cybersecurity Awareness Consultant / Full Stack Architect del progetto.
**Contesto:** miglioramento incrementale sullo scenario Phishing già esistente
(`type: "phishing-simulation"`). Non tocca l'email target (Banca Centrale Sicura) né la logica di
rivelazione: arricchisce il realismo dell'inbox con un allegato scaricabile e una seconda email
di sfondo.
**Tag di riferimento suggerito:** `v1.x-allegato-bolletta-e-password-email`
**Nota:** questo documento sostituisce integralmente la versione precedente
(`handover-allegato-bolletta-phishing.md`, consegnata in due round precedenti) — riflette lo stato
finale corrente, non va letto in sequenza con quello.

---

## 1. Stato del progetto

- Piattaforma stabile: 4 scenari reali (Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi),
  autenticazione locale, Sidebar a flyout — invariati.
- **Questo intervento: ✅ COMPLETATO E VERIFICATO END-TO-END**, in tre round incrementali (tutti
  confermati sul repository reale, clonato da zero ad ogni ripresa — mai dalla sola narrazione di
  una chat precedente):
  1. Allegato PDF scaricabile sull'email di riempimento "Voltrea" (bolletta simulata).
  2. Rinomina del brand da "EnergiaPlus" a "Voltrea" (verifica di non-esistenza, vedi §4) + 5
     codici del PDF resi deliberatamente non validi + indirizzo verificato come inesistente a
     Santeramo in Colle.
  3. Filigrana diagonale "FAC-SIMILE" sul PDF + nuova email "le mie password" (non di phishing:
     materiale di sfondo che mostra una cattiva pratica reale — credenziali in chiaro via email).
- **159/159 controlli Playwright superati** attraverso il vero `index.html` (19 login + 27 home +
  78 scenario + 35 phishing) — nessuna regressione.

---

## 2. Obiettivi completati

### 2.1 — PDF: `assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf`
Bolletta luce a una pagina (reportlab), brand "Voltrea":
- **Filigrana "FAC-SIMILE"** (nuovo): scritta diagonale a 45°, grigio chiaro semi-trasparente
  (alpha 0.22), attraversa l'intera pagina sotto ogni altro elemento — rinforza visivamente,
  non solo nel testo del footer, che il documento non è valido.
- **Dati cliente e fornitura**: intestatario (Davide Colombo), indirizzo di fornitura verificato
  come inesistente a Santeramo in Colle (**Via del Ginepro 18, 70029 Santeramo in Colle (BA)**),
  tipo di contratto, potenza, tensione.
- **Cinque codici deliberatamente non validi** (+2 caratteri ciascuno rispetto al formato reale
  — vedi §4 per il rationale):

  | Campo | Valore nel PDF |
  |---|---|
  | Codice di migrazione | `9801457236014578` |
  | Codice POD | `IT001E77412583A78` |
  | Codice fiscale | `CLMDVD85A01F205U78` |
  | Codice cliente | `VT-4821397678` |
  | IBAN registrato | `IT60 X054 2811 1010 0000 0123 45678` |

- **Riepilogo consumi** + due grafici a barre (consumi kWh / spesa €, 6 mesi, importi
  internamente coerenti con la formula del totale).
- **Dettaglio importi** (materia energia, trasporto, oneri di sistema, IVA, totale — valori che
  si sommano correttamente) e **modalità di pagamento**.
- **Footer**: disclaimer a scopo didattico su ogni pagina — "Voltrea" marchio di fantasia, dati
  inventati, file mai inviato ad alcun server esterno.

### 2.2 — Dati: `data/scenarios/phishing/inbox.json`
- **Email "Voltrea"** (`email-003`, già esistente, riempimento non target): campo `attachment`
  (`fileName`, `url`, `sizeLabel`) che punta al PDF statico.
- **Nuova email "le mie password"** (`email-006`, nuova, in coda alla cartella "Posta in
  arrivo" — la più vecchia, 3 giorni fa, già letta): mittente **Davide Colombo
  <davide.colombo86@gmail.com>** — lo stesso titolare della bolletta Voltrea, per coerenza
  narrativa tra i due elementi dell'inbox — che scrive a se stesso un elenco di password in
  chiaro:

  ```
  instagram passw 123456
  fb 7890
  netflix netflix01
  amazon amazon2020
  paypal paypal01
  spotify spotify123
  mail (questa) qwerty1
  ```

  Le prime due righe sono quelle fornite esplicitamente; le altre cinque sono invenzioni nello
  stesso registro "molto banale" (incl. deliberatamente la password della casella di posta
  stessa, per il punto didattico più forte: scrivere la password della propria email dentro
  un'email è l'esempio limite di questa cattiva pratica). `isTarget: false`: non è un'email di
  phishing, è materiale di sfondo — nessun CTA, nessun finto sito, nessuna logica di rivelazione
  collegata.

### 2.3 — Codice applicativo
**Nessuna modifica** a renderer o CSS in questo round: sia l'allegato sia la nuova email sono
interamente guidati dai dati (`inbox.json`) secondo l'architettura già esistente — conferma
concreta che la scelta "asset statico + rendering condizionale su un campo opzionale" (round 1)
regge bene a un secondo caso d'uso diverso (un'email senza alcun elemento speciale, solo corpo
testuale) senza richiedere nulla di nuovo nel renderer.

### 2.4 — Test: `tests/phishing.spec.js` (+9 controlli dal punto di partenza di questo intervento)
- Aggiornati i conteggi rigidi (5→6 righe inbox) in 2 test preesistenti.
- Esteso il test "le altre email restano senza biglietto allegato" per includere anche la nuova
  email (indice 5).
- Nuovo blocco dedicato "le mie password": riga in fondo con mittente/stato corretti, corpo con
  tutte le righe di credenziali attese, assenza di CTA/allegato.

---

## 3. Architettura — file coinvolti (stato cumulativo dei tre round)

| File | Stato | Intervento |
|---|---|---|
| `assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf` | ♻️ **MODIFICATO** (round 3: + filigrana) | Bolletta simulata |
| `data/scenarios/phishing/inbox.json` | ♻️ **MODIFICATO** (round 3: + `email-006`) | Allegato su Voltrea + nuova email password |
| `js/scenarios/renderers/phishingSimulationRenderer.js` | ♻️ **MODIFICATO** (invariato dal round 1) | Indicatore inbox + biglietto allegato |
| `css/scenarios/phishing-simulation.css` | ♻️ **MODIFICATO** (invariato dal round 1) | Stile indicatore + biglietto |
| `tests/phishing.spec.js` | ♻️ **MODIFICATO** (round 3: +conteggi, +3 controlli) | 35 controlli totali sullo scenario |
| `tests/helpers/server.js` | ♻️ **MODIFICATO** (invariato dal round 1) | +MIME type `.pdf` (bug reale corretto) |
| `docs/handover/handover-allegato-bolletta-phishing.md` | ♻️ **MODIFICATO** | Questo documento (sostituisce le versioni precedenti) |

**Nessuna modifica** a `bank-site.json`, `reveal.json`, `scenario.json` dello scenario Phishing,
`scenarioEngine.js`, `router.js`, `appShell.js`, `authService.js`, `index.html`, né a qualunque
altro scenario o componente condiviso.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Watermark disegnato per primo nel canvas, sotto ogni altro elemento | Stesso principio di "layer di sfondo" già usato per la fascia brand — l'ordine di disegno in reportlab determina lo z-order; disegnarlo per ultimo lo avrebbe messo sopra il testo, rendendolo illeggibile |
| Alpha 0.22, grigio neutro, 125pt, 45° | Abbastanza presente da essere notato subito (anche da chi guarda lo schermo proiettato a distanza), abbastanza leggero da non rendere illeggibili i dati sottostanti — nessun valore "giusto" a priori, scelto verificando il render |
| "Davide Colombo" come mittente di "le mie password" | Stesso titolare già usato per la bolletta Voltrea (round 1) — coerenza narrativa: è la stessa persona, non due identità scollegate nella stessa inbox |
| Email "le mie password" SENZA CTA/allegato/logica di rivelazione | Non è l'email di phishing: è un secondo esempio di rischio reale (credenziali in chiaro via email) che arricchisce la lezione senza introdurre un secondo vettore d'attacco non richiesto |
| Password della casella di posta stessa inclusa nell'elenco | Punto didattico deliberato: mostra l'assurdità estrema della pratica (la password per leggere quell'email è scritta dentro l'email stessa) — un dettaglio che il docente può far notare dal vivo |
| Brand rinominato da "EnergiaPlus" a "Voltrea" | "EnergiaPlus" non risultava come nome esatto, ma esistono fornitori reali molto vicini ("E-plus Energia", "Plus Energy", "Enplus Italia"). Anche "Zefiro Energia" e "Lumina Energia" (candidati scartati) risultano reali. "Voltrea" (parola coniata, come Wekiwi/Pulsee/Illumia) non ha dato alcun riscontro in nessuna ricerca. La verifica web non può escludere ogni piccola S.r.l. omonima: il disclaimer nel footer del PDF resta la tutela residua |
| Cinque codici con +2 caratteri (migrazione, POD, codice fiscale, cliente, IBAN) | Garantisce per costruzione che nessun codice possa coincidere con uno reale (lunghezze fisse: migrazione 14, POD 15, CF 16, IBAN 27). Resta plausibile a colpo d'occhio: è proprio il punto didattico — chi non verifica formato e lunghezza dei dati "ufficiali" di un'email è esposto al phishing |
| Indirizzo "Via del Ginepro 18, 70029 Santeramo in Colle (BA)" | Verificato sullo stradario comunale (geoplan.it): la via NON compare tra le vie di Santeramo (l'unica occorrenza trovata è a Matera). Il primo indirizzo usato ("Via Aldo Moro") era invece una via reale di Santeramo: sostituito |
| Asset statico, non generazione dinamica in JS | I dati della bolletta sono fissi — un file in `assets/` è la scelta più semplice, coerente con come il progetto già tratta immagini statiche |
| Vero `<a href download>`, non un Blob | Elemento nativo, zero codice a runtime — il Blob del Keylogger resta giustificato lì solo perché quel contenuto è generato dinamicamente |

---

## 5. Attività rimanenti

Nessuna attività aperta su questo specifico intervento. Punti pre-esistenti e indipendenti,
invariati: icon sprite, `js/config/env.js` per Supabase, integrazione CI, eventuali nuovi
scenari futuri della Long Term Vision.

---

## 6. Prossima fase

Nessuna fase numerata pendente. Possibile prossimo passo, se utile: lo stesso principio ("un
secondo esempio di cattiva pratica nell'inbox, non necessariamente un'email di phishing")
potrebbe estendersi ad altri scenari email-based futuri.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La piattaforma ha 4 scenari reali (Oversharing, Keylogger, Phishing, Evil Twin
Wi-Fi). Lo scenario Phishing ha ricevuto tre round di miglioramenti incrementali sulla stessa
email di riempimento "Voltrea" (ex "EnergiaPlus", rinominata dopo verifica) e sull'inbox:
1) un allegato PDF scaricabile (bolletta simulata) sull'email Voltrea; 2) la bolletta ora porta
una filigrana diagonale "FAC-SIMILE" e 5 codici (migrazione/POD/CF/cliente/IBAN) deliberatamente
allungati di 2 caratteri per non poter mai coincidere con un dato reale; 3) una nuova email
"le mie password" (mittente: lo stesso titolare della bolletta, Davide Colombo — non è
un'email di phishing, è materiale di sfondo) con un elenco di credenziali in chiaro per servizi
comuni, password volutamente banali. Il documento di handover completo è allegato: consideralo
la fonte di verità primaria, non la narrazione di una chat precedente.

FILE COINVOLTI (stato finale): assets/documents/phishing/bolletta-voltrea-ottobre-2026.pdf,
data/scenarios/phishing/inbox.json, js/scenarios/renderers/phishingSimulationRenderer.js,
css/scenarios/phishing-simulation.css, tests/phishing.spec.js, tests/helpers/server.js,
docs/handover/handover-allegato-bolletta-phishing.md.

VERIFICA ESEGUITA: suite completa (login+home+scenario+phishing) eseguita attraverso il vero
index.html dopo OGNI round — 159/159 controlli superati (19+27+78+35). Repository reale clonato
da zero ad ogni ripresa di lavoro per verificare lo stato effettivo, mai dato per scontato.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG), Cybersecurity Awareness Consultant e Full Stack
Architect. Prima di modificare index.html o authService.js, verifica sempre che ogni import
corrisponda a un export reale. Non azzerare mai data/users.json senza conferma esplicita di
Erasmo. Clona sempre il repository reale prima di modificare qualcosa. Mai duplicare
componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy}; eventi "sl:nome-evento"; documentazione in italiano;
proponi sempre un'architettura motivata e attendi conferma prima di scrivere codice; test reali
(mai mock), verificati anche attraverso l'index.html reale; ogni consegna include una tabella
file NUOVO/MODIFICATO con percorso esatto.

STATO: nessuna attività pendente su questo intervento. Indica la prossima priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** (Playwright, Chromium reale,
server locale, mai `file://`, credenziali di test separate da quelle reali di Erasmo).

### Test funzionali
- [x] Filigrana "FAC-SIMILE" presente e leggibile su ogni pagina del PDF, contenuto della
  bolletta ancora leggibile sotto di essa.
- [x] I 5 codici nel PDF hanno tutti +2 caratteri rispetto al formato reale.
- [x] Inbox: 6 righe totali; solo Voltrea ha l'indicatore di allegato.
- [x] Biglietto allegato Voltrea: nome/didascalia corretti, `href`/`download` corretti, il file
  scaricato è un PDF valido (status 200, `content-type: application/pdf`, firma `%PDF-`).
- [x] Riga "le mie password": in fondo, mittente Davide Colombo, nome accessibile corretto
  ("Non letta." assente).
- [x] Apertura "le mie password": tutte le 6 righe di credenziali presenti nel corpo, nessun
  CTA, nessun biglietto allegato.
- [x] Le altre 5 email (incl. target banca) restano senza biglietto allegato.
- [x] VINCOLO ETICO: apertura/download dell'allegato e navigazione generale non generano
  richieste verso host esterni.
- [x] Regressione: 35/35 su `phishing.spec.js`; 159/159 sull'intera suite.

### Test UI
- [x] Biglietto allegato e nuova email verificati via screenshot in Light (e, per il biglietto,
  anche in Dark) — leggibili, nessuna sovrapposizione.
- [ ] Screenshot dedicato della nuova email in Dark — non catturato esplicitamente in questo
  round (rischio basso: riusa le stesse classi CSS già verificate in Dark per Voltrea, nessuna
  nuova regola introdotta).

### Test UX
- [x] Nessun movimento forzato del focus; stato "letta"/"non letta" coerente.

### Test tecnici
- [x] `node --check` su tutti i file `.js` modificati; JSON validato sintatticamente.
- [x] Console priva di errori; nessun path relativo rotto; nessuna modifica a `index.html`
  necessaria.

### Test di regressione
- [x] Suite completa (159/159) rieseguita attraverso l'`index.html` reale dopo ogni round.

---

## 9. Criticità

Nessuna criticità aperta. (Il bug reale del MIME type `.pdf` mancante in `tests/helpers/
server.js`, trovato nel round 1, resta corretto e verificato nei round successivi.)

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento.

### Refactoring consigliati
- 🟢 Nessuno: pattern già esistenti riusati ovunque, zero nuova indirection.

### Ottimizzazioni future
- 🟢 Se un futuro scenario avesse bisogno dello stesso pattern "biglietto allegato", la funzione
  `buildAttachmentCard()` è già scritta in forma generica e potrebbe essere estratta in
  un'utility condivisa al secondo consumo reale (YAGNI, non anticipato ora).

### Rischi architetturali
- 🟢 Nessun rischio nuovo: intervento puramente additivo su dati/asset, zero modifiche a
  componenti condivisi, routing, autenticazione o allo scenario target.

### Priorità
- 🟢 Bassa: nessun elemento ad alta o media priorità residuo.

### Obiettivo
Intervento chiuso end-to-end nei tre round: implementazione, verifica reale (159/159) e
documentazione — coerente con l'architettura consolidata del progetto, senza debito residuo.
