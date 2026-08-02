import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import type { JwtPayload } from "../common/types/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

type SyncDocument = Record<string, unknown>;

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async getSync(trackId: string, user: JwtPayload) {
    const track = await this.requireTrackAccess(trackId, user);
    const current = await this.prisma.syncVersion.findFirst({
      where: { trackId: track.id, isCurrent: true },
      orderBy: { version: "desc" },
    });
    if (!current) {
      throw new NotFoundException("No sync version for this track");
    }

    const signed = await this.storage.createPresignedGetUrl({
      key: current.storageKey,
    });
    const res = await fetch(signed.url);
    if (!res.ok) {
      throw new BadRequestException("Failed to load sync document from storage");
    }
    const document = (await res.json()) as SyncDocument;

    return {
      trackId: track.id,
      version: current.version,
      status: current.status,
      source: current.source,
      formatVersion: current.formatVersion,
      storageKey: current.storageKey,
      document,
    };
  }

  async putSync(trackId: string, user: JwtPayload, document: SyncDocument) {
    const track = await this.requireTrackAccess(trackId, user);
    this.assertSyncDocument(document);

    const latest = await this.prisma.syncVersion.findFirst({
      where: { trackId: track.id },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const body = JSON.stringify(document);
    const checksum = createHash("sha256").update(body).digest("hex");
    const storageKey = `sync/${track.id}/v${version}.json`;

    await this.storage.putObject({
      key: storageKey,
      body,
      mimeType: "application/json",
    });

    await this.prisma.$transaction([
      this.prisma.syncVersion.updateMany({
        where: { trackId: track.id, isCurrent: true },
        data: { isCurrent: false, status: "superseded" },
      }),
      this.prisma.syncVersion.create({
        data: {
          trackId: track.id,
          version,
          storageKey,
          source: "manual",
          status: "draft",
          isCurrent: true,
          checksumSha256: checksum,
          formatVersion: String(document.formatVersion ?? "1.0.0"),
          createdBy: user.sub,
        },
      }),
      this.prisma.track.update({
        where: { id: track.id },
        data: { status: "needs_review" },
      }),
    ]);

    return {
      trackId: track.id,
      version,
      status: "draft",
      checksum,
    };
  }

  async publish(
    trackId: string,
    user: JwtPayload,
    body: { syncVersion?: number; changelog?: string },
  ) {
    const track = await this.requireTrackAccess(trackId, user);
    const requireApproval =
      (this.config.get<string>("REQUIRE_APPROVAL") ?? "true") === "true";

    // Prefer the requested version; fall back to current draft.
    // Clients often send a stale syncVersion after an auto-save PUT.
    let sync = body.syncVersion
      ? await this.prisma.syncVersion.findFirst({
          where: { trackId: track.id, version: body.syncVersion },
        })
      : null;
    if (!sync) {
      sync = await this.prisma.syncVersion.findFirst({
        where: { trackId: track.id, isCurrent: true },
        orderBy: { version: "desc" },
      });
    }
    if (!sync) throw new NotFoundException("Sync version not found");

    if (requireApproval && !user.roles.includes("admin")) {
      await this.prisma.track.update({
        where: { id: track.id },
        data: { status: "pending_approval" },
      });

      return {
        trackId: track.id,
        status: "pending_approval",
        syncVersion: sync.version,
        changelog: body.changelog ?? null,
        message: "Aguardando aprovação do admin",
      };
    }

    await this.prisma.$transaction([
      this.prisma.syncVersion.update({
        where: { id: sync.id },
        data: { status: "published" },
      }),
      this.prisma.track.update({
        where: { id: track.id },
        data: { status: "published", publishedAt: new Date() },
      }),
    ]);

    return {
      trackId: track.id,
      status: "published",
      syncVersion: sync.version,
      message: "Publicado no catálogo",
    };
  }

  async listPendingApprovals() {
    const tracks = await this.prisma.track.findMany({
      where: { status: "pending_approval", deletedAt: null },
      include: {
        artist: true,
        syncVersions: {
          where: { isCurrent: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return {
      items: tracks.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        artist: t.artist?.name ?? null,
        syncVersion: t.syncVersions[0]?.version ?? null,
        updatedAt: t.updatedAt,
      })),
    };
  }

  async decideApproval(
    trackId: string,
    reviewer: JwtPayload,
    body: { decision: "approved" | "rejected" | "changes_requested"; notes?: string },
  ) {
    if (!reviewer.roles.includes("admin")) {
      throw new ForbiddenException("Admin role required");
    }

    const track = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null },
    });
    if (!track) throw new NotFoundException("Track not found");

    const sync = await this.prisma.syncVersion.findFirst({
      where: { trackId, isCurrent: true },
    });
    if (!sync) throw new NotFoundException("Sync version not found");

    const nextStatus =
      body.decision === "approved"
        ? "published"
        : body.decision === "rejected"
          ? "rejected"
          : "needs_review";

    await this.prisma.$transaction([
      this.prisma.syncApproval.create({
        data: {
          syncVersionId: sync.id,
          reviewerId: reviewer.sub,
          decision: body.decision,
          notes: body.notes,
        },
      }),
      this.prisma.syncVersion.update({
        where: { id: sync.id },
        data: {
          status: body.decision === "approved" ? "published" : "draft",
        },
      }),
      this.prisma.track.update({
        where: { id: trackId },
        data: {
          status: nextStatus,
          publishedAt: body.decision === "approved" ? new Date() : track.publishedAt,
        },
      }),
    ]);

    return { trackId, decision: body.decision, status: nextStatus };
  }

  private async requireTrackAccess(trackId: string, user: JwtPayload) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null },
    });
    if (!track) throw new NotFoundException("Track not found");
    if (track.creatorId !== user.sub && !user.roles.includes("admin")) {
      throw new ForbiddenException();
    }
    return track;
  }

  private assertSyncDocument(doc: SyncDocument) {
    if (!doc || typeof doc !== "object") {
      throw new BadRequestException("Invalid sync document");
    }
    if (doc.formatVersion !== "1.0.0") {
      throw new BadRequestException("Unsupported formatVersion");
    }
    if (!Array.isArray(doc.events) || doc.events.length < 1) {
      throw new BadRequestException("events must be a non-empty array");
    }
    if (!doc.track || typeof doc.track !== "object") {
      throw new BadRequestException("track metadata required");
    }
  }
}
