import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchAdminMetrics } from "../features/catalog/api";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./AdminMetricsPage.module.css";

type Metrics = Awaited<ReturnType<typeof fetchAdminMetrics>>;

export function AdminMetricsPage() {
  const { user, accessToken, hasRole } = useAuthStore();
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void fetchAdminMetrics(accessToken)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole("admin")) return <Navigate to="/" replace />;

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Métricas</h1>
      <p className={styles.subtitle}>
        Painel operacional ·{" "}
        <Link to="/admin/denuncias">Denúncias</Link> ·{" "}
        <Link to="/admin/aprovacoes">Aprovações</Link>
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {!data ? (
        <p className={styles.muted}>Carregando…</p>
      ) : (
        <div className={styles.grid}>
          <article>
            <h2>Usuários</h2>
            <p className={styles.value}>{data.users}</p>
          </article>
          <article>
            <h2>Publicadas</h2>
            <p className={styles.value}>{data.tracks.published}</p>
          </article>
          <article>
            <h2>Pendentes</h2>
            <p className={styles.value}>{data.tracks.pendingApproval}</p>
          </article>
          <article>
            <h2>Processando</h2>
            <p className={styles.value}>{data.tracks.processing}</p>
          </article>
          <article>
            <h2>Denúncias abertas</h2>
            <p className={styles.value}>{data.reports.open}</p>
          </article>
          <article>
            <h2>Jobs OK (24h)</h2>
            <p className={styles.value}>{data.jobs.completedLast24h}</p>
          </article>
          <article>
            <h2>Jobs falha (24h)</h2>
            <p className={styles.value}>{data.jobs.failedLast24h}</p>
          </article>
          <article>
            <h2>Favoritos</h2>
            <p className={styles.value}>{data.favorites}</p>
          </article>
          <article className={styles.wide}>
            <h2>Runtime</h2>
            <p className={styles.muted}>
              uptime {data.runtime.uptimeSeconds}s · counters:{" "}
              {Object.keys(data.runtime.counters).length || "nenhum ainda"}
            </p>
            <pre className={styles.pre}>
              {JSON.stringify(data.runtime.counters, null, 2)}
            </pre>
          </article>
        </div>
      )}
    </section>
  );
}
