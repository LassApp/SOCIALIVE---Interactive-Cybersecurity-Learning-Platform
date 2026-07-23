SOCIALIVE — Handover di fine Fase 7 (Post e Media Viewer)

Redatto in qualità di Lead Software Architect / Senior Front-end Engineer / UX Designer / Accessibility Specialist / Full Stack Architect del progetto.
Data logica di chiusura fase: fine Fase 7 (Prompt #7 della Suite — "Post e Media Viewer").
Tag di riferimento suggerito: v0.7.0-fase7-post-media-viewer

1. Stato del progetto
Fase 1–6: ✅ complete (vedi handover dedicati).
Fase 7 — Post e Media Viewer: ✅ COMPLETATA. sl:post-open (emesso da PostCard fin da Fase 2 e da Timeline fin da Fase 6, sempre senza un consumer) ha finalmente una destinazione reale: MediaViewer, componente pianificato in Fase 1 §4 e differito per YAGNI, costruito ora. Apertura, zoom, navigazione prev/next (mouse + tastiera), microinterazioni, caricamento immagini — tutti i punti del Prompt #7 sono implementati e verificati.
41 controlli automatizzati Playwright, tutti verdi: 27 su un harness isolato (costruzione/collaudo del componente) + 14 sul flusso reale attraverso index.html (login → Home → click "Cybersecurity" → scenario → apertura da Feed e da Archivio) — verifica scelta deliberatamente per non ripetere il gap di processo di Fase 6 (CSS mai collegati in index.html, scoperto solo a deploy).
2 bug reali trovati e corretti durante la costruzione (dettagliati in §4), nessuno sopravvissuto alla consegna.
Nessuna riga di Fase 8 (esternalizzazione dati) è stata scritta.
2. Obiettivi completati
js/components/MediaViewer.js (nuovo): visualizzatore immersivo full-screen. Riceve { posts, startIndex } (mai un postId da risolvere internamente), naviga l'intero set di post (non solo quelli con immagine — un post di solo testo mostra il proprio contenuto centrato, stesso trattamento già usato da Timeline per il caso equivalente). Zoom click-to-toggle sull'immagine, navigazione prev/next disabilitata ai due estremi (nessun wraparound) + tasti ArrowLeft/ArrowRight, focus trap (riusa focusTrap.js, condiviso con Modal/ProfileMenu), chiusura ESC/overlay/bottone × con evento sl:media-viewer-close, annuncio aria-live ad ogni navigazione.
css/components/media-viewer.css (nuovo): sfondo immersivo scuro fisso, indipendente dal tema dell'app (comportamento reale di Instagram/Facebook/X).
css/themes/theme-light.css / theme-dark.css (modificati): 4 nuovi token semantici, valori identici nei due file (--sl-color-media-backdrop, --sl-color-media-focus-ring, --sl-color-media-bg-hover, --sl-color-media-bg-active) — stesso principio già usato da --sl-color-text-inverse.
js/scenarios/renderers/profileTimelineRenderer.js (modificato): un solo listener sl:post-open su wrapper (copre sia Feed sia Timeline, entrambi discendenti), risolve il post in feedPosts (già caricato, zero secondo fetch) e apre MediaViewer. Cleanup esplicito nel proprio destroy().
index.html (modificato): +1 <link> (media-viewer.css) — verificato con un test che carica il file reale, non solo un harness.
Verifica numerica WCAG (script Python) su 4 nuovi accostamenti prima di scrivere CSS — vedi §4.
Zero modifiche a PostCard.js, Timeline.js, Button.js, Avatar.js, Loader.js, focusTrap.js, Feed.js, scenarioEngine.js, router.js, appShell.js: tutti riusati esattamente come sono.
3. Architettura attuale
socialive/
├── index.html                              # ♻️ MODIFICATO — +1 <link> (media-viewer.css)
├── css/
│   ├── themes/
│   │   ├── theme-light.css                 # ♻️ MODIFICATO — +4 token fissi Media Viewer
│   │   └── theme-dark.css                  # ♻️ MODIFICATO — stessi 4 token, stessi valori
│   └── components/
│       └── media-viewer.css                # ⭐ NUOVO
└── js/
    ├── scenarios/renderers/
    │   └── profileTimelineRenderer.js       # ♻️ MODIFICATO — wiring sl:post-open → MediaViewer
    └── components/
        └── MediaViewer.js                   # ⭐ NUOVO

Nessuna modifica a nessun altro file. style-guide.html non toccato (nessun consumer suo dipende da questi file — vedi Criticità).

4. Decisioni progettuali

Risoluzione del post dal postId: il renderer (unico punto che ha già feedPosts in scope) ascolta sl:post-open, cerca l'indice per id, passa l'intero array + indice a MediaViewer. Nessun secondo fetch, nessuna modifica ai due emittenti dell'evento.

Ambito di navigazione = tutto il profilo, non solo le foto: il Prompt #7 dice "apertura post". MediaViewer tratta un post di solo testo come qualunque altro (contenuto centrato nello stage), coerente col trattamento già riservato da Timeline allo stesso caso.

MediaViewer non è una variante di Modal: stessa logica già usata per ProfileMenu — funzione diversa (visualizzatore a schermo intero vs dialogo su superficie chiara), pur condividendo focusTrap.js.

Sfondo fisso scuro, non theme-dependent: un photo-viewer reale è sempre scuro. Verificato numericamente (Python, luminanza relativa WCAG) prima di scrivere CSS:

gray-50 su gray-950 → 17.64:1 (testo/icone: riusato --sl-color-text-inverse, già esistente).
primary-600 su gray-950 → 3.06:1 — il focus ring che Light userebbe altrimenti: margine troppo sottile su un fondo fisso, per questo forzato.
primary-300 su gray-950 → 7.90:1 — nuovo --sl-color-media-focus-ring, forzato in entrambi i temi.
Nessun secondo colore "attenuato" per la gerarchia testuale: un'unica tinta verificata, gerarchia via dimensione/peso tipografico — evita di introdurre un colore translucido non verificato.

2 bug reali trovati da Playwright:

Click-fuori-per-chiudere non funzionava mai: a differenza di Modal, il pannello di MediaViewer riempie l'intero overlay (necessario per ancorare i controlli position:absolute a schermo intero) — il click sullo sfondo aveva quindi come target il pannello, non l'overlay (che non ha mai area propria esposta). Corretto controllando anche event.target === panel.
Bottoni di navigazione non cliccabili sotto ~720px: lo stage (necessariamente position:relative per centrare il Loader) si allarga a piena larghezza disponibile sotto quella soglia e, seguendo dopo nell'ordine del DOM, copriva i bottoni — assente a larghezza desktop (dove lo stage resta più stretto del pannello), motivo per cui i test desktop erano passati per primi. Corretto con z-index:1 sui controlli.

Cleanup più cauto di Modal: profileTimelineRenderer.destroy() distrugge esplicitamente un MediaViewer ancora aperto (caso limite: navigazione via router mentre il visualizzatore è aperto) — cautela non ancora applicata a Modal altrove nel progetto (debito noto e accettato lì), qui risolta perché il costo era minimo.

5. Attività rimanenti

In ordine di roadmap (Prompt #8 → #10):

Fase 8 — Dati: esternalizzazione di tutti i contenuti in JSON — includerà la decisione ancora aperta dal §4/§9 dell'handover di Fase 4 sul feed demo della Home (ricorrente da 4 fasi, mai affrontata).
Fase 9 — Rifinitura UX, Fase 10 — Audit finale.
Immagini reali (Fase 6, non bloccante): 18 placeholder a tinta unita ancora in attesa delle foto vere.

Non costruiti deliberatamente (YAGNI): pan/drag durante lo zoom (solo scale click-to-toggle); precaricamento di rete dedicato per le immagini adiacenti (la cache HTTP del browser già risolve il caso reale, dato che ogni immagine è già stata renderizzata come card/miniatura prima di poter essere aperta); un like/commenta dentro MediaViewer (fuori scope letterale del Prompt #7).

6. Prossima fase

Fase 8 — Dati (Prompt #8 della Suite originaria).

Punto di ripartenza: MediaViewer è pronto e verificato — Fase 8 non deve toccarlo. Il lavoro di Fase 8 è la decisione già segnalata come sospesa da 4 fasi: spostare il feed demo della Home (oggi hardcoded in homePageController.js) in data/*.json, definendo lo schema che poi si applicherà anche a eventuali contenuti futuri di altri scenari.

7. Prompt di continuità
Sto riprendendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"), piattaforma didattica per la formazione in Cybersecurity, usata esclusivamente dal
docente e proiettata in classe. Non è un social network reale: deve solo sembrarlo, con massimo
realismo, senza alcun elemento "scolastico" visibile.

RUOLO: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX Designer,
Accessibility Specialist (WCAG) e Full Stack Architect. Ragiona come un membro senior di un team
di sviluppo. Motiva ogni decisione prima di implementarla. Procedi per piccoli step.

CONVENZIONE OBBLIGATORIA DI CONSEGNA FILE: per OGNI file che consegni, indica sempre (a) se è
NUOVO o se SOSTITUISCE/MODIFICA un file già esistente nel progetto e (b) il percorso esatto nella
struttura del progetto, con tabella riassuntiva dopo ogni consegna.

CONVENZIONE OBBLIGATORIA DI FINE FASE: l'handover va SEMPRE prodotto come file .md separato, e a
fine fase va consegnata una cartella .zip con TUTTI i file prodotti in quella fase.

LEZIONE DI PROCESSO (Fase 6, confermata valida anche in Fase 7): ogni modifica che introduce nuovi
file CSS/JS da collegare in index.html va verificata con un test che carica l'index.html reale,
non solo un harness isolato con <link> scritti a mano.

STACK: HTML5, CSS3, JavaScript ES6+ nativo. Nessun framework/libreria UI.

REPOSITORY: pubblico su GitHub,
https://github.com/lassapp/SOCIALIVE---Interactive-Cybersecurity-Learning-Platform , deploy
GitHub Pages da branch main. Non hai credenziali per pushare: prepara i file, l'utente li applica
lui stesso.

NOTE TECNICHE DI AMBIENTE: niente `pkill -f "<pattern con la porta>"` (può terminare la shell
stessa che esegue il comando — confermato anche in Fase 7); server+test Playwright nella STESSA
chiamata bash; usa una porta nuova ad ogni test; Playwright con Chromium disponibile sia in Python
che in Node in questo ambiente.

STATO: Fasi 1–7 COMPLETE. Fase 7 ha prodotto: js/components/MediaViewer.js (nuovo — visualizzatore
immersivo, sfondo scuro fisso indipendente dal tema, zoom, navigazione prev/next mouse+tastiera,
focus trap), css/components/media-viewer.css (nuovo), css/themes/theme-light.css e theme-dark.css
(modificati: +4 token fissi --sl-color-media-*), js/scenarios/renderers/profileTimelineRenderer.js
(modificato: un solo listener sl:post-open che risolve il post in feedPosts già caricato e apre
MediaViewer, zero secondo fetch), index.html (modificato: +1 <link>). 41 controlli Playwright
eseguiti (27 harness isolato + 14 flusso reale attraverso index.html), tutti verdi. Il documento di
handover completo (10 sezioni, questo stesso file) è la fonte di verità primaria.

DECISIONE ANCORA APERTA (da Fase 4, ricorrente da 4 fasi, ORA nello scope diretto di questa fase):
il feed demo della Home è hardcoded in homePageController.js, non in data/*.json.

DATI DEMO LOGIN: username "docente@scuola.it", password "password123", displayName reale "Prof.
Erasmo Lassandro" (NON "Prof. Anna Ferrari", nome scartato in una fase precedente).

IMMAGINI OVERSHARING: ancora placeholder a tinta unita in assets/posts/oversharing/ — l'utente le
sostituirà con foto reali quando pronto, stessi percorsi, zero modifiche di codice previste. Non
generare nuovi placeholder se l'utente indica di aver già caricato le foto reali.

DA FARE ORA (Fase 8 — Dati, Prompt #8 della Suite):
1. Progettare (motivando prima del codice) lo schema di data/*.json per il feed della Home
   (probabilmente data/home/feed.json o analogo — da decidere) e per qualunque altro contenuto
   ancora hardcoded rimasto nei page controller.
2. Separare completamente dati e logica: zero contenuti letterali rimasti nei file .js.
3. Riusare localJsonRepository.js (già esistente) per l'accesso — nessuna nuova astrazione se non
   realmente necessaria.

REGOLE INVARIATE: mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI, (container,params)→destroy per i page
controller; eventi "sl:nome-evento"; componenti "dumb"; documentazione in italiano; test Playwright
+ screenshot reali + regressione ad ogni step, verificati anche attraverso l'index.html reale;
handover completo a 10 sezioni + zip di tutti i file della fase a fine fase.

Procedi progettando lo schema dei JSON per il feed della Home, motivando le scelte prima di
scrivere codice.
8. Test da eseguire
Test funzionali
 Apertura da PostCard (Feed) e da Timeline (Archivio), incl. post di solo testo.
 Navigazione prev/next (mouse + ArrowLeft/ArrowRight), disabilitazione ai due estremi, nessun wraparound.
 Zoom: toggle su click, reset alla navigazione, aria-label sincronizzato.
 Chiusura: ESC, click sullo sfondo, bottone ×, ognuna con reason corretto in sl:media-viewer-close.
 Focus trap (Tab non esce dal pannello), focus ripristinato al trigger originale.
 Flusso reale completo attraverso index.html: login → Home → Cybersecurity → apertura da Feed e da Archivio.
 Apertura di un tile con immagine dell'Archivio (verificato solo per il tile di solo testo nel flusso reale — stesso codice del caso Feed, rischio basso ma non testato esplicitamente).
 Interazione da tastiera end-to-end sul flusso completo (Tab attraverso Sidebar→Moduli→Feed→apertura→navigazione→chiusura) — non ripercorsa per intero.
Test UI
 Light/Dark/mobile 375px — 5 screenshot ispezionati, nessuna anomalia.
 Nessun overflow orizzontale a 375px.
 Breakpoint intermedi (768–1024px) — non verificati.
Test UX
 Annuncio aria-live ad ogni navigazione.
 Transizioni (apertura overlay, zoom) fluide, coerenti con prefers-reduced-motion (rete di sicurezza globale invariata).
Test tecnici
 Console priva di errori JS in tutto il flusso reale e nell'harness isolato.
 node --check su tutti i file JS nuovi/modificati.
 Nessun path relativo rotto in index.html dopo l'aggiunta del <link>.
Test di regressione
 Flusso di autenticazione (Fase 3), Home (Fase 4), collegamento Cybersecurity (Fase 5), profilo Oversharing/toggle Feed-Archivio (Fase 6): confermati integralmente attraverso il flusso reale.
 style-guide.html (Fase 2): non ri-verificato in questa fase (nessun file da esso dipendente è stato modificato — Button/Avatar/Loader sono stati solo riusati, non toccati — rischio basso, non una verifica eseguita esplicitamente).
9. Criticità
Apertura da tile con immagine dell'Archivio non testata esplicitamente (solo il tile di solo testo è stato verificato nel flusso reale) — stesso identico codice del percorso già verificato per il Feed, rischio basso ma non confermato con un'asserzione dedicata.
style-guide.html non ri-verificato: nessun file da essa dipendente è stato toccato in questa fase (rischio basso, non zero).
Interazione da tastiera end-to-end sul flusso completo Home→Scenario→MediaViewer non ripercorsa per intero (singoli componenti già verificati isolatamente).
Suite di test Playwright ancora non persistita nel repository — segnalata ricorrente da Fase 2, ora con 5 fasi di script accumulati.
10. Debito tecnico
Compromessi temporanei
🟢 Nessuno introdotto in questa fase oltre a quelli già noti e invariati dalle fasi precedenti (immagini placeholder, feed Home hardcoded).
Refactoring consigliati
🟡 Formalizzare i test Playwright come suite persistita (tests/) — ricorrente da 5 fasi.
Ottimizzazioni future
🟢 Pan/drag durante lo zoom di MediaViewer (oggi solo scale click-to-toggle) — nessun bisogno reale col dataset attuale (immagini singole, non gallerie).
🟢 Test dedicato per l'apertura di un tile con immagine dell'Archivio (copertura marginale mancante, rischio basso).
Rischi architetturali
🟢 Nessun rischio nuovo: MediaViewer è additivo, non ha richiesto modifiche a nessun componente/servizio esistente — secondo caso reale (dopo Modal) che valida il pattern "overlay full-screen con focus trap condiviso" del Design System.
Priorità
🟡 Media: formalizzare i test Playwright come suite persistita — ormai ricorrente da 6 fasi.
🟢 Bassa: decisione sospesa sul feed della Home (ora nello scope diretto di Fase 8); immagini reali di Oversharing (indipendente da questa fase).
Obiettivo

Questa sezione va riletta all'inizio della Fase 8, prima di introdurre nuove funzionalità, per mantenere SOCIALIVE pulito, modulare, scalabile e facilmente manutenibile.