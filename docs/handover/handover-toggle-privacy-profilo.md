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
- **Nuovo miglioramento: ✅ COMPLETATO.** Il profilo Oversharing (e, genericamente, qualunque
  profilo mostrato dal renderer `profile-timeline`) ha ora due stati commutabili in tempo reale
  tramite un'icona a lucchetto: **pubblico** (default, invariato da Fase 6/7) e **privato**
  (nuovo — storie e post sostituiti da un pannello "Questo profilo è privato").
- Stato **non persistito**, come richiesto esplicitamente: ogni mount/refresh dello scenario
  riparte sempre da "pubblico".
- **26 controlli automatizzati** eseguiti con Playwright (Chromium reale, browser headless, mai
  mock) su un harness che monta `renderProfileTimeline` con fetch reale dei dati JSON — tutti
  superati. 4 screenshot ispezionati (pubblico/privato × Light/Dark).
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

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `js/scenarios/renderers/profileTimelineRenderer.js` | **MODIFICATO** | import `svgNode`; nuova funzione `buildLockIcon(locked)`; nuova funzione `buildPrivateNotice(profile)`; `buildProfileHeader` riceve ora anche l'elemento del toggle e lo dispone in una riga dedicata (`.stats-row`) accanto alle statistiche; stato locale `isPrivate` (mai persistito); funzione `setPrivacy()`/handler di click; wrapper `.public-content` che raggruppa storie+tab+pannelli in un solo nodo commutabile; `destroy()` aggiornato con il cleanup del nuovo bottone e del pannello privato |
| `css/scenarios/profile-timeline.css` | **MODIFICATO** | nuova `.sl-profile-timeline__stats-row` (contenitore statistiche+lucchetto); `.sl-profile-timeline__stats` non ha più margin-top proprio (spostato sulla row, zero regressione visiva); colore del bottone lucchetto a riposo/premuto; intero blocco nuovo `.sl-profile-timeline__private-notice*` (pannello, icona, titolo, descrizione, bottone Segui) incl. la regola `[hidden]` esplicita (stesso bug pattern già corretto 3 volte nel progetto: post-card.css/timeline.css/media-viewer.css) |

**Nessun nuovo file.** Nessuna modifica a `index.html` (nessun nuovo asset da collegare — i due
file toccati sono già linkati). Nessuna modifica a `data/*.json`, a `Button.js`, `Avatar.js`,
`StoriesBar.js`, `Feed.js`, `Timeline.js`, `MediaViewer.js`, `scenarioEngine.js`,
`scenarioPageController.js`, `appShell.js`.

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

Nessuna attività aperta relativa a questo specifico miglioramento. Punti pre-esistenti e
indipendenti (invariati, per completezza):

1. Immagini reali di Oversharing (18 placeholder a tinta unita, gestiti autonomamente
   dall'utente).
2. Suite di test Playwright del repository (`tests/`, persistita da Fase 9) — **non ancora
   estesa** con i controlli su questo nuovo toggle: la verifica di questo intervento è stata
   eseguita su un harness isolato dedicato (Playwright/Python), non ancora trascritta come
   `.spec.js` dentro `tests/scenario.spec.js`. Consigliato come prossimo micro-step (vedi §6).
3. Gap dichiarati e invariati da Fase 10: icon sprite, `js/config/env.js` (Supabase), integrazione
   CI, secondo scenario reale con un `type` diverso da `profile-timeline`.

---

## 6. Prossima fase

Nessuna fase numerata pendente dalla Suite originaria. Come prossimo micro-step consigliato (non
bloccante):

**Estendere `tests/scenario.spec.js`** con i controlli equivalenti a quelli già eseguiti
sull'harness isolato di questo intervento — stato iniziale pubblico, click → privato (contenuto
nascosto, pannello visibile, stats identiche, annuncio corretto), click → pubblico (ripristino,
nessuna vista persa), assenza di regressioni su Feed/Archivio/MediaViewer — così che il toggle
diventi parte della regressione automatica ad ogni `npm test`, coerente con la disciplina di test
già adottata in tutte le fasi precedenti.

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
da "pubblico". Il documento di handover completo di questo intervento è allegato: consideralo la
fonte di verità primaria.

