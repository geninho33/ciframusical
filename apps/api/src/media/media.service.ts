import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import type { JwtPayload } from "../common/types/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { CompleteUploadDto, InitUploadDto } from "../catalog/dto/catalog.dto";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/mp4",
  "audio/aac",
]);

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async initUpload(user: JwtPayload, dto: InitUploadDto) {
    if (!ALLOWED_MIME.has(dto.mimeType)) {
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
        mimeType: dto.mimeType,
        sizeBytes: BigInt(dto.sizeBytes),
        checksumSha256: dto.checksumSha256 ?? null,
        uploadStatus: "pending",
      },
    });

    const signed = await this.storage.createPresignedPutUrl({
      key: storageKey,
      mimeType: dto.mimeType,
    });

    return {
      uploadId: media.id,
      mediaFileId: media.id,
      method: "PUT" as const,
      uploadUrl: signed.uploadUrl,
      headers: { "Content-Type": dto.mimeType },
      expiresAt: signed.expiresAt,
    };
  }

  async completeUpload(
    user: JwtPayload,
    uploadId: string,
    _dto: CompleteUploadDto,
  ) {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id: uploadId },
      include: { track: true },
    });
    if (!media) throw new NotFoundException("Upload not found");
    if (
      media.track.creatorId !== user.sub &&
      !user.roles.includes("admin")
    ) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        uploadStatus: "completed",
        completedAt: new Date(),
      },
    });

    // Placeholder duration until analysis pipeline (Phase 4)
    if (!media.track.durationMs) {
      await this.prisma.track.update({
        where: { id: media.trackId },
        data: { durationMs: 180_000 },
      });
    }

    return {
      mediaFileId: updated.id,
      trackId: updated.trackId,
      status: updated.uploadStatus,
      autoAnalyzeQueued: false,
      message:
        "Upload confirmed. Análise automática chega na Fase 4 — use publish quando quiser.",
    };
  }
}
