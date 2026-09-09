# SOCIALIVE — Handover: Revert da Supabase Auth a Sessione Locale

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Contesto:** Supabase (piano gratuito) mette in pausa i progetti valutati "inattivi". In SOCIALIVE
nessuna tabella applicativa è mai stata popolata (solo Auth), quindi il progetto veniva marcato
inattivo nonostante fosse in uso — causando una sospensione reale dell'accesso già verificatasi.
Su richiesta esplicita dell'utente, si è tornati alla sessione locale (SHA-256 su `data/users.json`,
già usata da Fase 3 a prima della migrazione Supabase) per eliminare il rischio operativo alla
radice.
**Tag di riferimento suggerito:** `v1.6.0-revert-local-auth`

---

## 1. Stato del progetto

- Tutto il lavoro precedente (Suite dei 10 prompt + tutti gli interventi incrementali, inclusi i
  quattro scenari reali oggi presenti — Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi):
  ✅ invariato, non toccato da questo intervento.
- **Revert Supabase Auth → sessione locale: ✅ COMPLETATO.** L'autenticazione torna a funzionare
  esattamente come da Fase 3 a prima della migrazione: verifica SHA-256 lato client contro
  `data/users.json`, sessione con scadenza 24h persistita in `localStorage` (chiave `sl-session`).
  Zero dipendenza da servizi esterni per il login.
- **Verifica eseguita**: repository reale clonato e ispezionato file per file prima di scrivere
  qualunque riga (disciplina di progetto invariata — mai fidarsi della sola narrazione). `node
  --check` su ogni file `.js` toccato e su tutto il resto del progetto (nessuna regressione di
  sintassi introdotta altrove). Tutti i JSON del repository validati. Hash SHA-256 di
  `"password123"` ricalcolato e confrontato byte per byte con quello storico in `data/users.json`
  — combacia esattamente, le credenziali demo restano invariate.
- **Non eseguita in questa sessione**: la suite Playwright end-to-end reale — questa sandbox non
  ha i binari Chromium di Playwright scaricati (il pacchetto npm è presente in
  `tests/node_modules/`, ma non i browser). Non è comunque un limite introdotto da questo
  intervento: **va rieseguita da te in locale**, e ora dovrebbe risultare più semplice di prima
  (nessuna rete esterna coinvolta — vedi §8).

---

## 2. Obiettivi completati

### Ripristinato l'adapter e i dati locali
- **`js/adapters/localAuthAdapter.js` (nuovo/ripristinato)**: stessa identica logica di Fase 3 —
  `verifyCredentials(username, password)` via Web Crypto (SHA-256), letta contro
  `data/users.json`/`data/roles.json` tramite `localJsonRepository.js` (invariato, riusato as-is).
- **`data/users.json` (nuovo/ripristinato)**: stesso utente demo, stesse credenziali
  (`docente@scuola.it` / `password123`), stesso `displayName` ("Prof. Erasmo Lassandro") — hash
  verificato identico a quello storico.

### Riscritto il servizio di autenticazione
- **`js/services/authService.js` (modificato)**: torna alla versione sincrona di Fase 3 —
  `login()`, `logout()`, `hasValidSession()`, `getCurrentUser()`. Rimosso `initSession()` (il
  punto asincrono di bootstrap introdotto solo per inizializzare la cache in-memory dallo stato
  reale di Supabase — non più necessario: la sessione locale è già sincrona per costruzione).
  Superficie pubblica verso i consumer (`router.js`, `loginPageController.js`, `appShell.js`)
  **identica**: zero modifiche necessarie a nessuno dei tre, verificato leggendoli.

### Bootstrap semplificato
- **`index.html` (modificato)**: rimossi lo `<script src="js/vendor/supabase-js.umd.js">` e
  l'import/chiamata `await initSession()` — il bootstrap torna interamente sincrono verso
  `router.init()`.

