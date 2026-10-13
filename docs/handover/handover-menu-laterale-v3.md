# SOCIALIVE — Handover: menu laterale richiudibile, tasti-icona senza sfondo, alternative di nome

**Redatto in qualità di** Lead Software Architect / Senior Front-end Engineer / Product & UX Designer /
Accessibility Specialist / Performance Engineer del progetto.
**Contesto:** correzione dopo la consegna precedente (che il repository contiene già, HEAD `8904eb4`). Il docente ha segnalato
che "la sidebar rimane sempre aperta" e che il tasto Home aveva uno sfondo grigio; ha chiesto altre alternative di nome.
**Tag di riferimento suggerito:** `v1.6.1-menu-laterale-richiudibile`

---

## 1. Stato del progetto

- **Completato e verificato** (server locale, Chromium reale, `index.html` reale): menu laterale richiudibile, tasto Home e
  tasto Menu senza sfondo.
- **Suite: 343/343** (login 19, home 76, sidebar 38, scenario 82, phishing 35, token 38, llm 56). Prima: 331.
- **Diagnosi:** il sottomenu "Scenari" si apriva e chiudeva correttamente (riprodotto con mouse reali su Home, Oversharing e
  Tokenizzazione, a 1280 e 1024px). Ciò che restava sempre aperto era la **colonna intera** della Sidebar: nessun controllo
  poteva chiuderla. "Apri e chiudi a fisarmonica" della richiesta precedente andava letto così; l'avevo interpretato come il
  solo sottomenu. Il sottomenu a fisarmonica resta com'è.
- **In attesa di una tua scelta:** il nome (§5). Nessun codice scritto per il rename.
- Ancora da fare sul tuo repository (dal primo intervento): `git rm data/home/feed.json assets/images/home/post_mario_bianchi.jpg assets/images/home/mountain-placeholder.svg`.

---

## 2. Obiettivi completati

| Richiesta | Esito |
|---|---|
| La Sidebar deve potersi chiudere | ✅ tasto "Menu laterale" (tre linee) a sinistra del marchio: chiude e riapre l'intera colonna; il contenuto si allarga (+240px) |
| Lo stato resta | ✅ ricordato tra pagine e ricaricamenti (`localStorage`, chiave `sl-sidebar-collapsed`); default: aperta |
| Tasto Home solo icona, senza sfondo grigio | ✅ nessuno sfondo a riposo, da pagina corrente o al passaggio del mouse; al passaggio cambia solo il colore dell'icona |
| Alternative di nome | ✅ §5 |

Dettagli del menu laterale: chiusa = attributo `[hidden]` (fuori dall'ordine di tabulazione e dall'albero di accessibilità);
cambiare lo stato **non ricostruisce** le voci, quindi la fisarmonica "Scenari" è com'era alla riapertura; il tasto tiene il
focus dopo Invio/Spazio; sotto i 768px il tasto non compare (la Sidebar è già nascosta lì); negli scenari immersivi non c'è
barra (invariato, per realismo).

---

## 3. Architettura attuale

```
├── css/components/
│   ├── app-header.css      # ♻️ MODIFICATO — tasti-icona senza sfondo (hover = colore); toggle nascosto < 768px
│   └── sidebar.css         # ♻️ MODIFICATO — .sl-sidebar[hidden]{display:none}
├── js/
│   ├── components/Sidebar.js     # ♻️ MODIFICATO — props id/collapsed; update() ricostruisce le voci solo se cambiano items/activeId
│   ├── components/AppHeader.js   # ♻️ MODIFICATO — props additive sidebarControlsId/sidebarCollapsed, evento sl:sidebar-toggle
│   └── pages/shared/appShell.js  # ♻️ MODIFICATO — collega tasto e Sidebar, salva lo stato con storage.js
└── tests/
    ├── sidebar.spec.js     # ♻️ MODIFICATO — +12 controlli (38)
    └── home.spec.js        # ♻️ MODIFICATO — +1 controllo, ordine di tabulazione aggiornato (76)
```

Evento nuovo: `sl:sidebar-toggle` (detail `{ collapsed }`), emesso da AppHeader. Chiave di storage nuova: `sl-sidebar-collapsed`.

**Come applicare:** copiare i 7 file dello zip mantenendo i percorsi; nessun file eliminato in questo intervento.

---

## 4. Decisioni progettuali

