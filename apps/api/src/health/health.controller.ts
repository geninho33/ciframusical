import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "cifratrack-api",
      version: "0.6.0",
      phase: 6,
      beta: (process.env.BETA_MODE ?? "false") === "true",
    };
  }
}
