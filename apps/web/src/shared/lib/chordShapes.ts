/**
 * Guitar chord diagrams (EADGBE).
 * frets[i]: -1 mute, 0 open, >0 absolute fret.
 * baseFret: first fret shown on the diagram grid.
 */

export type ChordShape = {
  frets: number[];
  baseFret: number;
  /** Optional barre across strings (0 = low E … 5 = high E) */
  barre?: { fret: number; from: number; to: number };
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const ENHARMONIC: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  "C♯": "C#",
  "D♯": "D#",
  "F♯": "F#",
  "G♯": "G#",
  "A♯": "A#",
  "D♭": "C#",
  "E♭": "D#",
  "G♭": "F#",
  "A♭": "G#",
  "B♭": "A#",
};

/** Open-position shapes (preferred when available). */
const OPEN: Record<string, ChordShape> = {
  C: { frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
  Cm: { frets: [-1, 3, 5, 5, 4, 3], baseFret: 3, barre: { fret: 3, from: 1, to: 5 } },
  C7: { frets: [-1, 3, 2, 3, 1, 0], baseFret: 1 },
  Cm7: { frets: [-1, 3, 5, 3, 4, 3], baseFret: 3, barre: { fret: 3, from: 1, to: 5 } },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], baseFret: 1 },
  Csus2: { frets: [-1, 3, 0, 0, 1, 0], baseFret: 1 },
  Csus4: { frets: [-1, 3, 3, 0, 1, 0], baseFret: 1 },
  Cdim: { frets: [-1, 3, 4, 2, 4, -1], baseFret: 1 },
  Caug: { frets: [-1, 3, 2, 1, 1, 0], baseFret: 1 },

  D: { frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], baseFret: 1 },
  D7: { frets: [-1, -1, 0, 2, 1, 2], baseFret: 1 },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },
  Dmaj7: { frets: [-1, -1, 0, 2, 2, 2], baseFret: 1 },
  Dsus2: { frets: [-1, -1, 0, 2, 3, 0], baseFret: 1 },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], baseFret: 1 },
  Ddim: { frets: [-1, -1, 0, 1, 0, 1], baseFret: 1 },
  Daug: { frets: [-1, -1, 0, 3, 3, 2], baseFret: 1 },

  E: { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
  Em: { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
  E7: { frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  Em7: { frets: [0, 2, 0, 0, 0, 0], baseFret: 1 },
  Emaj7: { frets: [0, 2, 1, 1, 0, 0], baseFret: 1 },
  Esus2: { frets: [0, 2, 4, 0, 0, 0], baseFret: 1 },
  Esus4: { frets: [0, 2, 2, 2, 0, 0], baseFret: 1 },
  Edim: { frets: [0, 1, 2, 0, 2, 0], baseFret: 1 },
  Eaug: { frets: [0, 3, 2, 1, 1, 0], baseFret: 1 },

  F: { frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fm: { frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  F7: { frets: [1, 3, 1, 2, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fm7: { frets: [1, 3, 1, 1, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fmaj7: { frets: [1, 3, 2, 2, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fsus2: { frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fsus4: { frets: [1, 3, 3, 3, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fdim: { frets: [1, 2, 3, 1, 3, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Faug: { frets: [1, 4, 3, 2, 2, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },

  G: { frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
  Gm: { frets: [3, 5, 5, 3, 3, 3], baseFret: 3, barre: { fret: 3, from: 0, to: 5 } },
  G7: { frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  Gm7: { frets: [3, 5, 3, 3, 3, 3], baseFret: 3, barre: { fret: 3, from: 0, to: 5 } },
  Gmaj7: { frets: [3, 2, 0, 0, 0, 2], baseFret: 1 },
  Gsus2: { frets: [3, 0, 0, 0, 3, 3], baseFret: 1 },
  Gsus4: { frets: [3, 3, 0, 0, 1, 3], baseFret: 1 },
  Gdim: { frets: [3, 4, 5, 3, 5, 3], baseFret: 3, barre: { fret: 3, from: 0, to: 5 } },
  Gaug: { frets: [3, 2, 1, 0, 0, 3], baseFret: 1 },

  A: { frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
  Am: { frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
  A7: { frets: [-1, 0, 2, 0, 2, 0], baseFret: 1 },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], baseFret: 1 },
  Amaj7: { frets: [-1, 0, 2, 1, 2, 0], baseFret: 1 },
  Asus2: { frets: [-1, 0, 2, 2, 0, 0], baseFret: 1 },
  Asus4: { frets: [-1, 0, 2, 2, 3, 0], baseFret: 1 },
  Adim: { frets: [-1, 0, 1, 2, 1, -1], baseFret: 1 },
  Aaug: { frets: [-1, 0, 3, 2, 2, 1], baseFret: 1 },

  B: { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  B7: { frets: [-1, 2, 1, 2, 0, 2], baseFret: 1 },
  Bm7: { frets: [-1, 2, 0, 2, 0, 2], baseFret: 1 },
  Bmaj7: { frets: [-1, 2, 4, 3, 4, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  Bsus2: { frets: [-1, 2, 4, 4, 2, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  Bsus4: { frets: [-1, 2, 4, 4, 5, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  Bdim: { frets: [-1, 2, 3, 4, 3, -1], baseFret: 1 },
  Baug: { frets: [-1, 2, 1, 0, 0, 3], baseFret: 1 },
};

/** Open E-shape templates (root on 6th string = fret 0). */
const E_SHAPE: Record<string, number[]> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus2: [0, 2, 2, 0, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  dim: [0, 1, 2, 0, 2, 0],
  aug: [0, 3, 2, 1, 1, 0],
  "9": [0, 2, 0, 1, 0, 2],
  m9: [0, 2, 0, 0, 0, 2],
  add9: [0, 2, 2, 1, 0, 2],
  "6": [0, 2, 2, 1, 2, 0],
  m6: [0, 2, 2, 0, 2, 0],
};

/** Open A-shape templates (root on 5th string = fret 0). Index 0 muted. */
const A_SHAPE: Record<string, number[]> = {
  maj: [-1, 0, 2, 2, 2, 0],
  min: [-1, 0, 2, 2, 1, 0],
  "7": [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  dim: [-1, 0, 1, 2, 1, -1],
  aug: [-1, 0, 3, 2, 2, 1],
  "9": [-1, 0, 2, 4, 2, 3],
  m9: [-1, 0, 2, 4, 1, 3],
  add9: [-1, 0, 2, 2, 2, 2],
  "6": [-1, 0, 2, 2, 2, 2],
  m6: [-1, 0, 2, 2, 1, 2],
};

export type ParsedChord = {
  root: string;
  quality: string;
  bass: string | null;
  lookupKey: string;
};

function normalizeNote(note: string): string {
  const cleaned = note.trim().replace("♯", "#").replace("♭", "b");
  if ((NOTES as readonly string[]).includes(cleaned)) return cleaned;
  return ENHARMONIC[cleaned] ?? cleaned;
}

function noteIndex(note: string): number {
  return NOTES.indexOf(normalizeNote(note) as (typeof NOTES)[number]);
}

/** Fret of root on low E (6th string). E=0 … D#=11 */
function rootFretOnE(root: string): number {
  const idx = noteIndex(root);
  if (idx < 0) return 0;
  // E=4 in NOTES → fret 0
  return (idx - 4 + 12) % 12;
}

/** Fret of root on A (5th string). A=0 … G#=11 */
function rootFretOnA(root: string): number {
  const idx = noteIndex(root);
  if (idx < 0) return 0;
  // A=9 in NOTES → fret 0
  return (idx - 9 + 12) % 12;
}

function shiftShape(template: number[], offset: number): ChordShape {
  const frets = template.map((f) => (f < 0 ? -1 : f + offset));
  const pressed = frets.filter((f) => f > 0);
  const baseFret = pressed.length ? Math.min(...pressed) : Math.max(1, offset);
  const barreFret = offset > 0 ? offset : undefined;
  const barre =
    barreFret && frets.filter((f) => f === barreFret).length >= 3
      ? {
          fret: barreFret,
          from: frets.findIndex((f) => f === barreFret),
          to: frets.length - 1 - [...frets].reverse().findIndex((f) => f === barreFret),
        }
      : undefined;
  return { frets, baseFret: Math.max(1, baseFret), barre };
}

/** Normalize quality aliases from analyzer / editors. */
export function normalizeQuality(raw: string): string {
  const q = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!q || q === "maj" || q === "major" || q === "m") {
    // bare "m" handled by caller via symbol; here empty → maj
  }
  const map: Record<string, string> = {
    "": "maj",
    maj: "maj",
    major: "maj",
    min: "min",
    minor: "min",
    m: "min",
    "7": "7",
    dom7: "7",
    dominant: "7",
    maj7: "maj7",
    major7: "maj7",
    m7: "m7",
    min7: "m7",
    minor7: "m7",
    dim: "dim",
    diminished: "dim",
    o: "dim",
    "°": "dim",
    aug: "aug",
    augmented: "aug",
    "+": "aug",
    sus2: "sus2",
    sus4: "sus4",
    sus: "sus4",
    "9": "9",
    m9: "m9",
    min9: "m9",
    add9: "add9",
    "6": "6",
    m6: "m6",
    min6: "m6",
    "6/9": "6",
    "7sus4": "sus4",
    "m7b5": "dim",
    halfdim: "dim",
  };
  return map[q] ?? (q.startsWith("m") && !q.startsWith("maj") ? "min" : "maj");
}

export function parseChordSymbol(symbol: string): ParsedChord | null {
  const raw = symbol.trim();
  if (!raw || raw === "—" || raw === "-") return null;

  const [main] = raw.split("/");
  const bassPart = raw.includes("/") ? raw.split("/")[1] : null;
  const match = main.match(/^([A-G](?:#|b|♯|♭)?)(.*)$/i);
  if (!match) return null;

  const root = normalizeNote(match[1][0].toUpperCase() + match[1].slice(1));
  let rest = (match[2] ?? "").trim();

  // Symbol styles: Am, C#m7, Fmaj7, G7, Bb sus4
  let quality = "maj";
  if (/^m(?!aj)/i.test(rest)) {
    rest = rest.replace(/^m/i, "");
    if (!rest || rest === "7") quality = rest === "7" ? "m7" : "min";
    else if (rest === "9") quality = "m9";
    else if (rest === "6") quality = "m6";
    else if (/^aj7/i.test(rest)) quality = "maj7";
    else quality = normalizeQuality(`m${rest}`);
  } else {
    quality = normalizeQuality(rest);
  }

  const lookupKey = quality === "maj" ? root : quality === "min" ? `${root}m` : `${root}${quality}`;
  return {
    root,
    quality,
    bass: bassPart ? normalizeNote(bassPart) : null,
    lookupKey,
  };
}

function buildMovable(root: string, quality: string): ChordShape | null {
  const eTemplate = E_SHAPE[quality] ?? E_SHAPE.maj;
  const aTemplate = A_SHAPE[quality] ?? A_SHAPE.maj;
  const eFret = rootFretOnE(root);
  const aFret = rootFretOnA(root);

  // Prefer open-ish positions (lower base fret), E-shape if tied and eFret<=4
  const eShape = shiftShape(eTemplate, eFret);
  const aShape = shiftShape(aTemplate, aFret);

  if (eFret === 0 && E_SHAPE[quality]) return eShape;
  if (aFret === 0 && A_SHAPE[quality]) return aShape;

  if (eShape.baseFret <= aShape.baseFret) return eShape;
  return aShape;
}

/** Precompute open aliases including sharp/flat roots via movable shapes. */
function resolveOpenOrMovable(root: string, quality: string): ChordShape | null {
  const majKey = root;
  const minKey = `${root}m`;
  const otherKey = `${root}${quality}`;

  if (quality === "maj" && OPEN[majKey]) return OPEN[majKey];
  if (quality === "min" && OPEN[minKey]) return OPEN[minKey];
  if (OPEN[otherKey]) return OPEN[otherKey];

  // Flat enharmonic open keys (Bb, Eb, …) stored under sharps in OPEN rarely —
  // generate movable for any missing combination.
  return buildMovable(root, quality);
}

export function getChordShape(symbol: string): ChordShape | null {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;

  // Exact open table first (C, Am, Fmaj7, …)
  if (OPEN[parsed.lookupKey]) return OPEN[parsed.lookupKey];
  if (OPEN[symbol.replace(/\/.*/, "")]) return OPEN[symbol.replace(/\/.*/, "")];

  return resolveOpenOrMovable(parsed.root, parsed.quality);
}

/** All common diagram keys (for tests / catalog). */
export function listCoveredChordSymbols(): string[] {
  const qualities = Object.keys(E_SHAPE);
  const out: string[] = [];
  for (const root of NOTES) {
    for (const q of qualities) {
      const symbol =
        q === "maj" ? root : q === "min" ? `${root}m` : `${root}${q}`;
      out.push(symbol);
    }
  }
  return out;
}
