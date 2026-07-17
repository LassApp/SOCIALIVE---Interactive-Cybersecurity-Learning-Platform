# SOCIALIVE --- Suite di Prompt

## Prompt #1 --- Fondamenta del progetto

**Obiettivo** - Creare la struttura del progetto. - Definire cartelle,
Design System, routing, login, temi Light/Dark. - Predisporre il
progetto per GitHub e Supabase. - Non implementare ancora lo scenario
Oversharing.

**Deliverable** - Struttura directory - Architettura software -
Convenzioni di naming - Piano dei componenti - Piano dei file JSON

------------------------------------------------------------------------

## Prompt #2 --- Design System e UI Core

**Obiettivo** Realizzare i componenti UI riutilizzabili: - Header -
Sidebar/Menu profilo - Feed - Card post - Modali - Pulsanti - Form
login - Theme switch

Garantire accessibilità WCAG e responsive.

------------------------------------------------------------------------

## Prompt #3 --- Autenticazione

**Obiettivo** Creare la schermata di login predisposta per Supabase.

Implementare: - struttura HTML - CSS dedicato - validazione lato
client - separazione logica/UI

------------------------------------------------------------------------

## Prompt #4 --- Home della piattaforma

**Obiettivo** Creare la Home di SOCIALIVE.

Contenuti: - feed personale del docente - categorie (Yoga, Nissan GT-R
R34/R35, Beatbox, Fotografia, Cybersecurity, Ricette) - menu profilo -
accesso agli Scenari

------------------------------------------------------------------------

## Prompt #5 --- Sistema Scenari

**Obiettivo** Progettare un sistema modulare.

Ogni scenario deve poter essere aggiunto tramite JSON senza modificare
l'architettura.

Primo scenario: - Oversharing

Scenari futuri: - Phishing - Social Engineering - Fake News - Deepfake -
Malware - Password - QR Code - Ransomware

------------------------------------------------------------------------

## Prompt #6 --- Scenario Oversharing

**Obiettivo** Realizzare il profilo realistico.

Comprende: - profilo utente - stories - feed - timeline annuale - post
normali - post con dettagli sensibili - immagini in
assets/posts/oversharing

Nessun elemento didattico visibile.

------------------------------------------------------------------------

## Prompt #7 --- Post e Media Viewer

**Obiettivo** Realizzare: - apertura post - zoom immagini - navigazione
fluida - microinterazioni - caricamento immagini ottimizzato

------------------------------------------------------------------------

## Prompt #8 --- Dati

**Obiettivo** Spostare tutti i contenuti nei JSON.

Esempi: - profiles.json - lessons.json - feed.json - posts.json

Separare completamente dati e logica.

------------------------------------------------------------------------

## Prompt #9 --- Rifinitura UX

**Obiettivo** Ottimizzare: - animazioni - performance - responsive -
accessibilità - Design System - consistenza visiva

------------------------------------------------------------------------

## Prompt #10 --- Audit Finale

**Obiettivo** Eseguire una revisione completa.

Verificare: - qualità architetturale - debito tecnico -
riutilizzabilità - performance - accessibilità - predisposizione a
Supabase

Produrre un report con criticità e miglioramenti consigliati.

------------------------------------------------------------------------

# Regole

Ogni prompt deve: 1. rispettare l'architettura esistente; 2. non
introdurre duplicazioni; 3. mantenere HTML, CSS e JavaScript separati;
4. usare dati esterni (JSON) quando possibile; 5. preservare la
scalabilità della piattaforma; 6. motivare eventuali scelte
architetturali prima di implementarle.