| Decisione | Motivazione |
|---|---|
| Il comando sta nella barra superiore, non nella Sidebar | resta raggiungibile anche con la Sidebar chiusa (altrimenti nessuno potrebbe riaprirla) |
| Nome accessibile fisso "Menu laterale" + `aria-expanded` | lo stato lo comunica `aria-expanded`; cambiare anche l'etichetta annuncerebbe due volte |
| Stato salvato con `storage.js` | la shell si ricostruisce ad ogni rotta: senza memoria, la colonna si riaprirebbe a ogni scenario |
| Chiusura/apertura istantanea (nessuna animazione) | sobrio e senza rischi; stesso criterio di Modal/ProfileMenu per la chiusura |
| Tasti-icona senza sfondo, hover = colore | richiesta del docente; `primary-text` su `bg-surface` 6.13:1 Light / 5.21:1 Dark (già verificato), a riposo `text-primary` 17.05 / 16.04 |
| `aria-current` sul tasto Home resta, senza effetto visivo | informazione per gli screen reader, nessun rumore visivo |
| Estensioni additive di `AppHeader`/`Sidebar` | la style guide e ogni consumer che non passa le nuove props restano identici |

---

## 5. Attività rimanenti

**Decisione aperta — il nome.** Alternative nuove rispetto a quelle già proposte (Ribalta, Specchio, ScenaLab, AulaLive,
DigiProf). La verifica web è **indicativa**, non una ricerca di marchio; per le parole molto comuni il web restituisce solo
dizionari, quindi non sono verificate.

| # | Nome | Idea | Nota |
|---|---|---|---|
| 1 | **Controluce** | ciò che normalmente non vedi (dati, tracce, conseguenze) diventa visibile; logo: cerchio con una mezzaluna di luce | non verificato |
| 2 | **Verosimile** | è il principio del progetto: tutto deve sembrare vero | descrittivo e ownable; non verificato |
| 3 | **Argine** | la protezione; breve, sobrio | evoca anche le alluvioni; non verificato |
| 4 | **Occhio** | "Occhio!": attenzione, tono amichevole | forse troppo informale; non verificato |
| 5 | **Presidio** | punto di guardia e controllo, professionale, lontano dal "social" | generico; non verificato |
| 6 | **Bussola** | orientarsi nel digitale | molto diffuso come nome; non verificato |
| 7 | **Sipario** | il sipario si alza sullo scenario (come Ribalta, stessa metafora teatrale) | non verificato |
| ✗ | Scenarium | — | **scartato**: troppo vicino a "Scenari", suite open source francese per contenuti didattici |

Controllato in questo giro anche **Ribalta** (la raccomandazione precedente): nessun prodotto omonimo nell'ambito della
sicurezza informatica nelle prime ricerche — non è una clearance.

**Raccomandazione:** Ribalta, Controluce, Verosimile (in ordine di preferenza). Qualunque sia: controllo di marchio
(UIBM/EUIPO), dominio e nome su GitHub prima di adottarlo. Se vuoi un nome in famiglia con PixelProf ("…Prof"), dimmelo e
propongo quel filone (i primi controlli su DigiProf hanno trovato un conflitto).

*Costo del rename (misurato):* 7 stringhe visibili (titolo del login, marchio e segnaposto della ricerca, titolo di ogni scheda,
`<title>`, due disclaimer dei file di log) + `style-guide.html`, `README`, ~10 asserzioni dei test. Si centralizza il nome in un
unico punto di configurazione. Restano il prefisso CSS `sl-` e le chiavi `sl-*` (rinominarli farebbe perdere tema e sessione).

---

## 6. Prossima fase

Scelto il nome: verifica, configurazione unica del marchio, logo SVG (marchio + solo icona), favicon, 7 stringhe, test,
screenshot Light/Dark della barra e del login.

---

## 7. Prompt di continuità

