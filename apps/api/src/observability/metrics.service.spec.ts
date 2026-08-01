import { describe, expect, it } from "vitest";
import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  it("increments counters and exports prometheus text", () => {
    const metrics = new MetricsService();
    metrics.incr("cifratrack_analyze_jobs_failed_total", 2);
    expect(metrics.get("cifratrack_analyze_jobs_failed_total")).toBe(2);
    const text = metrics.toPrometheus();
    expect(text).toContain("cifratrack_uptime_seconds");
    expect(text).toContain("cifratrack_analyze_jobs_failed_total 2");
  });
});
