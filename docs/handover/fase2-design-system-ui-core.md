# SOCIALIVE — Handover di fine Fase 2 (Design System e UI Core)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Data logica di chiusura fase:** fine Fase 2 (Prompt #2 della Suite — "Design System e UI Core").
**Tag di riferimento suggerito:** `v0.2.0-fase2-design-system-ui-core`

---

## 1. Stato del progetto

- **Fase 1 — Fondamenta**: ✅ completata (solo documentazione architetturale, nessun codice).
- **Fase 2 — Design System e UI Core**: ✅ **COMPLETATA** in 8 step incrementali. Tutti i
  componenti UI riutilizzabili previsti dal Prompt #2 originario (Header, Sidebar/menu profilo,
  Feed, Card post, Modali, Pulsanti, Form login, Theme switch) sono stati realizzati, verificati
  end-to-end con Playwright (funzionale + accessibilità + responsive + entrambi i temi) e
  documentati con motivazione delle scelte.
- **Avanzamento generale**: Fase 2 è, in termini di volume di componenti riutilizzabili, la fase
  più densa dell'intero progetto (14 componenti + 2 servizi + utility condivise). Le fasi
  successive (3–10) riuseranno questo Design System quasi integralmente: il lavoro da qui in poi
  sarà prevalentemente di **orchestrazione** (routing, dati, logica applicativa) più che di nuova
  UI, ad eccezione di componenti specifici agli scenari (Fase 6+) esplicitamente differiti per
  YAGNI (StoriesBar, Timeline, MediaViewer).
- **Nessuna riga di autenticazione reale, routing reale, o dato esterno (JSON) è stata scritta**:
  restano rigorosamente fuori scope, come da regola esplicita di Fase 1/Fase 2.

---

## 2. Obiettivi completati

Solo funzionalità realmente implementate e verificate (nessuna attività pianificata ma non
sviluppata compare qui).

### Step 1 — Design tokens, temi, baseline
- Token primitivi (`colors.css`) e semantici (`theme-light.css`/`theme-dark.css`), spacing (grid
  4px), typography, radius, shadows, motion.
- `reset.css` + `global.css` (focus-visible, utility `.sl-visually-hidden`, rete di sicurezza
  `prefers-reduced-motion`).
