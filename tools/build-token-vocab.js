/**
 * build-token-vocab.js
 * -----------------------------------------------------------------------
 * Strumento di SVILUPPO (non fa parte dell'app spedita): genera
 * data/scenarios/tokenizzazione/token-vocab.json a partire dall'albero
 * token-tree.json, associando a ogni parola la sua TOKENIZZAZIONE REALE
 * (BPE "o200k_base", lo stesso schema usato da GPT-4o) con i relativi ID.
 *
 * Quando eseguirlo: ogni volta che si aggiunge o si cambia una parola in
 * token-tree.json. Il test tests/token.spec.js fallisce se il
 * vocabolario non copre tutte le parole dell'albero.
 *
 *   cd tools && npm install && npm run build:token-vocab
 *
 * PERCHÉ "plain" E "spaced": un tokenizer vero distingue "giornata" da
 * " giornata" (con lo spazio davanti) e assegna ID diversi. Quale delle
 * due forme valga in una frase dipende dal token precedente
 * (js/utils/tokenText.js, needsSpaceBefore): qui si generano sempre
 * entrambe, così lo script non duplica quella regola e il renderer
 * sceglie la forma giusta a runtime.
 *
 * SEMPLIFICAZIONE DICHIARATA: nell'albero i candidati sono PAROLE, per
 * leggibilità in aula; un LLM reale prevede invece questi pezzi
 * ("token"), spesso sotto-parole. Il vocabolario serve a mostrare quanto
 * i due livelli differiscano, non a cambiare ciò che viene animato.
 *
 * Nessun salvataggio di date/ora nell'output: il file è deterministico,
 * così rieseguire lo script senza modifiche all'albero non produce diff.
 */
const fs = require("node:fs");
const path = require("node:path");
const { encode, decode } = require("gpt-tokenizer/encoding/o200k_base");
const pkg = require("gpt-tokenizer/package.json");

const DATA_DIR = path.join(__dirname, "..", "data", "scenarios", "tokenizzazione");
const TREE_PATH = path.join(DATA_DIR, "token-tree.json");
const VOCAB_PATH = path.join(DATA_DIR, "token-vocab.json");

function collectTokens(tree) {
  const tokens = new Set([tree.root]);
  (function walk(nodes) {
    nodes.forEach((node) => {
      tokens.add(node.token);
      if (node.children) walk(node.children);
    });
  })(tree.children);
  return [...tokens];
}

function tokenize(text) {
  const ids = encode(text);
  const pieces = ids.map((id) => decode([id]));
  if (pieces.join("") !== text) {
    // Un pezzo che spezza un carattere multi-byte non è ricomponibile da
    // solo: meglio fermarsi che scrivere nel JSON un pezzo illeggibile.
    throw new Error(`Tokenizzazione non ricomponibile per ${JSON.stringify(text)}: ${JSON.stringify(pieces)}`);
  }
  return { pieces, ids };
}

const tree = JSON.parse(fs.readFileSync(TREE_PATH, "utf8"));
const vocab = {};
collectTokens(tree)
  .sort((a, b) => a.localeCompare(b, "it"))
  .forEach((token) => {
    vocab[token] = { plain: tokenize(token), spaced: tokenize(` ${token}`) };
  });

const output = {
  encoding: "o200k_base",
  generatedWith: `gpt-tokenizer@${pkg.version}`,
  tokens: vocab,
};

// Pezzi e ID su una riga ciascuno: il file resta leggibile e diffabile.
const lines = Object.entries(vocab).map(([token, forms]) => {
  const form = (f) => `{ "pieces": ${JSON.stringify(f.pieces)}, "ids": ${JSON.stringify(f.ids)} }`;
  return `    ${JSON.stringify(token)}: {\n      "plain": ${form(forms.plain)},\n      "spaced": ${form(forms.spaced)}\n    }`;
});
fs.writeFileSync(
  VOCAB_PATH,
  `{\n  "encoding": ${JSON.stringify(output.encoding)},\n  "generatedWith": ${JSON.stringify(output.generatedWith)},\n  "tokens": {\n${lines.join(",\n")}\n  }\n}\n`
);
console.log(`token-vocab.json: ${Object.keys(vocab).length} token distinti (${output.encoding}, ${output.generatedWith}).`);
