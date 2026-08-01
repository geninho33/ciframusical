import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchAdminReports, resolveAdminReport } from "../features/catalog/api";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./AdminApprovalsPage.module.css";

type Item = Awaited<ReturnType<typeof fetchAdminReports>>["items"][number];

export function AdminReportsPage() {
  const { user, accessToken, hasRole } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    try {
      const res = await fetchAdminReports(accessToken, "open");
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

  async function onResolve(
    id: string,
    decision: "resolved" | "dismissed",
    archiveTrack = false,
  ) {
    if (!accessToken) return;
    try {
      await resolveAdminReport(id, accessToken, { decision, archiveTrack });
      setMessage(archiveTrack ? "Arquivada e resolvida" : `Denúncia ${decision}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Denúncias</h1>
      <p className={styles.subtitle}>
        Moderação de conteúdo · <Link to="/admin/metricas">Métricas</Link>
      </p>
      {message ? <p className={styles.ok}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div>
              <h2>{item.track.title}</h2>
              <p>
                {item.reason} · {item.reporter.displayName} ·{" "}
                {item.details ?? "sem detalhes"}
              </p>
            </div>
            <div className={styles.actions}>
              <Link to={`/faixas/${item.track.slug}`}>Ver</Link>
              <button type="button" onClick={() => void onResolve(item.id, "dismissed")}>
                Dispensar
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => void onResolve(item.id, "resolved", true)}
              >
                Arquivar faixa
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 ? <p className={styles.empty}>Nenhuma denúncia aberta.</p> : null}
    </section>
  );
}
