import { describe, expect, it } from "vitest";
import { findEventIndex } from "./syncResolver";
import type { SyncEvent } from "../../features/player/types";

const events: SyncEvent[] = [
  { id: "e1", t: 0, chord: { symbol: "G", root: "G", quality: "maj" } },
  { id: "e2", t: 2, chord: { symbol: "C", root: "C", quality: "maj" } },
  { id: "e3", t: 4, chord: { symbol: "D", root: "D", quality: "maj" } },
];

describe("findEventIndex", () => {
  it("returns active chord index for timeline position", () => {
    expect(findEventIndex(events, 0)).toBe(0);
    expect(findEventIndex(events, 1.9)).toBe(0);
    expect(findEventIndex(events, 2)).toBe(1);
    expect(findEventIndex(events, 3.5)).toBe(1);
    expect(findEventIndex(events, 10)).toBe(2);
  });
});
