SOCIALIVE — Fase 9: Audit di Rifinitura UX

Ho eseguito l'audit non sulla base della documentazione delle fasi precedenti, ma leggendo e verificando (grep/inspection) il codice reale dei tre file coinvolti nelle pagine effettive (router.js, homePageController.js, scenarioPageController.js → appShell.js/PageContainer.js/profileTimelineRenderer.js, oltre ai componenti che compongono). Dove un dubbio poteva essere verificato tecnicamente invece che "a occhio", l'ho verificato — stesso principio già seguito nel progetto per il contrasto colore.

Nessuna riga di codice è stata ancora scritta, come richiesto.

1. Animazioni
Riscontro	Evidenza	Valutazione
Nessuna transizione tra rotte — router.js.mount() smonta e rimonta sincronamente, zero opacity/transform	grep "opacity|transition|animation" router.js → nessun risultato	Il Prompt #9 chiede esplicitamente di ottimizzare le animazioni: un cambio pagina "a scatto" è l'unico punto dell'intera app in cui non c'è alcuna cura di transizione, in contrasto con la cura mostrata ovunque altrove (Modal, MediaViewer, ThemeSwitch).
Disciplina dei token di motion: solida	Nessuna durata hardcoded fuori da --sl-duration-*, eccetto le due eccezioni già motivate e documentate (Skeleton 1.6s, Loader 0.8s), entrambe comunque azzerate dalla rete di sicurezza generale in global.css	Nessun intervento necessario — lo cito per onestà del metodo (l'audit non deve trovare problemi a tutti i costi).
Nessun fade-in al caricamento immagine reale	PostCard.js/profileTimelineRenderer.js: l'<img> non ha alcun listener "load" per una transizione di opacità (solo MediaViewer lo fa, per il Loader)	Rischio di "pop-in" visibile proprio quando le 18 immagini reali di Oversharing (oggi placeholder) verranno caricate — il momento in cui conta di più.
2. Performance
Riscontro	Evidenza	Valutazione
CLS: immagine del post senza dimensioni riservate	post-card.css → .sl-post-card__media-image { width:100%; max-height:520px; object-fit:cover; }, nessun aspect-ratio, nessun width/height sull'<img>	Reale rischio di salto di layout quando le foto reali (rapporti d'aspetto variabili) sostituiranno i placeholder. Timeline/profile-timeline (avatar, cover) sono invece già a dimensione fissa riservata — solo il Feed ne è privo.
loading="lazy" presente solo in Timeline.js	grep "loading" *.js → un solo risultato, Timeline.js:139	PostCard.js (Home e Oversharing) carica le immagini eager. Basso costo, beneficio reale non appena i feed avranno più post.
svgNode() duplicata verbatim in 3 file	Loader.js:42, MediaViewer.js:108, PostCard.js:95 — stessa identica implementazione	Debito DRY concreto, non teorico: tre copie da tenere sincronizzate finché non esisterà lo sprite.
Costruttore di messaggio di fallback duplicato in 3 file	router.js (renderNotFound), scenarioEngine.js (buildFallbackMessage), profileTimelineRenderer.js (buildErrorMessage) — le ultime due sono identiche byte per byte	Vedi anche §5: questa duplicazione ha già prodotto un'incoerenza visiva reale, non solo un rischio teorico.
33 richieste <link rel="stylesheet"> + 7 moduli JS per pagina	grep -c su index.html	Non intervengo: bundlare richiederebbe un build step, in contrasto con il vincolo esplicito "nessun bundler" fissato in Fase 1. Su GitHub Pages (HTTP/2) l'impatto reale per un'app a singolo utente è marginale. Da monitorare, non da risolvere ora.
3. Responsive
Riscontro	Evidenza	Valutazione
Range 768–1024px: mai verificato con screenshot reali	Segnalato come apertura ricorrente in 4 handover consecutivi (Fase 4→8); nessuna media query dedicata esiste oltre ai 767px	Analizzando il CSS (nessuna larghezza fissa oltre ai 240px della Sidebar; tutto il resto è flex/minmax/max-width centrato) il layout dovrebbe degradare in modo fluido — ma è un'assunzione basata sulla lettura del codice, non una verifica. Va chiusa con screenshot reali in questa fase.
Nessuna regressione di layout individuata analizzando il CSS	—	Nessun bug reale trovato, solo l'assenza di una prova — coerente con l'onestà richiesta dal progetto.
4. Accessibilità
Riscontro	Evidenza	Valutazione
Skip link mai implementato	global.css:46 — la utility .sl-visually-hidden cita esplicitamente "skip-link" come caso d'uso previsto fin da Fase 2, ma nessun componente lo usa per questo	WCAG 2.4.1 (Bypass Blocks). Impatto reale modesto (un solo link abilitato in Sidebar oggi), ma è un requisito tecnicamente non soddisfatto nonostante fosse già "preventivato" nell'architettura.
document.title mai aggiornato per rotta	grep -rln "document.title" → nessun file	WCAG 2.4.2 (Page Titled), e coincide con l'obiettivo di realismo: un vero social aggiorna il titolo della scheda del browser. Doppio beneficio con un solo intervento.
Home priva di <h1>	Login (LoginForm.js:159) e pagina di scenario (profileTimelineRenderer.js:135) hanno un <h1>; homePageController.js no — solo un <h2> ("Moduli")	Struttura di intestazioni incoerente tra le tre pagine reali.
Navigazione da tastiera end-to-end mai ripercorsa per intero	Aperto fin da Fase 4, mai chiuso	Ogni singolo componente è verificato isolatamente; manca solo la prova del percorso completo Sidebar→Moduli→Feed→MediaViewer.
5. Coerenza visiva
Riscontro	Evidenza	Valutazione
Bug reale (non solo debito): "Pagina non trovata" è visivamente diverso dagli altri due messaggi di fallback	router.js imposta solo padding; scenarioEngine.js/profileTimelineRenderer.js impostano anche color: var(--sl-color-text-secondary) e font-size: var(--sl-font-size-md)	Il 404 del router eredita quindi colore/dimensione di default invece del trattamento "soft" usato ovunque altrove per gli stati non felici — diretta conseguenza della duplicazione di cui al punto Performance.
Tutto il resto verificato coerente: token, elevazioni, stroke delle icone, badge di stato	Ispezione trasversale di tutti i CSS coinvolti	Nessun'altra deriva visiva trovata.
Elenco interventi con priorità
#	Intervento	Area	File coinvolti
1	🔴 Estrarre un unico buildFallbackMessage() condiviso e farlo usare a router.js/scenarioEngine.js/profileTimelineRenderer.js	Performance + Coerenza visiva	nuovo js/utils/fallbackMessage.js + 3 file
2	🔴 Riservare lo spazio dell'immagine del post (aspect-ratio + attributo loading="lazy") prima dell'arrivo delle foto reali	Performance	post-card.css, PostCard.js
3	🔴 Estrarre svgNode() in un'unica utility condivisa	Performance	nuovo js/utils/svg.js, Loader.js, PostCard.js, MediaViewer.js
4	🟡 Aggiungere un <h1> (visivamente nascosto o non) alla Home	Accessibilità	homePageController.js
5	🟡 Aggiornare document.title ad ogni cambio di rotta	Accessibilità + Realismo	router.js
6	🟡 Implementare lo skip-link previsto da Fase 2	Accessibilità	PageContainer.js o appShell.js
7	🟡 Introdurre una transizione leggera (fade) tra le pagine in router.js	Animazioni	router.js
8	🟡 Chiudere la verifica del range 768–1024px con screenshot reali	Responsive (test)	— (solo verifica)
9	🟡 Percorrere l'intero flusso da tastiera Home→Scenario→MediaViewer	Accessibilità (test)	— (solo verifica)
10	🟡 Decidere e avviare la persistenza della suite Playwright (tests/)	Processo	vedi sotto
11	🟢 Fade-in delle immagini al caricamento	Animazioni	PostCard.js, profileTimelineRenderer.js
12	🟢 Micro-transizione di apertura per ProfileMenu	Animazioni	profile-menu.css
13	🟢 Monitorare (non agire) le 33 richieste CSS separate	Performance	—
Valutazione: persistere la suite Playwright in tests/

