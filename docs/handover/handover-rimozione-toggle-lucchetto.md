# SOCIALIVE — Handover: Eliminazione toggle lucchetto (profilo Oversharing)

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / UX Designer /
Accessibility Specialist / Full Stack Architect del progetto.
**Contesto:** miglioramento incrementale richiesto dall'utente dopo la chiusura della Suite dei
10 prompt originari (Fase 10) e dopo i due interventi precedenti ("Toggle Privacy Profilo",
"MediaViewer generico e migliorie realismo profilo"). Estende ulteriormente il renderer generico
`profile-timeline`, quindi impatta lo scenario Oversharing e, per costruzione, ogni futuro
scenario che riuserà lo stesso `type`.
**Tag di riferimento suggerito:** `v1.3.0-rimozione-toggle-lucchetto`

---

## 1. Stato del progetto

- Suite dei 10 prompt originari + interventi "Toggle Privacy Profilo" e "MediaViewer generico e
  migliorie realismo profilo": ✅ completi, invariati.
- **Questo intervento: ✅ COMPLETATO E VERIFICATO END-TO-END.** Il bottone icona a lucchetto
  (secondo controllo indipendente per la visibilità pubblico/privato del profilo, introdotto
  nell'intervento "Toggle Privacy Profilo") è stato **eliminato**. Il bottone "Segui"/"Segui già"
  è ora l'**unico** comando che governa sia lo stato "sto seguendo" sia la visibilità dei
  contenuti del profilo.
- **77/77 controlli** della suite Playwright ufficiale (`login.spec.js` 15 + `home.spec.js` 18 +
  `scenario.spec.js` 44), eseguita per intero attraverso un `index.html` reale ricostruito in
  questa sessione (server locale, mai `file://`, Chromium reale) — non solo script ad-hoc.
- **1 controllo di regressione esplicito aggiunto**: verifica che `.sl-profile-timeline__privacy-
  toggle` (il vecchio bottone) non esista più nel DOM — non solo "non serve più", è stato
  rimosso come codice morto.
- Console verificata priva di errori reali nel flusso principale (i soli 404 sono sulle immagini
  placeholder di Oversharing, assenti in questo specifico ambiente di verifica — limite noto e
  già documentato negli interventi precedenti, non introdotto da questo).
- **Zero modifiche** a `Button.js`, `Avatar.js`, `StoriesBar.js`, `Feed.js`, `Timeline.js`,
  `MediaViewer.js`, `mediaViewerLauncher.js`, `scenarioEngine.js`, `scenarioPageController.js`,
  `appShell.js`, `router.js`, `authService.js`, `homePageController.js`, o a qualunque file JSON
  di dati.

---

## 2. Obiettivi completati

### Comportamento richiesto (confermato con l'utente prima dell'implementazione)

- Il profilo si apre **sempre già "Segui già"** (equivalente al precedente "lucchetto aperto"):
  contenuto pubblico visibile — copertina, avatar, bio, statistiche, storie, tab Post/Archivio,
  entrambi i pannelli.
- Click su **"Segui già"** → passa a **"Segui"** (equivalente al precedente "lucchetto chiuso"):
  storie e i due pannelli Post/Archivio vengono sostituiti dal box "Questo profilo è privato" con
  l'invito a seguire. Copertina, avatar, bio e le tre statistiche restano identiche e visibili in
  entrambi gli stati.
- Click di nuovo su **"Segui"** → torna a **"Segui già"**: il profilo torna visibile per intero,
  con la vista Feed/Archivio che era selezionata prima del cambio di stato preservata (non
  resettata su "Post").

### Cosa è stato rimosso

- Il bottone icona lucchetto (`privacyToggle`), la sua icona interattiva con due varianti
  aperto/chiuso, il relativo listener `sl:click`, la classe CSS dedicata
  (`.sl-profile-timeline__privacy-toggle`, a riposo e `[aria-pressed="true"]`), e la variabile di
  stato `isPrivate` con la funzione `setPrivacy()` — tutto rimosso come codice morto, non solo
  disattivato o nascosto.

### Cosa è stato conservato, deliberatamente

- **L'icona a lucchetto *decorativa* dentro il box "Questo profilo è privato"** (il piccolo badge
  circolare sopra il titolo) **non è stata toccata**: non è mai stata il controllo interattivo
  eliminato, è sempre stata una semplice illustrazione statica del concetto "privato"
  (`aria-hidden`, nessun listener) — verificato esplicitamente con l'utente essere fuori dallo
  scope della richiesta. `buildLockIcon()` resta nel file, semplificata (nessun parametro
  `locked`, dato che serve oggi solo la variante "chiusa" per questo unico consumer rimasto).
