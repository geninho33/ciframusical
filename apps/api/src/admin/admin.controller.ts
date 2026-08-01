import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { AdminService } from "./admin.service";

type AuthedRequest = { user: JwtPayload };

@Controller()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("admin/metrics")
  metrics() {
    return this.admin.getDashboardMetrics();
  }

  @UseGuards(JwtAuthGuard)
  @Post("tracks/:id/reports")
  report(
    @Param("id") id: string,
    @Body()
    body: {
      reason: "copyright" | "inappropriate" | "spam" | "incorrect_sync" | "other";
      details?: string;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.admin.createReport(req.user, id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("admin/reports")
  listReports(@Query("status") status?: string) {
    return this.admin.listReports(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("admin/reports/:id/resolve")
  resolve(
    @Param("id") id: string,
    @Body()
    body: {
      decision: "resolved" | "dismissed";
      archiveTrack?: boolean;
      resolution?: string;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.admin.resolveReport(req.user, id, body);
  }
}
