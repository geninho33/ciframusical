import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "cifratrack-api",
      version: "0.1.0",
      phase: 0,
    };
  }
}
