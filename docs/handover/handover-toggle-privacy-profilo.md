# SOCIALIVE — Handover: Toggle Privacy Profilo (Oversharing)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Contesto:** miglioramento incrementale richiesto dall'utente dopo la chiusura della Suite dei
10 prompt originari (Fase 10 completata). Non introduce una nuova "Fase" numerata della roadmap:
estende il renderer generico `profile-timeline`, quindi impatta lo scenario Oversharing (Fase 6)
e, per costruzione, ogni futuro scenario che riuserà lo stesso `type`.
**Tag di riferimento suggerito:** `v1.1.0-toggle-privacy-profilo`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari (Fase 1 → Fase 10): ✅ completa, invariata.
- **Miglioramento "toggle privacy profilo": ✅ COMPLETATO E COMPLETAMENTE COPERTO DA TEST
  PERSISTITI.** Il profilo Oversharing (e, genericamente, qualunque profilo mostrato dal renderer
  `profile-timeline`) ha ora due stati commutabili in tempo reale tramite un'icona a lucchetto:
  **pubblico** (default, invariato da Fase 6/7) e **privato** (nuovo — storie e post sostituiti
  da un pannello "Questo profilo è privato").
- Stato **non persistito**, come richiesto esplicitamente: ogni mount/refresh dello scenario
  riparte sempre da "pubblico".
- **Step 1 (implementazione)**: 26 controlli automatizzati eseguiti con Playwright su un harness
  isolato (fetch reale dei dati JSON, mai mock) — tutti superati, 4 screenshot ispezionati.
- **Step 2 (questo aggiornamento — persistenza nella suite reale)**: `tests/scenario.spec.js`
  esteso con 15 nuovi controlli dedicati al toggle privacy, integrati nella suite ufficiale del
  repository. **Intera suite ri-eseguita attraverso il vero `index.html`** (login reale, router
  reale, nessun harness isolato): **61/61 controlli superati** (15 `login.spec.js` + 7
  `home.spec.js` + 39 `scenario.spec.js`, di cui 15 sul toggle privacy). Aggiunto anche uno
  screenshot dedicato al pannello privato a 375px, lacuna esplicitamente segnalata nella versione
  precedente di questo documento.
- **Zero modifiche** a componenti condivisi del Design System, a `router.js`, `scenarioEngine.js`,
  `appShell.js`, `authService.js`, o a qualunque file JSON di dati.

---

## 2. Obiettivi completati

- **Icona lucchetto** (aperto/chiuso, costruita inline con `svgNode()` — stesso pattern già usato
  per il cuore di `PostCard`), posizionata accanto alle statistiche post/follower/seguiti, dentro
  un nuovo bottone `Button` variante `icon` (componente esistente, zero modifiche).
- **Stato pubblico (default)**: lucchetto aperto, `aria-pressed="false"`, `aria-label="Rendi il
  profilo privato"`. Storie, tab Post/Archivio ed entrambi i pannelli visibili — comportamento
  identico a quello già esistente prima di questo intervento.
- **Stato privato**: lucchetto chiuso, `aria-pressed="true"`, `aria-label="Rendi il profilo
  pubblico"`. Copertina, avatar, bio e le **tre statistiche restano identiche e visibili**
  (verificato: gli stessi identici valori numerici in entrambi gli stati — un profilo privato
  reale le mostra comunque a chiunque). Storie e i due pannelli Post/Archivio sono sostituiti da
  un pannello con:
  - icona lucchetto su badge circolare
  - titolo "Questo profilo è privato"
  - testo "Segui **{displayName}** per vedere le sue foto, i suoi video e le sue storie."
  - bottone "Segui" (variante primary) — **volutamente inerte**: emette solo un evento
    `sl:profile-follow-request` senza alcun listener applicativo, stesso trattamento già
    riservato altrove nel progetto a interazioni non implementate (es. `sl:search`).
- **Toggle bidirezionale**: un secondo click sul lucchetto torna pubblico. La vista Feed/Archivio
  selezionata prima del passaggio a "privato" **viene preservata** (verificato con un test
  dedicato: se si era su "Archivio", si resta su "Archivio" dopo un giro privato→pubblico — nessun
  reset forzato su "Post").
