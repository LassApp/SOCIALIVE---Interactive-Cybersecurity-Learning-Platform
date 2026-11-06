/**
 * diskScene3d.js
 * -----------------------------------------------------------------------
 * Scene 3D dei due supporti (HDD e SSD) dello scenario "HDD vs SSD".
 * Nessuna libreria: CSS 3D (perspective + rotateX/rotateZ) per la
 * "camera", SVG per il disegno. Due fabbriche con la STESSA interfaccia:
 *
 *   scene.element            nodo da montare
 *   scene.bind(state)        {g, n}: stato dei cluster (letto a ogni repaint)
 *   scene.repaint()          ridisegna colori/numeri (e la lente, se aperta)
 *   scene.reset()            vista d'insieme, senza transizione, testina a riposo
 *   scene.travel(c)          sposta testina (HDD) / accende il bus (SSD) verso il cluster
 *                            → true se cambia traccia (HDD) / chip (SSD)
 *   scene.zoomIn(c, hl)      la camera si avvicina al settore (HDD) / chip (SSD) del
 *                            cluster; hl=false: nessun cluster evidenziato
 *   scene.out()              zoom out alla vista d'insieme
 *   scene.light(c)           evidenzia il cluster nella lente
 *   scene.zoomKey()/key(c)   gruppo ingrandito / gruppo di un cluster (settore o chip)
 *   scene.hit(target)        gruppo sotto un elemento cliccato (o null)
 *   scene.home()             testina a riposo / bus spento
 *
 * LA VISTA LOGICA SI VEDE SOLO DA VICINO: a distanza l'HDD mostra solo
 * settori tinteggiati con il colore del file più recente; i quadretti dei
 * cluster compaiono nella "lente" che si apre sul settore ingrandito
 * (nello schema originario il cluster è un'unità logica, non una divisione
 * fisica visibile) con una didascalia che lo dichiara.
 *
 * LA TELECAMERA — la trasformazione composta è, da destra a sinistra:
 * traslazione del punto d'interesse al centro, rotazione che raddrizza il
 * settore, ingrandimento, inclinazione. Tra settori diversi l'HDD fa
 * sempre zoom out → sposta la testina → zoom in.
 *
 * ROTAZIONE DEL PIATTO — i settori restano fermi nello schema (sono
 * indirizzi, non oggetti): la rotazione è resa da riflessi e da un
 * raggio tratteggiato che girano sopra il piatto (animazione CSS, ferma
 * con prefers-reduced-motion; durata scalata da --k).
 *
 * COLORI — le superfici della scena (piatto metallico, scheda) hanno
 * valori FISSI uguali nei due temi, come il Media Viewer: sono oggetti
 * fisici sullo sfondo della pagina, non superfici dell'interfaccia.
 *
 * Il markup SVG è statico e solo numerico (nessun testo da JSON): viene
 * letto con DOMParser, mai assemblato da dati esterni.
 */

import { createElement } from "./dom.js";
import { buildSvgFills } from "./diskPatterns.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SK = 300 / 260; // px per unità del viewBox (l'SVG è largo 300px)
const PLATE_CENTER = 130;
const PIVOT = 248; // perno del braccio (angolo in basso a destra)
const HOME = { x: 226, y: 226 };

let sceneCounter = 0;

function parseSvg(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  return document.importNode(doc.documentElement, true);
}

const point = (r, a) => [PLATE_CENTER + r * Math.cos(a), PLATE_CENTER + r * Math.sin(a)];

// Geometria di un settore (traccia t, settore s): corona circolare di 90°.
function sectorGeometry(t, s) {
  const ri = 30 + t * 32;
  const ro = ri + 28;
  const a0 = ((-90 + s * 90 + 1.5) * Math.PI) / 180;
  const a1 = ((-90 + s * 90 + 88.5) * Math.PI) / 180;
  const am = (a0 + a1) / 2;
  const [mx, my] = point(ri + 14, am);
  return { am, mx, my, d: `M${point(ro, a0)}A${ro} ${ro} 0 0 1 ${point(ro, a1)}L${point(ri, a1)}A${ri} ${ri} 0 0 0 ${point(ri, a0)}Z` };
}

function setupScene(kind, { small }) {
  const plate = createElement("div", { classNames: "sl-disk-scene__plate" });
  const cam = createElement("div", { classNames: ["sl-disk-scene__cam", kind === "ssd" ? "sl-disk-scene__cam--fast" : ""] }, [plate]);
  const note = createElement("p", { classNames: "sl-disk-scene__lens-note" });
  const element = createElement("div", { classNames: ["sl-disk-scene", small ? "sl-disk-scene--sm" : ""] }, [cam, note]);
  return { plate, cam, note, element };
}

