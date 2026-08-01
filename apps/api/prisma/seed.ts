import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const roles = [
  { code: "admin", name: "Administrador" },
  { code: "creator", name: "Criador/Músico" },
  { code: "student", name: "Estudante" },
] as const;

const genres = [
  { slug: "rock", name: "Rock" },
  { slug: "pop", name: "Pop" },
  { slug: "sertanejo", name: "Sertanejo" },
  { slug: "mpb", name: "MPB" },
  { slug: "gospel", name: "Gospel" },
  { slug: "jazz", name: "Jazz" },
  { slug: "blues", name: "Blues" },
  { slug: "funk", name: "Funk" },
] as const;

const styles = [
  { slug: "acoustic", name: "Acoustic" },
  { slug: "electric", name: "Electric" },
  { slug: "playalong", name: "Playalong" },
  { slug: "backing_track", name: "Backing Track" },
] as const;

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  for (const genre of genres) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: { name: genre.name },
      create: genre,
    });
  }

  for (const style of styles) {
    await prisma.style.upsert({
      where: { slug: style.slug },
      update: { name: style.name },
      create: style,
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@cifratrack.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: "Admin CifraTrack",
      passwordHash,
      status: "active",
      emailVerifiedAt: new Date(),
    },
    create: {
      email: adminEmail,
      displayName: "Admin CifraTrack",
      passwordHash,
      status: "active",
      emailVerifiedAt: new Date(),
    },
  });

  const allRoles = await prisma.role.findMany();
  for (const role of allRoles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: admin.id, roleId: role.id },
      },
      update: {},
      create: { userId: admin.id, roleId: role.id },
    });
  }

  const artist = await prisma.artist.upsert({
    where: { slug: "banda-exemplo" },
    update: { name: "Banda Exemplo" },
    create: { name: "Banda Exemplo", slug: "banda-exemplo" },
  });

  const mpb = await prisma.genre.findUniqueOrThrow({ where: { slug: "mpb" } });
  const pop = await prisma.genre.findUniqueOrThrow({ where: { slug: "pop" } });
  const acoustic = await prisma.style.findUniqueOrThrow({
    where: { slug: "acoustic" },
  });
  const playalong = await prisma.style.findUniqueOrThrow({
    where: { slug: "playalong" },
  });

  const demoSlug = "meu-amor-acoustic-playalong";
  const demo = await prisma.track.upsert({
    where: { slug: demoSlug },
    update: {
      title: "Meu Amor",
      status: "published",
      publishedAt: new Date(),
      originalKey: "G",
      bpm: 92,
      difficulty: "intermediate",
      durationMs: 214000,
    },
    create: {
      creatorId: admin.id,
      artistId: artist.id,
      title: "Meu Amor",
      slug: demoSlug,
      originalKey: "G",
      bpm: 92,
      difficulty: "intermediate",
      durationMs: 214000,
      status: "published",
      publishedAt: new Date(),
      lyricsPlain: "Sob a luz da manhã...",
      genres: {
        create: [{ genreId: mpb.id }, { genreId: pop.id }],
      },
      styles: {
        create: [{ styleId: acoustic.id }, { styleId: playalong.id }],
      },
    },
  });

  console.log(`Seed OK — admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Seed OK — demo track: ${demo.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
