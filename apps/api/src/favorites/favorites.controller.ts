import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { FavoritesService } from "./favorites.service";

type AuthedRequest = { user: JwtPayload };

@Controller("me/favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.favorites.list(req.user);
  }

  @Put(":trackId")
  add(@Param("trackId") trackId: string, @Req() req: AuthedRequest) {
    return this.favorites.add(req.user, trackId);
  }

  @Delete(":trackId")
  remove(@Param("trackId") trackId: string, @Req() req: AuthedRequest) {
    return this.favorites.remove(req.user, trackId);
  }
}
