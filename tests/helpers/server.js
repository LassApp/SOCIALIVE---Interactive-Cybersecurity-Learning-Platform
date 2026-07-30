/**
 * helpers/server.js
 * -----------------------------------------------------------------------
 * Server statico minimale per servire l'app SOCIALIVE reale durante i
 * test — MAI file://, stessa regola già seguita manualmente in ogni fase
 * precedente (vedi handover Fase 2 §4: "server locale, mai file://").
 * Nessuna dipendenza esterna: solo i moduli nativi di Node (http/fs/
 * path). Introdurre "http-server"/"serve" come devDependency in più
 * sarebbe un pacchetto intero per un compito che http nativo risolve in
 * poche righe (KISS, stesso principio guida di tutto il progetto).
 *
 * Porta 0 → il sistema operativo ne assegna una libera: evita
 * collisioni tra esecuzioni successive nello stesso ambiente, stesso
 * principio già seguito manualmente in ogni fase precedente ("usa una
 * porta nuova ad ogni test", nota tecnica ricorrente dalla Fase 2 in
 * avanti) — qui non serve nemmeno più sceglierla a mano.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * Avvia un server statico che serve i file di "rootDir".
 * @param {string} rootDir cartella radice dell'app (contiene index.html)
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
function startServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      // path.normalize + controllo ".." previene un path traversal
      // banale — difensivo anche in un server locale usato solo per i
      // test, stesso criterio di validazione prudente già seguito
      // altrove nel progetto (es. compilePattern in router.js).
      const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
      const resolved = path.normalize(path.join(rootDir, requestedPath));
      if (!resolved.startsWith(path.normalize(rootDir))) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      fs.readFile(resolved, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end(`Not found: ${urlPath}`);
          return;
        }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        res.end(data);
      });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

module.exports = { startServer };
