import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

/** Accepts admin@cifratrack.local and other non-public TLDs used in seed/dev. */
const EMAIL_OPTS = { require_tld: false, allow_utf8_local_part: true } as const;

export class RegisterDto {
  @IsEmail(EMAIL_OPTS)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "password must contain letters and numbers",
  })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  /** Required when BETA_MODE=true */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  inviteCode?: string;
}

export class LoginDto {
  @IsEmail(EMAIL_OPTS)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail(EMAIL_OPTS)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "password must contain letters and numbers",
  })
  password!: string;
}

export class UpdateMeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;
}

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(["admin", "creator", "student"], { each: true })
  roles!: Array<"admin" | "creator" | "student">;
}
