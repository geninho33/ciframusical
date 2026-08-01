import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchFavorites } from "../features/catalog/api";
import type { TrackDetail } from "../features/catalog/types";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./CatalogPage.module.css";

export function FavoritesPage() {
  const { user, accessToken } = useAuthStore();
  const [items, setItems] = useState<TrackDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchFavorites(accessToken!);
        if (!cancelled) {
          setItems(res.items);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Falha ao carregar favoritos");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Favoritos</h1>
          <p className={styles.subtitle}>{items.length} faixa(s) salvas</p>
        </div>
      </header>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.grid}>
        {items.map((track) => (
          <Link key={track.id} to={`/faixas/${track.slug}`} className={styles.card}>
            <div className={styles.cover}>
              <span>{track.originalKey ?? "—"}</span>
            </div>
            <h2>{track.title}</h2>
            <p>{track.artist?.name ?? "Artista"}</p>
          </Link>
        ))}
      </div>
      {!error && items.length === 0 ? (
        <p className={styles.empty}>
          Nenhum favorito ainda. Explore o <Link to="/catalogo">catálogo</Link>.
        </p>
      ) : null}
    </section>
  );
}
