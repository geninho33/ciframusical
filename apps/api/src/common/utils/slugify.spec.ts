import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("normalizes accents and spaces", () => {
    expect(slugify("Meu Amor Acústico")).toBe("meu-amor-acustico");
  });
});
