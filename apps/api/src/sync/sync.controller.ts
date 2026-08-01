import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { SyncService } from "./sync.service";

type AuthedRequest = { user: JwtPayload };

@Controller()
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Get("tracks/:id/sync")
  getSync(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.sync.getSync(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Put("tracks/:id/sync")
  putSync(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest,
  ) {
    return this.sync.putSync(id, req.user, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Post("tracks/:id/publish")
  publish(
    @Param("id") id: string,
    @Body() body: { syncVersion?: number; changelog?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.sync.publish(id, req.user, body ?? {});
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("admin/approvals")
  listApprovals() {
    return this.sync.listPendingApprovals();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("admin/tracks/:id/approvals")
  decide(
    @Param("id") id: string,
    @Body()
    body: {
      decision: "approved" | "rejected" | "changes_requested";
      notes?: string;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.sync.decideApproval(id, req.user, body);
  }
}
