# SOCIALIVE — Fase 1: Fondamenta del progetto

**Documento di architettura** · Nessun codice implementato in questa fase (per vincolo esplicito) · Redatto in qualità di Lead Software Architect / Senior Front-end Engineer / UX Designer / Accessibility Specialist / Full Stack Architect del progetto.

---

## Premessa

SOCIALIVE è una piattaforma didattica per la formazione in Cybersecurity, usata esclusivamente dal docente, che deve risultare indistinguibile da un vero social network durante la proiezione in classe. Questo documento definisce **esclusivamente l'architettura**: struttura, convenzioni, componenti pianificati, design system, temi, routing, login, dati, preparazione GitHub/Supabase e strategia di scalabilità. Nessuna riga di HTML, CSS o JavaScript viene scritta in questa fase: tutto ciò che segue è pianificazione vincolante per le fasi successive.

Ogni decisione è motivata; dove esistevano alternative valide, sono confrontate esplicitamente.

---

## 1. Struttura delle cartelle

```
socialive/
├── index.html
├── README.md
├── .gitignore
├── docs/
│   ├── architettura.md
│   ├── design-system.md
│   └── handover/
│
├── assets/
│   ├── images/
│   │   ├── ui/                     # illustrazioni di sistema, logo, empty state
│   │   └── scenarios/
│   │       └── oversharing/        # immagini specifiche allo scenario (Fase 6+)
│   ├── icons/
│   │   └── icons.svg               # sprite SVG unico (vedi §5 — performance)
│   └── fonts/
│
├── css/
│   ├── tokens/                     # variabili strutturali comuni ai due temi
│   │   ├── colors.css
│   │   ├── spacing.css
│   │   ├── typography.css
│   │   ├── radius.css
│   │   ├── shadows.css
│   │   └── motion.css
│   ├── themes/                     # solo i valori che cambiano tra Light/Dark
│   │   ├── theme-light.css
│   │   └── theme-dark.css
│   ├── base/
│   │   ├── reset.css
│   │   └── global.css
│   ├── components/                 # un file per componente (header.css, card.css, ...)
│   └── layouts/                    # css delle pagine/layout
│
├── js/
│   ├── app.js                      # bootstrap dell'applicazione
│   ├── core/
│   │   ├── router.js
│   │   ├── state.js                # store minimale (observer pattern)
│   │   └── eventBus.js
│   ├── components/                 # un modulo per componente UI (PascalCase)
│   ├── pages/                      # controller di vista per pagina
│   ├── scenarios/
│   │   └── scenarioEngine.js       # motore generico di interpretazione scenario.json
│   ├── services/
│   │   ├── authService.js
│   │   ├── themeService.js
│   │   ├── dataService.js
│   │   └── notificationService.js
│   ├── repositories/                # interfaccia unica di accesso ai dati
│   ├── adapters/                    # implementazioni concrete (local JSON oggi, Supabase domani)
│   ├── utils/
│   │   ├── dom.js
│   │   ├── validation.js
│   │   ├── storage.js
│   │   └── logger.js
│   └── config/
│       └── env.js
│
└── data/
    ├── config.json
    ├── themes.json
    ├── navigation.json
    ├── modules.json
    ├── roles.json
    ├── users.json
    ├── settings.json
    ├── notifications.json
    ├── localization/
    │   └── it.json
    └── scenarios/
        └── oversharing/             # popolato in Fase 6, struttura riservata da ora
            ├── scenario.json
            ├── profile.json
            ├── feed.json
            ├── posts.json
            └── stories.json
```

**Motivazioni principali**