### File rimossi (Supabase-only, non più referenziati da nulla)
- `js/adapters/supabaseAuthAdapter.js` — eliminato.
- `js/config/env.js` — eliminato (conteneva `SUPABASE_URL`/`SUPABASE_ANON_KEY`).
- `js/vendor/supabase-js.umd.js` — eliminato (bundle vendorizzato, ~210 KB).
- `data/roles.json` — **conservato**, invariato: era già riusato identico prima della migrazione
  Supabase, resta compatibile con il nuovo/vecchio adapter senza alcuna modifica.

### Suite di test aggiornata
- **`tests/helpers/auth.js` (modificato)**: credenziali tornano hardcoded
  (`docente@scuola.it`/`password123`) — non più un vero account esterno da tenere fuori dal
  codice versionato via variabili d'ambiente. La suite torna eseguibile **offline**.
- **`tests/login.spec.js` (modificato)**: `chromium.launch({ headless: false })` → `chromium.launch()`
  (la deviazione era necessaria solo contro un timeout osservato in Chromium headless verso la rete
  di Supabase Auth — causa rimossa insieme alla chiamata di rete). Le due asserzioni su
  "credenziali corrette"/"logout" tornano a verificare direttamente `localStorage["sl-session"]`
  (nostro formato, non più il dettaglio implementativo di una libreria terza) — più precise del
  solo comportamento osservabile via UI usato temporaneamente con Supabase. Timeout estesi (15s)
  rimossi: nessuna latenza di rete esterna da assorbire.
- **`tests/home.spec.js` (modificato)**: stessa rimozione di `headless: false`, nessun'altra
  modifica (non tocca direttamente la sessione).
