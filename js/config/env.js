/**
 * env.js
 * -----------------------------------------------------------------------
 * Configurazione del progetto Supabase (Fase 1 §11, gap dichiarato da
 * sempre — implementato per la prima volta ora).
 *
 * PERCHÉ QUESTO FILE È VERSIONATO CON VALORI REALI, NON GITIGNORED:
 * SUPABASE_ANON_KEY non è un segreto — è un valore pensato per essere
 * pubblico, la cui sicurezza reale è delegata a Row Level Security (RLS)
 * sul database Supabase, non alla segretezza della chiave. Questo è
 * concettualmente diverso da una "service_role" key (che NON deve MAI
 * apparire in codice client) e diverso anche dal passwordHash che viveva
 * in data/users.json (lì la "non segretezza" era un limite accettato per
 * mancanza di alternative; qui è un requisito di progettazione dello
 * stesso Supabase). Nessun build step esiste in questo progetto per
 * iniettare variabili d'ambiente al deploy — GitHub Pages serve solo
 * file statici — quindi questi valori DEVONO comunque esistere come
 * letterali in un file JS servito: non c'è una terza opzione tecnica.
 *
 * SUPABASE_URL: l'URL BASE del progetto (senza alcun suffisso di path):
 * il client Supabase aggiunge internamente /rest/v1, /auth/v1, ecc. — un
 * URL con un suffisso già presente (es. "/rest/v1/") produrrebbe
 * richieste doppie e rotte, motivo per cui va sempre verificato contro
 * Project Settings → API → "Project URL" (non l'endpoint REST mostrato
 * altrove nella Dashboard).
 *
 * SICUREZZA REALE DI QUESTA APP: dipende interamente dalle policy RLS
 * configurate sul progetto Supabase (nessuna tabella applicativa esiste
 * ancora in questo momento della migrazione — solo Auth), non da questo
 * file. Se in futuro verranno aggiunte tabelle (es. "profiles",
 * "settings" — Fase 1 §11), ciascuna dovrà avere RLS abilitata con
 * policy esplicite prima di essere considerata sicura.
 */

export const SUPABASE_URL = "https://tnvwfptcjjymwrnpcgsi.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudndmcHRjamp5bXdybnBjZ3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjE2MTEsImV4cCI6MjEwMjA5NzYxMX0.CHLaseOxm4KVrVmcq9LaGMFMp68oAToIS8tuTvbKYyU";
