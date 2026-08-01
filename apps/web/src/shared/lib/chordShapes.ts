/** Simplified guitar chord shapes: fret positions per string (EADGBE), -1 = mute, 0 = open */
export type ChordShape = {
  frets: number[];
  baseFret: number;
};

const SHAPES: Record<string, ChordShape> = {
  C: { frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
  D: { frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
  E: { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
  Em: { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
  F: { frets: [1, 3, 3, 2, 1, 1], baseFret: 1 },
  G: { frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
  A: { frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
  Am: { frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], baseFret: 1 },
  B: { frets: [-1, 2, 4, 4, 4, 2], baseFret: 1 },
};

export function getChordShape(symbol: string): ChordShape | null {
  const base = symbol.replace(/\/.*/, "").replace("maj7", "").replace("maj", "");
  if (SHAPES[base]) return SHAPES[base];
  if (SHAPES[symbol]) return SHAPES[symbol];
  // try minor like "C#m"
  const m = symbol.match(/^([A-G][b#]?m?)/);
  if (m && SHAPES[m[1]]) return SHAPES[m[1]];
  return null;
}
