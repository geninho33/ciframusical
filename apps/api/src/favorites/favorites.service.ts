import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogService } from "../catalog/catalog.service";
import type { JwtPayload } from "../common/types/auth.types";

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async list(user: JwtPayload) {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId: user.sub,
        track: { deletedAt: null, status: "published" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        track: {
          include: {
            artist: true,
            genres: { include: { genre: true } },
            styles: { include: { style: true } },
            mediaFiles: {
              where: { uploadStatus: "completed", kind: "source_audio" },
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    // Reuse catalog mapping via getBySlug for signed URLs consistency
    const items = [];
    for (const fav of favorites) {
      items.push(await this.catalog.getBySlug(fav.track.slug, user));
    }

    return { items };
  }

  async add(user: JwtPayload, trackId: string) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, deletedAt: null, status: "published" },
    });
    if (!track) throw new NotFoundException("Published track not found");

    await this.prisma.favorite.upsert({
      where: {
        userId_trackId: { userId: user.sub, trackId },
      },
      update: {},
      create: { userId: user.sub, trackId },
    });

    return { ok: true };
  }

  async remove(user: JwtPayload, trackId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId: user.sub, trackId },
    });
    return { ok: true };
  }
}