- **`tests/scenario.spec.js` — NON toccato**, vedi Criticità (§9): il file contiene oggi una
  corruzione di sintassi preesistente e indipendente da questo intervento (blocca `node --check`/
  `npm test` sull'intera suite). Segnalato per una decisione separata, non incluso in questa
  consegna per non mescolare due interventi distinti.

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `js/adapters/localAuthAdapter.js` | ⭐ **RIPRISTINATO** | Stessa logica di Fase 3, invariata |
| `data/users.json` | ⭐ **RIPRISTINATO** | Stesse credenziali demo, hash verificato identico |
| `js/services/authService.js` | ♻️ **MODIFICATO** | Torna sincrono; rimosso `initSession()` |
| `index.html` | ♻️ **MODIFICATO** | Rimossi script vendorizzato + `await initSession()` |
| `tests/helpers/auth.js` | ♻️ **MODIFICATO** | Credenziali hardcoded, nessuna variabile d'ambiente |
| `tests/login.spec.js` | ♻️ **MODIFICATO** | `headless` di default; asserzioni su `sl-session` |
| `tests/home.spec.js` | ♻️ **MODIFICATO** | Solo rimozione `headless: false` |
| `js/adapters/supabaseAuthAdapter.js` | 🗑️ **DA ELIMINARE** | Non più referenziato da nulla |
| `js/config/env.js` | 🗑️ **DA ELIMINARE** | Non più referenziato da nulla |
| `js/vendor/supabase-js.umd.js` | 🗑️ **DA ELIMINARE** | Non più referenziato da nulla |

**Nessuna modifica** a `router.js`, `appShell.js`, `loginPageController.js`, `LoginForm.js`,
`localJsonRepository.js`, `data/roles.json`, né a qualunque componente UI, scenario, o dato di
scenario (Oversharing/Keylogger/Phishing/Evil Twin Wi-Fi) — verificato leggendo ciascuno di questi
file nel repository reale, non per assunzione.

**Azione richiesta da parte tua** (non posso pushare): applica i file di questa consegna al
repository, poi **elimina manualmente** i tre file "🗑️ DA ELIMINARE" sopra — non sono nella cartella
scaricabile proprio perché vanno rimossi, non sostituiti.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Sessione locale invece di keep-alive/upgrade a pagamento | Elimina il rischio operativo alla radice, zero costi, coerente con KISS per un'app single-user senza dati sensibili |
| `initSession()` rimosso, non lasciato come no-op | Un export morto è un invito a confusione futura (perché esiste se nessuno lo chiama?) — meglio nessuna traccia di un meccanismo non più necessario |
| `data/roles.json` conservato invariato | Nessuna ragione di duplicare/modificare un file già compatibile con entrambi gli adapter, passato e presente |
| File Supabase-only eliminati, non lasciati inutilizzati | Stesso principio già applicato nella migrazione opposta ("un adapter parallelo mai esercitato in produzione è un rischio, non una rete di sicurezza") — qui applicato in modo simmetrico |
| Credenziali di test tornano hardcoded | Non sono più un vero account esterno da proteggere: la demo pubblica storica è di nuovo appropriata, e riporta la suite offline |
| `headless: false` rimosso da login/home.spec.js | La causa empiricamente verificata (timeout di rete verso Supabase) non esiste più — ma raccomando una riverifica locale prima di considerarlo definitivo (vedi §9) |
| `tests/scenario.spec.js` non toccato | Contiene una corruzione di sintassi preesistente, indipendente da questo intervento — mescolarla qui avrebbe reso questa consegna meno isolata e più rischiosa da verificare |

---

## 5. Attività rimanenti

1. **Applicare questa consegna al repository reale** (file nuovi/modificati) ed **eliminare** i tre
   file Supabase-only elencati in §3.
2. **Rieseguire `npm test` in locale** (Windows, come da prassi consolidata) per confermare
   `login.spec.js`/`home.spec.js` — ora senza bisogno di `SOCIALIVE_TEST_EMAIL`/
   `SOCIALIVE_TEST_PASSWORD`: basta `npm test` (o `npm run test:login`/`test:home`) senza variabili
   d'ambiente.
3. **`tests/scenario.spec.js` è oggi rotto** (corruzione di sintassi preesistente, non introdotta
   da questo intervento) — blocca `run-all.js` per intero. Decidere se affrontarlo ora in un
   intervento dedicato o rimandarlo.
4. Refactoring "solo Cybersecurity nel sidebar" e altri punti aperti da sessioni precedenti (se
   ancora rilevanti) — indipendenti da questo intervento.

---

## 6. Prossima fase

Nessuna fase numerata pendente. Prossimo passo naturale: **verificare `tests/scenario.spec.js`**
(punto 3 di §5) — è oggi l'unico file del repository con un errore di sintassi reale, e blocca
l'intera suite persistita. Consiglio di affrontarlo come intervento a sé, con lo stesso metodo
("clona e verifica prima di scrivere") usato in questa sessione.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). È stato appena completato un revert dell'autenticazione: da Supabase Auth (che veniva
sospeso dal piano gratuito per "inattività", nonostante il progetto fosse in uso — nessuna tabella
applicativa era mai stata popolata, solo Auth) a sessione locale (SHA-256 su data/users.json,
esattamente come da Fase 3 fino a prima della migrazione Supabase). Il documento di handover
completo è allegato: consideralo la fonte di verità primaria.

COSA È STATO FATTO: ripristinati js/adapters/localAuthAdapter.js e data/users.json (stesse
credenziali storiche docente@scuola.it/password123, hash verificato identico); riscritto
js/services/authService.js tornando sincrono (rimosso initSession()); index.html non carica più
il bundle Supabase vendorizzato né chiama initSession(); rimossi js/adapters/
supabaseAuthAdapter.js, js/config/env.js, js/vendor/supabase-js.umd.js (non più referenziati da
nulla); tests/helpers/auth.js torna a credenziali hardcoded (suite di nuovo eseguibile offline);
tests/login.spec.js e tests/home.spec.js: rimossa la deviazione headless:false (causa: timeout
verso la rete Supabase, non più presente), login.spec.js verifica di nuovo direttamente
localStorage["sl-session"].