Sì, questo è il momento giusto, per tre motivi concreti:

Il debito è ricorrente da 7 fasi (~250+ controlli eseguiti e mai salvati) — Fase 9 è per definizione la fase di "rifinitura", non di nuove funzionalità: è il contesto più coerente per questo lavoro, prima che Fase 10 (Audit finale) debba fare una revisione senza una rete di sicurezza automatizzata.
Introdurre tests/ con package.json/playwright come devDependency non viola il vincolo "nessun framework/build tool": quel vincolo riguarda l'app consegnata su GitHub Pages, non gli strumenti di sviluppo — tests/ non verrebbe mai servito né referenziato da index.html.
È il momento più economico per farlo: gli interventi 1–9 sopra genereranno comunque nuovi script Playwright ad-hoc: scriverli direttamente dentro tests/ invece che come script temporanei costa zero in più.

Proposta minima (da confermare, non ancora implementata): tests/ con un file per pagina reale (login.spec.js, home.spec.js, scenario.spec.js) + un helper comune per avviare il server locale, eseguibili con un unico comando Node — nessuna riscrittura dei controlli già fatti, solo la loro prima persistenza a partire da questa fase in avanti.

Prossimo step

Propongo di procedere nell'ordine 1→2→3 (i tre 🔴, che sono anche la base per correggere il bug reale del 404), poi i 🟡 uno per turno, chiudendo per ultimi gli item di sola verifica (8, 9) una volta stabile la suite in tests/.

Confermi questo ordine, o preferisci iniziare da un punto diverso?

confermo, vai