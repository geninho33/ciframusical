import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Track } from "@prisma/client";
import type { JwtPayload } from "../common/types/auth.types";
import { slugify } from "../common/utils/slugify";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { CreateTrackDto, ListTracksQueryDto } from "./dto/catalog.dto";

const trackInclude = {
  artist: true,
  genres: { include: { genre: true } },
  styles: { include: { style: true } },
  mediaFiles: {
    where: { uploadStatus: "completed" as const, kind: "source_audio" as const },
    take: 1,
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.TrackInclude;

type TrackWithRelations = Prisma.TrackGetPayload<{ include: typeof trackInclude }>;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listTaxonomy() {
    const [genres, styles] = await Promise.all([
      this.prisma.genre.findMany({ orderBy: { name: "asc" } }),
      this.prisma.style.findMany({ orderBy: { name: "asc" } }),
    ]);
    return {
      genres: genres.map((g) => ({ slug: g.slug, name: g.name })),
      styles: styles.map((s) => ({ slug: s.slug, name: s.name })),
    };
  }

  async listTracks(query: ListTracksQueryDto, user?: JwtPayload | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query, user);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.track.count({ where }),
      this.prisma.track.findMany({
        where,
        include: trackInclude,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: await Promise.all(rows.map((row) => this.toListItem(row))),
      page,
      pageSize,
      total,
    };
  }

  async getBySlug(slug: string, user?: JwtPayload | null) {
    const track = await this.prisma.track.findFirst({
      where: { slug, deletedAt: null },
      include: trackInclude,
    });
    if (!track) throw new NotFoundException("Track not found");
    this.assertCanView(track, user);
    return this.toDetail(track);
  }

  async createTrack(user: JwtPayload, dto: CreateTrackDto) {
    if (!user.roles.includes("creator") && !user.roles.includes("admin")) {
      throw new ForbiddenException("Creator role required");
    }

    const genres = await this.prisma.genre.findMany({
      where: { slug: { in: dto.genres } },
    });
    if (genres.length !== dto.genres.length) {
      throw new BadRequestException("One or more genres are invalid");
    }

    const styles = await this.prisma.style.findMany({
      where: { slug: { in: dto.styles } },
    });
    if (styles.length !== dto.styles.length) {
      throw new BadRequestException("One or more styles are invalid");
    }

    const artistSlug = slugify(dto.artistName);
    const artist = await this.prisma.artist.upsert({
      where: { slug: artistSlug },
      update: { name: dto.artistName.trim() },
      create: { name: dto.artistName.trim(), slug: artistSlug },
    });

    const baseSlug = slugify(`${dto.title}-${dto.styles[0] ?? "track"}`);
    const slug = await this.uniqueSlug(baseSlug);

    const track = await this.prisma.track.create({
      data: {
        creatorId: user.sub,
        artistId: artist.id,
        title: dto.title.trim(),
        slug,
        originalKey: dto.originalKey,
        bpm: dto.bpm,
        difficulty: dto.difficulty ?? "intermediate",
        lyricsPlain: dto.lyricsPlain,
        status: "draft",
        genres: {
          create: genres.map((g) => ({ genreId: g.id })),
        },
        styles: {
          create: styles.map((s) => ({ styleId: s.id })),
        },
      },
      include: trackInclude,
    });

    return this.toDetail(track);
  }

  async publishTrack(trackId: string, user: JwtPayload) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null },
      include: trackInclude,
    });
    if (!track) throw new NotFoundException("Track not found");
    if (track.creatorId !== user.sub && !user.roles.includes("admin")) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.track.update({
      where: { id: track.id },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
      include: trackInclude,
    });

    return this.toDetail(updated);
  }

  private buildWhere(
    query: ListTracksQueryDto,
    user?: JwtPayload | null,
  ): Prisma.TrackWhereInput {
    const and: Prisma.TrackWhereInput[] = [{ deletedAt: null }];

    const scope = query.scope ?? "published";
    if (scope === "published") {
      and.push({ status: "published" });
    } else if (scope === "mine") {
      if (!user) throw new ForbiddenException("Authentication required");
      and.push({ creatorId: user.sub });
    } else if (scope === "all") {
      if (!user?.roles.includes("admin")) {
        throw new ForbiddenException("Admin role required");
      }
    }

    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { artist: { name: { contains: query.q, mode: "insensitive" } } },
        ],
      });
    }

    if (query.key) and.push({ originalKey: query.key });
    if (query.difficulty) and.push({ difficulty: query.difficulty });
    if (query.bpmMin || query.bpmMax) {
      and.push({
        bpm: {
          gte: query.bpmMin,
          lte: query.bpmMax,
        },
      });
    }
    if (query.artist) {
      and.push({
        artist: { name: { contains: query.artist, mode: "insensitive" } },
      });
    }
    if (query.genre) {
      const genres = query.genre.split(",").map((g) => g.trim()).filter(Boolean);
      and.push({
        genres: { some: { genre: { slug: { in: genres } } } },
      });
    }
    if (query.style) {
      const styles = query.style.split(",").map((s) => s.trim()).filter(Boolean);
      and.push({
        styles: { some: { style: { slug: { in: styles } } } },
      });
    }

    return { AND: and };
  }

  private buildOrderBy(
    sort?: ListTracksQueryDto["sort"],
  ): Prisma.TrackOrderByWithRelationInput {
    switch (sort) {
      case "bpm":
        return { bpm: "asc" };
      case "title":
        return { title: "asc" };
      case "newest":
      case "relevance":
      default:
        return { createdAt: "desc" };
    }
  }

  private assertCanView(track: Track, user?: JwtPayload | null) {
    if (track.status === "published") return;
    if (!user) throw new ForbiddenException("Track is not public");
    if (track.creatorId === user.sub || user.roles.includes("admin")) return;
    throw new ForbiddenException("Track is not public");
  }

  private async uniqueSlug(base: string) {
    let slug = base || "track";
    let i = 1;
    while (await this.prisma.track.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  private async toListItem(track: TrackWithRelations) {
    let coverUrl: string | null = null;
    if (track.coverStorageKey) {
      coverUrl = (await this.storage.createPresignedGetUrl({ key: track.coverStorageKey })).url;
    }

    return {
      id: track.id,
      slug: track.slug,
      title: track.title,
      artist: track.artist
        ? { id: track.artist.id, name: track.artist.name }
        : null,
      genres: track.genres.map((g) => g.genre.slug),
      styles: track.styles.map((s) => s.style.slug),
      originalKey: track.originalKey,
      bpm: track.bpm,
      difficulty: track.difficulty,
      durationMs: track.durationMs,
      status: track.status,
      coverUrl,
      hasAudio: track.mediaFiles.length > 0,
    };
  }

  private async toDetail(track: TrackWithRelations) {
    const base = await this.toListItem(track);
    const audioFile = track.mediaFiles[0];
    let audio: {
      url: string;
      mimeType: string;
      expiresAt: string;
    } | null = null;

    if (audioFile) {
      const signed = await this.storage.createPresignedGetUrl({
        key: audioFile.storageKey,
      });
      audio = {
        url: signed.url,
        mimeType: audioFile.mimeType,
        expiresAt: signed.expiresAt,
      };
    }

    const fixtureSyncUrl = fixtureSyncPath(track.slug);

    return {
      ...base,
      timeSignature: track.timeSignature,
      lyricsPlain: track.lyricsPlain,
      audio,
      sync: fixtureSyncUrl
        ? {
            version: 1,
            url: fixtureSyncUrl,
            formatVersion: "1.0.0",
          }
        : null,
      chordInstrumentDefault: "guitar" as const,
    };
  }
}

/** Phase 3: sync fixtures served by the web app under /fixtures */
function fixtureSyncPath(slug: string): string | null {
  const known = new Set(["meu-amor-acoustic-playalong"]);
  if (!known.has(slug)) return null;
  return `/fixtures/${slug}.json`;
}

