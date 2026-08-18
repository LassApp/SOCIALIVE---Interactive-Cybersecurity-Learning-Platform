# SOCIALIVE — Handover: Migrazione Autenticazione a Supabase Auth

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Contesto:** primo punto di "Future Integrations" (Fase 1 §11: "Supabase verrà utilizzato per
autenticazione, profili, eventuali dati, salvataggio impostazioni") attuato concretamente — non
più solo pianificato. Scope di questo intervento: **solo autenticazione**. Profili estesi
(tabella `profiles`) e impostazioni (tabella `settings`) restano un passo futuro distinto,
deliberatamente non affrontato ora.
**Tag di riferimento suggerito:** `v1.5.0-supabase-auth`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari + tutti gli interventi incrementali precedenti (toggle privacy,
  MediaViewer generico, eliminazione toggle lucchetto, scenario Keylogger, consolidamento CSS):
  ✅ completi, invariati.
- **Migrazione Auth Supabase: ✅ COMPLETATA E VERIFICATA END-TO-END con credenziali reali** —
  non un mock, non un'interfaccia simulata: **86/86 controlli Playwright superati contro il vero
  progetto Supabase dell'utente** (`tnvwfptcjjymwrnpcgsi.supabase.co`), eseguiti dall'utente
  stesso in locale (questa sandbox di sviluppo non ha accesso di rete a domini `*.supabase.co`).
- L'app non usa più `data/users.json`/hash SHA-256 client-side: le credenziali sono verificate
  realmente lato server da Supabase Auth.
- **1 bug reale di processo trovato e corretto durante l'implementazione stessa** (non
  sopravvissuto alla consegna): un commento di rationale nel bundle vendorizzato conteneva
  accidentalmente la sequenza `*/`, chiudendo prematuramente il blocco di commento JS — trovato
  da `node --check` prima ancora di consegnare il file.