- **Accessibilità**: annuncio invisibile dedicato (`aria-live="polite"`, separato da quello
  Post/Archivio) — "Profilo impostato su privato."/"...pubblico." — nessun movimento forzato del
  focus, `aria-pressed`/`aria-label` sempre coerenti con lo stato.
- **Generico rispetto allo scenario**: la logica vive in `profileTimelineRenderer.js`, non in
  codice specifico di Oversharing — nessun dato hardcoded relativo a "marti.travel" (il nome nel
  messaggio arriva da `profile.displayName`). Un futuro scenario con lo stesso `type`
  (`"Privacy"`, Fase 1 §12) erediterebbe questa stessa demo senza alcuna modifica.

### Step 2 — Persistenza nella suite di test reale

- **`tests/scenario.spec.js` esteso** con un nuovo blocco dedicato (`--- Toggle pubblico/privato
  (nuovo, post Fase 10) ---`), inserito tra il blocco "Toggle Post/Archivio" e il blocco
  "MediaViewer" — ordine di lettura naturale per un futuro manutentore. 15 controlli: bottone
  presente, stato iniziale pubblico (`aria-pressed`/`aria-label`), contenuto pubblico visibile/
  pannello privato nascosto, transizione a privato (attributi, visibilità, titolo, descrizione
  col nome utente reale, bottone "Segui", statistiche identiche, annuncio `aria-live`), click su
  "Segui" senza errori, transizione di ritorno a pubblico (attributi, 12 post ancora presenti,
  annuncio corretto), preservazione della vista Archivio dopo un giro privato→pubblico.
- **Nuovo screenshot** `scenario-private-mobile-375.png` nel blocco screenshot esistente — colma
  la lacuna esplicitamente segnalata nella versione precedente di questo handover ("non eseguito
  in questo giro").
- **Verifica eseguita attraverso l'intero progetto reale ricostruito** (`index.html`, tutti i
  componenti/servizi, tutti i dati JSON reali di Oversharing), non un harness isolato — stessa
  lezione di processo già imposta dal progetto fin dalla Fase 6 ("ogni modifica va verificata
  anche con un test che carica l'entry point reale"). `node`/`playwright` (package npm globale,
  versione 1.56.0, coerente con `tests/package.json`) + Chromium reale.
- **Nessuna modifica** a `login.spec.js`/`home.spec.js`/agli helper (`server.js`, `testKit.js`,
  `auth.js`) — riusati esattamente come sono.

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `js/scenarios/renderers/profileTimelineRenderer.js` | **MODIFICATO** | import `svgNode`; nuova funzione `buildLockIcon(locked)`; nuova funzione `buildPrivateNotice(profile)`; `buildProfileHeader` riceve ora anche l'elemento del toggle e lo dispone in una riga dedicata (`.stats-row`) accanto alle statistiche; stato locale `isPrivate` (mai persistito); funzione `setPrivacy()`/handler di click; wrapper `.public-content` che raggruppa storie+tab+pannelli in un solo nodo commutabile; `destroy()` aggiornato con il cleanup del nuovo bottone e del pannello privato |
| `css/scenarios/profile-timeline.css` | **MODIFICATO** | nuova `.sl-profile-timeline__stats-row` (contenitore statistiche+lucchetto); `.sl-profile-timeline__stats` non ha più margin-top proprio (spostato sulla row, zero regressione visiva); colore del bottone lucchetto a riposo/premuto; intero blocco nuovo `.sl-profile-timeline__private-notice*` (pannello, icona, titolo, descrizione, bottone Segui) incl. la regola `[hidden]` esplicita (stesso bug pattern già corretto 3 volte nel progetto: post-card.css/timeline.css/media-viewer.css) |
| `tests/scenario.spec.js` | **MODIFICATO** | +15 controlli sul toggle privacy (nuovo blocco dedicato) + 1 screenshot mobile del pannello privato; docstring di testa al file aggiornato |

