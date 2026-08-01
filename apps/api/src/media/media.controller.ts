import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { CompleteUploadDto, InitUploadDto } from "../catalog/dto/catalog.dto";
import { MediaService } from "./media.service";

type AuthedRequest = { user: JwtPayload };

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Post("uploads")
  init(@Body() dto: InitUploadDto, @Req() req: AuthedRequest) {
    return this.media.initUpload(req.user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Post("uploads/:uploadId/complete")
  complete(
    @Param("uploadId") uploadId: string,
    @Body() dto: CompleteUploadDto,
    @Req() req: AuthedRequest,
  ) {
    return this.media.completeUpload(req.user, uploadId, dto);
  }
}
