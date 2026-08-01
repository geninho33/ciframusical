import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { JwtPayload } from "../common/types/auth.types";
import { MetricsService } from "../observability/metrics.service";
import { captureException } from "../observability/sentry";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

export type AnalyzeJobPayload = {
  jobId: string;
  trackId: string;
  mediaStorageKey: string;
  title: string;
  artist: string;
  requestedBy: string;
};

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private connection: IORedis | null = null;
  private queue: Queue<AnalyzeJobPayload> | null = null;
  private worker: Worker<AnalyzeJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    try {
      this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      this.queue = new Queue("analyze-audio", { connection: this.connection });
      this.worker = new Worker<AnalyzeJobPayload>(
        "analyze-audio",
        async (job) => this.dispatchToPythonWorker(job),
        { connection: this.connection.duplicate(), concurrency: 1 },
      );
      this.worker.on("failed", (job, err) => {
        this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      });
      this.logger.log("BullMQ analyze-audio queue ready");
    } catch (error) {
      this.logger.warn(`Redis/BullMQ unavailable: ${String(error)}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueueAnalyze(user: JwtPayload, trackId: string) {
    if (!user.roles.includes("creator") && !user.roles.includes("admin")) {
      throw new ForbiddenException("Creator role required");
    }

    const track = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null },
      include: {
        artist: true,
        mediaFiles: {
          where: { kind: "source_audio", uploadStatus: "completed" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!track) throw new NotFoundException("Track not found");
    if (track.creatorId !== user.sub && !user.roles.includes("admin")) {
      throw new ForbiddenException();
    }
    if (!track.mediaFiles[0]) {
      throw new NotFoundException("No completed source audio for this track");
    }

    const job = await this.prisma.processingJob.create({
      data: {
        trackId: track.id,
        requestedBy: user.sub,
        jobType: "analyze_audio",
        status: "queued",
        progress: 0,
        stage: "queued",
      },
    });

    await this.prisma.track.update({
      where: { id: track.id },
      data: { status: "processing" },
    });

    const payload: AnalyzeJobPayload = {
      jobId: job.id,
      trackId: track.id,
      mediaStorageKey: track.mediaFiles[0].storageKey,
      title: track.title,
      artist: track.artist?.name ?? "Unknown",
      requestedBy: user.sub,
    };

    if (this.queue) {
      await this.queue.add("analyze", payload, {
        jobId: job.id,
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } else {
      // Fallback: fire-and-forget HTTP without queue
      void this.dispatchToPythonWorker({ data: payload } as Job<AnalyzeJobPayload>);
    }

    this.metrics.incr("cifratrack_analyze_jobs_queued_total");
    return {
      jobId: job.id,
      status: job.status,
      trackId: track.id,
      traceId: job.id,
    };
  }

  async getJob(jobId: string, user?: JwtPayload | null) {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
      include: { track: true },
    });
    if (!job) throw new NotFoundException("Job not found");
    if (
      user &&
      job.requestedBy !== user.sub &&
      !user.roles.includes("admin")
    ) {
      throw new ForbiddenException();
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      etaSeconds: job.status === "running" ? Math.max(5, 60 - job.progress) : null,
      error: job.error,
      result: job.result,
      trackId: job.trackId,
      traceId: job.id,
    };
  }

  async updateProgress(
    jobId: string,
    data: { progress: number; stage: string },
  ) {
    await this.prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "running",
        progress: Math.min(99, Math.max(0, data.progress)),
        stage: data.stage,
        startedAt: new Date(),
      },
    });
    return { ok: true };
  }

  async completeJob(
    jobId: string,
    data: {
      syncDocument: Record<string, unknown>;
      bpm: number;
      originalKey: string;
      durationSec: number;
      confidence: Record<string, number>;
    },
  ) {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException("Job not found");

    const body = JSON.stringify(data.syncDocument, null, 2);
    const checksum = createHash("sha256").update(body).digest("hex");
    const latest = await this.prisma.syncVersion.findFirst({
      where: { trackId: job.trackId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const storageKey = `sync/${job.trackId}/v${version}.json`;

    await this.storage.putObject({
      key: storageKey,
      body: body,
      mimeType: "application/json",
    });

    await this.prisma.$transaction([
      this.prisma.syncVersion.updateMany({
        where: { trackId: job.trackId, isCurrent: true },
        data: { isCurrent: false, status: "superseded" },
      }),
      this.prisma.syncVersion.create({
        data: {
          trackId: job.trackId,
          version,
          storageKey,
          source: "auto",
          status: "draft",
          isCurrent: true,
          checksumSha256: checksum,
          formatVersion: "1.0.0",
          createdBy: job.requestedBy,
        },
      }),
      this.prisma.track.update({
        where: { id: job.trackId },
        data: {
          status: "needs_review",
          bpm: Math.round(data.bpm),
          originalKey: data.originalKey,
          durationMs: Math.round(data.durationSec * 1000),
        },
      }),
      this.prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          progress: 100,
          stage: "persist",
          finishedAt: new Date(),
          result: {
            syncVersion: version,
            storageKey,
            confidence: data.confidence,
          },
        },
      }),
    ]);

    this.metrics.incr("cifratrack_analyze_jobs_completed_total");
    return { ok: true, syncVersion: version, storageKey, traceId: jobId };
  }

  async failJob(jobId: string, error: { message: string; detail?: string }) {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException("Job not found");

    await this.prisma.$transaction([
      this.prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          stage: "failed",
          finishedAt: new Date(),
          error,
        },
      }),
      this.prisma.track.update({
        where: { id: job.trackId },
        data: { status: "draft" },
      }),
    ]);

    this.metrics.incr("cifratrack_analyze_jobs_failed_total");
    captureException(error, { jobId, trackId: job.trackId, traceId: jobId });
    return { ok: true, traceId: jobId };
  }

  private async dispatchToPythonWorker(job: Job<AnalyzeJobPayload> | { data: AnalyzeJobPayload }) {
    const payload = job.data;
    const workerUrl =
      this.config.get<string>("AUDIO_WORKER_URL") ?? "http://localhost:8001";
    const token =
      this.config.get<string>("INTERNAL_API_TOKEN") ?? "dev-internal-token";

    await this.updateProgress(payload.jobId, { progress: 5, stage: "normalize" });

    const response = await fetch(`${workerUrl}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": token,
      },
      body: JSON.stringify({
        jobId: payload.jobId,
        trackId: payload.trackId,
        mediaStorageKey: payload.mediaStorageKey,
        title: payload.title,
        artist: payload.artist,
        callbackBaseUrl:
          this.config.get<string>("API_INTERNAL_URL") ?? "http://localhost:3000/v1",
        internalToken: token,
        s3: {
          endpoint: this.config.get<string>("S3_ENDPOINT") ?? "http://localhost:9000",
          accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID") ?? "cifratrack",
          secretAccessKey:
            this.config.get<string>("S3_SECRET_ACCESS_KEY") ?? "cifratrack_secret",
          bucket: this.config.get<string>("S3_BUCKET") ?? "cifratrack",
          region: this.config.get<string>("S3_REGION") ?? "us-east-1",
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      await this.failJob(payload.jobId, {
        message: "Audio worker failed",
        detail: text.slice(0, 500),
      });
      throw new Error(`Worker HTTP ${response.status}: ${text}`);
    }

    return response.json();
  }
}