**Nessun nuovo file.** Nessuna modifica a `index.html` (nessun nuovo asset da collegare — i file
toccati sono già linkati/referenziati). Nessuna modifica a `data/*.json`, a `Button.js`,
`Avatar.js`, `StoriesBar.js`, `Feed.js`, `Timeline.js`, `MediaViewer.js`, `scenarioEngine.js`,
`scenarioPageController.js`, `appShell.js`, `router.js`, `authService.js`,
`tests/login.spec.js`, `tests/home.spec.js`, `tests/helpers/*`.

---

## 4. Decisioni progettuali

- **Vive nel renderer del `type`, non in un componente dedicato né nello scenario Oversharing**:
  il toggle pubblico/privato è un comportamento di "cosa significa mostrare un profilo social",
  non un dato specifico di un singolo scenario — coerente con il principio già applicato in tutto
  il progetto ("generico rispetto allo scenario, specifico rispetto al type").
- **Stato locale, non persistito**: una singola variabile (`isPrivate`) nello scope della funzione
  `renderProfileTimeline`, stesso pattern già usato per `state.zoomed` in `MediaViewer` o
  `state.profileMenuOpen` in `AppHeader` — nessuna scrittura su `storage.js`, per costruzione:
  ogni apertura/refresh dello scenario deve ripartire da "pubblico", come richiesto esplicitamente
  per non compromettere l'effetto didattico della demo.
- **Le statistiche non cambiano tra i due stati**: decisione esplicita, non un'omissione — un
  profilo privato reale mostra comunque pubblicamente i tre numeri (post/follower/seguiti); solo
  i CONTENUTI sono riservati. Verificato con un'asserzione dedicata (stessi valori testuali in
  entrambi gli stati).
- **Un solo `hidden` da commutare, non quattro**: storie, annuncio Post/Archivio, tab e pannelli
  sono raggruppati in un unico contenitore (`.sl-profile-timeline__public-content`) — un solo
  toggle invece di quattro, stesso principio già seguito da questo file per Feed/Timeline (un
  `hidden` per pannello, non uno per ciascun figlio interno).
- **Nessun `display` proprio su `.public-content`**: a differenza di `.sl-timeline`/
  `.sl-post-card__media`, questo contenitore non dichiara un proprio `display` — l'attributo
  nativo `[hidden]` basta da solo, nessuna ridichiarazione CSS necessaria. La ridichiarazione
  esplicita serve invece per `.private-notice`, che dichiara `display: flex`.
- **Bottone "Segui" fittizio incluso** (confermato con l'utente prima dell'implementazione): emette
  un evento senza listener, stesso trattamento già riservato a `sl:search`/`sl:settings-click` —
  rinforza il realismo senza introdurre alcuna logica applicativa non richiesta.
- **Nessuna nuova verifica di contrasto WCAG necessaria**: tutti i token colore riusati
  (`bg-elevated`, `text-primary`, `text-secondary`, `primary-text`, `primary-600`/
  `text-inverse` del bottone "Segui") sono già verificati in contesti identici altrove nel
  progetto — nessun accostamento genuinamente nuovo introdotto.

---

## 5. Attività rimanenti

**Nessuna attività aperta relativa a questo miglioramento** — il gap di copertura segnalato nella
versione precedente di questo documento (§9 di quella versione) è stato chiuso in questo stesso
aggiornamento. Punti pre-esistenti e indipendenti (invariati, per completezza, non legati a
questo intervento):

