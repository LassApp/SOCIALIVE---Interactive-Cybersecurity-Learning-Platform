# SOCIALIVE — Handover Fase 1 → Fase 2

## 1. Stato del progetto

Fase completata: **Fase 1 — Fondamenta del progetto**.
Avanzamento: progettazione architetturale **100%**; implementazione codice **0%** (vincolo esplicito di questa fase, nessun HTML/CSS/JS doveva essere scritto). Il progetto è pronto per l'implementazione dei componenti core del Design System (Fase 2 / Prompt #2 della suite).

## 2. Obiettivi completati

- Struttura delle cartelle definita e motivata.
- Architettura a livelli definita (Presentation → Application → Data → Core), con regola di dipendenza unidirezionale.
- Convenzioni di naming definite per file, cartelle, CSS, custom properties, JS, eventi, JSON, asset.
- Piano dei componenti condivisi definito (responsabilità/input/eventi/dipendenze), incluse le razionalizzazioni DRY (unificazione Header/TopBar/Navbar in `AppHeader`; unificazione Modal/Dialog).
- Piano del Design System definito (colori, tipografia, spaziature, radius, ombre, animazioni, icone, stati, accessibilità), come token da trascrivere in CSS nella Fase 2.
- Sistema temi Light/Dark progettato (struttura file, persistenza, fallback, anti-FOUC, estendibilità).
- Routing progettato (hash-based, motivato rispetto a History API) con mappa rotte completa.
- Sistema login progettato (flusso, ruoli, sessione, guard, punto di integrazione Supabase).
- Piano dei file JSON definito (10 file, scopo e struttura per ciascuno).
- Preparazione GitHub definita (.gitignore, README, branch strategy, commit convention, versioning).
- Preparazione Supabase definita (repository pattern, adapter, punti di integrazione futuri).
- Strategia di scalabilità definita (Scenario Engine, principio Open/Closed).

Documento completo: `socialive-fase1-architettura-fondamenta.md`.

## 3. Architettura attuale

Nessun file di codice o cartella è stato creato su disco/repository in questa fase: il deliverable è **esclusivamente documentale**, per vincolo di fase. La struttura riportata nel documento di architettura (§1) è **pianificata e vincolante**, da creare concretamente a partire dalla Fase 2.

## 4. Decisioni progettuali

| Decisione | Motivazione sintetica |
|---|---|
| Routing hash-based | Compatibile con hosting statico senza configurazione server; isolato in un modulo per migrazione futura |
| Componenti come factory JS (no Web Components/Shadow DOM) | Lo Shadow DOM ostacolerebbe il theming via CSS custom properties globali |
| Repository Pattern + Adapter per i dati | Punto unico di migrazione verso Supabase, zero impatti su UI/servizi |
| `AppHeader` unico (non Header+TopBar+Navbar) | Rispetta la regola "mai componenti diversi per la stessa funzione" |
| `Modal` unico con variante Dialog | Idem, evita duplicazione |
| Grid spaziature a 4px | Standard di settore, coerenza visiva garantita |
| Breakpoint come costanti documentate, non custom properties | Limite tecnico reale: le CSS variables non sono utilizzabili dentro `@media` |
| Script inline anti-FOUC per il tema | Evita il flash del tema errato all'avvio, requisito di fluidità/performance |
| Ruoli `docente`/`admin` definiti già ora | Costo minimo, richiesto esplicitamente, utile per estendibilità futura |

## 5. Attività rimanenti

Ordinate secondo la roadmap della suite di prompt:

1. **Fase 2** — Design System e UI Core (implementazione componenti)
2. **Fase 3** — Autenticazione (schermata login, predisposizione Supabase)
3. **Fase 4** — Home della piattaforma
4. **Fase 5** — Sistema Scenari (motore modulare via JSON)
5. **Fase 6** — Scenario Oversharing
6. **Fase 7** — Post e Media Viewer
7. **Fase 8** — Migrazione dati nei JSON pianificati
8. **Fase 9** — Rifinitura UX
9. **Fase 10** — Audit finale

## 6. Prossima fase

**Fase 2 — Design System e UI Core.** Punto di partenza: il piano dei componenti (§4) e i design token (§5) del documento di architettura Fase 1, da trascrivere in codice reale (HTML/CSS/JS) rispettando rigorosamente le convenzioni di naming definite (§3) e la struttura cartelle (§1). Ogni componente va validato in Light e Dark e verificato per accessibilità (contrasto, focus, `prefers-reduced-motion`) prima di considerarlo concluso.

## 7. Prompt di continuità

