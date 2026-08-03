import { describe, expect, it } from "vitest";
import {
  getChordShape,
  listCoveredChordSymbols,
  parseChordSymbol,
} from "./chordShapes";

describe("chordShapes", () => {
  it("parses common symbols", () => {
    expect(parseChordSymbol("Am")?.quality).toBe("min");
    expect(parseChordSymbol("F#m7")?.root).toBe("F#");
    expect(parseChordSymbol("Bbmaj7")?.root).toBe("A#");
    expect(parseChordSymbol("G/B")?.bass).toBe("B");
  });

  it("returns open shapes for basics", () => {
    expect(getChordShape("G")?.frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(getChordShape("Am")?.frets).toEqual([-1, 0, 2, 2, 1, 0]);
    expect(getChordShape("F")?.barre).toBeTruthy();
  });

  it("covers all 12 roots × common qualities", () => {
    const symbols = listCoveredChordSymbols();
    expect(symbols.length).toBeGreaterThanOrEqual(12 * 10);
    for (const symbol of symbols) {
      const shape = getChordShape(symbol);
      expect(shape, symbol).toBeTruthy();
      expect(shape!.frets).toHaveLength(6);
      expect(shape!.baseFret).toBeGreaterThanOrEqual(1);
    }
  });

  it("resolves flats and aliases", () => {
    expect(getChordShape("Bbm")).toBeTruthy();
    expect(getChordShape("C#m7")).toBeTruthy();
    expect(getChordShape("Gsus4")).toBeTruthy();
    expect(getChordShape("Dmaj7")).toBeTruthy();
  });
});
