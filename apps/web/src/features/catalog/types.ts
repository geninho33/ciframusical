export type TrackListItem = {
  id: string;
  slug: string;
  title: string;
  artist: { id: string; name: string } | null;
  genres: string[];
  styles: string[];
  originalKey: string | null;
  bpm: number | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  durationMs: number | null;
  status: string;
  coverUrl: string | null;
  hasAudio: boolean;
};

export type TrackDetail = TrackListItem & {
  timeSignature: string;
  lyricsPlain: string | null;
  audio: { url: string; mimeType: string; expiresAt: string } | null;
  sync: {
    version: number;
    url: string;
    formatVersion: string;
  } | null;
  chordInstrumentDefault: string;
};

export type Taxonomy = {
  genres: { slug: string; name: string }[];
  styles: { slug: string; name: string }[];
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