- **2 asserzioni di test obsolete trovate e corrette** durante la verifica (non con
  l'implementazione, ma durante l'analisi dei risultati reali di `npm test` forniti dall'utente):
  un test cercava la vecchia chiave `localStorage` "sl-session" (rimossa con la migrazione) — un
  secondo caso era addirittura un **falso positivo silenzioso** (l'assert su una chiave ormai
  sempre assente risultava "verde" anche a fronte di un logout completamente rotto).
- **1 causa ambientale reale isolata con un processo diagnostico strutturato**: Chromium headless
  (modalità di default di Playwright) non completa mai la richiesta di rete verso Supabase Auth
  nell'ambiente Windows dell'utente (timeout di 30s, nessun errore esplicito), mentre lo stesso
  identico flusso funziona sia in un browser reale sia in Chromium **headed** lanciato da
  Playwright — isolato confrontando comportamento in browser normale, Playwright headless e
  Playwright headed, non per tentativi casuali.

---

## 2. Obiettivi completati

Solo funzionalità realmente implementate e verificate.

### Client Supabase, vendorizzato senza bundler
- `js/vendor/supabase-js.umd.js` (nuovo): bundle UMD auto-contenuto (208 KB), verificato scaricando
  `@supabase/supabase-js@2.112.3` da npm e ispezionando `dist/` — confermato che il build ESM
  (`dist/index.mjs`) importa da specificatori nudi non risolvibili senza bundler, mentre il build
  UMD è un'unica IIFE con **zero** import/require residui. Caricato con uno `<script>` classico
  (non `type="module"`) PRIMA del modulo di bootstrap in `index.html` — nessuna dipendenza da CDN
  a runtime, requisito di affidabilità per un'app proiettata in aula su reti scolastiche non
  garantite.

### Configurazione
- `js/config/env.js` (nuovo): `SUPABASE_URL`/`SUPABASE_ANON_KEY` con i valori reali del progetto
  Supabase dell'utente. Versionato deliberatamente (non gitignored): l'anon key non è un segreto
  per progettazione Supabase (sicurezza reale delegata a Row Level Security), e non esiste alcun
  build step nel progetto per iniettare variabili d'ambiente al deploy.

### Adapter e servizio di autenticazione
- `js/adapters/supabaseAuthAdapter.js` (nuovo, **sostituisce** `localAuthAdapter.js`): client
  Supabase singleton, `signInWithPassword()`/`signOut()` (wrapper diretti sulle API native,
  nessuna interpretazione dell'errore — responsabilità lasciata ad `authService.js`),
  `buildAppUser(session)` che trasforma una Session Supabase nell'oggetto utente applicativo
  (`displayName`/`avatar` da `user_metadata`, `role` risolto da `data/roles.json`, invariato
  nella forma da Fase 3).
- `js/services/authService.js` (riscritto): superficie pubblica **identica** per ogni consumer
  esistente (`login`, `logout`, `hasValidSession`, `getCurrentUser`) + un nuovo export additivo,
  `initSession()`. Cache sincrona in-memory (`currentUser`) mantenuta sempre aggiornata da
  `supabase.auth.onAuthStateChange()` — risolve il conflitto architetturale centrale di questa
  migrazione: `router.js` richiede una guardia di sessione **sincrona**, Supabase Auth espone
  solo API asincrone. **Zero modifiche** a `router.js`, `loginPageController.js`,
  `appShell.js` — verificato leggendo ciascuno dei tre file, non per assunzione.
- Effetto collaterale positivo non richiesto: il logout si propaga ora automaticamente tra schede
  diverse dello stesso browser (limite noto e accettato fin dalla Fase 3), grazie alla
  sincronizzazione cross-tab nativa di Supabase.

### Bootstrap
- `index.html` (modificato): aggiunto lo `<script>` classico del bundle vendorizzato + `import
  { initSession }` + `await initSession();` come unico punto asincrono introdotto nel bootstrap,
  PRIMA di `initRouter(...)` — necessario per evitare un falso "non autenticato" al primo
  caricamento pagina per chi ha già una sessione valida.

### Rimozioni (eseguite dall'utente sul repository reale)
- `js/adapters/localAuthAdapter.js` — eliminato. Nessun secondo percorso di login nel codice di
  produzione (principio: un adapter parallelo mai esercitato in produzione è un rischio, non una
  rete di sicurezza).
- `data/users.json` — eliminato. Le credenziali vivono ora in `auth.users` di Supabase, gestito
  interamente lato server.
- `data/roles.json` — **conservato**, invariato nella forma: catalogo statico `id→permissions`,
  letto da `supabaseAuthAdapter.js` per risolvere l'oggetto `role` completo dal solo `roleId`
  presente in `user_metadata`.

### Suite di test — adattamento e correzioni reali
- `tests/helpers/auth.js` (modificato): credenziali lette da `SOCIALIVE_TEST_EMAIL`/
  `SOCIALIVE_TEST_PASSWORD` (variabili d'ambiente), **mai** hardcoded — l'account ora è un vero
  indirizzo email dell'utente, non più una demo pubblica innocua. Errore esplicito a livello di
  modulo se le variabili non sono impostate.
- `tests/login.spec.js` (modificato):
  - `chromium.launch({ headless: false })`, documentato come deviazione necessaria (non
    opzionale) dalla modalità headless di default — causa profonda non isolata oltre l'evidenza
    empirica, segnalata come debito da approfondire (§9/§10).
  - Test "#app-root ha la classe di transizione": sostituito un `waitForTimeout(100)` fisso con
    un'attesa a polling (`waitForFunction`) — più robusta rispetto a qualunque variazione di
    timing, incluso il nuovo passaggio di rete nel bootstrap.
  - Test "credenziali corrette": non cerca più la chiave `localStorage` "sl-session" (rimossa
    dalla migrazione) — verifica invece un comportamento osservabile reale, l'`aria-label` del
    trigger profilo con il nome arrivato davvero da Supabase.
  - Test "logout da ProfileMenu": **corretto un falso positivo silenzioso** — la stessa
    asserzione su "sl-session" risultava sempre vera (chiave sempre assente) anche a fronte di un
    logout rotto. Sostituita con una verifica comportamentale: dopo il logout, una rotta protetta
    deve tornare a reindirizzare al login.
- `tests/home.spec.js`, `tests/scenario.spec.js` (modificati): stessa correzione
  `headless: false`, nessun'altra modifica (non toccano direttamente la sessione).

### Verifica end-to-end reale (eseguita dall'utente, non da questa sessione)
**86/86 controlli superati** contro il vero progetto Supabase (`login.spec.js` 15/15,
`home.spec.js` 26/26, `scenario.spec.js` 45/45) — incluso un vero login con credenziali reali, un
tentativo con credenziali errate (banner corretto), persistenza della sessione al reload, redirect
simmetrico, e logout con verifica comportamentale reale.

**Cosa NON è stato verificato in questa sessione** (limite dichiarato, non un'omissione): questa
sandbox di sviluppo non ha accesso di rete a domini `*.supabase.co` — ho verificato tutto ciò che
era verificabile senza rete (sintassi con `node --check` su ogni file, lettura diretta del codice
sorgente di `auth-js` per confermare il comportamento di `onAuthStateChange()`/`getSession()`,
coerenza delle firme tra i moduli). La verifica end-to-end reale è stata eseguita dall'utente.

---

## 3. Architettura attuale

```
socialive/
├── index.html                                    # ♻️ MODIFICATO — script vendorizzato + initSession()
├── data/
│   ├── users.json                                # 🗑️ ELIMINATO
│   └── roles.json                                # invariato — riusato da supabaseAuthAdapter.js
│
└── js/
    ├── vendor/
    │   └── supabase-js.umd.js                    # ⭐ NUOVO — bundle UMD vendorizzato
    ├── config/
    │   └── env.js                                # ⭐ NUOVO — SUPABASE_URL/SUPABASE_ANON_KEY reali
    ├── adapters/
    │   ├── localAuthAdapter.js                   # 🗑️ ELIMINATO
    │   └── supabaseAuthAdapter.js                # ⭐ NUOVO
    ├── services/
    │   └── authService.js                        # ♻️ MODIFICATO — stessa superficie pubblica + initSession()
    ├── core/router.js                             # INVARIATO (verificato, non per assunzione)
    ├── pages/
    │   ├── loginPageController.js                # INVARIATO
    │   └── shared/appShell.js                    # INVARIATO
    └── repositories/localJsonRepository.js        # INVARIATO — riusato as-is per roles.json

tests/
├── helpers/
│   └── auth.js                                    # ♻️ MODIFICATO — credenziali da env var
├── login.spec.js                                  # ♻️ MODIFICATO — headless:false + 2 asserzioni corrette
├── home.spec.js                                   # ♻️ MODIFICATO — headless:false
└── scenario.spec.js                               # ♻️ MODIFICATO — headless:false
```

**Nessuna modifica** a componenti UI, CSS, `scenarioEngine.js`, `scenarioPageController.js`,
`homePageController.js`, `moduleScenariosPageController.js`, o a qualunque dato di scenario
(Oversharing, Keylogger) — questa migrazione è isolata al solo livello di autenticazione.

---

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Bundle UMD vendorizzato, non CDN | Zero dipendenza di rete a runtime da un servizio terzo — un'app proiettata in aula non può permettersi che un CDN irraggiungibile blocchi il login |
| `js/config/env.js` versionato con valori reali | Anon key non è un segreto per progettazione Supabase (protezione reale = RLS); nessun build step disponibile per iniettarla altrimenti |
| Email+password, non magic link | Zero modifiche a `LoginForm.js`; nessuna dipendenza dalla latenza di consegna email durante una lezione dal vivo; coerente col realismo di un login "da prodotto vero" |
| Cache sincrona in `authService.js` + gate asincrono isolato al bootstrap | `router.js` non è mai stato asincrono in 10 fasi — riscriverlo avrebbe un raggio di modifica sproporzionato; Supabase espone solo API async |
| `displayName`/`role` in `user_metadata`, nessuna tabella `profiles` | Un solo utente oggi, zero consumer reale che richieda un `profiles` — stesso YAGNI già applicato ovunque nel progetto |
| `localAuthAdapter.js` rimosso, non tenuto come fallback | Un secondo percorso di login mai esercitato in produzione è un rischio (backdoor non testata), non una rete di sicurezza |
| Credenziali di test da variabili d'ambiente, mai hardcoded | L'account non è più una demo pubblica innocua — è un vero indirizzo email; scriverlo in un file versionato pubblico sarebbe una cattiva pratica |
| `chromium.launch({ headless: false })` reso permanente nei 3 spec file | Empiricamente l'unica configurazione in cui il login Supabase completa in questo ambiente — vedi §9 per la causa non ancora isolata |
| 2 asserzioni di test riscritte, non solo "aggiornate" | Testavano un dettaglio implementativo dell'architettura precedente (chiave "sl-session") ormai inesistente — una era un falso positivo silenzioso, corretto per evitare falsa fiducia futura |

---

## 5. Attività rimanenti

In ordine di priorità pratica, non di roadmap fissa:

1. **Isolare la causa radice del blocco in Chromium headless** verso Supabase Auth in questo
   ambiente Windows (ipotesi principali: risoluzione IPv6 diversa tra le due modalità, o un
   antivirus/EDR che tratta diversamente un processo headless) — non bloccante (workaround
   `headless:false` funziona e documentato), ma vale la pena chiudere per poter un giorno
   eseguire la suite in un ambiente CI headless senza sorprese.
2. **Valutare un progetto Supabase di test separato** da quello di produzione (piano gratuito) —
   oggi i test girano contro l'account reale del docente; funziona, ma mescola dati di test e
   produzione. Se adottato, l'asserzione sul `displayName` "Prof. Erasmo Lassandro" in
   `login.spec.js` andrà aggiornata di conseguenza.
3. **Gap pre-esistenti, invariati e indipendenti da questa migrazione**: icon sprite
   (`assets/icons/icons.svg`), integrazione CI per `tests/`, controllo anti-regressione per
   contenuti testuali banditi, immagini reali di Oversharing (18 placeholder, gestite
   dall'utente).
4. **Fase Supabase successiva, non iniziata qui deliberatamente**: tabelle `profiles`/`settings`
   (Fase 1 §11) — da affrontare solo quando un consumo reale (multi-docente, impostazioni
   persistite) lo richiederà.
5. **Long Term Vision**: nuovi scenari (Phishing, Social Engineering, Fake News, Password
   Security, Deepfake, Malware, Ransomware, QR Code, Cyberbullismo, Privacy, Identity Theft) —
   indipendenti da questa migrazione, il pattern Registry di `scenarioEngine.js` è già validato
   con due `type` reali (Oversharing, Keylogger).

---

## 6. Prossima fase

Nessuna fase numerata "obbligata" — tre direzioni indipendenti possibili, in qualunque ordine:

- **(A) Consolidamento tecnico**: punti 1/2/3 di §5 — nessuna decisione architetturale nuova
  richiesta.
- **(B) Espansione Supabase**: tabelle `profiles`/`settings`, se emergesse un bisogno reale
  (es. multi-docente).
- **(C) Espansione contenuti**: un terzo scenario reale della Long Term Vision.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa, seguita da interventi incrementali su
Oversharing, dallo scenario Keylogger, e ora dalla MIGRAZIONE DELL'AUTENTICAZIONE A SUPABASE AUTH
— primo punto reale di "Future Integrations" (Fase 1 §11) attuato, non più solo pianificato. Il
documento di handover completo di questa migrazione è allegato: consideralo la fonte di verità
primaria.

COSA HA FATTO QUESTA MIGRAZIONE: sostituito l'adapter locale (data/users.json, hash SHA-256
client-side) con Supabase Auth reale (email+password). Client Supabase vendorizzato come bundle
UMD (js/vendor/supabase-js.umd.js, no dipendenza da CDN a runtime). js/config/env.js con
URL/anon key reali (versionato: l'anon key non è un segreto per progettazione Supabase).
js/adapters/supabaseAuthAdapter.js (nuovo) parla con Supabase; js/services/authService.js
(riscritto) mantiene la STESSA superficie pubblica (login/logout/hasValidSession/getCurrentUser)
per zero impatto su router.js/loginPageController.js/appShell.js — una cache sincrona in-memory,
aggiornata reattivamente da onAuthStateChange(), risolve il conflitto tra la guardia sincrona di
router.js e le API asincrone di Supabase. localAuthAdapter.js e data/users.json ELIMINATI.
data/roles.json CONSERVATO (invariato), riusato per risolvere il ruolo da user_metadata.

VERIFICA ESEGUITA: 86/86 controlli Playwright superati END-TO-END contro il vero progetto
Supabase dell'utente (non un mock) — eseguiti dall'utente stesso in locale (Windows), non in
questa sandbox di sviluppo (nessun accesso di rete a *.supabase.co qui). Due asserzioni di test
obsolete corrette durante l'analisi (una era un falso positivo silenzioso). Una causa ambientale
isolata: Chromium HEADLESS non completa mai il login contro Supabase su questa macchina Windows
(causa profonda non isolata oltre l'evidenza empirica) — workaround permanente
chromium.launch({headless:false}) nei 3 file di test, documentato nel codice.

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework/bundler per l'app consegnata (il
bundle Supabase è vendorizzato as-is, prodotto dal build ufficiale di Supabase, non da noi).

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main. L'utente lavora su Windows con cmd.exe (sintassi variabili
d'ambiente: "set VAR=valore", NON "VAR=valore comando" da bash/PowerShell).

CREDENZIALI: account Supabase Auth reale dell'utente (email personale, non una demo pubblica) —
NON richiederle né scriverle in file versionati; i test le leggono da SOCIALIVE_TEST_EMAIL/
SOCIALIVE_TEST_PASSWORD (variabili d'ambiente, mai hardcoded, mai committate).

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container,params)→destroy per i
page controller; eventi "sl:nome-evento"; componenti "dumb"; documentazione in italiano; test
reali (mai mock) verificati anche attraverso l'index.html reale, con distinzione esplicita tra
"verificato con credenziali reali" e "verificato solo architetturalmente" quando le credenziali
non sono disponibili nella sandbox di sviluppo; per ogni file dichiara sempre
NUOVO/MODIFICATO/GIÀ ESISTENTE, verificato sui file reali, non per assunzione; handover completo
a 10 sezioni + zip di tutti i file della fase a fine fase.

STATO: nessuna attività bloccante pendente su questa migrazione. Direzioni possibili per il
prossimo intervento: (A) consolidamento (isolare la causa del blocco headless, progetto Supabase
di test separato, CI, anti-regressione contenuti banditi), (B) espansione Supabase (tabelle
profiles/settings, solo se un bisogno reale emerge), (C) terzo scenario reale della Long Term
Vision.

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** dall'utente contro il vero progetto
Supabase, in questa stessa milestone.

### Test funzionali
- [x] Bootstrap senza sessione → `#/login`; accesso diretto a `#/home` senza sessione → redirect.
- [x] Validazione di formato lato client (submit vuoto, email malformata) — invariata, nessuna
  rete coinvolta.
- [x] Credenziali errate → banner "Credenziali non valide." (rete reale verso Supabase).
- [x] Credenziali corrette → `#/home`, nome utente reale da `user_metadata` mostrato in header.
- [x] Reload con sessione valida → resta su `#/home`.
- [x] Redirect simmetrico `#/login` con sessione valida → `#/home`.
- [x] Logout → `#/login`, verificato comportamentalmente (rotta protetta torna a reindirizzare).
- [x] Regressione completa Home (26/26) e scenario Oversharing/MediaViewer (45/45) — nessun
  impatto della migrazione sulle funzionalità non-auth.

### Test UI
- [x] Screenshot Light/Dark/mobile 375px su login — nessuna anomalia introdotta.
- [x] Breakpoint 768–1024px su Home — invariati.

### Test UX
- [x] Focus management post-submit invariato (form di login non toccato nel markup).
- [ ] Percezione reale della latenza di rete verso Supabase durante un login live in aula — non
  misurata in questa fase (il login nei test locali è rapido, ma una rete scolastica reale
  potrebbe introdurre latenza percepibile — da osservare al primo uso reale).

### Test tecnici
- [x] `node --check` su tutti i file `.js` nuovi/modificati.
- [x] Sintassi del modulo di bootstrap in `index.html` verificata isolatamente.
- [x] Console priva di errori nel flusso reale (implicito nei controlli Playwright superati).

### Test di regressione
- [x] Intera suite (86/86) eseguita end-to-end contro Supabase reale — nessuna funzionalità
  preesistente (Home, Oversharing, Keylogger, MediaViewer) compromessa dalla migrazione.

---

## 9. Criticità

- **Causa radice del blocco in Chromium headless non isolata**: workaround (`headless:false`)
  verificato affidabile ma non spiegato a fondo — se in futuro si introducesse una pipeline CI
  headless (es. GitHub Actions), andrebbe verificato se lo stesso blocco si presenta anche lì
  (ambiente Linux, non Windows: la causa potrebbe essere specifica alla macchina dell'utente e
  non riprodursi affatto in CI, ma non è stato verificato).
- **Account di test coincide con l'account di produzione**: funziona, ma mescola l'esecuzione
  automatica dei test con l'account reale del docente. Nessun rischio immediato (Supabase non ha
  rate limit aggressivi sul piano gratuito per un solo utente), ma una separazione futura
  (progetto Supabase di test dedicato) è più pulita.
- **Latenza di rete non misurata in condizioni reali d'aula**: i test locali mostrano un login
  rapido, ma una rete scolastica con throughput ridotto potrebbe introdurre un ritardo percepibile
  al primo utilizzo reale — da osservare, non necessariamente da correggere preventivamente.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 **`chromium.launch({ headless: false })` permanente nei test**: funziona in modo affidabile,
  ma la causa del fallimento in headless non è stata isolata — un compromesso accettato, non
  ignorato (documentato esplicitamente nel codice).
- 🟢 **Account Supabase di test = account di produzione**: nessun rischio funzionale immediato,
  ma una separazione è la pratica più pulita a lungo termine.

### Refactoring consigliati
- 🟢 **Rinominare `DEMO_EMAIL`/`DEMO_PASSWORD` in `TEST_EMAIL`/`TEST_PASSWORD`** in
  `tests/helpers/auth.js` — puramente cosmetico (i valori non sono più una "demo" pubblica), non
  functionalmente necessario, rimandabile a un intervento che tocchi comunque quel file.

### Ottimizzazioni future
- 🟢 **Investigare la causa del blocco headless** (IPv6, proxy, EDR) — valore soprattutto se si
  introdurrà una pipeline CI in futuro.
- 🟢 **Progetto Supabase di test dedicato** — separazione pulita test/produzione, nessun urgenza.

### Rischi architetturali
- 🟡 **Nuova dipendenza di rete esterna reale per il login** (prima: verifica locale contro un
  file JSON, mai un punto di fallimento di rete): un'interruzione del servizio Supabase o della
  connettività dell'aula blocca ora il login, dove prima non poteva accadere. Mitigato in parte
  dal fatto che una sessione già valida (persistita da Supabase) non richiede una nuova
  connessione ad ogni reload — ma il PRIMO login della giornata richiede connettività reale.
  Accettato come compromesso intrinseco della migrazione (nessuna alternativa che mantenga
  un'autenticazione reale lato server), non introdotto per trascuratezza.
- 🟢 **Nessun altro rischio nuovo**: la superficie pubblica di `authService.js` è rimasta
  identica, verificato leggendo (non assumendo) ogni consumer — zero accoppiamento nuovo
  introdotto verso Supabase al di fuori dei due file dedicati (`supabaseAuthAdapter.js`,
  `authService.js`).

### Priorità
- 🟡 Media: isolare la causa del blocco headless, prima di un'eventuale pipeline CI.
- 🟢 Bassa: tutto il resto — nessuna criticità bloccante per l'uso reale in aula.

### Obiettivo
Questa migrazione chiude end-to-end il primo punto reale di "Future Integrations" del progetto,
con una verifica autentica (non simulata) contro un vero servizio esterno — un salto di
maturità architetturale rispetto a tutte le fasi precedenti, che avevano sempre potuto verificare
tutto in locale. Chi riprenderà il progetto eredita un'autenticazione reale, un pattern
(cache sincrona + gate asincrono isolato) riusabile per qualunque futura integrazione Supabase
che dovesse affrontare lo stesso conflitto sync/async, e una lezione di processo aggiuntiva: un
ambiente di test headless può comportarsi diversamente da un browser reale in modi non ovvi — la
differenza va sempre isolata empiricamente, mai assunta.
