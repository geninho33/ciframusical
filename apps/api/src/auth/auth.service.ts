import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import type {
  AuthTokensResponse,
  AuthUserView,
  JwtPayload,
  RoleCode,
} from "../common/types/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

const ACCESS_TTL_SECONDS = 900;
const REFRESH_TTL_DAYS = 30;
const RESET_TTL_MINUTES = 30;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultAdmin();
    } catch (error) {
      this.logger.warn(`ensureDefaultAdmin skipped: ${String(error)}`);
    }
  }

  async register(dto: RegisterDto): Promise<AuthTokensResponse> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    this.assertBetaInvite(dto.inviteCode);

    const studentRole = await this.prisma.role.findUnique({
      where: { code: "student" },
    });
    if (!studentRole) {
      throw new BadRequestException("Roles not seeded. Run prisma db seed.");
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName.trim(),
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: studentRole.id }] },
      },
      include: { roles: { include: { role: true } } },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const email = dto.email.toLowerCase().trim();
    const password = dto.password;
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });

    if (!user?.passwordHash || user.status !== "active") {
      throw new UnauthorizedException(
        this.devAuthHint(
          "Invalid credentials",
          "Usuário inexistente/inativo. Rode `pnpm db:setup` ou reinicie a API com ENSURE_ADMIN=true.",
        ),
      );
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException(
        this.devAuthHint(
          "Invalid credentials",
          "Senha incorreta. Admin seed: admin@cifratrack.local / Admin123!",
        ),
      );
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (stored.user.status !== "active" || stored.user.deletedAt) {
      throw new UnauthorizedException("User inactive");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, status: "active" },
    });

    // Always return success to avoid email enumeration
    if (!user) {
      return { message: "If the email exists, a reset link was sent." };
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Dev mail stub — replace with real provider later
    console.log(`[auth] password reset token for ${email}: ${rawToken}`);

    const response: { message: string; devResetToken?: string } = {
      message: "If the email exists, a reset link was sent.",
    };

    if (this.config.get("NODE_ENV") !== "production") {
      response.devResetToken = rawToken;
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: "Password updated successfully." };
  }

  async getMe(userId: string): Promise<AuthUserView> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    return this.toUserView(user);
  }

  async updateMe(userId: string, displayName: string): Promise<AuthUserView> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: displayName.trim() },
      include: { roles: { include: { role: true } } },
    });
    return this.toUserView(user);
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items: users.map((u) => this.toUserView(u)) };
  }

  async updateUserRoles(userId: string, roles: RoleCode[]) {
    const uniqueRoles = [...new Set(roles)];
    const roleRows = await this.prisma.role.findMany({
      where: { code: { in: uniqueRoles } },
    });
    if (roleRows.length !== uniqueRoles.length) {
      throw new BadRequestException("One or more roles are invalid");
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roleRows.map((role) => ({ userId, roleId: role.id })),
      }),
    ]);

    return this.getMe(userId);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    roles: { role: { code: string } }[];
  }): Promise<AuthTokensResponse> {
    const view = this.toUserView(user);
    const payload: JwtPayload = {
      sub: view.id,
      email: view.email,
      roles: view.roles,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TTL_SECONDS,
    });

    const refreshToken = randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60_000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      user: view,
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
    };
  }

  private toUserView(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    roles: { role: { code: string } }[];
  }): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((r) => r.role.code as RoleCode),
    };
  }

  private assertBetaInvite(inviteCode?: string) {
    const betaMode = (this.config.get<string>("BETA_MODE") ?? "false") === "true";
    if (!betaMode) return;

    const raw = this.config.get<string>("BETA_INVITE_CODES") ?? "";
    const codes = raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!codes.length) {
      throw new BadRequestException(
        "Beta fechado: configure BETA_INVITE_CODES no servidor.",
      );
    }
    if (!inviteCode || !codes.includes(inviteCode.trim())) {
      throw new BadRequestException("Código de convite beta inválido.");
    }
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private isProduction() {
    return (this.config.get<string>("NODE_ENV") ?? "development") === "production";
  }

  private devAuthHint(safe: string, hint: string) {
    return this.isProduction() ? safe : `${safe}. ${hint}`;
  }

  /**
   * Upserts the seed admin so local/deploy login works without a manual seed.
   * Enabled by default outside production; set ENSURE_ADMIN=true/false to override.
   */
  private async ensureDefaultAdmin() {
    const flag = this.config.get<string>("ENSURE_ADMIN");
    const enabled =
      flag === "true" || (flag !== "false" && !this.isProduction());
    if (!enabled) return;

    const roles = [
      { code: "admin", name: "Administrador" },
      { code: "creator", name: "Criador/Músico" },
      { code: "student", name: "Estudante" },
    ] as const;

    for (const role of roles) {
      await this.prisma.role.upsert({
        where: { code: role.code },
        update: { name: role.name },
        create: { ...role },
      });
    }

    const email = (
      this.config.get<string>("SEED_ADMIN_EMAIL") ?? "admin@cifratrack.local"
    )
      .toLowerCase()
      .trim();
    const password =
      this.config.get<string>("SEED_ADMIN_PASSWORD") ?? "Admin123!";
    const passwordHash = await argon2.hash(password);

    const admin = await this.prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        status: "active",
        deletedAt: null,
        emailVerifiedAt: new Date(),
        displayName: "Admin CifraTrack",
      },
      create: {
        email,
        passwordHash,
        status: "active",
        emailVerifiedAt: new Date(),
        displayName: "Admin CifraTrack",
      },
    });

    const allRoles = await this.prisma.role.findMany();
    for (const role of allRoles) {
      await this.prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: admin.id, roleId: role.id },
        },
        update: {},
        create: { userId: admin.id, roleId: role.id },
      });
    }

    this.logger.log(`Default admin ensured: ${email}`);
  }
}
