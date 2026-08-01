const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const ENHARMONIC: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

export type Chord = {
  symbol: string;
  root: string;
  quality: string;
  bass?: string | null;
  extensions?: string[];
};

function normalizeNote(note: string): string {
  const cleaned = note.trim().replace("♯", "#").replace("♭", "b");
  if ((NOTES as readonly string[]).includes(cleaned)) return cleaned;
  return ENHARMONIC[cleaned] ?? cleaned;
}

function pitchIndex(note: string): number {
  const n = normalizeNote(note);
  const idx = NOTES.indexOf(n as (typeof NOTES)[number]);
  if (idx < 0) throw new Error(`Unknown pitch: ${note}`);
  return idx;
}

export function shiftPitch(note: string, semitones: number): string {
  const idx = pitchIndex(note);
  const next = (idx + semitones) % 12;
  return NOTES[(next + 12) % 12];
}

export function renderSymbol(chord: Pick<Chord, "root" | "quality" | "bass">): string {
  const quality =
    chord.quality === "maj"
      ? ""
      : chord.quality === "min"
        ? "m"
        : chord.quality === "maj7"
          ? "maj7"
          : chord.quality;
  const bass = chord.bass ? `/${chord.bass}` : "";
  return `${chord.root}${quality}${bass}`;
}

export function transposeChord(chord: Chord, semitones: number): Chord {
  if (semitones === 0) return chord;
  const root = shiftPitch(chord.root, semitones);
  const bass = chord.bass ? shiftPitch(chord.bass, semitones) : chord.bass;
  const next = { ...chord, root, bass: bass ?? null };
  return { ...next, symbol: renderSymbol(next) };
}

export function transposeKey(key: string, semitones: number): string {
  const match = key.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return key;
  return `${shiftPitch(match[1], semitones)}${match[2] ?? ""}`;
}
