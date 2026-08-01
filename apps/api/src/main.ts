import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.API_CORS_ORIGIN ?? "http://localhost:5173";
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix("v1");

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`CifraTrack API listening on http://localhost:${port}/v1`);
}

void bootstrap();
