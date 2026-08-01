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
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { CatalogService } from "./catalog.service";
import { CreateTrackDto, ListTracksQueryDto } from "./dto/catalog.dto";

type AuthedRequest = { user?: JwtPayload };

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("taxonomy")
  taxonomy() {
    return this.catalog.listTaxonomy();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("tracks")
  list(@Query() query: ListTracksQueryDto, @Req() req: AuthedRequest) {
    return this.catalog.listTracks(query, req.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("tracks/:slug")
  getOne(@Param("slug") slug: string, @Req() req: AuthedRequest) {
    return this.catalog.getBySlug(slug, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("creator", "admin")
  @Post("tracks")
  create(@Body() dto: CreateTrackDto, @Req() req: AuthedRequest) {
    return this.catalog.createTrack(req.user!, dto);
  }
}
