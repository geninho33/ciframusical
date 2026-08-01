import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiRequest } from "../../shared/api/client";
import type { AuthResponse, AuthUser, RoleCode } from "./types";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (payload: AuthResponse) => void;
  clearSession: () => void;
  hasRole: (role: RoleCode) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<boolean>;
  loadMe: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setSession: (payload) =>
        set({
          user: payload.user,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        }),

      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      hasRole: (role) => Boolean(get().user?.roles.includes(role)),

      login: async (email, password) => {
        const payload = await apiRequest<AuthResponse>("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        get().setSession(payload);
      },

      register: async (email, password, displayName) => {
        const payload = await apiRequest<AuthResponse>("/auth/register", {
          method: "POST",
          body: { email, password, displayName },
        });
        get().setSession(payload);
      },

      logout: () => get().clearSession(),

      refresh: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) return false;
        try {
          const payload = await apiRequest<AuthResponse>("/auth/refresh", {
            method: "POST",
            body: { refreshToken },
          });
          get().setSession(payload);
          return true;
        } catch {
          get().clearSession();
          return false;
        }
      },

      loadMe: async () => {
        const token = get().accessToken;
        if (!token) return;
        try {
          const user = await apiRequest<AuthUser>("/me", { token });
          set({ user });
        } catch {
          const ok = await get().refresh();
          if (!ok) get().clearSession();
        }
      },
    }),
    { name: "cifratrack-auth" },
  ),
);