const tintOf = (styles, id) => styles.find((s) => s.id === id)?.color;

/* ------------------------------ HDD ---------------------------------- */

export function createHddScene({ styles, textColors, lensNote, ariaLabel, overview = 1, small = false }) {
  const id = (sceneCounter += 1);
  const { defs, fills } = buildSvgFills(id, styles);
  const geometry = [];
  for (let t = 0; t < 3; t += 1) for (let s = 0; s < 4; s += 1) geometry.push(sectorGeometry(t, s));

  const { plate, cam, note, element } = setupScene("hdd", { small });
  [12, 8, 4].forEach((depth, i) => {
    const layer = createElement("div", { classNames: "sl-disk-scene__rim" });
    layer.style.transform = `translateZ(-${depth}px)`;
    layer.style.opacity = String(1 - i * 0.12);
    plate.appendChild(layer);
  });
  const lensCells = [0, 1, 2, 3]
    .map((q) => `<rect data-q="${q}" x="${q & 1 ? 1 : -13}" y="${q & 2 ? 1 : -13}" width="12" height="12" rx="1.5" class="sl-disk-scene__lens-cell"/><text data-t="${q}" x="${q & 1 ? 7 : -7}" y="${q & 2 ? 7 : -7}" font-size="8" font-weight="700" text-anchor="middle" dominant-baseline="central"></text>`)
    .join("");
  const svg = parseSvg(`<svg xmlns="${SVG_NS}" viewBox="0 0 260 260" role="img" aria-label="${ariaLabel}">${defs}
<circle cx="130" cy="130" r="126" fill="#d5d9e0" stroke="#7a8190"/>
${geometry.map((g, i) => `<path d="${g.d}" fill="#ffffff" stroke="#9aa1b0" stroke-width=".8" data-s="${i}" class="sl-disk-scene__sector"/>`).join("")}
<g class="sl-disk-scene__spin"><path d="M130 130L130 4A126 126 0 0 1 205 28Z" fill="#fff" opacity=".4"/><path d="M130 130L130 256A126 126 0 0 1 55 232Z" fill="#fff" opacity=".4"/><path d="M130 130L8 130" stroke="#7a8190" stroke-dasharray="2 5"/></g>
<circle cx="130" cy="130" r="14" fill="#7a8190"/><circle cx="130" cy="130" r="4" fill="#fff"/>
<g class="sl-disk-scene__lens"><rect x="-17" y="-17" width="34" height="34" rx="3" fill="#fff" fill-opacity=".7" class="sl-disk-scene__lens-box"/>${lensCells}</g>
<circle cx="${PIVOT}" cy="${PIVOT}" r="9" fill="#4a5062"/>
<g class="sl-disk-scene__arm" style="transform:translate(${PIVOT}px,${PIVOT}px) rotate(225deg) scale(31,1)"><rect y="-2.5" width="1" height="5" fill="#2c3038"/></g>
<circle class="sl-disk-scene__tip" r="4.5" fill="#e1483d" stroke="#fff" stroke-width="1.5" style="transform:translate(${HOME.x}px,${HOME.y}px)"/></svg>`);
  plate.appendChild(svg);
  note.textContent = lensNote;

  const lens = svg.querySelector(".sl-disk-scene__lens");
  const arm = svg.querySelector(".sl-disk-scene__arm");
  const tip = svg.querySelector(".sl-disk-scene__tip");
  const sectorEls = geometry.map((_, i) => svg.querySelector(`path[data-s="${i}"]`));
  const overviewTransform = `rotateX(58deg) scale(${overview})`;
  cam.style.transform = overviewTransform;

  let state = null;
  let zoomed = null;
  let highlighted = -1;
  let track = -1;

  // Posizione globale di un cluster dentro la lente del suo settore.
  function infoOf(c) {
    const g = geometry[c >> 2];
    const theta = (g.am * 180) / Math.PI + 90;
    const rad = (theta * Math.PI) / 180;
    const slot = c & 3;
    const lx = slot & 1 ? 7 : -7;
    const ly = slot & 2 ? 7 : -7;
    return { g, theta, x: g.mx + lx * Math.cos(rad) - ly * Math.sin(rad), y: g.my + lx * Math.sin(rad) + ly * Math.cos(rad) };
  }

  function setArm(x, y) {
    const dx = x - PIVOT;
    const dy = y - PIVOT;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    arm.style.transform = `translate(${PIVOT}px,${PIVOT}px) rotate(${angle}deg) scale(${Math.hypot(dx, dy)},1)`;
    tip.style.transform = `translate(${x}px,${y}px)`;
  }

  function tint() {
    geometry.forEach((_, i) => {
      const used = [0, 1, 2, 3].map((j) => state.g[i * 4 + j]).filter((k) => k !== ".");
      const last = used[used.length - 1];
      sectorEls[i].setAttribute("fill", last ? tintOf(styles, last) : "#ffffff");
      sectorEls[i].setAttribute("fill-opacity", last ? 0.55 : 1);
    });
  }

  function paintLens() {
    if (zoomed === null) return;
    const base = zoomed * 4;
    [0, 1, 2, 3].forEach((j) => {
      const k = state.g[base + j];
      const rect = lens.querySelector(`[data-q="${j}"]`);
      const text = lens.querySelector(`[data-t="${j}"]`);
      rect.setAttribute("fill", k === "." ? "none" : fills[k]);
      rect.classList.toggle("is-free", k === ".");
      rect.classList.toggle("is-hl", base + j === highlighted);
      const numbered = k !== "." && textColors[k] && k !== "n";
      text.textContent = numbered ? state.n[base + j] : "";
      text.setAttribute("fill", textColors[k] || "#ffffff");
    });
  }

  return {
    element,
    bind(next) {
      state = next;
      tint();
    },
    repaint() {
      tint();
      paintLens();
    },
    zoomKey: () => zoomed,
    key: (c) => c >> 2,
    reset() {
      cam.classList.add("is-instant");
      cam.style.transform = overviewTransform;
      lens.classList.remove("is-on");
      note.classList.remove("is-on");
      zoomed = null;
      highlighted = -1;
      track = -1;
      setArm(HOME.x, HOME.y);
      void cam.offsetWidth; // forza lo stato senza transizione prima di riattivarla
      cam.classList.remove("is-instant");
    },
    travel(c) {
      const info = infoOf(c);
      const changed = track !== c >> 4;
      track = c >> 4;
      setArm(info.x, info.y);
      return changed;
    },
    zoomIn(c, highlight = true) {
      const info = infoOf(c);
      zoomed = c >> 2;
      highlighted = highlight ? c : -1;
      paintLens();
      lens.setAttribute("transform", `translate(${info.g.mx} ${info.g.my}) rotate(${info.theta})`);
      // Angolo normalizzato in (-180, 180]: il raddrizzamento non gira mai più di mezzo giro.
      const straighten = ((info.theta + 180) % 360 + 360) % 360 - 180;
      cam.style.transform = `rotateX(36deg) scale(${4 * overview}) rotateZ(${-straighten}deg) translate(${-(info.g.mx - PLATE_CENTER) * SK}px,${-(info.g.my - PLATE_CENTER) * SK}px)`;
      lens.classList.add("is-on");
      note.classList.add("is-on");
    },
    out() {
      zoomed = null;
      cam.style.transform = overviewTransform;
      lens.classList.remove("is-on");
      note.classList.remove("is-on");
    },
    light(c) {
      highlighted = c;
      paintLens();
    },
    home() {
      setArm(HOME.x, HOME.y);
    },
    hit(target) {
      const sector = target?.closest?.("[data-s]");
      return sector ? Number(sector.dataset.s) : null;
    },
  };
}

