import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { JobsService } from "./jobs.service";

type AuthedRequest = { user?: JwtPayload };

@Controller()
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Post("tracks/:id/analyze")
  analyze(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.jobs.enqueueAnalyze(req.user!, id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("jobs/:jobId")
  getJob(@Param("jobId") jobId: string, @Req() req: AuthedRequest) {
    return this.jobs.getJob(jobId, req.user);
  }

  @Post("internal/jobs/:jobId/progress")
  progress(
    @Param("jobId") jobId: string,
    @Body() body: { progress: number; stage: string },
    @Headers("x-internal-token") token?: string,
  ) {
    this.assertInternal(token);
    return this.jobs.updateProgress(jobId, body);
  }

  @Post("internal/jobs/:jobId/complete")
  complete(
    @Param("jobId") jobId: string,
    @Body()
    body: {
      syncDocument: Record<string, unknown>;
      bpm: number;
      originalKey: string;
      durationSec: number;
      confidence: Record<string, number>;
    },
    @Headers("x-internal-token") token?: string,
  ) {
    this.assertInternal(token);
    return this.jobs.completeJob(jobId, body);
  }

  @Post("internal/jobs/:jobId/fail")
  fail(
    @Param("jobId") jobId: string,
    @Body() body: { message: string; detail?: string },
    @Headers("x-internal-token") token?: string,
  ) {
    this.assertInternal(token);
    return this.jobs.failJob(jobId, body);
  }

  private assertInternal(token?: string) {
    const expected =
      this.config.get<string>("INTERNAL_API_TOKEN") ?? "dev-internal-token";
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid internal token");
    }
  }
}