VERIFICA ESEGUITA: repository reale clonato e ispezionato prima di scrivere codice (mai per
assunzione). node --check su tutti i file .js del progetto — puliti eccetto tests/scenario.spec.js
(corruzione di sintassi PREESISTENTE, indipendente da questo intervento, non toccata qui). Tutti i
JSON validati. Hash SHA-256 di "password123" ricalcolato e confermato identico allo storico. NON
eseguita in questa sessione la suite Playwright end-to-end reale (niente Chromium scaricato in
questa sandbox) — va rieseguita in locale.

CRITICITÀ APERTA SEGNALATA: tests/scenario.spec.js contiene oggi un errore di sintassi reale
(due versioni di un blocco di test concatenate per errore in un intervento precedente) che blocca
run-all.js per intero. Non è stata toccata in questo intervento per tenerlo isolato — è la
priorità naturale del prossimo intervento.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Motiva ogni decisione prima di
implementarla. SEMPRE clonare/leggere il repository reale prima di assumere lo stato di un file
(disciplina consolidata da almeno 5 episodi documentati di handover che descrivevano lavoro non
applicato al codice). Mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy}; eventi "sl:nome-evento"; componenti "dumb";
documentazione in italiano; verifica sempre con node --check + JSON validi + (quando possibile)
Playwright reale; handover completo a 10 sezioni + file .md separato ad ogni intervento.

Indica se vuoi procedere ora con tests/scenario.spec.js, o un'altra priorità.
```

---

## 8. Test da eseguire

### Test funzionali
- [ ] Login con `docente@scuola.it` / `password123` → naviga a `#/home`.
- [ ] Login con password errata → banner "Credenziali non valide.".
- [ ] Reload con sessione valida → resta su `#/home` (persistenza in `localStorage["sl-session"]`).
- [ ] Redirect simmetrico: `#/login` con sessione valida → `#/home`.
- [ ] Logout da ProfileMenu → `#/login`, `sl-session` rimosso da `localStorage`.
- [ ] Accesso diretto a `#/home` senza sessione → redirect a `#/login`.
- [ ] Tutti e 4 gli scenari (Oversharing, Keylogger, Phishing, Evil Twin Wi-Fi) ancora raggiungibili
  dopo il login — nessuna regressione attesa (nessun file di scenario toccato), ma da confermare.

### Test UI
- [ ] Schermata di login invariata visivamente (Light/Dark/mobile) — nessuna modifica di markup/CSS
  in questo intervento.

### Test UX
- [ ] Nessun ritardo percepibile aggiuntivo al login (la verifica locale è più veloce di una
  chiamata di rete a Supabase).

### Test tecnici
- [x] `node --check` su tutti i file `.js` modificati/nuovi — eseguito in questa sessione, tutti
  puliti.
- [x] Tutti i JSON del repository validati sintatticamente — eseguito in questa sessione.
- [x] Hash SHA-256 di `"password123"` verificato identico allo storico — eseguito in questa
  sessione.
- [ ] `npm test` (o almeno `npm run test:login` / `test:home`) in locale, senza variabili
  d'ambiente — **da eseguire su Windows, come da prassi consolidata**.
- [ ] Verificare se `headless: false` è ancora necessario in `login.spec.js`/`home.spec.js` — la
  causa nota (rete Supabase) è stata rimossa, ma non è stato possibile confermarlo con
  un'esecuzione reale in questa sessione (rischio basso).

### Test di regressione
- [ ] Flusso completo Home → selettore Cybersecurity → ciascuno dei 4 scenari — nessun file di
  scenario è stato toccato, ma nessuna verifica end-to-end reale è stata eseguita in questa
  sessione.
- [ ] `style-guide.html` — verificato che non importa `authService`/Supabase (nessuna dipendenza),
  nessuna regressione attesa.

