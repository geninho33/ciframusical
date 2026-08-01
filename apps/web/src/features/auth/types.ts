export type RoleCode = "admin" | "creator" | "student";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: RoleCode[];
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
