import { describe, expect, it } from "vitest";
import { buildStudyLines, formatChordRow, placeChordsOnText } from "./studyLines";
import type { CifraSyncDocument } from "./types";

const baseDoc: CifraSyncDocument = {
  formatVersion: "1.0.0",
  track: {
    title: "Demo",
    artist: "Artista",
    originalKey: "Em",
    bpm: 90,
    timeSignature: "4/4",
    durationSec: 30,
  },
  sections: [],
  events: [
    {
      id: "e1",
      t: 0,
      tEnd: 2,
      chord: { symbol: "Em", root: "E", quality: "min" },
      lyricLine: "Acreditei no seu amor",
    },
    {
      id: "e2",
      t: 2,
      tEnd: 4,
      chord: { symbol: "Bm", root: "B", quality: "min" },
      lyricLine: "Acreditei no seu amor",
    },
    {
      id: "e3",
      t: 4,
      tEnd: 6,
      chord: { symbol: "Am", root: "A", quality: "min" },
      lyricLine: "Sozinho, sozinho",
    },
    {
      id: "e4",
      t: 6,
      tEnd: 8,
      chord: { symbol: "D", root: "D", quality: "maj" },
      lyricLine: "Sozinho, sozinho",
    },
  ],
};

describe("studyLines", () => {
  it("merges same lyricLine and places multiple chords", () => {
    const lines = buildStudyLines(baseDoc);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("Acreditei no seu amor");
    expect(lines[0].chords.map((c) => c.symbol)).toEqual(["Em", "Bm"]);
    expect(lines[1].chords.map((c) => c.symbol)).toEqual(["Am", "D"]);
  });

  it("formats chord row above lyrics", () => {
    const text = "Acreditei no seu amor";
    const chords = placeChordsOnText(text, baseDoc.events.slice(0, 2));
    const row = formatChordRow(text, chords);
    expect(row).toContain("Em");
    expect(row).toContain("Bm");
  });
});
