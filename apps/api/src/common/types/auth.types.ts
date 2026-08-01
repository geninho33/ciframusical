export type RoleCode = "admin" | "creator" | "student";

export type JwtPayload = {
  sub: string;
  email: string;
  roles: RoleCode[];
};

export type AuthUserView = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: RoleCode[];
};

export type AuthTokensResponse = {
  user: AuthUserView;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
