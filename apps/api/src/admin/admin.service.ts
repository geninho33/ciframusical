import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { JwtPayload } from "../common/types/auth.types";
import { MetricsService } from "../observability/metrics.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async getDashboardMetrics() {
    const [
      users,
      tracksPublished,
      tracksPending,
      tracksProcessing,
      openReports,
      jobsFailed24h,
      jobsCompleted24h,
      favorites,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.track.count({ where: { status: "published", deletedAt: null } }),
      this.prisma.track.count({
        where: { status: "pending_approval", deletedAt: null },
      }),
      this.prisma.track.count({
        where: { status: "processing", deletedAt: null },
      }),
      this.prisma.trackReport.count({ where: { status: "open" } }),
      this.prisma.processingJob.count({
        where: {
          status: "failed",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.processingJob.count({
        where: {
          status: "completed",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.favorite.count(),
    ]);

    const runtime = this.metrics.snapshot();

    return {
      users,
      tracks: {
        published: tracksPublished,
        pendingApproval: tracksPending,
        processing: tracksProcessing,
      },
      reports: { open: openReports },
      jobs: {
        failedLast24h: jobsFailed24h,
        completedLast24h: jobsCompleted24h,
      },
      favorites,
      runtime,
    };
  }

  async createReport(
    user: JwtPayload,
    trackId: string,
    body: {
      reason: "copyright" | "inappropriate" | "spam" | "incorrect_sync" | "other";
      details?: string;
    },
  ) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null, status: "published" },
    });
    if (!track) throw new NotFoundException("Track not found");

    const report = await this.prisma.trackReport.create({
      data: {
        trackId,
        reporterId: user.sub,
        reason: body.reason,
        details: body.details?.slice(0, 1000),
      },
    });
    this.metrics.incr("cifratrack_reports_created_total");
    return {
      id: report.id,
      status: report.status,
      message: "Denúncia registrada. Obrigado.",
    };
  }

  async listReports(status?: string) {
    const where =
      status && ["open", "reviewing", "resolved", "dismissed"].includes(status)
        ? { status: status as "open" | "reviewing" | "resolved" | "dismissed" }
        : { status: "open" as const };

    const items = await this.prisma.trackReport.findMany({
      where,
      include: {
        track: { select: { id: true, slug: true, title: true, status: true } },
        reporter: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      items: items.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        track: r.track,
        reporter: r.reporter,
      })),
    };
  }

  async resolveReport(
    admin: JwtPayload,
    reportId: string,
    body: {
      decision: "resolved" | "dismissed";
      archiveTrack?: boolean;
      resolution?: string;
    },
  ) {
    if (!["resolved", "dismissed"].includes(body.decision)) {
      throw new BadRequestException("Invalid decision");
    }

    const report = await this.prisma.trackReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException("Report not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.trackReport.update({
        where: { id: reportId },
        data: {
          status: body.decision,
          resolverId: admin.sub,
          resolution: body.resolution?.slice(0, 500),
          resolvedAt: new Date(),
        },
      });
      if (body.archiveTrack) {
        await tx.track.update({
          where: { id: report.trackId },
          data: { status: "archived" },
        });
      }
    });

    this.metrics.incr("cifratrack_reports_resolved_total");
    return { id: reportId, decision: body.decision, archived: Boolean(body.archiveTrack) };
  }
}
