# SOCIALIVE — Perché Supabase si è sospeso, e come riattivarlo

**Redatto in qualità di** Lead Software Architect / Full Stack Architect del progetto.
**Scopo di questo documento:** spiegare la causa della sospensione, e fungere da runbook completo
per tornare a Supabase Auth in futuro — riusando **esattamente** il lavoro già fatto (nessuna
riscrittura da zero necessaria), se le condizioni che oggi lo sconsigliano dovessero cambiare.

---

## 1. Perché si è sospeso

Supabase, sul piano gratuito, mette in pausa automaticamente i progetti che valuta "inattivi" per
un periodo prolungato. La definizione di "attività" che usa per questa valutazione è legata al
**traffico verso il database** (query su tabelle, in sostanza) — non a "qualcuno usa l'app".

SOCIALIVE, così com'era configurato, usava Supabase **solo per Auth** (login/logout, sessione).
Nessuna tabella applicativa (`profiles`, `settings`, o qualunque altra) è mai stata creata o
popolata — l'unico dato in gioco era l'utente demo (`docente@scuola.it`) in `auth.users`, la
tabella interna di sistema di Supabase Auth, che **non conta come "attività database"** ai fini
di questa valutazione automatica.

Risultato pratico: anche con lezioni regolari e login frequenti, dal punto di vista del sistema di
monitoraggio di Supabase il progetto appariva silenzioso — perché "silenzioso" per Supabase
significa "nessuna query Postgres", non "nessun accesso utente". Il progetto è stato quindi
sospeso nonostante fosse realmente in uso, causando un blocco reale dell'accesso — già capitato
una volta, il motivo di questo intervento.

**Non è stato un errore di configurazione né un bug del codice**: è una conseguenza diretta e
prevedibile di come funziona il piano gratuito di Supabase applicato a un caso d'uso — solo Auth,
nessun dato applicativo — per cui quel piano non è stato pensato.

---

## 2. Cosa è stato fatto ora

Vedi `handover-revert-supabase-auth.md` (nella stessa consegna) per il dettaglio completo. In
sintesi: l'autenticazione è tornata alla verifica locale (SHA-256 su `data/users.json`, la stessa
usata da Fase 3 fino a prima della migrazione Supabase) — zero dipendenza da servizi esterni, zero
rischio di sospensione futura. Le stesse credenziali demo restano valide
(`docente@scuola.it` / `password123`).

---

## 3. Come riattivare Supabase Auth in futuro

Se in futuro le condizioni cambiassero — ad esempio se SOCIALIVE iniziasse a usare **davvero**
delle tabelle Postgres (profili multipli, impostazioni sincronizzate, un secondo docente), rendendo
il progetto "attivo" anche secondo la metrica di Supabase — questa sezione permette di tornare
esattamente allo stato funzionante già raggiunto, senza dover riprogettare nulla.

**Tutto il codice necessario è già pronto**, nella cartella `reactivate-supabase/` allegata a
questa consegna — recuperato dalla cronologia Git del repository (non ricostruito a memoria),
verificato sintatticamente e, per il bundle vendorizzato, verificato byte-per-byte identico
all'originale tramite confronto con il pacchetto ufficiale scaricato da npm.

### 3.1 — Riattivare il progetto Supabase stesso

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard) → apri il progetto
   `tnvwfptcjjymwrnpcgsi` (o il progetto SOCIALIVE, se nel frattempo ne hai creato uno nuovo).
2. Se risulta "Paused", clicca **"Restore project"** (stesso passaggio già fatto una volta).
3. Attendi che lo stato torni "Active" (di solito 1-2 minuti).

### 3.2 — Verificare/ricreare l'utente Auth

L'utente `docente@scuola.it` potrebbe essere ancora presente in `auth.users` (la riattivazione
del progetto non cancella i dati esistenti) — verificalo prima di ricrearlo:

1. Dashboard → **Authentication** → **Users**. Se `docente@scuola.it` è già in elenco, passa al
   punto 3.3.
2. Se non c'è (o è un progetto nuovo): **Add user** → **Create new user** → email
   `docente@scuola.it`, password a tua scelta, **Auto Confirm User** attivo (così non serve un
   flusso di conferma email per un utente demo unico).
3. Dopo la creazione, apri l'utente → modifica **User Metadata** (JSON grezzo) e imposta:
   ```json
   {
     "displayName": "Prof. Erasmo Lassandro",
     "role": "docente",
     "avatar": null
   }
   ```
   Questi tre campi sono letti da `buildAppUser()` in `supabaseAuthAdapter.js` (vedi §3.4) — senza
   `role`, il login funzionerebbe ma l'utente non avrebbe un ruolo risolto da `data/roles.json`.

### 3.3 — Recuperare URL e chiave del progetto

Dashboard → **Project Settings** → **API**:
- **Project URL** → `SUPABASE_URL`
- **anon / public key** → `SUPABASE_ANON_KEY`

Se il progetto è lo stesso di prima (non ne hai creato uno nuovo), questi valori sono già noti e
salvati qui sotto per comodità (recuperati dalla cronologia Git, **non sono un segreto** — vedi
il commento di rationale nel file stesso):

```
SUPABASE_URL = https://tnvwfptcjjymwrnpcgsi.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudndmcHRjamp5bXdybnBjZ3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjE2MTEsImV4cCI6MjEwMjA5NzYxMX0.CHLaseOxm4KVrVmcq9LaGMFMp68oAToIS8tuTvbKYyU
```

