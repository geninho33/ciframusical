import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/authStore";
import type { AuthUser, RoleCode } from "../features/auth/types";
import { apiRequest, ApiError } from "../shared/api/client";
import styles from "./AdminUsersPage.module.css";

const ALL_ROLES: RoleCode[] = ["admin", "creator", "student"];

export function AdminUsersPage() {
  const { user, accessToken, hasRole } = useAuthStore();
  const [items, setItems] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !hasRole("admin")) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await apiRequest<{ items: AuthUser[] }>("/admin/users", {
          token: accessToken,
        });
        if (!cancelled) setItems(res.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Falha ao carregar usuários");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, hasRole]);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole("admin")) return <Navigate to="/" replace />;

  async function toggleRole(target: AuthUser, role: RoleCode) {
    if (!accessToken) return;
    const next = target.roles.includes(role)
      ? target.roles.filter((r) => r !== role)
      : [...target.roles, role];

    if (next.length === 0) {
      setError("Usuário precisa de ao menos um role.");
      return;
    }

    try {
      const updated = await apiRequest<AuthUser>(`/admin/users/${target.id}/roles`, {
        method: "PATCH",
        token: accessToken,
        body: { roles: next },
      });
      setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao atualizar roles");
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Usuários</h1>
      <p className={styles.subtitle}>Gestão de roles (RF-A05).</p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div>
              <h2>{item.displayName}</h2>
              <p>{item.email}</p>
            </div>
            <div className={styles.roles}>
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={
                    item.roles.includes(role) ? styles.roleActive : styles.role
                  }
                  onClick={() => void toggleRole(item, role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