```
Sto proseguendo lo sviluppo di SOCIALIVE ("SocialAlive - Interactive Cybersecurity Learning Platform"), piattaforma
didattica usata dal docente e proiettata in classe. Allego l'handover: è la fonte di verità, ma VERIFICA SEMPRE il
repository reale prima di fidarti di qualunque handover.

STATO: Home = saluto + card per area (Cybersecurity, AI) da data/modules.json via js/utils/scenarioCatalog.js, con
ricerca-filtro. Sidebar: sottomenu "Scenari" a fisarmonica (sempre chiuso all'avvio, aree esclusive, voce esterna PixelProf da
data/external-links.json) E colonna intera richiudibile con il tasto "Menu laterale" della barra superiore (stato ricordato in
localStorage "sl-sidebar-collapsed"). Barra superiore: [Menu laterale] [marchio] [Home] ... ricerca ... profilo; i tasti-icona
non hanno sfondo (hover = colore). Immersivi (chrome:"none"): niente barra, uscita "×". Suite 343/343 (login 19, home 76,
sidebar 38, scenario 82, phishing 35, token 38, llm 56).

DA FARE: scegliere il nome (Ribalta, Controluce, Verosimile le preferite; altre in handover §5), poi marchio unico, logo SVG,
favicon, 7 stringhe visibili, test, README/style-guide. Restano prefisso CSS "sl-" e chiavi di storage "sl-*".

REGOLE: stack HTML/CSS/JS nativo; componenti create(props)→{element,update,destroy}; page controller (container,params)→
destroy; eventi "sl:nome"; componenti "dumb"; estensioni additive; token --sl-*; ogni NUOVO accostamento colore verificato
numericamente; ".classe[hidden]{display:none}" se la classe dichiara display; non toccare data/users.json; credenziali di
test solo da SL_TEST_EMAIL/SL_TEST_PASSWORD (sandbox: usa-e-getta); nessun elemento didattico visibile dentro gli scenari;
proponi e attendi conferma prima di implementare; handover a 10 sezioni (.md) + zip a fine intervento.

NOTE DI AMBIENTE: Chromium della sandbox compatibile con Playwright globale 1.56 (tests/node_modules del repo è 1.62.1: usare
NODE_PATH al globale). Per aprire "Scenari" nei test: openScenariosMenu (tests/helpers/sidebar.js).
```

---

## 8. Test da eseguire

### Test funzionali
- [x] Tasto "Menu laterale": a sinistra del marchio, `aria-expanded`, `aria-controls` verso la Sidebar, icona decorativa, ≥ 44px.
- [x] Click: la colonna si chiude (non visibile), il contenuto guadagna ≥ 230px, nessun overflow orizzontale; click di nuovo: si riapre.
- [x] Riaprendo, la fisarmonica è com'era (Scenari e Cybersecurity aperte).
- [x] Invio/Spazio chiudono e riaprono, il focus resta sul tasto; a colonna chiusa nessun elemento della Sidebar è raggiungibile con Tab.
- [x] Lo stato è ricordato: passando a uno scenario, dopo il ricaricamento, e in entrambe le direzioni; chiave `sl-sidebar-collapsed`.
- [x] 375px: tasto Menu non visibile, tasto Home visibile.
- [x] Tasto Home e tasto Menu: sfondo trasparente a riposo e all'hover, cambia solo il colore.
- [ ] Applicazione sul **repository reale** e `npm test` con le **credenziali reali** (in sandbox: usa-e-getta).

### Test UI
- [x] Ispezionati a vista: barra con i due tasti (Light), Home a colonna chiusa (Light).
- [ ] **Non ispezionati a vista:** tasti-icona in Dark; barra a 375px; hover del colore (verificato solo da asserzione).
- [ ] Verifica su un deploy reale di GitHub Pages.

### Test UX
- [x] Ordine di Tab: skip-link → Menu laterale → Home → ricerca → profilo → Sidebar → contenuto.

### Test tecnici
- [x] Console senza errori, nessun 404.

### Test di regressione
- [x] 343/343 su 7 suite.

---

## 9. Criticità

- **Interpretazione della richiesta:** avevo letto "fisarmonica" come il solo sottomenu; la correzione aggiunge la chiusura della colonna e
  lascia il sottomenu com'era. Se invece intendevi un'altra cosa (es. la colonna ridotta a una striscia di icone invece che nascosta),
  va detto: le voci oggi non hanno icone.
- **Il nome** blocca logo e favicon. Verifica web solo indicativa.
- **Dark e 375px della barra** non ispezionati a vista.
- Stato aperto/chiuso salvato solo su questo browser (`localStorage`): su un altro computer riparte aperto.

---

## 10. Debito tecnico

### Compromessi temporanei
- 🟢 Chiusura/apertura della colonna senza animazione (scelta, non limite tecnico).

### Refactoring consigliati
- 🟡 Marchio in un unico punto (oggi 7 stringhe) — si fa con il rename.
- 🟡 Igiene del repository (preesistente): `tests/node_modules` e `tests/screenshots/` versionati; `README.md` e `tests/README.md` obsoleti.

### Ottimizzazioni future
- 🟢 Scorciatoia da tastiera per chiudere/aprire il menu; colonna ridotta a icone se le voci ne avranno.
- 🟢 Frecce su/giù tra le intestazioni della fisarmonica.

### Rischi architetturali
- 🟢 Nessuno nuovo: tutte le estensioni sono additive e testate; lo stato è in un solo punto (`appShell.js`).

### Priorità
- 🟡 Media: marchio unico + nome; igiene repo. 🟢 Bassa: il resto.

### Obiettivo
Il docente governa lo spazio dello schermo (menu chiuso o aperto, ricordato), con tasti-icona puliti e nessun elemento in più
durante la proiezione.