| Scelta | Motivazione |
|---|---|
| `css/tokens/` separato da `css/themes/` | Solo i valori *cromatici/semantici* cambiano tra Light e Dark; spaziature, tipografia, raggi, ombre strutturali sono condivisi. Separarli evita duplicazione (DRY) e rende il cambio tema un'operazione isolata. |
| `js/repositories/` + `js/adapters/` separati | I servizi non devono mai sapere se i dati arrivano da un file JSON locale o da Supabase. Questa separazione (Repository Pattern) è il punto esatto in cui avverrà la futura migrazione, senza toccare UI o servizi. |
| `js/scenarios/scenarioEngine.js` | Unico punto che interpreta i JSON di scenario e sceglie come renderizzarli, cardine della scalabilità richiesta (nuovi scenari = nuovi JSON, zero nuovo codice nella maggioranza dei casi). |
| `data/scenarios/<id>/` | Ogni scenario è una cartella autonoma e autosufficiente: aggiungerne uno non tocca gli altri (isolamento, principio Open/Closed). |
| Nessuna cartella `build/` o `dist/` | Stack vincolato a HTML/CSS/JS puro, nessun bundler: i file eseguono direttamente in browser (coerente con KISS e con l'assenza di framework richiesta). |
| `docs/handover/` | Ospita i documenti di passaggio fase-per-fase richiesti dal workflow di progetto, senza inquinare la root. |

---

## 2. Architettura software

### 2.1 Modello a livelli (Clean Architecture adattata al vanilla JS)

```
┌─────────────────────────────────────────────┐
│  PRESENTATION                                │
│  pages/  →  components/   (+ css/)           │
├─────────────────────────────────────────────┤
│  APPLICATION                                 │
│  services/  (auth, theme, data, notification)│
├─────────────────────────────────────────────┤
│  DATA                                        │
│  repositories/  →  adapters/                 │
├─────────────────────────────────────────────┤
│  CORE / INFRASTRUTTURA TRASVERSALE           │
│  router.js · state.js · eventBus.js · config │
└─────────────────────────────────────────────┘
```

**Regola di dipendenza (rigida, unidirezionale):** ogni livello dipende solo dal livello sottostante, mai il contrario.

- I **componenti** non conoscono i servizi: ricevono dati come parametri e comunicano verso l'esterno solo tramite eventi. Sono "dumb" per definizione — riutilizzabili in qualunque scenario futuro.
- Le **pagine** (page controller) sono le uniche autorizzate a orchestrare: chiamano i servizi, ricevono i dati, li passano ai componenti, ascoltano gli eventi dei componenti e reagiscono.
- I **servizi** contengono la logica applicativa (login, cambio tema, caricamento scenario) e non conoscono il DOM.
- I **repository** offrono un'interfaccia stabile (es. `get`, `list`, `create`, `update`, `remove`) indipendente dalla fonte dati reale.
- Gli **adapter** sono le uniche classi che sanno se i dati vengono da un file JSON o da Supabase.

Questa struttura garantisce che sostituire "JSON locali" con "Supabase" (obiettivo esplicito del progetto) richieda modifiche **solo** dentro `adapters/`.

### 2.2 Gestione dello stato: alternative a confronto

| Opzione | Pro | Contro | Scelta |
|---|---|---|---|
| Nessuno stato centralizzato, solo DOM/prop-passing | Massima semplicità | Diventa ingestibile con più pagine/temi/sessione utente | ❌ Scartata |
| Framework reattivo (tipo mini-Redux) | Robusto, prevedibile | Overengineering per un'app a singolo utente (il docente) | ❌ Scartata |
| Store minimale (observer pattern) + eventBus | Leggero, nessuna dipendenza, sufficiente alla scala reale | Richiede disciplina nell'uso | ✅ **Scelta** |

`state.js` conterrà solo dati realmente condivisi tra moduli (utente corrente, tema attivo, scenario attivo). `eventBus.js` gestisce comunicazioni "fire and forget" tra moduli non direttamente collegati (es. un componente Toast che reagisce a un evento di logout emesso altrove), evitando accoppiamenti diretti component→component.

### 2.3 Componenti: alternative a confronto

| Opzione | Pro | Contro | Scelta |
|---|---|---|---|
| Web Components (Custom Elements + Shadow DOM) | Incapsulamento nativo | Lo Shadow DOM ostacola la propagazione delle CSS custom properties usate per il theming globale; overhead di lifecycle non necessario a questa scala | ❌ Scartata per ora |
| Funzioni "factory" JS che restituiscono nodi DOM, con CSS globale namespaced | Coerente col vincolo "niente librerie", theming semplice via `[data-theme]`, nessuna frizione con CSS Variables | Incapsulamento solo "a convenzione" (namespacing), non nativo | ✅ **Scelta** |

Ogni componente esporrà comunque un'interfaccia uniforme (`create(props) → { element, update(props), destroy() }`), così che una futura migrazione a Custom Elements — se mai necessaria — non romperebbe i consumer (pagine e altri componenti).

### 2.4 Flusso di inizializzazione dell'app

```
index.html
 └─ script inline sincrono nel <head> → legge tema salvato (storage.js)
     e imposta data-theme sull'<html> PRIMA del rendering (evita flash tema errato)
 └─ carica app.js come modulo ES
      1. config.js legge data/config.json
      2. themeService.init()          → applica/rifinisce il tema
      3. router.init(navigation.json) → risolve la rotta corrente
      4. authService.checkSession()   → guard
           ├─ non autenticato → redirect #/login
           └─ autenticato     → risolve il page controller della rotta
                 → page controller chiama i services necessari
                       → services chiamano repositories → adapters (oggi: JSON)
                 → page controller costruisce/aggiorna i componenti
                       → componenti emettono eventi → gestiti da page controller / eventBus
```

### 2.5 Flusso di navigazione

Il router (§7) osserva i cambi di `location.hash`, risolve la voce corrispondente in `navigation.json`, verifica i permessi di ruolo (`roles.json`), monta il page controller associato e smonta il precedente (cleanup espliciti per evitare memory leak da listener non rimossi — importante vista l'assenza di un framework che lo faccia automaticamente).

---

## 3. Convenzioni di naming

| Ambito | Convenzione | Esempio |
|---|---|---|
| Cartelle | kebab-case, plurale per collezioni | `components/`, `data/scenarios/` |
| File componente UI (classe/modulo con stato) | PascalCase | `Header.js` → rinominato `AppHeader.js` (vedi §4) |
| File servizio/utility (moduli funzionali) | camelCase | `themeService.js`, `validation.js` |
| File CSS | kebab-case, un file per componente | `app-header.css`, `post-card.css` |
| Classi CSS | BEM con namespace di progetto | `sl-card`, `sl-card__title`, `sl-card--highlighted` |
| Custom properties CSS | `--sl-{categoria}-{nome}[-{variante}]` | `--sl-color-bg-surface`, `--sl-space-4`, `--sl-radius-md` |
| Variabili JS | camelCase | `currentUser`, `isAuthenticated` |
| Costanti | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| Funzioni | camelCase, verbo + nome | `fetchScenarioData()`, `renderCard()` |
| Eventi custom | namespace + kebab-case | `sl:theme-change`, `sl:auth-logout` |
| Attributi `data-*` | kebab-case | `data-component="card"`, `data-scenario-id="oversharing"` |
| id HTML | kebab-case | `main-navigation`, `login-form` |
| Chiavi JSON | camelCase (coerenza con JS consumer) | `scenarioId`, `displayName`, `createdAt` |
| Nomi icone | kebab-case descrittivo | `icon-home`, `icon-logout` |
| Nomi immagini | kebab-case + contesto | `oversharing-profile-avatar.jpg` |

Il prefisso `sl-` (SociaLive) su classi e custom properties evita collisioni con eventuali librerie di terze parti introdotte in futuro e rende immediatamente riconoscibile ciò che appartiene al Design System del progetto.

---

## 4. Piano dei componenti

Prima di elencarli, una razionalizzazione richiesta esplicitamente dalle regole del progetto ("mai creare componenti differenti per svolgere la stessa funzione"):

- **Header / TopBar / Navbar** → unificati in un solo componente: **`AppHeader`**.
- **Modal / Dialog** → un solo componente **`Modal`**; "Dialog" (conferma/alert) è una *variante* di configurazione di `Modal`, non un componente separato.
- **Card / PostCard** → `Card` è il contenitore generico di base; `PostCard` è una specializzazione che lo compone, non lo duplica.

| Componente | Responsabilità | Input | Eventi emessi | Dipendenze |
|---|---|---|---|---|
| `AppHeader` | Branding, ricerca rapida, trigger menu profilo | `user`, `onSearch` | `sl:search`, `sl:profile-menu-toggle` | Avatar, ThemeSwitch (nel menu) |
| `Sidebar` | Navigazione tra moduli/scenari | `navigationItems`, `activeRoute` | `sl:navigate` | — |
| `ProfileMenu` | Dropdown da AppHeader: impostazioni, tema, logout | `user` | `sl:logout`, `sl:theme-change` | Dropdown, ThemeSwitch |
| `Button` | Azione cliccabile, varianti primary/secondary/ghost/icon | `label`, `variant`, `disabled` | `sl:click` | — |
| `Modal` (incl. variante Dialog) | Contenuto sovrapposto, focus trap, chiusura ESC/overlay | `title`, `content`, `variant` | `sl:modal-close`, `sl:modal-confirm` | Button |
| `Toast` | Feedback transitorio non bloccante | `message`, `type` | `sl:toast-dismiss` | — |
| `Card` | Contenitore generico riutilizzabile | `content` (slot) | — | — |
| `PostCard` | Visualizza un post del feed | `post` | `sl:post-open` | Card, Avatar, Badge |
| `Avatar` | Immagine profilo con fallback iniziali | `src`, `name`, `size` | — | — |
| `Badge` | Etichetta di stato compatta | `label`, `tone` | — | — |
| `Chip` | Tag selezionabile/rimovibile | `label`, `removable` | `sl:chip-remove` | — |
| `Dropdown` | Selettore a comparsa | `options`, `value` | `sl:change` | — |
| `Tabs` | Navigazione a schede all'interno di una pagina | `tabs`, `activeTab` | `sl:tab-change` | — |
| `Input` | Campo testo/password/email generico | `type`, `value`, `error` | `sl:input`, `sl:blur` | — |
| `SearchInput` | Specializzazione di Input con icona/debounce | `value`, `placeholder` | `sl:search` | Input |
| `Loader` | Indicatore di attesa indeterminato | `size` | — | — |
| `Skeleton` | Placeholder di caricamento contenuti | `shape`, `count` | — | — |
| `ProgressBar` | Indicatore di avanzamento determinato | `value`, `max` | — | — |
| `ThemeSwitch` | Toggle Light/Dark | `currentTheme` | `sl:theme-change` | themeService |
| `EmptyState` | Stato "nessun contenuto" | `message`, `icon` | — | — |
| `ErrorState` | Stato di errore con azione di retry | `message`, `onRetry` | `sl:retry` | Button |
| `PageContainer` | Wrapper di layout standard per pagina | `slot` | — | — |
| `ScrollArea` | Area con scroll controllato/virtualizzabile | `content` | `sl:scroll-end` | — |
| `Feed` | Orchestrazione lista di `PostCard`, lazy-load | `posts`, `onLoadMore` | `sl:feed-load-more` | PostCard, Skeleton, ScrollArea |

**Componenti differiti (pianificati, non specificati in dettaglio ora — principio YAGNI):** `StoriesBar`, `Timeline`, `MediaViewer`. Saranno progettati nel dettaglio a ridosso delle fasi che li richiedono (Fase 6-7, scenario Oversharing), per evitare di fissare oggi decisioni premature su contenuti che ancora non esistono.

---

## 5. Piano del Design System

> Tabelle di riferimento: i valori concreti verranno trascritti in `css/tokens/*.css` e `css/themes/*.css` **nella Fase 2** — qui si definiscono solo nomi e valori pianificati.

### 5.1 Colori (token semantici, valore diverso per Light/Dark, stesso nome variabile)

| Token | Uso |
|---|---|
| `--sl-color-bg-canvas` | Sfondo pagina |
| `--sl-color-bg-surface` | Sfondo card/pannelli |
| `--sl-color-bg-elevated` | Sfondo modali/dropdown |
| `--sl-color-text-primary` / `-secondary` / `-inverse` | Testo |
| `--sl-color-border-subtle` / `-strong` | Bordi |
| `--sl-color-primary-500` / `-600` | Brand, hover/active |
| `--sl-color-success-500`, `-warning-500`, `-error-500`, `-info-500` | Stati semantici |
| `--sl-color-overlay` | Sfondo scurito dietro le modali |
| `--sl-color-focus-ring` | Anello di focus (accessibilità, §5.7) |

Contrasto minimo garantito: **AA WCAG** (≥4.5:1 testo normale, ≥3:1 testo grande/icone), verificato per entrambi i temi.

### 5.2 Tipografia

Font stack di sistema (per realismo e performance, zero download di webfont): `-apple-system, "Segoe UI", Roboto, sans-serif`.

Scala modulare (rapporto ~1.2): `--sl-font-size-xs/sm/base/md/lg/xl/2xl/3xl`. Pesi: `--sl-font-weight-regular/medium/semibold/bold`. Altezze riga: `--sl-line-height-tight/base/relaxed`.

### 5.3 Spaziature

Grid a 4px: `--sl-space-1` (4px) … `--sl-space-12` (48px), per garantire coerenza visiva su tutti i componenti.

### 5.4 Border radius e ombre

`--sl-radius-sm/md/lg/full` (quest'ultimo per avatar/pill). Elevazioni: `--sl-shadow-1` (card a riposo), `--sl-shadow-2` (dropdown/menu), `--sl-shadow-3` (modale) — sobrie, coerenti con l'obiettivo "nessun effetto futuristico".

### 5.5 Animazioni

`--sl-duration-fast` (120ms), `-base` (200ms), `-slow` (320ms); `--sl-ease-standard`. **Rispetto obbligatorio di `prefers-reduced-motion`**: chi lo richiede riceverà transizioni istantanee o quasi.

### 5.6 Icone e griglia

Un solo set di icone (stile outline, griglia 24px, stroke 1.5px), distribuito come sprite SVG unico (`assets/icons/icons.svg`) referenziato via `<use>`: una sola richiesta HTTP, colorabile via `currentColor` + variabile CSS.

**Nota tecnica importante:** i breakpoint (`sm` 480px, `md` 768px, `lg` 1024px, `xl` 1280px) **non** possono essere definiti come CSS custom properties utilizzabili dentro `@media` (limite dello standard CSS, non superabile senza preprocessore). Verranno quindi documentati come costanti di riferimento condivise (stesso valore replicato nelle media query CSS e, se serve lato JS, in `config/env.js`), con un commento che rimanda a questa tabella per mantenerli sincronizzati.

### 5.7 Stati e accessibilità

- Focus visibile tramite `:focus-visible` (non `:focus`, per non mostrare l'anello ai click da mouse) + `--sl-color-focus-ring`, conforme a WCAG 2.4.7.
- Stati semantici (errore/successo/warning) **non affidati solo al colore**: sempre accompagnati da icona e/o testo, per utenti con daltonismo.
- Stato `disabled`: opacità ridotta + `cursor: not-allowed` + `aria-disabled="true"`.

---

## 6. Sistema temi

**Struttura file:** `css/tokens/*` (valori strutturali condivisi) + `css/themes/theme-light.css` e `theme-dark.css` (solo i token cromatici, dichiarati sotto i selettori `[data-theme="light"]` e `[data-theme="dark"]` sull'elemento `<html>`).

**Cambio tema:** `themeService.setTheme(name)` imposta l'attributo `data-theme` sull'`<html>`; tutti i componenti che usano `var(--sl-color-*)` si aggiornano automaticamente, senza dover essere notificati singolarmente. Un evento `sl:theme-change` viene comunque emesso per i rari casi (es. un grafico canvas) che non possono reagire via CSS puro.

**Persistenza:** oggi tramite `storage.js` → `localStorage`; domani stessa interfaccia → tabella `settings` su Supabase. Il componente `ThemeSwitch` e il `themeService` non cambiano.

**Fallback:** se non esiste una preferenza salvata, si usa `prefers-color-scheme` di sistema; se anche questa è assente, default **Light**.

**Anti-flicker (FOUC):** uno script inline sincrono nell'`<head>` legge la preferenza e imposta `data-theme` **prima** che i CSS vengano applicati, evitando il lampeggio del tema sbagliato all'avvio — dettaglio richiesto dagli obiettivi di performance/fluidità del progetto.

**Estendibilità:** un nuovo tema (es. "alto contrasto") richiede solo un nuovo file `theme-*.css` + una voce in `themes.json`; zero modifiche ai componenti.

---

## 7. Routing

**Alternative a confronto**

| Opzione | Pro | Contro | Scelta |
|---|---|---|---|
| History API (`pushState`) | URL puliti | Richiede configurazione server per il fallback su refresh — non garantita su hosting statico (es. GitHub Pages) | ❌ Scartata per la Fase 1 |
| Hash-based (`location.hash`) | Funziona su qualsiasi hosting statico senza configurazione server, zero 404 su refresh | URL meno "puliti" | ✅ **Scelta** |

La logica è isolata in un unico modulo (`core/router.js`): se in futuro si disporrà di un server/edge function configurabile, la migrazione a History API toccherà solo quel file.

**Mappa delle rotte pianificate**

| Rotta | Pagina | Guard |
|---|---|---|
| `#/` | Bootstrap → redirect in base alla sessione | — |
| `#/login` | Login | Solo utenti non autenticati |
| `#/home` | Dashboard/feed principale | Autenticato |
| `#/modules` | Elenco moduli/scenari (categorie citate nel progetto: Yoga, Nissan GT-R, Beatbox, Fotografia, Cybersecurity, Ricette) | Autenticato |
| `#/scenario/:scenarioId` | Runner generico di scenario (interpreta `scenario.json` tramite `scenarioEngine`) | Autenticato |
| `#/settings` | Preferenze (tema, profilo) | Autenticato |
| `#/404` | Pagina non trovata | — |

---

## 8. Sistema Login (solo design)

**Flusso:** form di login → validazione client-side di formato (non è autenticazione) → `authService.login(credenziali)` → oggi: verifica contro `users.json` tramite `localAuthAdapter`; domani: stessa chiamata tramite `supabaseAuthAdapter` → creazione oggetto sessione (utente, ruolo, scadenza) salvato via `storage.js` → redirect a `#/home`.

**Ruoli:** `docente` (unico ruolo realmente utilizzato oggi) e `admin` (predisposto per un'eventuale gestione multi-docente/istituto in futuro) — definiti in `roles.json` fin da ora perché il costo di definirli è minimo e la richiesta di progetto lo prevede esplicitamente.

**Sessione e guard:** `router.js` verifica `authService.hasValidSession()` prima di montare qualunque rotta protetta; sessione scaduta o assente → redirect a `#/login`.

**Logout:** pulizia sessione, evento `sl:auth-logout`, redirect a login.

**Punto di integrazione Supabase futuro:** sostituzione del solo `localAuthAdapter` con `supabaseAuthAdapter` (stessa interfaccia), zero impatti su UI/servizi.

---

## 9. Piano dei file JSON

| File | Scopo | Proprietà principali |
|---|---|---|
| `config.json` | Configurazione globale app | `appName`, `version`, `environment`, `defaultLocale`, `featureFlags` |
| `themes.json` | Temi disponibili | `defaultTheme`, `available: [{id, label, cssFile}]` |
| `navigation.json` | Definizione rotte e menu | `routes: [{path, id, labelKey, icon, roles, order}]` |
| `modules.json` | Elenco moduli/scenari e loro stato | `modules: [{id, title, category, icon, status}]` |
| `roles.json` | Ruoli e permessi | `roles: [{id, label, permissions}]` |
| `users.json` | Utenti demo (placeholder, mai credenziali reali in chiaro) | `users: [{id, username, roleId, displayName, avatar}]` |
| `settings.json` | Default preferenze persistite | `theme`, `locale`, `sidebarCollapsed` |
| `notifications.json` | Notifiche mock, per realismo interfaccia | `notifications: [{id, type, message, timestamp, read}]` |
| `localization/it.json` | Stringhe UI (oggi solo italiano, struttura pronta per altre lingue) | coppie chiave → stringa |
| `data/scenarios/oversharing/scenario.json` | Metadati dello scenario (riservato, popolato in Fase 6) | `id`, `type: "profile-timeline"`, `title`, `dataRefs` |

---

## 10. Preparazione GitHub

- **`.gitignore`**: `.env`, `.DS_Store`, `Thumbs.db`, `*.log`, `node_modules/` (se in futuro si introducesse tooling di sviluppo opzionale, es. linting).
- **README**: titolo/tagline, descrizione, stack tecnologico, come eseguire in locale, struttura cartelle, roadmap, licenza.
- **Versioning**: SemVer (`MAJOR.MINOR.PATCH`); `v0.x.y` durante le fasi di sviluppo, `v1.0.0` riservato al primo traguardo realmente "production-ready" (Oversharing completo + audit finale).
- **Branch strategy**: `main` (stabile), `develop` (integrazione fasi), `feature/<nome>`, `fix/<nome>`.
- **Commit convention**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`), opzionalmente scoped (`feat(router): ...`).
- **Release naming**: tag semver con suffisso di fase, es. `v0.1.0-fase1-fondamenta`.
- **Cartelle escluse dal repo**: file `.env`, eventuali cache locali; nessuna cartella di build (non previsto un bundler in questa fase).

---

## 11. Preparazione Supabase (solo design)

- **Repository Pattern**: interfaccia comune (es. metodi `get`, `list`, `create`, `update`, `remove`) implementata oggi da un `localJsonRepository` (legge i file in `data/`) e in futuro da un `supabaseRepository` — i `services` consumano sempre la stessa interfaccia.
- **Adapter**: `adapters/` ospiterà `localAuthAdapter` vs `supabaseAuthAdapter`, entrambi conformi alla stessa interfaccia di `authService`.
- **Config**: `config/env.js` centralizzerà `SUPABASE_URL` e `SUPABASE_ANON_KEY`, letti da un file `.env` non versionato (oggi assente/placeholder).
- **Punti di integrazione futuri**: autenticazione (Supabase Auth), profili (tabella `profiles`), impostazioni (tabella `settings`), eventuale storage immagini (Supabase Storage) come alternativa/aggiunta agli asset statici.
- **Flusso**: oggi `authService → localAuthAdapter → users.json`; domani `authService → supabaseAuthAdapter → Supabase Auth`, **nessuna modifica ai componenti UI**.

---

## 12. Scalabilità futura

**Scenario Engine**: ogni scenario è descritto da un `scenario.json` con un campo `type` (es. `"profile-timeline"`; in futuro potenzialmente `"quiz"`, `"chat-simulation"`) che seleziona quale renderer generico usare tra quelli già presenti nei componenti condivisi (`Feed`, `PostCard`, in futuro `Timeline`, `MediaViewer`).

**Aggiungere un nuovo scenario simile a Oversharing** (es. un futuro scenario "Privacy" con lo stesso `type: "profile-timeline"`) richiede solo:
1. creare `data/scenarios/privacy/` con i JSON necessari;
2. aggiungere una voce in `modules.json`;

— **zero modifiche** a `components/`, `services/` o `pages/`.

**Aggiungere un nuovo tipo di interazione** (es. una simulazione di chat per Social Engineering) richiederà invece un nuovo renderer, isolato in `components/` e registrato nello `scenarioEngine`, senza toccare gli scenari esistenti (principio Open/Closed: si estende, non si modifica).

---

## Roadmap della Fase 2

Da implementare (con codice reale, questa volta) nella Fase 2 — *Design System e UI Core*, secondo il piano qui definito:

1. Realizzare in HTML/CSS/JS i componenti core: `AppHeader`, `Sidebar`/menu profilo, `Feed`, `Card`/`PostCard`, `Modal` (incl. variante Dialog), `Button`, form di login, `ThemeSwitch`.
2. Trascrivere in `css/tokens/*.css` e `css/themes/*.css` i design token pianificati nel §5.
3. Verificare da subito WCAG (contrasto, focus visibile, `prefers-reduced-motion`) e responsive su ciascun componente, sui due temi.
4. **Non** implementare ancora: autenticazione reale (Fase 3), routing multi-pagina completo (Fase 4), scenario Oversharing (Fase 6).
5. Validare visivamente ogni componente in Light **e** Dark prima di considerarlo completo.
