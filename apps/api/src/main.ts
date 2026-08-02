import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { initSentryFromEnv } from "./observability/sentry";

function resolveCorsOrigins(): string[] | boolean {
  const rawOrigins =
    process.env.API_CORS_ORIGIN ??
    "http://localhost:5173,http://127.0.0.1:5173";
  if (rawOrigins.trim() === "*") return true;
  const list = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Always allow both localhost spellings in development
  const defaults = ["http://localhost:5173", "http://127.0.0.1:5173"];
  return [...new Set([...list, ...defaults])];
}

async function bootstrap() {
  initSentryFromEnv();
  // bodyParser:false + useBodyParser avoids bare `import 'express'` (pnpm/Docker).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "2mb" });
  app.useBodyParser("raw", {
    limit: "120mb",
    type: (req) => {
      if (req.method !== "PUT") return false;
      const ct = String(req.headers["content-type"] ?? "");
      return (
        ct.startsWith("audio/") ||
        ct.startsWith("application/octet-stream") ||
        ct === ""
      );
    },
  });

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
  });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`CifraTrack API listening on http://0.0.0.0:${port}/v1`);
}

void bootstrap();