```
Stai riprendendo lo sviluppo di SOCIALIVE (rinominato in fase di progetto "SocialAlive - Interactive Cybersecurity Learning Platform"), una piattaforma didattica per la formazione in Cybersecurity, usata esclusivamente dal docente e proiettata in classe. Non è un social network reale né un clone di piattaforme esistenti: deve solo sembrarlo, con massimo realismo, senza alcun elemento "scolastico" visibile.

RUOLO: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Non comportarti come un chatbot: ragiona come un membro senior di un team di sviluppo, privilegiando sempre semplicità, scalabilità, manutenibilità, leggibilità, riutilizzabilità, performance e accessibilità. Motiva ogni decisione.

STACK: esclusivamente HTML5, CSS3, JavaScript ES6+. Nessun framework, nessuna libreria UI (no React/Vue/Angular/Bootstrap/Tailwind/jQuery). Predisposizione futura per GitHub e Supabase (auth, profili, impostazioni), senza implementarla ancora se non specificato.

STATO ATTUALE: la Fase 1 (Fondamenta del progetto) è completata — solo progettazione, nessun codice scritto. Decisioni vincolanti prese:

- STRUTTURA CARTELLE: assets/ (images/ui, images/scenarios/<id>, icons, fonts) · css/ (tokens/, themes/theme-light.css+theme-dark.css, base/, components/, layouts/) · js/ (app.js, core/ [router.js, state.js, eventBus.js], components/, pages/, scenarios/scenarioEngine.js, services/, repositories/, adapters/, utils/, config/) · data/ (config.json, themes.json, navigation.json, modules.json, roles.json, users.json, settings.json, notifications.json, localization/it.json, scenarios/<id>/).

- ARCHITETTURA: livelli Presentation (components/pages) → Application (services) → Data (repositories → adapters) → Core (router/state/eventBus). Dipendenza sempre unidirezionale verso il basso. I componenti sono funzioni factory che restituiscono { element, update(props), destroy() }, nessun Web Component/Shadow DOM (frizione col theming CSS Variables). Stato condiviso minimale via state.js + eventBus.js per comunicazioni decoupled.

- NAMING: cartelle kebab-case; file componente PascalCase (es. AppHeader.js); file servizio camelCase (es. themeService.js); CSS file kebab-case; classi CSS in BEM con prefisso "sl-" (es. sl-card__title); custom properties "--sl-{categoria}-{nome}"; variabili JS camelCase; costanti UPPER_SNAKE_CASE; eventi custom "sl:nome-evento"; data-* e id kebab-case; chiavi JSON camelCase.

- COMPONENTI PIANIFICATI (da implementare in Fase 2): AppHeader (unifica Header/TopBar/Navbar), Sidebar, ProfileMenu, Button, Modal (incl. variante Dialog), Toast, Card, PostCard, Avatar, Badge, Chip, Dropdown, Tabs, Input, SearchInput, Loader, Skeleton, ProgressBar, ThemeSwitch, EmptyState, ErrorState, PageContainer, ScrollArea, Feed. Differiti a fasi successive: StoriesBar, Timeline, MediaViewer.

- DESIGN SYSTEM (token da tradurre in CSS in Fase 2): colori semantici (--sl-color-bg-canvas/surface/elevated, --sl-color-text-primary/secondary/inverse, --sl-color-primary-500/600, --sl-color-success/warning/error/info-500, --sl-color-focus-ring), tipografia a scala modulare (--sl-font-size-xs..3xl), spaziature a grid 4px (--sl-space-1..12), radius (--sl-radius-sm/md/lg/full), ombre (--sl-shadow-1/2/3), motion (--sl-duration-fast/base/slow, rispetto di prefers-reduced-motion), icone come sprite SVG unico, breakpoint (480/768/1024/1280) documentati come costanti (non custom properties, per limite tecnico CSS su @media). Contrasto minimo WCAG AA.

- TEMI: Light/Dark tramite attributo data-theme sull'<html>, valori cromatici in css/themes/theme-*.css, resto dei token condiviso in css/tokens/. Persistenza oggi via localStorage (storage.js), domani via Supabase, stessa interfaccia. Fallback su prefers-color-scheme, poi Light. Script inline anti-FOUC nell'head.

- ROUTING: hash-based (#/login, #/home, #/modules, #/scenario/:id, #/settings, #/404), isolato in core/router.js, guard di autenticazione su tutte le rotte protette.

- LOGIN: form → validazione client-side di formato → authService.login() → oggi localAuthAdapter su users.json, domani supabaseAuthAdapter, stessa interfaccia. Ruoli: docente (attivo), admin (predisposto). Sessione persistita via storage.js, guard nel router, logout con evento sl:auth-logout.

- JSON PIANIFICATI: config.json, themes.json, navigation.json, modules.json, roles.json, users.json, settings.json, notifications.json, localization/it.json, data/scenarios/<id>/scenario.json (+ profile/feed/posts/stories per Oversharing, popolati in Fase 6).

- SCALABILITÀ: Scenario Engine legge scenario.json (campo "type", es. "profile-timeline") e sceglie il renderer generico già esistente; un nuovo scenario simile richiede solo nuovi JSON + voce in modules.json, zero modifiche al codice esistente.

REGOLE DI PROCESSO: procedere per piccoli step, una fase alla volta, mantenendo sempre compatibilità con quanto già deciso qui sopra; motivare ogni scelta architetturale nuova prima di implementarla; usare dati esterni (JSON) quando possibile; al termine di questa fase produrre di nuovo il documento di handover completo (stato, obiettivi completati, architettura attuale, decisioni progettuali, attività rimanenti, prossima fase, prompt di continuità, test da eseguire, criticità, debito tecnico).

RICHIESTA PER QUESTA CONVERSAZIONE: procedi con la Fase 2 — Design System e UI Core (Prompt #2 della suite), implementando concretamente in HTML/CSS/JS i componenti core elencati sopra, rispettando rigorosamente struttura, naming e token qui riportati, garantendo accessibilità WCAG e responsive fin da subito, senza ancora implementare autenticazione reale, routing multi-pagina completo o lo scenario Oversharing.
```

