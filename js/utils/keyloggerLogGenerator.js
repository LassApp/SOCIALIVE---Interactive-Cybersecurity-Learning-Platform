/**
 * keyloggerLogGenerator.js
 * -----------------------------------------------------------------------
 * Generatore puro del file di log fittizio per lo scenario Keylogger
 * (type "fake-login-capture"). NESSUN dato esce mai dal browser: questa
 * funzione produce solo una stringa in memoria — il download avviene
 * altrove (fakeLoginCaptureRenderer.js, via Blob + <a download>). Vedi
 * la nota etica in testa a quel file per il vincolo completo.
 *
 * Contenuti (tag di log, nomi modulo, template dei messaggi, riga di
 * cattura, disclaimer finale) arrivano interamente da
 * data/scenarios/keylogger/log-template.json: questo file possiede solo
 * la LOGICA di generazione, mai un contenuto letterale specifico dello
 * scenario — coerente col principio di progetto "i contenuti non devono
 * essere scritti nel codice".
 *
 * GARANZIA "@" UNIVOCA (requisito pedagogico centrale dello scenario):
 * la riga di cattura è l'UNICO punto del file che può contenere "@" —
 * garantito da due meccanismi complementari, non uno solo:
 *   1. Il form a monte (LoginForm.js, prop emailValidation:"loose")
 *      impone che "username" contenga sempre almeno un "@" prima che il
 *      submit possa avvenire — quindi la riga di cattura contiene
 *      SEMPRE esattamente il valore digitato, con la sua "@" naturale,
 *      MAI un marcatore sintetico aggiunto da questo generatore (che
 *      altererebbe un'email vera se ne comparisse una seconda accanto).
 *   2. Ogni valore generato casualmente per il rumore (nomi modulo,
 *      buildId esadecimale, conteggi numerici) è per costruzione privo
 *      di "@": i pool in log-template.json sono testo naturale/hex, MAI
 *      un template libero che potrebbe introdurne uno per caso.
 * Il risultato: cercare "@" in un editor di testo porta SEMPRE e SOLO
 * alla riga di cattura, mai a un falso positivo nel rumore.
 *
 * Nessuna libreria per data/ora: Date native + padStart, stesso
 * principio già seguito da dateFormat.js (zero dipendenze per una
 * formattazione semplice).
 */

const LEVEL_WIDTH = 5; // "DEBUG" è il tag più lungo tra quelli previsti: allinea la colonna

function pad2(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function formatLogTimestamp(date) {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${pad3(date.getMilliseconds())}`
  );
}

function formatLevel(level) {
  return `[${level.padEnd(LEVEL_WIDTH, " ")}]`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[randomInt(0, list.length - 1)];
}

// Esadecimale puro (0-9a-f): mai un carattere "@", per costruzione —
// stesso principio di sicurezza già documentato in testa al file per
// l'intero pool di rumore.
function randomHex(length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += "0123456789abcdef"[randomInt(0, 15)];
  }
  return out;
}

// Sostituisce i placeholder di un template di messaggio con valori
// generati — ogni valore è testo/numero/hex, mai in grado di introdurre
// un "@" accidentale nel rumore.
function fillMessageTemplate(template, modules) {
  return template
    .replace(/\{module\}/g, () => pickRandom(modules))
    .replace(/\{ms\}/g, () => String(randomInt(4, 1800)))
    .replace(/\{count2\}/g, () => String(randomInt(0, 12)))
    .replace(/\{count\}/g, () => String(randomInt(1, 400)))
    .replace(/\{buildId\}/g, () => randomHex(8));
}

function buildNoiseLine(date, template) {
  const level = pickRandom(template.levels);
  const message = fillMessageTemplate(pickRandom(template.messageTemplates), template.modules);
  return `${formatLogTimestamp(date)} ${formatLevel(level)} ${message}`;
}

// Rimuove newline (difensivo, es. incolla accidentale) e sfugge le
// virgolette doppie: il valore digitato finisce dentro
// username="..."/password="..." nel testo del log — il file non viene
// mai riparsato da nulla, ma un log realistico non lascerebbe comunque
// una virgoletta non gestita al suo interno.
function sanitizeForLogValue(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/"/g, '\\"');
}

/**
 * @param {object} template  contenuto di log-template.json
 * @param {string} username  valore digitato nel campo email/username
 *   (già validato a monte: contiene sempre almeno un "@")
 * @param {string} password  valore digitato nel campo password
 * @param {Date}   [now]     istante di "fine sessione" (default: adesso)
 * @returns {{ fileName: string, content: string }}
 */
export function generateFakeLog(template, username, password, now = new Date()) {
  const lineCount = randomInt(template.lineCount.min, template.lineCount.max);
  const ratio = template.captureBlock.positionRatio;
  const captureIndex = Math.round(lineCount * (ratio.min + Math.random() * (ratio.max - ratio.min)));

  // La sessione fittizia TERMINA in "now" (il momento del click): le
  // righe vengono generate a ritroso nel tempo e poi lette in ordine
  // cronologico, così l'ultima riga del file risulta sempre coerente
  // con l'istante reale del download, mai nel futuro.
  const timestamps = [];
  let cursor = new Date(now);
  for (let i = lineCount - 1; i >= 0; i -= 1) {
    timestamps[i] = new Date(cursor);
    cursor = new Date(cursor.getTime() - randomInt(template.lineDelayMs.min, template.lineDelayMs.max));
  }

  const lines = [];
  for (let i = 0; i < lineCount; i += 1) {
    if (i === captureIndex) {
      // Riga "lead-in": annuncia la richiesta di login, nello stesso
      // stile di log del rumore circostante — nessun elemento
      // visivamente diverso che segnalerebbe "qui c'è qualcosa di
      // importante".
      lines.push(`${formatLogTimestamp(timestamps[i])} ${formatLevel("INFO")} ${template.leadInMessage}`);
      const captureLine = template.captureLine
        .replace("{username}", sanitizeForLogValue(username))
        .replace("{password}", sanitizeForLogValue(password));
      // Timestamp leggermente successivo al lead-in (stessa riga
      // temporale, frazione di secondo dopo) — non una nuova voce di
      // "timestamps[]", solo un piccolo offset cosmetico coerente con
      // due eventi che avvengono in rapida sequenza.
      const captureTime = new Date(timestamps[i].getTime() + randomInt(80, 400));
      lines.push(`${formatLogTimestamp(captureTime)} ${formatLevel("DEBUG")} ${captureLine}`);
    } else {
      lines.push(buildNoiseLine(timestamps[i], template));
    }
  }

  const disclaimerBlock = Array.isArray(template.disclaimer) ? template.disclaimer.join("\n") : "";
  const content = `${lines.join("\n")}\n\n${disclaimerBlock}\n`;

  const fileName = template.fileNamePattern
    .replace("{yyyyMMdd}", `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`)
    .replace("{HHmmss}", `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`);

  return { fileName, content };
}