1. Immagini reali di Oversharing (18 placeholder a tinta unita, gestiti autonomamente
   dall'utente).
2. Gap dichiarati e invariati da Fase 10: icon sprite, `js/config/env.js` (Supabase), integrazione
   CI, secondo scenario reale con un `type` diverso da `profile-timeline`.

---

## 6. Prossima fase

Nessuna fase numerata pendente dalla Suite originaria, e nessun micro-step pendente su questo
specifico miglioramento — è stato chiuso end-to-end (implementazione + copertura test persistita
+ verifica attraverso l'app reale). Le due direzioni indipendenti già proposte in chiusura di
Fase 10 restano valide come possibili prossimi passi generali del progetto:

- **Consolidamento**: integrazione CI per `tests/`, controllo anti-regressione per contenuti
  testuali banditi.
- **Espansione**: primo secondo scenario reale (Phishing o Password Security consigliati, per
  validare il pattern Registry di `scenarioEngine.js` con un `type` diverso da
  `"profile-timeline"`).

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa (Fase 1 → Fase 10). Su richiesta
dell'utente è stato aggiunto un miglioramento al profilo Oversharing: un toggle pubblico/privato
(icona lucchetto accanto alle statistiche post/follower/seguiti). Quando il profilo è impostato
su "privato" (lucchetto chiuso), copertina/avatar/bio/statistiche restano visibili e identiche,
ma storie e post vengono sostituiti da un pannello "Questo profilo è privato" con un bottone
"Segui" fittizio. Lo stato NON è persistito: ogni refresh/apertura dello scenario riparte sempre
da "pubblico". L'intervento è stato completato in due step: implementazione (renderer+CSS) e
persistenza della copertura test nella suite ufficiale del repository. Il documento di handover
completo è allegato: consideralo la fonte di verità primaria.

FILE MODIFICATI (nessun file nuovo): js/scenarios/renderers/profileTimelineRenderer.js,
css/scenarios/profile-timeline.css, tests/scenario.spec.js. Nessun altro file del progetto è
stato toccato.

VERIFICA ESEGUITA: suite completa (login.spec.js + home.spec.js + scenario.spec.js, incl. i 15
nuovi controlli sul toggle privacy) eseguita attraverso il vero index.html (login reale, router
reale, tutti i dati JSON reali di Oversharing) — 61/61 controlli superati, incl. uno screenshot
dedicato al pannello privato a 375px (lacuna precedente ora chiusa).

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Motiva ogni decisione prima di
implementarla. Mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI; eventi "sl:nome-evento"; componenti
"dumb"; documentazione in italiano; test reali (mai mock) prima di consegnare, verificati anche
attraverso l'index.html reale (non solo harness isolati); handover completo a 10 sezioni + file
.md separato ad ogni milestone.

STATO: nessuna attività pendente su questo specifico miglioramento. Le due direzioni generali
proposte in chiusura di Fase 10 restano disponibili come prossimo passo del progetto:
(A) consolidamento (CI, controllo anti-regressione contenuti banditi) o (B) espansione (primo
secondo scenario reale, con un "type" diverso da "profile-timeline" per validare il pattern
Registry di scenarioEngine.js con un secondo caso reale).

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** (Playwright, Chromium headless, su
harness con fetch reale dei dati — mai mock) durante questo intervento.

### Test funzionali
- [x] Bottone lucchetto presente accanto alle statistiche.
- [x] Stato iniziale: pubblico, `aria-pressed="false"`, `aria-label` corretto.
- [x] Stato iniziale: contenuto pubblico (storie/tab/pannelli) visibile, pannello privato nascosto.
- [x] 12 post visibili nel Feed in stato pubblico.
- [x] Click → privato: `aria-pressed="true"`, `aria-label` invertito, contenuto pubblico nascosto,
  pannello privato visibile.
- [x] Pannello privato: titolo "Questo profilo è privato" esatto.
- [x] Pannello privato: descrizione contiene il nome utente corretto (letto da `profile.json`,
  non hardcoded).
- [x] Pannello privato: bottone "Segui" presente e cliccabile senza errori.
- [x] Statistiche identiche (stessi valori testuali) in stato pubblico e privato.
- [x] Annuncio `aria-live`: "Profilo impostato su privato." esatto.
- [x] Click di nuovo → pubblico: stato/attributi ripristinati correttamente.
- [x] Dopo il ritorno a pubblico: ancora 12 post (nessun duplicato/nessuna perdita).
- [x] Annuncio `aria-live`: "Profilo impostato su pubblico." esatto.
- [x] La vista Feed/Archivio selezionata prima del passaggio a privato viene preservata dopo un
  giro privato→pubblico (nessun reset forzato su "Post").

### Test UI
- [x] Screenshot pubblico — Light.
- [x] Screenshot privato — Light.
- [x] Screenshot privato — Dark.
- [x] Screenshot pubblico — Dark.
- [x] Screenshot a viewport mobile (375px) del pannello privato — **eseguito in questo
  aggiornamento** (`scenario-private-mobile-375.png`), nessun overflow orizzontale, layout
  coerente con il resto del Design System.

### Test UX
- [x] Nessun movimento forzato del focus al cambio stato.
- [x] Nessun salto di layout percepibile (header/statistiche non si muovono, solo il contenuto
  sotto cambia).

### Test tecnici
- [x] `node --check` sul file JS modificato.
- [x] Nessun 404 fuori da `assets/` (dati e moduli JS tutti risolti correttamente).
- [x] Nessun errore console inatteso (i soli 404 osservati sono sulle immagini placeholder,
  attesi in questo harness isolato — stesso criterio di tolleranza già documentato più volte nel
  progetto).

### Test di regressione
- [x] Toggle Post/Archivio (Fase 6) invariato e funzionante in entrambi gli stati pubblico/privato.
- [x] **Flusso reale completo attraverso `index.html`** (login → Home → Cybersecurity → scenario)
  con questo intervento — **eseguito in questo aggiornamento**: 61/61 controlli superati
  sull'intera suite (`login.spec.js`/`home.spec.js`/`scenario.spec.js`), non solo sull'harness
  isolato dello Step 1.
- [x] Flusso completo da tastiera Home→Scenario→MediaViewer (Fase 9, intervento #9): confermato
  invariato dopo l'inserimento del nuovo blocco di test — il toggle privacy non introduce nuovi
  elementi nell'ordine di tabulazione prima della card Cybersecurity/del primo post del Feed.

---

## 9. Criticità

**Nessuna criticità aperta relativa a questo miglioramento.** Le due segnalate nella versione
precedente di questo documento sono state chiuse in questo aggiornamento:
- ~~Nessuna copertura nella suite persistita `tests/`~~ → **chiusa**: 15 controlli dedicati ora
  in `tests/scenario.spec.js`, parte di `npm test`.
- ~~Non ripetuto sul flusso reale completo `index.html`~~ → **chiusa**: intera suite (61
  controlli) eseguita attraverso l'app reale ricostruita per intero (non un harness), tutti
  superati.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo miglioramento. Il compromesso temporaneo segnalato nella
  versione precedente di questo documento (copertura solo su harness isolato) è stato chiuso.

### Refactoring consigliati
- 🟢 Nessuno: l'intervento riusa esclusivamente componenti/pattern già esistenti (Button variante
  icon, `svgNode()`, `createElement()`), zero nuova indirection introdotta.

### Ottimizzazioni future
- 🟢 Valutare se un futuro secondo scenario con `type: "profile-timeline"` richiederà varianti del
  messaggio privato (oggi generico e già parametrico su `profile.displayName`, nessuna modifica
  prevista come necessaria).

### Rischi architetturali
- 🟢 Nessun rischio nuovo: l'intervento è puramente additivo all'interno di un singolo renderer
  già isolato dal resto dell'architettura (nessuna modifica a componenti condivisi, router,
  servizi, o schema dati). Il secondo blocco di verifica (Step 2) ha inoltre confermato che
  l'inserimento del nuovo blocco di test non altera l'ordine di tabulazione né introduce
  regressioni nel flusso da tastiera Home→Scenario→MediaViewer già validato in Fase 9.

### Priorità
- 🟢 Bassa: nessun elemento ad alta o media priorità residuo su questo intervento. Le priorità
  aperte sul progetto restano quelle generali già note da Fase 10 (icon sprite, `env.js` Supabase,
  integrazione CI, secondo scenario reale).

### Obiettivo
Questo intervento è ora chiuso end-to-end: implementazione, verifica reale, e persistenza della
copertura nella suite ufficiale del repository — pienamente coerente con l'architettura
consolidata nelle 10 fasi precedenti, senza debito residuo.
