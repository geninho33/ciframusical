import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { JwtPayload } from "../common/types/auth.types";
import { AuthService } from "./auth.service";
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateMeDto,
  UpdateUserRolesDto,
} from "./dto/auth.dto";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("auth/register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("auth/login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("auth/refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("auth/forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post("auth/reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get("auth/oauth/google/start")
  oauthGoogleStart() {
    throw new NotImplementedException(
      "Google OAuth será habilitado com GOOGLE_CLIENT_ID/SECRET.",
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.sub, dto.displayName);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("admin/users")
  listUsers() {
    return this.auth.listUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("admin/users/:id/roles")
  updateRoles(@Param("id") id: string, @Body() dto: UpdateUserRolesDto) {
    return this.auth.updateUserRoles(id, dto.roles);
  }
}
