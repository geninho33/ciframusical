import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { CompleteUploadDto, InitUploadDto } from "../catalog/dto/catalog.dto";
import { MediaService } from "./media.service";

type AuthedRequest = Request & { user: JwtPayload };

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Post("uploads")
  init(@Body() dto: InitUploadDto, @Req() req: AuthedRequest) {
    return this.media.initUpload(req.user, dto);
  }

  /**
   * Browser uploads the MP3 through the API (no MinIO CORS).
   * Body = raw audio bytes; Content-Type = audio/mpeg.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Put("uploads/:uploadId/content")
  async putContent(
    @Param("uploadId") uploadId: string,
    @Req() req: AuthedRequest,
    @Body() body: Buffer | undefined,
    @Headers("content-type") contentType?: string,
  ) {
    const buffer = await resolveUploadBuffer(req, body);
    return this.media.putUploadContent(req.user, uploadId, buffer, contentType);
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

async function resolveUploadBuffer(
  req: Request,
  body: Buffer | undefined,
): Promise<Buffer> {
  if (Buffer.isBuffer(body) && body.length > 0) return body;
  if (Buffer.isBuffer(req.body) && req.body.length > 0) return req.body;

  const chunks: Buffer[] = [];
  let total = 0;
  const maxBytes = 120 * 1024 * 1024;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new BadRequestException(`Upload exceeds max size (${maxBytes} bytes)`);
    }
    chunks.push(buf);
  }
  const merged = Buffer.concat(chunks, total);
  if (!merged.length) {
    throw new BadRequestException("Empty upload body");
  }
  return merged;
}