---

## 9. Criticità

- **🔴 `tests/scenario.spec.js` contiene un errore di sintassi reale**, non introdotto da questo
  intervento: due versioni di un blocco di test ("selettore Cybersecurity mostra N scenari...")
  risultano concatenate senza una corretta chiusura di funzione/parentesi, a partire dalla riga
  con `chromium.launch({ headless: false });` seguita immediatamente da altro codice sulla stessa
  riga. `node --check` fallisce con `SyntaxError: missing ) after argument list`. Questo blocca
  `run-all.js` per intero (il `require()` del file lancia l'eccezione prima ancora di eseguire
  qualunque test). **Non è stato toccato in questa sessione** per non mescolare due interventi
  distinti — segnalato qui come priorità immediata separata.
- **Suite Playwright non eseguita realmente in questa sessione**: nessun binario Chromium
  disponibile in questa sandbox (solo il pacchetto npm). Le verifiche eseguite si sono fermate a
  sintassi/JSON/hash — solide, ma non sostituiscono un'esecuzione reale in un browser.
  Raccomando fortemente di eseguire almeno `npm run test:login` in locale prima di considerare
  questo revert definitivamente chiuso.
- **`headless: false` rimosso su un'ipotesi motivata, non su una verifica reale**: la causa nota
  (timeout di rete verso Supabase in Chromium headless) è stata eliminata insieme alla chiamata di
  rete, ma non è stato possibile confermare che il problema non si ripresenti per un altro motivo
  indipendente (es. uno specifico antivirus/EDR sull'ambiente Windows dell'utente, ipotesi minore
  già menzionata nel commento originale). Rischio basso, ma non zero — se `npm test` dovesse
  bloccarsi di nuovo in locale, reintrodurre `{ headless: false }` in `login.spec.js`/
  `home.spec.js` è una modifica di una riga.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento. Il revert **riduce** debito (rimuove una dipendenza
  esterna con un rischio operativo concreto già materializzatosi), non ne aggiunge.

### Refactoring consigliati
- 🔴 **`tests/scenario.spec.js`**: da ricostruire correttamente (vedi §9) — priorità immediata,
  indipendente da questo intervento ma bloccante per l'intera suite.

### Ottimizzazioni future
- 🟢 Nessuna identificata specificamente da questo intervento.

### Rischi architetturali
- 🟢 **Nessun rischio nuovo**: il pattern Repository/Adapter (pensato fin dalla Fase 1 proprio per
  rendere sostituibile l'origine dei dati di autenticazione) ha retto la prova nei due sensi — sia
  la migrazione a Supabase sia, ora, il revert — senza toccare `router.js`/`appShell.js`/
  `loginPageController.js` in nessuno dei due interventi. Un eventuale ritorno futuro a un backend
  esterno (Supabase o altro) richiederebbe di nuovo solo un nuovo adapter, non una riscrittura.
- 🟡 **La sessione locale non è mai stata un confine di sicurezza reale** (nota d'onestà già
  presente nel codice, invariata): per un progetto pubblico single-user senza dati sensibili è un
  compromesso accettabile e consapevole, non un rischio da correggere.

### Priorità
- 🔴 Alta: **`tests/scenario.spec.js`** — blocca oggi l'intera suite di test.
- 🟡 Media: rieseguire `npm test` in locale per confermare il revert end-to-end.
- 🟢 Bassa: tutto il resto.

### Obiettivo
Questo intervento chiude un rischio operativo reale e già verificatosi (sospensione dell'accesso
per "inattività" su Supabase free tier) tornando a un'architettura più semplice e coerente con
KISS per il caso d'uso reale del progetto (single-user, nessun dato sensibile). La priorità
immediata successiva è indipendente da questo intervento: la corruzione di sintassi in
`tests/scenario.spec.js`, che blocca oggi l'intera suite persistita.
