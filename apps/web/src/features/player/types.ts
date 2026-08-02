export type SyncChord = {
  symbol: string;
  root: string;
  quality: string;
  bass?: string | null;
  extensions?: string[];
};

export type SyncEvent = {
  id: string;
  t: number;
  tEnd?: number;
  chord: SyncChord;
  lyricLine?: string | null;
  sectionId?: string | null;
};

export type SyncSection = {
  id: string;
  name: string;
  startSec: number;
  endSec: number;
};

export type CifraSyncDocument = {
  formatVersion: string;
  track: {
    title: string;
    artist: string;
    originalKey: string;
    bpm: number;
    timeSignature: string;
    durationSec: number;
    tuning?: string[];
  };
  meta?: {
    source?: string;
    generatedAt?: string;
    generator?: string;
  };
  sections: SyncSection[];
  events: SyncEvent[];
  lyrics?: Array<{
    id: string;
    t: number;
    tEnd?: number;
    text: string;
    sectionId?: string | null;
    /** Chord markers aligned to character columns (Modo Estudo) */
    chords?: Array<{
      symbol: string;
      charIndex: number;
      eventId?: string;
    }>;
  }>;
};

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused";
