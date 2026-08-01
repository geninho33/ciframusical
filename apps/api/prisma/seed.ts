import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const roles = [
  { code: "admin", name: "Administrador" },
  { code: "creator", name: "Criador/Músico" },
  { code: "student", name: "Estudante" },
] as const;

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
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

  console.log(`Seed OK — admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
