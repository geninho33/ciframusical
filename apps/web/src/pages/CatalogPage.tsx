import { useEffect, useState } from "react";
import styles from "./CatalogPage.module.css";

type HealthResponse = {
  status: string;
  service: string;
  version: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/v1";

export function CatalogPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${apiBase}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setHealth(null);
          setError("API offline — suba `pnpm dev:api` e o Docker Compose.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Catálogo</h1>
        <p className={styles.subtitle}>
          Shell da Fase 0. Busca, filtros e player chegam nas fases seguintes.
        </p>
      </header>

      <div className={styles.statusCard}>
        <h2 className={styles.statusTitle}>Status da API</h2>
        {health ? (
          <dl className={styles.meta}>
            <div>
              <dt>status</dt>
              <dd className={styles.ok}>{health.status}</dd>
            </div>
            <div>
              <dt>service</dt>
              <dd>{health.service}</dd>
            </div>
            <div>
              <dt>version</dt>
              <dd>{health.version}</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.error}>{error ?? "Verificando…"}</p>
        )}
      </div>

      <div className={styles.emptyGrid} aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    </section>
  );
}