/* ------------------------------ SSD ---------------------------------- */

const chipOrigin = (i) => ({ x: 24 + (i % 3) * 76, y: i < 3 ? 18 : 72 });
const TRACES = [
  "M130 140V130H93V41H86", "M130 140V130H93V41H100", "M130 140V130H169V41H176",
  "M130 140V130H93V95H86", "M130 140V130H93V95H100", "M130 140V130H169V95H176",
];

export function createSsdScene({ styles, textColors, lensNote, ariaLabel, chipLabel, overview = 1, small = false }) {
  const id = (sceneCounter += 1);
  const { defs, fills } = buildSvgFills(id, styles);
  const { plate, cam, note, element } = setupScene("ssd", { small });
  plate.style.height = "231px";
  const chips = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const c = chipOrigin(i);
      const cells = [0, 1, 2, 3, 4, 5, 6, 7]
        .map((j) => `<rect data-c="${i * 8 + j}" x="${c.x + 6 + (j % 4) * 13}" y="${c.y + 14 + (j >> 2) * 14}" width="11" height="11" rx="1.5" class="sl-disk-scene__flash-cell"/><text data-n="${i * 8 + j}" x="${c.x + 11.5 + (j % 4) * 13}" y="${c.y + 19.5 + (j >> 2) * 14}" font-size="7" font-weight="700" text-anchor="middle" dominant-baseline="central"></text>`)
        .join("");
      return `<g data-k="${i}"><rect x="${c.x + 3}" y="${c.y + 4}" width="62" height="46" rx="4" fill="#0b161a"/><rect x="${c.x}" y="${c.y}" width="62" height="46" rx="4" fill="#2c3038" stroke="#8a90a0"/><text x="${c.x + 31}" y="${c.y + 9}" font-size="7" fill="#d5d9e0" text-anchor="middle">${chipLabel} ${i + 1}</text>${cells}</g>`;
    })
    .join("");
  const svg = parseSvg(`<svg xmlns="${SVG_NS}" viewBox="0 0 260 200" role="img" aria-label="${ariaLabel}">${defs}
<rect x="15" y="20" width="240" height="180" rx="10" fill="#0b161a"/><rect x="10" y="10" width="240" height="180" rx="10" fill="#1d5a66" stroke="#0e2a30"/><rect x="100" y="190" width="60" height="9" fill="#d9b84a"/>
${TRACES.map((d, i) => `<path class="sl-disk-scene__trace" data-t="${i}" d="${d}"/>`).join("")}
${chips}
<rect x="103" y="143" width="60" height="34" rx="6" fill="#0b161a"/><rect x="100" y="140" width="60" height="34" rx="6" fill="#4a5062" stroke="#d5d9e0"/><text x="130" y="157" font-size="9" fill="#ffffff" text-anchor="middle" dominant-baseline="central">Controller</text></svg>`);
  plate.appendChild(svg);
  note.textContent = lensNote;

  const overviewTransform = `rotateX(52deg) rotateZ(-20deg) scale(${overview})`;
  cam.style.transform = overviewTransform;
  const cellEls = Array.from({ length: 48 }, (_, c) => ({
    rect: svg.querySelector(`rect[data-c="${c}"]`),
    text: svg.querySelector(`text[data-n="${c}"]`),
  }));
  const traces = Array.from(svg.querySelectorAll(".sl-disk-scene__trace"));

  let state = null;
  let zoomed = null;
  let highlighted = -1;

  function paint() {
    cellEls.forEach(({ rect, text }, c) => {
      const k = state.g[c];
      rect.setAttribute("fill", k === "." ? "none" : fills[k]);
      rect.classList.toggle("is-free", k === ".");
      rect.classList.toggle("is-hl", c === highlighted);
      text.textContent = k !== "." && k !== "n" ? state.n[c] : "";
      text.setAttribute("fill", textColors[k] || "#ffffff");
    });
  }
  const busOff = () => traces.forEach((t) => t.classList.remove("is-on"));

  return {
    element,
    bind(next) {
      state = next;
      paint();
    },
    repaint: paint,
    zoomKey: () => zoomed,
    key: (c) => c >> 3,
    reset() {
      cam.classList.add("is-instant");
      cam.style.transform = overviewTransform;
      note.classList.remove("is-on");
      zoomed = null;
      highlighted = -1;
      busOff();
      void cam.offsetWidth;
      cam.classList.remove("is-instant");
    },
    travel(c) {
      busOff();
      traces[c >> 3].classList.add("is-on");
      return true;
    },
    zoomIn(c, highlight = true) {
      const origin = chipOrigin(c >> 3);
      zoomed = c >> 3;
      highlighted = highlight ? c : -1;
      paint();
      cam.style.transform = `rotateX(40deg) rotateZ(-6deg) scale(${2.7 * overview}) translate(${-(origin.x + 31 - 130) * SK}px,${-(origin.y + 23 - 100) * SK}px)`;
      note.classList.add("is-on");
    },
    out() {
      zoomed = null;
      cam.style.transform = overviewTransform;
      note.classList.remove("is-on");
      busOff();
    },
    light(c) {
      highlighted = c;
      paint();
    },
    home: busOff,
    hit(target) {
      const chip = target?.closest?.("[data-k]");
      return chip ? Number(chip.dataset.k) : null;
    },
  };
}
