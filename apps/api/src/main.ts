import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { initSentryFromEnv } from "./observability/sentry";

async function bootstrap() {
  initSentryFromEnv();
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.API_CORS_ORIGIN ?? "http://localhost:5173";
  app.enableCors({ origin: corsOrigin, credentials: true });
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
