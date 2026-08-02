import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import type { CompleteUploadDto, InitUploadDto } from "../catalog/dto/catalog.dto";
import type { JwtPayload } from "../common/types/auth.types";
import { JobsService } from "../jobs/jobs.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/mp4",
  "audio/aac",
]);

/** Normalize aliases so signed Content-Type matches the browser PUT. */
function normalizeAudioMime(mimeType: string): string {
  const mime = mimeType.trim().toLowerCase();
  if (mime === "audio/mp3") return "audio/mpeg";
  return mime;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobs: JobsService,
  ) {}

  async initUpload(user: JwtPayload, dto: InitUploadDto) {
    const mimeType = normalizeAudioMime(dto.mimeType || "audio/mpeg");
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException("Unsupported audio mime type");
    }

    const track = await this.prisma.track.findFirst({
      where: { id: dto.trackId, deletedAt: null },
    });
    if (!track) throw new NotFoundException("Track not found");
    if (track.creatorId !== user.sub && !user.roles.includes("admin")) {
      throw new ForbiddenException();
    }

    const ext = dto.filename.includes(".")
      ? dto.filename.split(".").pop()?.toLowerCase()
      : "mp3";
    const storageKey = `audio/${track.id}/${randomUUID()}.${ext || "mp3"}`;

    const media = await this.prisma.mediaFile.create({
      data: {
        trackId: track.id,
        kind: "source_audio",
        storageKey,
        mimeType,
        sizeBytes: BigInt(dto.sizeBytes),
        checksumSha256: dto.checksumSha256 ?? null,
        uploadStatus: "pending",
      },
    });

    const signed = await this.storage.createPresignedPutUrl({
      key: storageKey,
      mimeType,
    });

    return {
      uploadId: media.id,
      mediaFileId: media.id,
      method: "PUT" as const,
      uploadUrl: signed.uploadUrl,
      // Must match PutObject ContentType used when signing (SignedHeaders).
      headers: signed.headers ?? { "Content-Type": mimeType },
      expiresAt: signed.expiresAt,
    };
  }

  async completeUpload(
    user: JwtPayload,
    uploadId: string,
    dto: CompleteUploadDto,
  ) {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id: uploadId },
      include: { track: true },
    });
    if (!media) throw new NotFoundException("Upload not found");
    if (media.track.creatorId !== user.sub && !user.roles.includes("admin")) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        uploadStatus: "completed",
        completedAt: new Date(),
      },
    });

    let analyze: { jobId: string; status: string; trackId: string } | null = null;
    if (dto.autoAnalyze !== false) {
      analyze = await this.jobs.enqueueAnalyze(user, media.trackId);
    }

    return {
      mediaFileId: updated.id,
      trackId: updated.trackId,
      status: updated.uploadStatus,
      autoAnalyzeQueued: Boolean(analyze),
      jobId: analyze?.jobId ?? null,
      message: analyze
        ? "Upload confirmed. Análise enfileirada."
        : "Upload confirmed.",
    };
  }
}
