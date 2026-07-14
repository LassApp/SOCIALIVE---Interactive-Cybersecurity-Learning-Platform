# SocialAlive — SOCIALIVE

Piattaforma didattica per la formazione in Cybersecurity Awareness, ad uso esclusivo del docente e proiettata in classe. Non è un social network reale né un clone di piattaforme esistenti: riproduce con realismo il funzionamento di un moderno social network per mostrare scenari legati a comportamenti quotidiani e alle loro conseguenze sulla sicurezza digitale.

## Stato del progetto

- ✅ **Fase 1 — Fondamenta**: architettura, convenzioni, piano dei componenti (solo documentazione).
- 🔄 **Fase 2 — Design System e UI Core** (in corso):
  - Step 1 — token, temi Light/Dark, reset/global, `themeService`.
  - Step 2 — componenti `Button`, `Avatar`, `Badge`, `Card`.
  - Step 3 — componenti `ThemeSwitch`, `Input`.
  - Step 4 — componente `Modal` (incl. variante `dialog` per conferma/annulla).
- ⏳ Fase 3 — Autenticazione · Fase 4 — Home · Fase 5 — Sistema Scenari · Fase 6 — Scenario Oversharing · Fase 7 — Post e Media Viewer · Fase 8 — Dati (JSON) · Fase 9 — Rifinitura UX · Fase 10 — Audit finale.

## Stack tecnologico

HTML5, CSS3, JavaScript ES6+ (moduli nativi). Nessun framework, nessuna libreria UI. Predisposizione futura per Supabase (autenticazione, profili, impostazioni).

## Come eseguire in locale

I componenti usano moduli ES (`import`/`export`): non funzionano se il file HTML viene aperto direttamente con doppio click (protocollo `file://`, bloccato per CORS). Serve un piccolo server HTTP locale, ad esempio:

```bash
python -m http.server
# poi apri http://localhost:8000/style-guide.html
```

oppure l'estensione "Live Server" di VS Code, oppure `npx serve`. Su **GitHub Pages** funziona senza alcuna configurazione, essendo servito via HTTPS.

## Struttura cartelle

```
socialive/
├── style-guide.html      # strumento di QA interno (NON fa parte dell'app)
├── css/
│   ├── tokens/           # design token: colori primitivi, spaziature, tipografia, radius, ombre, motion
│   ├── themes/           # token semantici Light/Dark
│   ├── base/             # reset e baseline globale
│   └── components/       # un file per componente
└── js/
    ├── utils/            # storage.js, dom.js
    ├── services/         # themeService.js
    └── components/       # Button.js, Avatar.js, Badge.js, Card.js, ...
```

La struttura completa pianificata (comprese le cartelle non ancora popolate: `assets/`, `data/`, `js/core`, `js/pages`, ecc.) è descritta nel documento di architettura di Fase 1.

## Style Guide (QA interna)

`style-guide.html` non è una pagina dell'applicazione: è uno strumento di verifica usato durante lo sviluppo per validare a occhio i design token e i componenti (contrasto, temi, motion, comportamento). Viene ampliato ad ogni step della Fase 2.

## Licenza

Da definire.
