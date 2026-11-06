/**
 * diskModel.js
 * -----------------------------------------------------------------------
 * Modello PURO dello scenario "HDD vs SSD" (type "disk-compare"): nessuna
 * dipendenza dal DOM né dalla rete. Dato il contenuto di disk.json calcola
 * lo stato del disco passaggio per passaggio.
 *
 * LO STATO È UNA FUNZIONE DEL NUMERO DI PASSAGGIO, non un accumulo di
 * effetti: buildScript() applica una sola volta, in ordine, le operazioni
 * di ogni passaggio e registra per ciascuno lo stato "prima" (prev) e
 * "dopo" (end). Aprire il passaggio N significa disegnare prev di N e poi
 * riprodurre l'animazione verso end di N: qualunque salto avanti o
 * indietro produce la stessa immagine, senza dover "annullare" nulla.
 *
 * GEOMETRIA — 48 cluster = 3 tracce × 4 settori × 4 cluster. L'indice di
 * cluster è l'ordine di lettura per traccia → settore → cluster:
 *   traccia = c >> 4, settore = (c & 15) >> 2, cluster nel settore = c & 3.
 * Un indice di griglia è quindi anche la posizione fisica sul disco.
 *
 * ALLOCAZIONE "first-fit": una scrittura occupa i primi cluster liberi in
 * ordine di indice (è il sistema operativo a sceglierli, non la testina).
 * I cluster sono segnati: '.' libero, 'n' dati preesistenti, altrimenti
 * l'id di un file (es. 'b'). "n" numera l'ordine di scrittura per file.
 *
 * Operazioni di un passaggio ("ops"):
 *   ["w", id]    scrive tutti i cluster del file nei primi liberi;
 *   ["d", id]    libera tutti i cluster del file (i dati restano sul
 *                supporto: è solo la segnatura di "disponibile");
 *   ["read", id] legge i cluster del file, in un ordine volutamente NON
 *                crescente (la testina li raggiunge come capita: la
 *                ricomposizione li rimette in ordine).
 * Ogni operazione produce una "fase" separata ({ op, cells, to, nn }):
 * così scrittura e cancellazione dello stesso file nello stesso passaggio
 * si animano entrambe, invece di compensarsi in un confronto tra stati.
 */

export const TRACKS = 3;
export const SECTORS = 4;
export const PER_SECTOR = 4;
export const CLUSTERS = TRACKS * SECTORS * PER_SECTOR;

const OPS = new Set(["w", "d", "read"]);

function fail(message) {
  throw new Error(`disk.json non valido: ${message}`);
}

/** Validazione di forma: un errore dei dati deve fermarsi qui, con un messaggio leggibile. */
export function validateDiskConfig(config) {
  if (!config || typeof config !== "object") fail("contenuto assente");
  ["labels", "actions", "settings", "timing", "existing", "comparison"].forEach((key) => {
    if (!config[key] || typeof config[key] !== "object") fail(`manca "${key}"`);
  });
  if (!Array.isArray(config.files) || config.files.length === 0) fail('manca "files"');
  const ids = new Set();
  config.files.forEach((file) => {
    if (!file.id || ids.has(file.id) || file.id === "." || file.id === config.existing.id) fail(`id file non valido: "${file.id}"`);
    ids.add(file.id);
    if (!(file.mb > 0) || !file.name || !file.color) fail(`file "${file.id}" incompleto`);
  });
  if (!Array.isArray(config.scenarios) || config.scenarios.length === 0) fail('manca "scenarios"');
  config.scenarios.forEach((scenario) => {
    if (scenario.medium !== "hdd" && scenario.medium !== "ssd") fail(`medium non valido in "${scenario.id}"`);
    const init = (scenario.init || []).join("");
    if (init.length !== CLUSTERS) fail(`"${scenario.id}": init deve avere ${CLUSTERS} cluster (trovati ${init.length})`);
    [...init].forEach((ch) => {
      if (ch !== "." && ch !== config.existing.id) fail(`"${scenario.id}": carattere di init sconosciuto "${ch}"`);
    });
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) fail(`"${scenario.id}": nessun passaggio`);
    scenario.steps.forEach((step, i) => {
      if (!step.title || !step.text) fail(`"${scenario.id}" passaggio ${i + 1} senza titolo o testo`);
      (step.ops || []).forEach(([op, id]) => {
        if (!OPS.has(op) || !ids.has(id)) fail(`"${scenario.id}" passaggio ${i + 1}: operazione non valida [${op}, ${id}]`);
      });
    });
  });
  const { timing, settings } = config;
  if (!(timing.hddTotalMs > 0) || !(timing.ratio >= 1)) fail('"timing" non valido');
  if (!Array.isArray(settings.speeds) || !settings.speeds.some((s) => s.value === settings.defaultSpeed)) fail('"settings" non valido');
  return config;
}

/**
 * Calcola, per ogni passaggio dello scenario, stato prima/dopo e fasi.
 * @returns {Array<object>} copie dei passaggi arricchite con prev/end/phases/read
 */
export function buildScript(scenario, files) {
  const sizes = Object.fromEntries(files.map((f) => [f.id, f.mb]));
  const g = [...scenario.init.join("")];
  const n = Array(CLUSTERS).fill(0);

  return scenario.steps.map((step) => {
    const prev = { g: [...g], n: [...n] };
    const phases = [];
    (step.ops || []).forEach(([op, id]) => {
      const before = [...g];
      let cells;
      if (op === "w") {
        let written = 0;
        for (let i = 0; i < CLUSTERS && written < sizes[id]; i += 1) {
          if (g[i] === ".") {
            g[i] = id;
            written += 1;
            n[i] = written;
          }
        }
        cells = g.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
      } else if (op === "d") {
        g.forEach((v, i) => {
          if (v === id) {
            g[i] = ".";
            n[i] = 0;
          }
        });
        cells = g.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
      } else {
        // Ordine di lettura volutamente NON crescente: salti di 3 posizioni (una
        // permutazione valida quando il numero di cluster non è multiplo di 3,
        // es. gli 8 di foto_sushi); se lo è, ordine inverso.
        const own = g.map((v, i) => (v === id ? i : -1)).filter((i) => i >= 0);
        cells = own.length % 3 === 0 ? [...own].reverse() : own.map((_, i) => own[(i * 3 + 2) % own.length]);
      }
      phases.push({ op, cells, to: cells.map((i) => g[i]), nn: cells.map((i) => n[i]) });
    });
    return { ...step, prev, end: { g: [...g], n: [...n] }, phases, read: phases.some((p) => p.op === "read") };
  });
}

/** Numero di gruppi di cluster contigui di un file (>1 = frammentato). */
export function groupCount(g, id) {
  return g.filter((v, i) => v === id && g[i - 1] !== id).length;
}

/** Riepilogo numerico: cluster dei file / preesistenti / liberi. */
export function summarize(g, existingId) {
  const free = g.filter((v) => v === ".").length;
  const existing = g.filter((v) => v === existingId).length;
  return { files: CLUSTERS - free - existing, existing, free };
}

/** Sequenza piatta di eventi di un'intera sequenza di scrittura, per il confronto affiancato. */
export function flattenEvents(script) {
  return script
    .flatMap((step) => step.phases)
    .flatMap((phase) => phase.cells.map((c, j) => ({ c, to: phase.to[j], n: phase.nn[j], op: phase.op })));
}

export function formatTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}
