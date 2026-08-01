import { describe, expect, it } from "vitest";
import { transposeChord, transposeKey } from "./chords";

describe("transpose", () => {
  it("shifts chord roots and keys", () => {
    expect(transposeChord({ symbol: "G", root: "G", quality: "maj" }, 2).symbol).toBe("A");
    expect(transposeChord({ symbol: "Em", root: "E", quality: "min" }, 2).symbol).toBe("F#m");
    expect(transposeKey("G", 2)).toBe("A");
  });
});
