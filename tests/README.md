# SOCIALIVE — Suite di test end-to-end

Suite Playwright persistita nel repository (Fase 9, intervento #10 — segnalata come
debito tecnico ricorrente dalla Fase 2). **Strumento di sviluppo**: non fa parte
dell'app spedita, non è mai referenziata da `index.html`, non richiede alcun bundler
per l'app reale (il vincolo "nessun framework/bundler" del progetto riguarda l'app
consegnata su GitHub Pages, non gli strumenti di sviluppo).

## Perché niente `@playwright/test`

Ogni fase precedente ha già verificato l'app con script Playwright "grezzi"
(`chromium.launch()` diretto, nessun framework di test). Questa suite persiste
esattamente lo stesso approccio — introdurre ora un intero test runner con la
propria configurazione sarebbe complessità aggiuntiva senza un bisogno reale per
tre pagine (KISS).

## Come eseguirla

Prerequisiti: Node.js e il pacchetto `playwright` con Chromium già installato
(`npx playwright install chromium` se non fosse già disponibile nell'ambiente).

```bash
cd tests
npm install        # solo la prima volta, installa playwright come devDependency
npm test           # esegue le tre suite in sequenza (login, home, scenario)

# oppure singolarmente:
npm run test:login
npm run test:home
npm run test:scenario
```

Ogni suite avvia da sé un server statico locale su una porta libera
(`helpers/server.js`, nessuna dipendenza esterna) — non serve avviare nulla a mano,
né usare `python -m http.server` come nelle verifiche manuali delle fasi precedenti.

Gli screenshot generati durante l'esecuzione vengono scritti in `tests/screenshots/`
(esclusa da Git — sono artefatti di una singola esecuzione, non contenuto versionato).

## Struttura

```
tests/
├── package.json
├── helpers/
│   ├── server.js      # server statico minimale (http/fs/path nativi)
│   ├── testKit.js      # micro-runner (createSuite/test/summary)
│   └── auth.js         # login reale via UI, riusato da home/scenario
├── login.spec.js        # bootstrap, guardie di sessione, validazione, 404
├── home.spec.js         # composizione Home, moduli, feed, skip-link, ProfileMenu
├── scenario.spec.js     # profilo Oversharing, toggle Feed/Archivio, MediaViewer,
│                          flusso completo da tastiera Home→Scenario→MediaViewer
└── run-all.js            # esegue le tre suite in sequenza, riepilogo aggregato
```

## Cosa copre (stato a fine Fase 9)

- **login.spec.js**: bootstrap sensibile alla sessione, guardia su `#/home`,
  validazione di formato (submit vuoto, email malformata), credenziali errate/
  corrette, persistenza della sessione al reload, redirect simmetrico da
  `#/login` già autenticato, logout, "Pagina non trovata" (incl. verifica dello
  stile — bug reale corretto in Fase 9), `document.title` per rotta, transizione
  di rotta, screenshot Light/Dark/mobile.
- **home.spec.js**: struttura pagina, `<h1>` nascosto, 6 `ModuleCard` (solo
  Cybersecurity disponibile), Feed con 3 post (autori reali, **mai** "Prof. Anna
  Ferrari" — regressione esplicita), fallback avatar a iniziali, `aspect-ratio`/
  `loading=lazy` sull'immagine del post, toggle "mi piace", skip-link (WCAG
  2.4.1), ProfileMenu, screenshot incl. il range 768–1024px (mai chiuso con
  screenshot reali nelle fasi precedenti), remount pulito Home→Scenario→Home.
- **scenario.spec.js**: profilo Oversharing (statistiche derivate, mai
  `scenario.title`/`description` renderizzati), StoriesBar, toggle Post/Archivio
  (incl. annuncio `aria-live` e fallback testuale di `post-004`), assenza
  verificata di ogni elemento didattico nel testo visibile, MediaViewer (apertura,
  navigazione mouse+tastiera, zoom, chiusura), screenshot, e il **flusso completo
  da tastiera** Home→Sidebar→Moduli→Cybersecurity→Scenario→Feed→MediaViewer→
  chiusura (nessun click salvo il login iniziale) — chiude un item di verifica
  aperto fin dalla Fase 4.

## Cosa NON copre ancora

- `style-guide.html` (pagina di QA interna, non una rotta reale dell'app).
- Fade-in delle immagini al caricamento e micro-transizione di apertura di
  `ProfileMenu` (interventi 🟢 a bassa priorità dell'audit di Fase 9, non ancora
  implementati nel codice sorgente — quindi non ancora testabili).
- Un guasto di rete reale (404 forzato) su `data/modules.json`/`data/home/feed.json`
  — non pertinente oggi: la Home in produzione usa ancora dati hardcoded (Fase 5),
  non la riscrittura a JSON esterni descritta nell'handover di Fase 8.
