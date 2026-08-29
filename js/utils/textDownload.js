/**
 * textDownload.js
 * -----------------------------------------------------------------------
 * Costruttore condiviso di un download di testo puro via Blob + <a
 * download> — MAI una richiesta di rete. Estratto in questo step:
 * fakeLoginCaptureRenderer.js (Keylogger) e fakeCaptivePortalRenderer.js
 * (Evil Twin Wi-Fi) hanno bisogno della stessa identica funzione — si
 * estrae al secondo consumo reale, stesso principio già seguito per
 * svg.js/fallbackMessage.js/imageFadeIn.js/mediaViewerLauncher.js.
 *
 * Il link non resta mai visibile: montato e smontato nello stesso
 * istante del click sintetico; URL.revokeObjectURL() è sicuro subito
 * dopo perché il download è già partito in modo sincrono dal click.
 *
 * @param {string} fileName
 * @param {string} content
 */
export function triggerTextDownload(fileName, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