FILE MODIFICATI (nessun file nuovo): js/scenarios/renderers/profileTimelineRenderer.js,
css/scenarios/profile-timeline.css. Nessun altro file del progetto è stato toccato.

VERIFICA ESEGUITA: 26 controlli automatizzati Playwright (Chromium reale) su un harness isolato
dedicato (non ancora nella suite persistita tests/), tutti superati, incl. 4 screenshot
Light/Dark × pubblico/privato ispezionati.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Motiva ogni decisione prima di
implementarla. Mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI; eventi "sl:nome-evento"; componenti
"dumb"; documentazione in italiano; test reali (mai mock) prima di consegnare; handover completo
a 10 sezioni + file .md separato ad ogni milestone.

DA FARE ORA (consigliato, non bloccante): estendere tests/scenario.spec.js con i controlli
equivalenti a quelli già eseguiti sull'harness isolato per il toggle privacy (stato iniziale
pubblico, transizione a privato/pubblico, preservazione della vista Feed/Archivio, statistiche
identiche nei due stati), così che rientri nella regressione automatica di "npm test".

Procedi estendendo tests/scenario.spec.js, oppure indica un'altra priorità.
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
- [ ] Screenshot a viewport mobile (375px) del pannello privato — non eseguito in questo giro
  (rischio basso: il pannello riusa lo stesso layout centrato a colonna unica già verificato
  altrove per Light/Dark desktop).

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
- [ ] Flusso reale completo attraverso `index.html` (login → Home → Cybersecurity → scenario) con
  questo intervento — non ripetuto in questo giro (verificato invece su harness isolato,
  sufficiente a validare la logica; nessun nuovo asset da collegare in `index.html`, quindi il
  rischio di un gap "file consegnato ma mai collegato" — già accaduto in Fase 6 — non si applica
  qui). Consigliato comunque un passaggio sul flusso reale alla prossima occasione di test
  integrale.

---

## 9. Criticità

- **Nessuna copertura nella suite persistita `tests/`**: la verifica di questo intervento è stata
  eseguita su un harness Playwright dedicato e isolato (Python), non ancora trascritta come
  `.spec.js` dentro il repository — a differenza di ogni altra funzionalità del progetto, oggi
  coperta da `npm test`. Non bloccante (26 controlli reali già eseguiti e superati), ma da
  chiudere per non reintrodurre il debito "verifica solo manuale" che il progetto aveva già
  eliminato in Fase 9.
- **Non ripetuto sul flusso reale completo `index.html`**: verificato solo su harness isolato.
  Rischio basso (nessun nuovo asset da collegare, nessuna modifica a file di routing/auth), ma
  non una verifica end-to-end eseguita in questo giro.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟡 Toggle privacy verificato solo su harness isolato, non ancora nella suite persistita
  `tests/` — vedi §9.

### Refactoring consigliati
- 🟢 Nessuno: l'intervento riusa esclusivamente componenti/pattern già esistenti (Button variante
  icon, `svgNode()`, `createElement()`), zero nuova indirection introdotta.

### Ottimizzazioni future
- 🟢 Screenshot mobile (375px) del pannello privato — non eseguito in questo giro, rischio basso.
- 🟢 Valutare se un futuro secondo scenario con `type: "profile-timeline"` richiederà varianti del
  messaggio privato (oggi generico e già parametrico su `profile.displayName`, nessuna modifica
  prevista come necessaria).

### Rischi architetturali
- 🟢 Nessun rischio nuovo: l'intervento è puramente additivo all'interno di un singolo renderer
  già isolato dal resto dell'architettura (nessuna modifica a componenti condivisi, router,
  servizi, o schema dati).

### Priorità
- 🟡 Media: estendere `tests/scenario.spec.js` con i controlli sul toggle privacy, per chiudere il
  gap di copertura segnalato in §9.
- 🟢 Bassa: screenshot mobile del pannello privato.

### Obiettivo
Questo intervento resta pienamente coerente con l'architettura consolidata nelle 10 fasi
precedenti: nessuna nuova astrazione, nessuna modifica a componenti condivisi, verifica reale
(non a occhio, non mock) prima della consegna.
