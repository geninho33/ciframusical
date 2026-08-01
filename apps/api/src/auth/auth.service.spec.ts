import { describe, expect, it } from "vitest";
import { createHash } from "crypto";

describe("auth token hashing", () => {
  it("hashes tokens with sha256 hex", () => {
    const token = "sample-refresh-token";
    const hash = createHash("sha256").update(token).digest("hex");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});
