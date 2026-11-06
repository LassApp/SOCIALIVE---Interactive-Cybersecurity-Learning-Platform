/**
 * diskPatterns.js
 * -----------------------------------------------------------------------
 * Resa grafica dei file: ogni file è distinguibile per COLORE + TRAMA +
 * NUMERO (il colore non è mai l'unico segnale, WCAG 1.4.1). I valori
 * (colore, accento, nome della trama) arrivano da disk.json; qui c'è solo
 * la traduzione in CSS per le celle HTML e in <pattern> per le scene SVG.
 * Trame: solid, stripes, dots, grid, hatch (la trama dei dati preesistenti).
 */

/** Valore CSS "background" di una cella HTML. */
export function cellBackground({ color, accent, pattern }) {
  switch (pattern) {
    case "stripes":
      return `repeating-linear-gradient(45deg, ${color} 0 5px, ${accent} 5px 7px)`;
    case "dots":
      return `radial-gradient(${accent} 1.6px, transparent 2px) 0 0/7px 7px, ${color}`;
    case "grid":
      return `linear-gradient(90deg, ${accent} 1.5px, transparent 1.5px) 0 0/7px 7px, linear-gradient(${accent} 1.5px, transparent 1.5px) 0 0/7px 7px, ${color}`;
    case "hatch":
      return `repeating-linear-gradient(135deg, ${color} 0 3px, ${accent} 3px 6px)`;
    default:
      return color;
  }
}

/** Markup (statico, numerico) di un <pattern> SVG; l'id è univoco per scena. */
function patternMarkup(id, { color, accent, pattern }) {
  const base = `<rect width="5" height="5" fill="${color}"/>`;
  const open = `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"`;
  switch (pattern) {
    case "stripes":
      return `${open} patternTransform="rotate(45)">${base}<rect width="2" height="5" fill="${accent}"/></pattern>`;
    case "dots":
      return `${open}>${base}<circle cx="2.5" cy="2.5" r="1" fill="${accent}"/></pattern>`;
    case "grid":
      return `${open}>${base}<path d="M0 0H5M0 0V5" stroke="${accent}" stroke-width=".8"/></pattern>`;
    case "hatch":
      return `${open} patternTransform="rotate(135)">${base}<rect width="2" height="5" fill="${accent}"/></pattern>`;
    default:
      return `${open}>${base}</pattern>`;
  }
}

/**
 * Costruisce <defs> e la mappa id→fill per una scena SVG.
 * @param {number|string} scope  identificatore univoco della scena
 * @param {Array<object>} styles file + dati preesistenti (id, color, accent, pattern)
 */
export function buildSvgFills(scope, styles) {
  const fills = {};
  const patterns = styles.map((style) => {
    const id = `dk-${scope}-${style.id}`;
    fills[style.id] = `url(#${id})`;
    return patternMarkup(id, style);
  });
  return { defs: `<defs>${patterns.join("")}</defs>`, fills };
}