- **Due bottoni DOM distinti, uno stato condiviso**: l'architettura "Segui" a due istanze
  (header pubblico + pannello privato, mai visibili insieme, sincronizzate tramite un'unica
  variabile `isFollowing`) era già stata introdotta nell'intervento precedente — non è stata
  ricostruita da zero, solo **estesa** per assorbire anche la responsabilità che prima apparteneva
  al lucchetto.

### Estensione della funzione `setFollowing()`

La funzione che già gestiva label/variante/`aria-pressed` dei due bottoni "Segui" ora gestisce
**anche**:
- `publicContent.hidden = !isFollowing`
- `privateNotice.element.hidden = isFollowing`
- il testo dell'annuncio invisibile dedicato (`aria-live`), riscritto per riflettere il nuovo
  significato del toggle (vedi §4 per il testo esatto confermato con l'utente).

`isFollowing` parte oggi da `true` (era `false` nell'intervento precedente, quando "Segui" e
"privacy" erano due stati indipendenti): il profilo si apre già seguito, coerente con la
richiesta esplicita.

### Verifica (Playwright, Chromium reale, server locale ricostruito in questa sessione)

Poiché l'ambiente di sviluppo non conserva stato tra sessioni di chat, l'intero progetto è stato
**ricostruito file per file** in questa sessione (tutti i componenti, servizi, dati, `index.html`)
per poter eseguire una verifica end-to-end reale, non solo una lettura statica del codice — stessa
disciplina già imposta dal progetto fin dalla Fase 2 ("mai fidarsi della sola lettura, verificare
sempre con Playwright contro un server reale").

- **15 controlli** `login.spec.js`: invariati, tutti verdi (nessun file di autenticazione
  toccato da questo intervento).
- **18 controlli** `home.spec.js`: invariati, tutti verdi (la Home non è toccata da questo
  intervento).
- **44 controlli** `scenario.spec.js` (era 53 nell'intervento precedente: il blocco dedicato al
  vecchio toggle lucchetto, 15 controlli, è stato **rimosso** e la sua copertura essenziale è
  stata **fusa** nel blocco "Bottone Segui", ora 20 controlli — nessuna perdita di copertura
  reale, solo consolidamento):
  - Regressione: il vecchio bottone lucchetto non esiste più nel DOM.
  - Bottone "Segui" presente prima del conteggio "post".
  - Stato iniziale "Segui già", `aria-pressed="true"`, contenuto pubblico visibile.
  - Click → "Segui", `aria-pressed="false"`, evento `sl:profile-follow-toggle` con
    `{ following: false }`, contenuto pubblico nascosto, pannello privato visibile.
  - Pannello privato: titolo, descrizione con nome utente reale, bottone sincronizzato.
  - Statistiche identiche prima/dopo.
  - Annunci `aria-live` con il nuovo testo in entrambe le direzioni.
  - Round-trip preserva la vista Archivio.
  - Regressione completa su: profilo/storie/feed, toggle Post/Archivio, MediaViewer (avatar,
    copertina, storie, post da Feed, zoom, navigazione tastiera), flusso completo da tastiera
    Home→Scenario→MediaViewer.
- **3 screenshot ispezionati visivamente** (desktop Light, mobile 375px pubblico implicito nello
  screenshot desktop, mobile 375px con pannello privato) — confermano un layout pulito: nessun
  lucchetto residuo, bottone "Segui"/"Segui già" ben posizionato, box privato invariato
  visivamente (icona decorativa ancora presente, come previsto).
- **Verifica console dedicata**: nessun errore JS reale durante il ciclo completo
  seguo→non seguo→seguo di nuovo (i soli 404 sulle immagini placeholder, noti e tollerati).

---

## 3. Architettura attuale — file coinvolti

| File | Stato | Intervento |
|---|---|---|
| `js/scenarios/renderers/profileTimelineRenderer.js` | **MODIFICATO** | Rimossi: bottone `privacyToggle`, variabile `isPrivate`, funzione `setPrivacy()`, handler/listener dedicati. `buildLockIcon()` semplificata (nessun parametro, un solo consumer: l'icona decorativa del pannello privato). `buildProfileHeader()` perde il parametro `privacyToggleElement`. `isFollowing` default `true`. `setFollowing()` estesa per assorbire show/hide di `publicContent`/`privateNotice` e il nuovo testo dell'annuncio. Rinominato `privacyStatus` → `followStatus` (classe `sl-profile-timeline__follow-status`). |
| `css/scenarios/profile-timeline.css` | **MODIFICATO** | Rimosse le due regole `.sl-profile-timeline__privacy-toggle` (a riposo e `[aria-pressed="true"]`) — dead code. Aggiornato il commento di testa al file. Nessun'altra regola toccata: `.sl-profile-timeline__private-icon` (il badge decorativo) resta invariata. |
| `tests/scenario.spec.js` | **MODIFICATO** | Rimosso il blocco "Toggle pubblico/privato" (15 controlli sul vecchio lucchetto). Il blocco "Bottone Segui" è stato esteso (20 controlli) per coprire sia lo stato "sto seguendo" sia la visibilità pubblico/privato, ora un'unica responsabilità. Aggiornati i selettori dello screenshot del pannello privato (click su `.sl-profile-timeline__follow-button` invece che sul lucchetto). |

**Nessuna modifica** a `Button.js`, `Avatar.js`, `StoriesBar.js`, `Feed.js`, `Timeline.js`,
`MediaViewer.js`, `mediaViewerLauncher.js`, `scenarioEngine.js`, `scenarioPageController.js`,
`appShell.js`, `router.js`, `authService.js`, `homePageController.js`, `index.html`, né a
qualunque file JSON di dati o ad altri componenti del Design System.

---

## 4. Decisioni progettuali

- **Unificazione di stato, non solo di interfaccia**: `isFollowing` è oggi l'unica fonte di
  verità; il concetto `isPrivate` non esiste più nemmeno internamente (non solo "non esposto
  all'utente") — elimina per costruzione la possibilità che i due stati si disallineassero, un
  rischio che esisteva latente nella versione precedente (due controlli indipendenti che
  *dovevano* restare sincronizzati per convenzione, non per struttura del codice).
- **L'icona decorativa nel pannello privato è stata preservata deliberatamente**: durante
  l'analisi del codice è emerso che `buildLockIcon()` serviva a DUE scopi distinti — il bottone
  interattivo (da eliminare) e un badge puramente illustrativo dentro il box "Questo profilo è
  privato" (non menzionato nella richiesta). Ho verificato questa distinzione con l'utente prima
  di scrivere codice, per evitare di rimuovere silenziosamente un elemento visivo non richiesto.
- **Testo dell'annuncio `aria-live` riscritto, non riusato**: il precedente
  "Profilo impostato su privato/pubblico" descriveva lo stato del *profilo*; il nuovo comando
  descrive un'*azione dell'utente* ("segui"/"non segui più"), quindi il testo è stato aggiornato
  per restare coerente con ciò che il bottone comunica visivamente (label "Segui"/"Segui già") —
  proposto e confermato con l'utente prima dell'implementazione.
- **`buildLockIcon()` semplificata, non rimossa**: con un solo consumer rimasto (il badge
  decorativo, sempre nello stato "chiuso"), il parametro `locked` non aveva più alcun caso d'uso
  reale — mantenerlo sarebbe stata un'opzione morta nella firma della funzione (violazione YAGNI).
- **Consolidamento dei test, non solo cancellazione**: il blocco di test dedicato al vecchio
  lucchetto non è stato semplicemente eliminato — la sua copertura essenziale (stato iniziale,
  transizione, statistiche identiche, annunci, preservazione della vista) è stata fusa nel
  blocco "Bottone Segui" già esistente, evitando sia la duplicazione sia la perdita di copertura.
  Un test di regressione dedicato conferma che il vecchio selettore non produce più risultati.
- **Verifica end-to-end reale, non solo lettura del codice**: coerente con la disciplina di
  progetto stabilita fin dalla Fase 2 ("mai fidarsi della sola lettura, verificare sempre con
  Playwright contro un server reale, mai `file://`") — l'intero progetto è stato ricostruito in
  questa sessione per eseguire la suite ufficiale attraverso un `index.html` reale, non un
  harness isolato.

---

## 5. Attività rimanenti

**Nessuna attività aperta relativa a questo intervento** — implementazione, verifica reale (suite
completa attraverso `index.html`, non solo il file modificato) e documentazione sono complete
end-to-end. Punti pre-esistenti e indipendenti, invariati:

1. Immagini reali di Oversharing (18 placeholder a tinta unita nel repository reale, gestiti
   autonomamente dall'utente).
2. Gap dichiarati e invariati da Fase 10: icon sprite, `js/config/env.js` (Supabase),
   integrazione CI, controllo anti-regressione per contenuti testuali banditi, secondo scenario
   reale con un `type` diverso da `profile-timeline`.
3. **Nota operativa per l'utente**: la suite `tests/scenario.spec.js` consegnata sostituisce
   integralmente la versione precedente nel repository — va applicata per intero, non unita a
   mano al file esistente (i blocchi sono stati riorganizzati, non solo aggiunti in coda).

---

## 6. Prossima fase

Nessuna fase numerata pendente dalla Suite originaria, e nessun micro-step pendente su questo
specifico intervento. Le direzioni generali già proposte in chiusura di Fase 10 restano valide:

- **Consolidamento**: integrazione CI per `tests/`, controllo anti-regressione per contenuti
  testuali banditi, ri-esecuzione periodica della suite in un ambiente con browser reale (in
  questa sessione l'intero ambiente Playwright/Chromium era già disponibile e la suite è stata
  eseguita realmente, non solo pianificata).
- **Espansione**: primo secondo scenario reale (Phishing o Password Security consigliati) — il
  pattern "un solo stato, due bottoni sincronizzati" appena consolidato in questo intervento è
  riusabile senza modifiche da qualunque futuro scenario con lo stesso `type`.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning
Platform"). La Suite dei 10 prompt originari è completa (Fase 1 → Fase 10), seguita dagli
interventi "Toggle Privacy Profilo", "MediaViewer generico e migliorie realismo profilo" e, ora,
da un intervento "Eliminazione toggle lucchetto". Il documento di handover completo è allegato:
consideralo la fonte di verità primaria.

COSA HA FATTO L'ULTIMO INTERVENTO: il profilo Oversharing aveva due controlli indipendenti per la
visibilità pubblico/privato — un bottone "Segui"/"Segui già" e, accanto, un bottone icona a
lucchetto aperto/chiuso che duplicava la stessa decisione. Su richiesta esplicita, il lucchetto
INTERATTIVO è stato eliminato: oggi il solo bottone "Segui"/"Segui già" comanda sia lo stato "sto
seguendo" sia la visibilità dei contenuti (storie, Feed, Archivio). Il profilo si apre sempre già
"Segui già" (contenuto visibile); un click passa a "Segui" e mostra il box "Questo profilo è
privato" (statistiche invariate e sempre visibili); un secondo click ripristina lo stato
precedente, preservando la vista Feed/Archivio che era selezionata. L'icona a lucchetto
DECORATIVA dentro il box privato (badge statico, non interattivo) è stata CONSERVATA — non era
il controllo da eliminare.

FILE MODIFICATI (nessun file nuovo): js/scenarios/renderers/profileTimelineRenderer.js,
css/scenarios/profile-timeline.css, tests/scenario.spec.js. Nessun altro file toccato.

VERIFICA ESEGUITA: l'intero progetto è stato ricostruito in questa sessione (tutti i file, dati
inclusi) e la suite ufficiale è stata eseguita per intero attraverso un index.html reale con
Chromium reale — 77/77 controlli superati (15 login.spec.js + 18 home.spec.js + 44
scenario.spec.js, di cui uno è un test di regressione esplicito che verifica l'assenza del
vecchio selettore ".sl-profile-timeline__privacy-toggle" nel DOM). 3 screenshot ispezionati
visivamente, console priva di errori reali nel flusso principale.

RUOLO/REGOLE INVARIATE: agisci come Lead Software Architect, Senior Front-end/UI Engineer, UX
Designer, Accessibility Specialist (WCAG) e Full Stack Architect. Motiva ogni decisione prima di
implementarla. Mai duplicare componenti/moduli per la stessa funzione; interfaccia uniforme
create(props)→{element,update,destroy} per i componenti UI; eventi "sl:nome-evento"; componenti
"dumb"; documentazione in italiano; test reali (mai mock) prima di consegnare, verificati anche
attraverso l'index.html reale; handover completo a 10 sezioni + file .md separato ad ogni
milestone; per ogni file dichiara sempre NUOVO/MODIFICATO/GIÀ ESISTENTE, verificato sui file
reali, non per assunzione.

STATO: nessuna attività pendente su questo specifico intervento. Le due direzioni generali
proposte in chiusura di Fase 10 restano disponibili come prossimo passo del progetto:
(A) consolidamento (CI, controllo anti-regressione contenuti banditi) o (B) espansione (primo
secondo scenario reale, con un "type" diverso da "profile-timeline").

Indica quale direzione preferisci, o un'altra priorità.
```

---

## 8. Test da eseguire

Tutti i controlli sotto sono **già stati eseguiti realmente** in questa sessione (Playwright,
Chromium reale, server locale ricostruito, mai `file://`).

### Test funzionali
- [x] Il vecchio selettore `.sl-profile-timeline__privacy-toggle` non produce più alcun elemento
  nel DOM (regressione esplicita).
- [x] Bottone "Segui" presente prima del conteggio "post" nella riga statistiche.
- [x] Stato iniziale: "Segui già", `aria-pressed="true"`, contenuto pubblico visibile, pannello
  privato nascosto.
- [x] Click → "Segui", `aria-pressed="false"`, evento `sl:profile-follow-toggle` con
  `{ following: false }`, contenuto pubblico nascosto, pannello privato visibile.
- [x] Pannello privato: titolo, descrizione con nome reale, bottone sincronizzato con l'header.
- [x] Statistiche (post/follower/seguiti) identiche prima e dopo il cambio di stato.
- [x] Annunci `aria-live` corretti in entrambe le direzioni (testo aggiornato, confermato con
  l'utente).
- [x] Round-trip Segui↔Segui già preserva la vista Feed/Archivio selezionata.
- [x] Nessuna perdita/duplicazione di post dopo le transizioni (sempre 12).
- [x] Regressione completa: toggle Post/Archivio, MediaViewer (avatar, copertina, storie, post),
  flusso da tastiera Home→Scenario→MediaViewer, autenticazione, Home.

### Test UI
- [x] Screenshot desktop Light: nessun lucchetto residuo, layout header coerente.
- [x] Screenshot mobile 375px, pannello privato: nessun overflow orizzontale, icona decorativa
  del box privato ancora presente e corretta.
- [ ] Screenshot desktop Dark del nuovo stato "non seguo" — non catturato esplicitamente in questo
  giro (rischio basso: nessun nuovo colore introdotto, solo riuso di varianti Button già
  verificate in entrambi i temi).

### Test UX
- [x] Nessun movimento forzato del focus al cambio di stato.
- [x] Nessun salto di layout percepibile (header/statistiche non si muovono).
- [x] Coerenza testo↔variante colore del bottone (mai il solo colore come segnale).

### Test tecnici
- [x] `node --check` su tutti i file `.js` modificati e su tutti i 46 file `.js` del progetto
  ricostruito.
- [x] Console priva di errori JS reali nel flusso completo di verifica.
- [x] Nessun path relativo rotto — nessuna modifica a `index.html` necessaria in questo
  intervento.

### Test di regressione
- [x] Suite ufficiale completa (`login.spec.js` + `home.spec.js` + `scenario.spec.js`, 77
  controlli) eseguita attraverso `index.html` reale — tutti verdi.
- [x] Nessuna regressione sui componenti/servizi condivisi (non toccati da questo intervento).

---

## 9. Criticità

Nessuna criticità aperta introdotta da questo intervento. Punti già noti e indipendenti,
invariati:

- **Immagini reali di Oversharing** ancora placeholder nel repository reale (gestite
  dall'utente) — nell'ambiente di verifica di questa sessione erano del tutto assenti (404
  attesi e tollerati, non influenzano la correttezza del comportamento verificato).
- **Screenshot Dark del nuovo stato "non seguo"** non catturato esplicitamente (rischio basso,
  vedi §8).
- Gap generali già segnalati da Fase 10 (icon sprite, `env.js` Supabase, integrazione CI,
  controllo anti-regressione testi banditi) — indipendenti da questo intervento.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Nessuno introdotto da questo intervento. La rimozione del lucchetto ha **ridotto** la
  superficie di codice e di stato, non ne ha aggiunta.

### Refactoring consigliati
- 🟢 Nessuno: l'intervento è una semplificazione (unificazione di due stati in uno, rimozione di
  codice morto) — non ha introdotto nuova indirection né nuovi pattern da mantenere.

### Ottimizzazioni future
- 🟢 Nessuna identificata specificamente da questo intervento.

### Rischi architetturali
- 🟢 **Nessun rischio nuovo**: l'unificazione di `isPrivate` in `isFollowing` elimina, non
  introduce, un potenziale punto di disallineamento tra due stati. Il pattern "due bottoni DOM,
  un solo stato condiviso" era già stato validato nell'intervento precedente; qui è stato solo
  esteso a una responsabilità aggiuntiva (visibilità), non riprogettato.

### Priorità
- 🟢 Bassa: tutto quanto sopra — nessuna criticità bloccante identificata da questo intervento.

### Obiettivo
Questo intervento è chiuso end-to-end: implementazione, verifica reale (progetto ricostruito e
suite ufficiale eseguita per intero attraverso `index.html`), e documentazione — pienamente
coerente con l'architettura consolidata nelle fasi precedenti, con una riduzione netta della
complessità del renderer `profile-timeline` rispetto allo stato precedente.