- `themeService.js` (get/set/toggle/apply/init tema, persistenza via `storage.js`, ascolto
  preferenza di sistema finché l'utente non sceglie esplicitamente).
- Script anti-FOUC sincrono in `<head>`.
- Verifica numerica WCAG (script Python di luminanza relativa): **2 correzioni** —
  `warning-500` (#E3A008 → #B8760A, falliva anche la soglia 3:1 decorativa) e `border-strong`
  (gray-400 → gray-500, sotto soglia 3:1 per bordo funzionale).
- `style-guide.html` creato come strumento di QA interno (non fa parte dell'app).

### Step 2 — Componenti atomici
- `Button` (varianti primary/secondary/ghost/icon), `Avatar` (fallback su iniziali/errore
  immagine), `Badge` (varianti soft di stato), `Card` (base generica, variante interattiva).

### Step 3 — ThemeSwitch, Input
- `ThemeSwitch` (pattern ARIA "switch", unico componente autorizzato a importare `themeService`
  direttamente).
- `Input` (text/email/password/search, label associata, helper/error, stato disabled).
- **Bug trovato e corretto**: `--sl-color-text-inverse` in Dark mappava su gray-900 (2.78:1 su
  primary-600, sotto soglia AA) — corretto a gray-50 FISSO in entrambi i temi (5.77:1).

### Step 4 — Modal
- `Modal` (incl. variante `dialog` per conferma/annulla), focus trap, chiusura ESC/overlay/bottone,
  ripristino focus e scroll alla chiusura.

### Step 5 — Navigazione e profilo
- `AppHeader` (branding, ricerca — riusa `Input` type="search"/hideLabel —, trigger menu profilo).
- `ProfileMenu` (popover NON modale, riusa `ThemeSwitch`, focus trap estratto in
  `js/utils/focusTrap.js` e condiviso con `Modal`).
- `Sidebar` (link `<a href="#/...">` reali, voce attiva `aria-current="page"`, voce disabilitata
  non focalizzabile).
- **Bug trovato e corretto**: nuovo token `--sl-color-primary-text` introdotto dopo aver scoperto
  che `primary-600` usato come colore di TESTO (non come riempimento) rendeva 2.78:1 in Dark —
  bug già insediato nel brand mark di `AppHeader`, corretto in questo step.

### Step 6 — PostCard
- `PostCard` (compone `Card`/`Avatar`/`Button`; header, testo, immagine full-bleed opzionale,
  azioni Mi piace/Commenta/Condividi con icone SVG inline, contatori con
  `toLocaleString("it-IT")`).
- Estensione additiva di `Button`: prop `pressed` (toggle ARIA) e `ariaLabel` valida anche fuori
  dalla variante `icon`.
- **2 bug trovati e corretti**: (a) `.sl-post-card__media[hidden]` — una regola d'autore con
  `display:block` vinceva sullo stile UA di `[hidden]`; (b) `Button.render()` sovrascriveva
  l'intero `className` ad ogni render, cancellando classi aggiunte da un consumer esterno alla
  prima `update()` — corretto gestendo solo le classi di proprietà di `Button` via
  `classList.add/remove`.

### Step 7 — Feed
- `Skeleton` (placeholder generico text/circle/block — pianificato in Fase 1, costruito ora
  perché dipendenza reale di Feed, non estetismo).
- `Feed` (riconciliazione `PostCard` per id, lazy-load via `IntersectionObserver`, skeleton "a
  forma di post" durante il caricamento, regione `aria-live` per l'annuncio a screen reader,
  **niente** `role="feed"` — motivato in §4).
- **Bug trovato e corretto**: il `<li>` che avvolge ogni skeleton "finto post" non veniva rimosso
  dal DOM al termine del caricamento (`destroy()` distruggeva solo le istanze figlie).

### Step 8 — LoginForm
- `Loader` (indicatore di attesa indeterminato, anello SVG rotante — pianificato in Fase 1,
  costruito ora perché dipendenza reale del bottone di submit).
- `LoginForm` (**solo UI**: validazione di formato client-side su email/password, focus
  automatico sul primo campo non valido dopo submit fallito, stato di invio con `Loader`,
  nessuna autenticazione reale).
- Estensione additiva di `Input`: prop `autocomplete` e metodo `focus()` nell'interfaccia
  restituita.
- Nessun bug trovato in questo step (prima esecuzione della suite di test: tutto verde).

**Totale bug reali trovati da Playwright e corretti durante la Fase 2: 6** (elencati sopra), oltre
alle 3 correzioni di contrasto WCAG trovate dallo script Python.

---

## 3. Architettura attuale

```
socialive/
├── README.md
├── style-guide.html                 # strumento di QA interno — NON fa parte dell'app
├── docs/
│   └── handover/
│       └── fase2-design-system-ui-core.md   # questo documento
│
├── css/
│   ├── tokens/
│   │   ├── colors.css        # primitivi --sl-palette-*
│   │   ├── spacing.css       # grid 4px
│   │   ├── typography.css
│   │   ├── radius.css
│   │   ├── shadows.css
│   │   └── motion.css
│   ├── themes/
│   │   ├── theme-light.css   # token semantici --sl-color-*
│   │   └── theme-dark.css
│   ├── base/
│   │   ├── reset.css
│   │   └── global.css
│   └── components/
│       ├── button.css
│       ├── avatar.css
│       ├── badge.css
│       ├── card.css
│       ├── theme-switch.css
│       ├── input.css
│       ├── modal.css
│       ├── app-header.css
│       ├── profile-menu.css
│       ├── sidebar.css
│       ├── post-card.css
│       ├── skeleton.css
│       ├── feed.css
│       ├── loader.css
│       └── login-form.css
│
└── js/
    ├── utils/
    │   ├── dom.js           # createElement/clearChildren
    │   ├── storage.js       # wrapper localStorage
    │   └── focusTrap.js     # getFocusableElements/trapTabKey (condiviso Modal/ProfileMenu)
    ├── services/
    │   └── themeService.js
    └── components/
        ├── Button.js
        ├── Avatar.js
        ├── Badge.js
        ├── Card.js
        ├── ThemeSwitch.js
        ├── Input.js
        ├── Modal.js
        ├── AppHeader.js
        ├── ProfileMenu.js
        ├── Sidebar.js
        ├── PostCard.js
        ├── Skeleton.js
        ├── Feed.js
        ├── Loader.js
        └── LoginForm.js
```

**Cartelle previste dall'architettura di Fase 1 ma NON ancora popolate** (correttamente, non è
uno scope creep mancato — sono di competenza delle fasi successive): `assets/images`,
`assets/fonts`, `data/`, `js/core/` (router.js, state.js, eventBus.js), `js/pages/`,
`js/scenarios/`, `js/repositories/`, `js/adapters/`, `js/config/`. `assets/icons/` esiste ma è
vuota (lo sprite SVG unificato resta un debito tecnico noto, vedi §10).

**Nessuna modifica architetturale rispetto al piano di Fase 1**, salvo le puntualizzazioni già
segnalate nei rispettivi step (nuovo token `--sl-color-primary-text`, evento invece di callback
per `Feed.onLoadMore` → `sl:feed-load-more`, niente `role="feed"`/`role="tabpanel"` non previsti
esplicitamente in Fase 1 ma decisi con motivazione in §4).

---

## 4. Decisioni progettuali

### Colori e contrasto
- **Metodo**: ogni NUOVO accostamento colore viene verificato numericamente (script Python,
  luminanza relativa WCAG) prima di scrivere il CSS; un accostamento già verificato in un
  contesto identico (stesso token, stesso sfondo) NON viene riverificato — solo i pairing
  genuinamente nuovi.
- **Correzioni**: `warning-500` (#E3A008→#B8760A), `border-strong` (gray-400→gray-500),
  `text-inverse` Dark (gray-900→gray-50 fisso), nuovo token `--sl-color-primary-text` (Light:
  alias di primary-600; Dark: alias di primary-500/primitivo-400) per separare "colore di
  riempimento con testo bianco sopra" da "colore usato COME testo" — due pairing distinti anche a
  parità di valore esadecimale.
- **error-text vs error-500**: quando un colore di stato tinge anche testo/contatori visibili
  (non solo un'icona), si usa sempre la variante `-text` (verificata ≥4.5:1), mai la `-500`
  (verificata solo ≥3:1 per uso decorativo) — stessa distinzione fill-vs-testo del bug
  primary-600.
- **bg-elevated ≠ bg-surface in Dark**: ogni combinazione testo/bg-elevated è stata riverificata a
  sé (non ereditata dai numeri di bg-surface) per `ProfileMenu`.

### Componenti e composizione
- Interfaccia uniforme `create(props) → { element, update(props), destroy() }` per tutti;
  eccezioni esplicite e motivate quando un componente ha bisogno di più (es. `Input.focus()`,
  aggiunto in Step 8).
- **Mai duplicare, sempre comporre**: `PostCard` compone `Card`/`Avatar`/`Button`, non li
  reimplementa; `Feed` compone `PostCard`/`Card`/`Skeleton`; `LoginForm` compone
  `Input`/`Button`/`Card`/`Loader`. Le estensioni a componenti condivisi (`Button.pressed`,
  `Input.autocomplete`/`focus()`) sono sempre **additive**: nessun consumer esistente ne risente.
- **Icone**: nessuno sprite SVG ancora esistente (debito tecnico noto). Icone costruite inline nel
  componente che le usa (`Modal`, `PostCard`, `LoginForm`/`Loader`) con lo stesso pattern ogni
  volta — quando lo sprite esisterà, sostituzione con `<use>` a markup esterno invariato.
- **Stato pienamente controllato vs locale**: i componenti sono "dumb" per default (ricevono dati,
  emettono eventi, non mutano se stessi) — l'unica eccezione è `ThemeSwitch` (chiama
  `themeService`, l'unico service esistente). `PostCard` (mi piace) e `LoginForm` (submit)
  seguono lo stesso principio: l'evento porta l'INTENTO, l'aspetto cambia solo quando il consumer
  richiama `update()`.
- **Evento, mai callback prop**: anche dove il piano di Fase 1 elencava una callback
  (`Feed.onLoadMore`), si è scelto `sl:feed-load-more` per coerenza con il vocabolario di eventi
  ormai consolidato in tutti gli altri componenti — deviazione dal piano originario, motivata e
  documentata nel file.

### Accessibilità
- Focus visibile solo da tastiera (`:focus-visible`) a livello globale, mai ridefinito localmente
  nei componenti.
- Stati mai affidati al solo colore: `PostCard` cambia FORMA dell'icona cuore (non solo colore) +
  `aria-pressed`; `Badge`/errori sempre colore + testo/icona.
- **Niente `role="feed"` su `Feed`**: quel ruolo ARIA porta un contratto di interazione da
  tastiera (roving focus tra articoli) non implementato — usarlo senza quel comportamento sarebbe
  peggio per un utente di tecnologie assistive che non usarlo affatto. Si usa `<ul>` nativa +
  `aria-busy` + regione `aria-live`.
- Focus management esplicito: `Modal`/`ProfileMenu` intrappolano e ripristinano il focus;
  `LoginForm` sposta il focus sul primo campo non valido dopo un submit fallito (WCAG 3.3.1).
- Ogni componente interattivo ha nome accessibile garantito (mai un'icona-sola senza
  `aria-label`).

### Metodo di verifica (invariato per tutta la fase)
1. Contrasto: script Python (verificato solo per pairing NUOVI).
2. Codice: test end-to-end Playwright (headless Chromium) contro server locale
   (`python -m http.server`, mai `file://`), MAI solo asserzioni sul DOM — sempre anche
   screenshot reali (incl. viewport <768px).
3. **Regressione ad ogni step**: la suite dello step corrente ripete sempre anche i controlli
   chiave sugli step precedenti (Button/Modal/ProfileMenu/Sidebar/PostCard/Feed), non solo il
   nuovo componente.

---

## 5. Attività rimanenti

In ordine di roadmap (Prompt #3 → #10 della Suite):

1. **Fase 3 — Autenticazione** (prossima, vedi §6):
   - `data/users.json`, `data/roles.json` (Fase 1 §9).
   - `js/adapters/localAuthAdapter.js` + `js/repositories/` (pattern Repository/Adapter, Fase 1
     §2.1/§11).
   - `js/services/authService.js` (login/logout/checkSession/hasValidSession).
   - `js/core/router.js` (routing hash-based, Fase 1 §7) — **prima implementazione reale di
     routing**.
   - `index.html` reale (oggi non esiste: `style-guide.html` è solo QA) + script anti-FOUC
     duplicato lì.
   - Wiring di `LoginForm` (già pronta) a `authService` tramite un vero page controller.
2. **Fase 4 — Home**: feed personale, categorie moduli, menu profilo, accesso agli scenari — userà
   `AppHeader`+`Sidebar`+`Feed` già pronti, più probabilmente `EmptyState`/`PageContainer` (mai
   costruiti, YAGNI finora).
3. **Fase 5 — Sistema Scenari**: `js/scenarios/scenarioEngine.js`, primo scenario via JSON.
4. **Fase 6 — Scenario Oversharing**: profilo realistico, stories, timeline annuale — richiederà
   `StoriesBar`/`Timeline` (esplicitamente differiti in Fase 1 per YAGNI, da progettare ora).
5. **Fase 7 — Post e Media Viewer**: apertura post (Fase 2 emette già `sl:post-open` da
   `PostCard`, in attesa di un consumer reale), zoom immagini, `MediaViewer` (differito).
6. **Fase 8 — Dati**: spostare tutti i dati demo (oggi hardcoded in `style-guide.html`) in JSON
   reali (`profiles.json`, `feed.json`, `posts.json`, ecc.), zero logica nei componenti da
   modificare (già "dumb" per costruzione).
7. **Fase 9 — Rifinitura UX**: animazioni, performance, coerenza visiva.
8. **Fase 10 — Audit finale**.

**Componenti pianificati in Fase 1 §4 ma non ancora costruiti** (deliberatamente, per YAGNI, non
dimenticati): `Chip`, `Dropdown`, `Tabs`, `ProgressBar`, `EmptyState`, `ErrorState`,
`PageContainer`, `ScrollArea`, `Toast`, `SearchInput` (dedicato — oggi `Input` type="search" via
`AppHeader` copre il caso reale). Da costruire solo quando un consumer reale ne avrà bisogno.

**Icon sprite** (`assets/icons/icons.svg`): ancora non esiste. Prerequisito per: toggle
mostra/nascondi password di `Input`, icone di navigazione di `Sidebar`, lente di ricerca/campanella
di `AppHeader`. Nessuno di questi è bloccante per Fase 3.

---

## 6. Prossima fase

**Fase 3 — Autenticazione** (Prompt #3 della Suite originaria).

**Punto di ripartenza esatto**: tutti i componenti UI necessari esistono già e sono verificati
(`LoginForm`, `AppHeader`, `ProfileMenu`, `Sidebar`, `Modal`). Fase 3 NON deve toccare
`css/`/componenti esistenti se non per correggere eventuali bug reali emersi durante
l'integrazione (da verificare, non da presumere). Il lavoro di Fase 3 è quasi interamente nuovo:

1. Creare `data/users.json` (utenti demo, mai credenziali reali in chiaro) e `data/roles.json`
   (`docente`, `admin`).
2. Creare `js/repositories/` (interfaccia `get/list/create/update/remove`) e
   `js/adapters/localAuthAdapter.js` (implementazione oggi su JSON locale).
3. Creare `js/services/authService.js`: `login(credenziali)` → verifica contro
   `localAuthAdapter` → crea oggetto sessione (utente, ruolo, scadenza) via `storage.js` esistente
   (già pronto, nessuna modifica necessaria) → `hasValidSession()`, `logout()`.
4. Creare `js/core/router.js` (hash-based, come deciso in Fase 1 §7): prima vera implementazione
   di routing del progetto. Rotte minime per questa fase: `#/login`, `#/home` (placeholder),
   `#/404`.
5. Creare il vero `index.html` (entry point dell'app, distinto da `style-guide.html` che resta
   solo QA) con lo script anti-FOUC (stessa chiave `sl-theme`) e bootstrap che chiama
   `router.init()` + `authService.checkSession()`.
6. Creare un primo, minimo page controller per `#/login` che monta `LoginForm` (già pronto),
   ascolta `sl:login-submit`, chiama `authService.login()`, gestisce `isSubmitting`/`error` di
   `LoginForm` di conseguenza, e su successo fa `router.navigate('#/home')`.
7. Guard: `router.js` verifica `authService.hasValidSession()` prima di montare rotte protette →
   redirect a `#/login` se assente/scaduta.
8. Continuare a seguire il metodo di verifica invariato (contrasto solo su NUOVI pairing, test
   Playwright + screenshot, regressione sui componenti Fase 2).

**Nota di continuità tecnica per i test**: evitare `pkill -f "<pattern>"` per liberare la porta di
un server di test precedente — in questo ambiente `pkill -f` può corrispondere (e terminare) il
processo shell stesso che esegue il comando, poiché la sua riga di comando contiene letteralmente
il pattern cercato. Usare una porta nuova ad ogni esecuzione di test invece di riutilizzarne una
con `pkill` di pulizia.

---

## 7. Prompt di continuità

```
Sto riprendendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"), piattaforma didattica per la formazione in Cybersecurity, usata esclusivamente dal
docente e proiettata in classe. Non è un social network reale né un clone di piattaforme
esistenti: deve solo sembrarlo, con massimo realismo, senza alcun elemento "scolastico" visibile.

RUOLO: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX Designer,
Accessibility Specialist (WCAG) e Full Stack Architect. Non comportarti come un chatbot: ragiona
come un membro senior di un team di sviluppo, privilegiando semplicità, scalabilità,
manutenibilità, leggibilità, riutilizzabilità, performance e accessibilità. Motiva ogni decisione
prima di implementarla. Prima di scrivere CSS che introduce un NUOVO accostamento colore,
verificalo numericamente (script Python, formula luminanza relativa WCAG) — non fidarti a occhio,
e non dare per scontato che un colore già verificato in un contesto sia automaticamente sicuro in
un contesto diverso (fill vs testo, bg-surface vs bg-elevated: sono pairing distinti anche a
parità di valore esadecimale — è già successo più volte, vedi §4 dell'handover allegato). Dopo
aver scritto codice, verificalo end-to-end con Playwright (headless Chromium, browser
pre-installato in /opt/pw-browsers) contro un server locale (python -m http.server, mai file://)
prima di consegnarlo, con screenshot reali (anche <768px), e SEMPRE una regressione sui componenti
già esistenti, non solo sul nuovo. Procedi sempre per piccoli step, mai grandi quantità di codice
in un'unica risposta.

NOTA TECNICA DI AMBIENTE: per liberare una porta di test già usata, NON usare
`pkill -f "<pattern che include la porta>"` — in questo ambiente può corrispondere alla riga di
comando del processo shell che esegue il comando stesso, terminandolo e troncando l'intera
risposta senza output. Usa invece una porta nuova ad ogni test.

STACK: esclusivamente HTML5, CSS3, JavaScript ES6+ (moduli nativi). Nessun framework, nessuna
libreria UI. Predisposizione futura per Supabase (auth, profili, impostazioni), non ancora
implementata.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main, cartella /root. GitHub blocca via robots.txt il browsing delle
directory — se serve leggere file del repo non presenti nei file del progetto, chiedili
direttamente all'utente (link raw o contenuto incollato) invece di provare a indovinare i path.

STATO: Fase 1 (Fondamenta) e Fase 2 (Design System e UI Core) COMPLETE. Fase 2 ha prodotto 14
componenti (Button, Avatar, Badge, Card, ThemeSwitch, Input, Modal, AppHeader, ProfileMenu,
Sidebar, PostCard, Skeleton, Feed, Loader, LoginForm), 2 servizi (themeService, e utility
dom/storage/focusTrap), il Design System completo (token + temi Light/Dark), e style-guide.html
come QA interno — tutto verificato end-to-end con Playwright, incl. accessibilità e contrasto
WCAG AA in entrambi i temi. Il documento di handover completo (10 sezioni) di fine Fase 2 è
allegato a questo prompt: contiene TUTTE le decisioni prese, i bug trovati e corretti, e i
dettagli architetturali — consideralo la fonte di verità primaria, non ripartire da assunzioni.

DA FARE ORA (Fase 3 — Autenticazione, Prompt #3 della Suite):
1. data/users.json (utenti demo, mai credenziali reali in chiaro), data/roles.json (docente,
   admin).
2. js/repositories/ (interfaccia get/list/create/update/remove) +
   js/adapters/localAuthAdapter.js.
3. js/services/authService.js: login(credenziali) → localAuthAdapter → sessione (utente, ruolo,
   scadenza) via storage.js (già esistente, non modificarlo se non necessario) →
   hasValidSession()/logout().
4. js/core/router.js: PRIMA implementazione reale di routing, hash-based (location.hash) come
   deciso in Fase 1 §7. Rotte minime: #/login, #/home (placeholder), #/404.
5. index.html reale (entry point dell'app — oggi non esiste, style-guide.html è solo QA interno e
   NON va toccato per l'app reale) con script anti-FOUC (chiave "sl-theme", stessa di
   themeService.js) + bootstrap che chiama router.init() e authService.checkSession().
6. Un primo, minimo page controller per #/login: monta LoginForm (già pronto, Fase 2/Step 8),
   ascolta sl:login-submit, chiama authService.login(), gestisce isSubmitting/error di LoginForm
   di conseguenza, su successo naviga a #/home.
7. Guard in router.js: hasValidSession() prima di montare rotte protette, altrimenti redirect a
   #/login.

REGOLE INVARIATE: mai duplicare componenti per la stessa funzione; ogni componente
create(props) → {element, update(props), destroy()}; eventi "sl:nome-evento" (mai callback prop);
componenti "dumb" (ricevono dati, emettono eventi, non decidono logica applicativa) tranne
ThemeSwitch (unico autorizzato a importare un service); documentazione in italiano; commenti che
motivano le scelte, non solo descrivono il codice; al termine di questa fase (Fase 3), produci di
nuovo l'handover completo a 10 sezioni prima di considerarla conclusa.

Procedi con il punto 1 (data/users.json, data/roles.json), motivando la struttura scelta prima di
scrivere il JSON.
```

---

## 8. Test da eseguire

Checklist cumulativa sull'intero style-guide.html (stato di fine Fase 2), da ripetere ogni volta
che si tocca un componente condiviso.

### Test funzionali
- [ ] `ThemeSwitch`: toggle, persistenza dopo reload, sincronizzazione tra istanze multiple.
- [ ] `Button`: `sl:click` con `detail.variant` corretto per ogni variante; stato `disabled`
  blocca il click.
- [ ] `Avatar`: fallback su iniziali (nessuna src), fallback su errore di caricamento immagine.
- [ ] `Modal`: apertura/chiusura via ×, ESC, overlay, Annulla/Conferma; `sl:modal-close` con
  `reason` corretto; focus trap (Tab non esce dal pannello).
- [ ] `AppHeader`: `sl:search` sul digitare; `sl:profile-menu-toggle` con `open`/`anchorElement`
  corretti.
- [ ] `ProfileMenu`: apertura/chiusura ESC/click-fuori/azione; `sl:logout`/`sl:settings-click`;
  clic sul trigger non genera doppia chiusura.
- [ ] `Sidebar`: `sl:navigate` con `id`/`route` corretti; voce disabilitata non genera eventi e non
  è raggiungibile con Tab.
- [ ] `PostCard`: toggle "mi piace" (click e da tastiera) aggiorna `aria-pressed` e contatore SOLO
  dopo `update()` del consumer; `sl:post-open` solo cliccando l'immagine; `sl:post-comment`/
  `sl:post-share`; fallback avatar; formattazione contatori `it-IT`.
- [ ] `Feed`: stato iniziale corretto; scroll → `sl:feed-load-more` + skeleton visibili +
  `aria-busy=true`; dopo il caricamento, skeleton rimossi, post aggiunti in ordine, `aria-busy`
  torna false; dopo `hasMore:false` nessun ulteriore evento; bubbling di `sl:post-like` dai
  `PostCard` figli fino a `Feed`.
- [ ] `LoginForm`: submit vuoto → entrambi i campi in errore + focus sul primo; email malformata
  → errore specifico; validazione live dopo il primo tentativo (blur); stato `isSubmitting`
  disabilita campi/bottone e mostra `Loader`; banner di errore generale su credenziali errate;
  evento `sl:login-submit` solo con formato valido; `sl:login-forgot-password`; invio da tastiera
  (Enter) funzionante.

### Test UI
- [ ] Layout, spaziature, allineamenti coerenti in TUTTE le sezioni della style guide.
- [ ] Temi Light e Dark su OGNI componente (non solo i token base) — nessun testo illeggibile,
  nessun bordo invisibile.
- [ ] Responsive: `AppHeader` nasconde la ricerca <768px; `Sidebar` si nasconde <768px; `PostCard`/
  `Feed`/`LoginForm` restano leggibili a 375px senza overflow orizzontale.
- [ ] Nessun layout shift percepibile nel passaggio skeleton → contenuto reale in `Feed`.

### Test UX
- [ ] Focus visibile solo da tastiera (mai al click mouse) su tutti i componenti.
- [ ] Transizioni di tema (Light↔Dark) percepite come morbide, non a scatto.
- [ ] `prefers-reduced-motion` rispettato (verificare via DevTools/emulazione, non solo lettura del
  codice): animazioni di `Modal`, `Skeleton`, `Loader`, `ThemeSwitch` diventano quasi istantanee.
- [ ] Messaggi di errore comprensibili e mai affidati al solo colore.

### Test tecnici
- [ ] Console priva di errori/warning su `style-guide.html` (eccetto i 404 noti e tollerati:
  `favicon.svg`, `assets/immagine-inesistente.jpg`, quest'ultima fixture intenzionale per il
  fallback di `Avatar`).
- [ ] Nessun path relativo rotto (import ES module, link CSS) — verificato con server locale, mai
  `file://`.
- [ ] Nessuna funzione/variabile inutilizzata residua nei file toccati durante la Fase 2.

### Test di regressione
- [ ] Ogni step successivo della Fase 2 ha ripetuto (con esito positivo) i controlli chiave degli
  step precedenti — l'ultima esecuzione integrale (Step 8) ha verificato: `PostCard` standalone,
  `Feed` (conteggio post), `Button`, `Modal`, `ProfileMenu`, `Sidebar` — tutti verdi insieme a
  `LoginForm`.
- [ ] Prima di iniziare la Fase 3: ripetere l'intera suite una volta in più, per avere una
  baseline "nota buona" immediatamente precedente alle prime modifiche di routing/autenticazione.

---

## 9. Criticità

- **Nessuna integrazione multi-pagina reale testata**: tutti i componenti vivono oggi solo dentro
  `style-guide.html` (un unico documento). L'orchestrazione tra componenti (es.
  AppHeader↔ProfileMenu, Feed↔backend simulato, LoginForm↔backend simulato) è scritta
  temporaneamente nello script della style guide, non in veri page controller — per costruzione
  (Fase 4 non ancora iniziata), non è un difetto, ma resta un'area NON verificata in un contesto
  multi-pagina reale finché Fase 3/4 non la mettono alla prova.
- **Nessuna suite di test automatizzata persistita nel repository**: gli script Playwright usati
  per verificare ogni step sono stati eseguiti durante lo sviluppo ma non salvati come parte del
  repo (nessuna cartella `tests/`). Se in futuro si introducesse una regressione, andrebbero
  ricostruiti da zero invece di essere semplicemente rieseguiti. Raccomando di formalizzarli come
  parte del repo non appena la Fase 3 introduce logica applicativa reale (vedi §10).
- **Icon sprite ancora assente**: diversi componenti restano visivamente "semplificati" rispetto
  all'obiettivo di realismo assoluto del progetto (nessun'icona in `Sidebar`, nessuna lente di
  ricerca/campanella in `AppHeader`, nessun toggle mostra/nascondi password in `Input`). Non
  bloccante per Fase 3, ma da programmare prima possibile per non accumulare troppi punti
  "provvisori" nell'esperienza visiva complessiva.
- **Backend/credenziali della demo di `LoginForm` hardcoded solo nello script di QA**: corretto
  per questo step (nessun `authService` deve esistere ancora), ma da NON confondere con la logica
  reale che arriverà in Fase 3 — la demo va rimossa/sostituita quando `authService` esisterà, non
  semplicemente lasciata accanto.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 **Icon sprite assente** (`assets/icons/icons.svg`): più componenti restano più semplici del
  design finale previsto (Input, Sidebar, AppHeader). Nessun impatto funzionale, solo estetico/di
  completezza del realismo.
- 🟢 **`Feed.SKELETON_ITEMS` hardcoded a 2**, non esposto come prop — sufficiente per ogni caso
  d'uso attuale, facilmente reso configurabile in futuro senza rompere l'interfaccia pubblica.
- 🟢 **Credenziali demo di `LoginForm` hardcoded in `style-guide.html`** — da rimuovere quando
  `authService` esisterà (Fase 3), non da riusare.
- 🟡 **`ProfileMenu` non si riposiziona su resize/scroll a menu aperto** (già annotato come debito
  a bassa priorità nel proprio file in Fase 2/Step 5) — invariato in questa fase.

### Refactoring consigliati
- 🟡 **Formalizzare i test Playwright come suite persistita nel repo** (es. `tests/`), invece di
  script ad-hoc rieseguiti manualmente ad ogni step — soprattutto ora che il numero di componenti
  con interdipendenze (Button↔PostCard↔Feed, Input↔LoginForm) rende la regressione manuale sempre
  più costosa da ripetere per intero ad ogni nuova fase.
- 🟢 **`style-guide.html` è cresciuto molto** (8 sezioni demo + script inline unico, ~44K). Ancora
  gestibile, ma se Fase 3+ dovesse aggiungere ulteriori demo nello stesso file, valutare di
  separare lo script di orchestrazione per sezione in file dedicati (solo per lo strumento di QA,
  non per l'app reale).

### Ottimizzazioni future
- 🟢 `PostCard`: aggiungere abbreviazione contatori ("1,2k") come alternativa a
  `toLocaleString` per numeri molto grandi — cambio non-breaking se richiesto in una fase futura.
- 🟢 `Feed`: rendere configurabili `rootMargin`/numero di skeleton se un consumer reale (Fase 4+)
  ne avrà bisogno.
- 🟢 `Loader`/`Skeleton`: valutare un'unica utility condivisa per le poche righe di gestione
  `prefers-reduced-motion` se in futuro ne servisse una gestione più fine (oggi la rete di
  sicurezza generale in `global.css` è sufficiente, nessuna azione richiesta ora).

### Rischi architetturali
- 🟡 **Nessun vero router/page controller esiste ancora**: tutta l'orchestrazione tra componenti
  vive temporaneamente nello script di `style-guide.html`. Il rischio è contenuto (ogni componente
  è stato progettato fin dall'inizio per essere "dumb" e riorchestrabile altrove senza modifiche),
  ma Fase 3/4 rappresentano il primo vero banco di prova di questa assunzione architetturale.
- 🟢 **Nessuna suite di test automatizzata persistente**: in caso di refactoring futuro più ampio
  (es. introduzione di Supabase in Fase 3+), mancherebbe una rete di sicurezza automatizzata
  pronta all'uso finché non verrà formalizzata (vedi Refactoring consigliati).

### Obiettivo
Questa sezione va riletta all'inizio della Fase 3, prima di introdurre nuove funzionalità, per
mantenere SOCIALIVE pulito, modulare, scalabile e facilmente manutenibile — come da regola
fondamentale di progetto.