Se hai riattivato lo *stesso* progetto (§3.1), questi valori restano validi as-is — non serve
rigenerare nulla. Il file `reactivate-supabase/js/config/env.js` allegato li contiene già.

### 3.4 — Applicare i file al repository

Copia i 4 file dalla cartella `reactivate-supabase/` di questa consegna nel repository, sostituendo
la versione locale attuale:

| File da copiare | Percorso di destinazione | Sostituisce |
|---|---|---|
| `js/adapters/supabaseAuthAdapter.js` | `js/adapters/supabaseAuthAdapter.js` | (nuovo) |
| `js/config/env.js` | `js/config/env.js` | (nuovo) |
| `js/vendor/supabase-js.umd.js` | `js/vendor/supabase-js.umd.js` | (nuovo) |
| `js/services/authService.js` | `js/services/authService.js` | la versione locale attuale |

Poi **elimina**:
- `js/adapters/localAuthAdapter.js`
- `data/users.json` (le credenziali vivono ora in `auth.users` su Supabase — nessun secondo
  percorso di login in produzione)

`data/roles.json` **resta invariato** — è riusato identico da `supabaseAuthAdapter.js`.

### 3.5 — Aggiornare `index.html`

Reintrodurre, nell'ordine esatto (lo script vendorizzato **prima** del modulo di bootstrap, come
script classico non-module — vedi rationale in `supabase-js.umd.js`):

```html
<script src="js/vendor/supabase-js.umd.js"></script>

<script type="module">
  import { initTheme } from "./js/services/themeService.js";
  import { initSession } from "./js/services/authService.js";
  import { init as initRouter, registerRoute } from "./js/core/router.js";
  // ... resto invariato ...

  await initSession(); // PRIMA di initRouter() — vedi rationale in authService.js
  initRouter(document.getElementById("app-root"));
</script>
```

### 3.6 — Aggiornare la suite di test

- `tests/helpers/auth.js`: le credenziali tornano a dover arrivare da variabili d'ambiente
  (`SOCIALIVE_TEST_EMAIL`/`SOCIALIVE_TEST_PASSWORD`), non più hardcoded — l'account torna a essere
  un indirizzo reale, non una demo pubblica innocua.
- `tests/login.spec.js` / `tests/home.spec.js` / `tests/scenario.spec.js`: reintrodurre
  `chromium.launch({ headless: false })` — necessario contro un timeout osservato in Chromium
  headless verso la rete di Supabase Auth (causa non del progetto, verificata empiricamente in
  precedenza).
- `tests/login.spec.js`: le asserzioni su "credenziali corrette"/"logout" non possono più leggere
  direttamente `localStorage["sl-session"]` (quel formato non esiste più) — vanno sostituite con
  verifiche sul comportamento osservabile via UI (es. nome utente mostrato in header dopo il
  login), come già fatto nella versione Supabase precedente.

### 3.7 — Verifica

Stessa disciplina di sempre: `node --check` su tutti i file toccati, poi `npm test` in locale
(Windows) con le variabili d'ambiente impostate, poi un login reale end-to-end.

---

## 4. Come evitare che la sospensione si ripeta (se torni a Supabase)

Se in futuro riattivi Supabase, vale la pena aggiungere **da subito** una mitigazione contro una
nuova sospensione per inattività — non fatto in questo intervento perché, per ora, Supabase non è
più in uso:

**Keep-alive automatico via GitHub Actions** (gratuito su repository pubblico): un workflow
schedulato (`on: schedule`, cron) che ogni 3-4 giorni esegue una query minima e innocua contro il
progetto Supabase (es. una `select` su `data/roles.json`... non applicabile, serve una vera tabella
Postgres — anche solo `select 1` via l'endpoint REST con la anon key basta) per registrare
attività reale a livello di database, non solo di Auth.

```yaml
# .github/workflows/supabase-keepalive.yml (esempio, da adattare)
name: Supabase keep-alive
on:
  schedule:
    - cron: "0 6 */3 * *"  # ogni 3 giorni
  workflow_dispatch:        # permette anche un avvio manuale
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Query minima contro Supabase
        run: |
          curl -s "https://tnvwfptcjjymwrnpcgsi.supabase.co/rest/v1/" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

Questo risolverebbe la causa radice del problema (nessuna query = "inattivo" secondo Supabase) a
costo zero, senza dover rinunciare a Supabase se un giorno servisse davvero.

---

## 5. Riepilogo del trade-off

| | Supabase Auth | Sessione locale (oggi) |
|---|---|---|
| Rischio di sospensione | Reale, già verificato | Nessuno |
| Costo | Gratuito (con rischio) o a pagamento (Pro) | Gratuito, nessun rischio |
| Sincronizzazione multi-dispositivo | Sì | No (non necessaria oggi) |
| Dipendenza di rete per il login | Sì (mitigata dal bundle vendorizzato per l'affidabilità in aula) | No |
| Confine di sicurezza reale | Sì (verifica lato server) | No (mai stato un problema per questo caso d'uso — vedi nota d'onestà in `localAuthAdapter.js`) |
| Complessità | Maggiore (client, cache sincrona, `initSession`) | Minima |

Per il caso d'uso reale di SOCIALIVE oggi (singolo utente, nessun dato sensibile, nessun bisogno
multi-dispositivo), la sessione locale resta la scelta più coerente con KISS. Supabase torna
sensato nel momento in cui esistesse un bisogno reale di dati applicativi condivisi/sincronizzati
— non prima.
