import { describe, expect, it, vi } from "vitest";
import { MetricsService } from "../observability/metrics.service";
import { AdminService } from "./admin.service";

describe("AdminService.createReport", () => {
  it("creates report for published track", async () => {
    const prisma = {
      track: {
        findFirst: vi.fn().mockResolvedValue({ id: "t1", status: "published" }),
      },
      trackReport: {
        create: vi.fn().mockResolvedValue({
          id: "r1",
          status: "open",
        }),
      },
    };
    const metrics = new MetricsService();
    const admin = new AdminService(prisma as never, metrics);
    const res = await admin.createReport(
      { sub: "u1", roles: ["student"] } as never,
      "t1",
      { reason: "spam" },
    );
    expect(res.id).toBe("r1");
    expect(metrics.get("cifratrack_reports_created_total")).toBe(1);
  });
});
