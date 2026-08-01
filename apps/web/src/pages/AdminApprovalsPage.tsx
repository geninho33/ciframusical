import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { decideApproval, fetchPendingApprovals } from "../features/catalog/api";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./AdminApprovalsPage.module.css";

type Item = {
  id: string;
  slug: string;
  title: string;
  artist: string | null;
  syncVersion: number | null;
  updatedAt: string;
};

export function AdminApprovalsPage() {
  const { user, accessToken, hasRole } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    try {
      const res = await fetchPendingApprovals(accessToken);
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole("admin")) return <Navigate to="/" replace />;

  async function onDecide(id: string, decision: "approved" | "rejected") {
    if (!accessToken) return;
    try {
      await decideApproval(id, accessToken, { decision });
      setMessage(`Faixa ${decision}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Aprovações</h1>
      <p className={styles.subtitle}>Fila de faixas em pending_approval</p>
      {message ? <p className={styles.ok}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div>
              <h2>{item.title}</h2>
              <p>
                {item.artist ?? "—"} · sync v{item.syncVersion ?? "—"}
              </p>
            </div>
            <div className={styles.actions}>
              <Link to={`/editar-sync/${item.slug}`}>Revisar</Link>
              <button type="button" onClick={() => void onDecide(item.id, "approved")}>
                Aprovar
              </button>
              <button type="button" className={styles.danger} onClick={() => void onDecide(item.id, "rejected")}>
                Rejeitar
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 ? <p className={styles.empty}>Nenhuma aprovação pendente.</p> : null}
    </section>
  );
}
