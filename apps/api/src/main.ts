import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { initSentryFromEnv } from "./observability/sentry";

function resolveCorsOrigins(): string[] | boolean {
  const raw =
    process.env.API_CORS_ORIGIN ??
    "http://localhost:5173,http://127.0.0.1:5173";
  if (raw.trim() === "*") return true;
  const list = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Always allow both localhost spellings in development
  const defaults = ["http://localhost:5173", "http://127.0.0.1:5173"];
  return [...new Set([...list, ...defaults])];
}

async function bootstrap() {
  initSentryFromEnv();
  const app = await NestFactory.create(AppModule);

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
  await app.listen(port);
  console.log(`CifraTrack API listening on http://localhost:${port}/v1`);
}

void bootstrap();