## 8. Test da eseguire

Poiché la Fase 1 è puramente di progettazione e non è stato prodotto alcun codice eseguibile, i test classici non sono applicabili in questa fase. Di seguito una checklist di **validazione documentale**, più il template standard che verrà applicato a partire dalla Fase 2.

**Validazione documentale (Fase 1 — eseguibile ora)**
- [ ] Ogni cartella nel piano ha uno scopo univoco e non sovrapposto ad altre.
- [ ] Ogni componente elencato ha responsabilità, input, eventi e dipendenze definiti senza ambiguità.
- [ ] Nessun componente duplica la funzione di un altro (verificato: Header/TopBar/Navbar unificati, Modal/Dialog unificati).
- [ ] Ogni file JSON pianificato ha uno scopo chiaro e non si sovrappone ad altri file.
- [ ] Le convenzioni di naming sono applicabili in modo coerente a tutti gli ambiti (file, CSS, JS, JSON, asset).

**Template standard (a partire dalla Fase 2)**

*Test funzionali*: ogni componente implementato si comporta secondo la specifica del piano (input/eventi/output).
*Test UI*: layout, responsive, spaziature, allineamenti, temi Light/Dark, comportamento dei componenti.
*Test UX*: fluidità, semplicità d'uso, coerenza, naturalezza delle interazioni.
*Test tecnici*: console priva di errori/warning, corretto caricamento risorse, JS funzionante, nessun percorso errato.
*Test di regressione*: nessuna funzionalità precedente compromessa dalle nuove implementazioni.

## 9. Criticità

- L'assenza di un framework impone disciplina extra nel mantenere la separazione delle responsabilità man mano che le fasi si accumulano: rischio più umano/organizzativo che tecnico. Suggerimento: introdurre in una fase successiva (Fase 9/10) un semplice linting (es. ESLint) come dev-dependency opzionale, senza bundler, solo per coerenza di stile.
- Nessun'altra criticità rilevata: essendo questa fase priva di codice, non ci sono comportamenti da verificare.

## 10. Debito tecnico

### Compromessi temporanei
Nessuno: non è stato scritto codice in questa fase.

### Refactoring consigliati
Non applicabile: non esiste ancora codice da refattorizzare.

### Ottimizzazioni future
- Valutare, se il numero di scenari crescerà molto (oltre la decina), la suddivisione di `modules.json` per categoria per evitare un file monolitico troppo grande — soluzione già compatibile con l'architettura attuale.
- Validare il lazy-loading dei JSON di scenario con dati reali, quando lo scenario Oversharing sarà implementato (Fase 6).

### Rischi architetturali
| Rischio | Priorità | Motivazione |
|---|---|---|
| Migrazione da routing hash-based a History API, se in futuro servissero URL "puliti" condivisibili | 🟡 Media | Mitigato dall'isolamento della logica in un solo modulo (`router.js`) |
| Incapsulamento CSS solo "a convenzione" (namespace `sl-`), non nativo come nei Web Components | 🟡 Media | Mitigato dalla disciplina nelle convenzioni di naming definite al §3 |
| Possibile "drift" tra questa documentazione architetturale e l'implementazione reale nelle fasi successive | 🔴 Alta | È il rischio più concreto oggi: va mitigato validando ogni nuova fase contro questo documento prima di procedere, come previsto dalle regole di progetto |
| Struttura dati JSON piatta per gli scenari, da rivalidare oltre una decina di scenari | 🟢 Bassa | Soluzione di mitigazione già prevista (suddivisione per categoria) |

### Obiettivo
Nessun debito tecnico reale è stato introdotto, in quanto questa fase non ha prodotto codice. Il rischio principale da monitorare nelle fasi successive è la fedeltà dell'implementazione rispetto alle decisioni qui documentate.
