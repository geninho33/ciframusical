import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTaxonomy, fetchTracks } from "../features/catalog/api";
import type { Taxonomy, TrackListItem } from "../features/catalog/types";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./CatalogPage.module.css";

export function CatalogPage() {
  const { accessToken, hasRole } = useAuthStore();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [items, setItems] = useState<TrackListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [style, setStyle] = useState("");
  const [key, setKey] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [scope, setScope] = useState("published");

  useEffect(() => {
    void fetchTaxonomy()
      .then(setTaxonomy)
      .catch(() => setTaxonomy(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchTracks(
          { q, genre, style, key, difficulty, scope, sort: "newest" },
          accessToken,
        );
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar o catálogo.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [q, genre, style, key, difficulty, scope, accessToken]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Catálogo</h1>
          <p className={styles.subtitle}>
            {total} faixa{total === 1 ? "" : "s"} · filtros por tom, gênero e estilo
          </p>
        </div>
        {hasRole("creator") || hasRole("admin") ? (
          <Link className={styles.createLink} to="/criar">
            Nova faixa
          </Link>
        ) : null}
      </header>

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Buscar título ou artista"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={styles.input} value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Gênero</option>
          {taxonomy?.genres.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <select className={styles.input} value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="">Estilo</option>
          {taxonomy?.styles.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          placeholder="Tom (ex: G, Am)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <select
          className={styles.input}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">Dificuldade</option>
          <option value="beginner">Iniciante</option>
          <option value="intermediate">Intermediário</option>
          <option value="advanced">Avançado</option>
        </select>
        {(hasRole("creator") || hasRole("admin")) && (
          <select
            className={styles.input}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="published">Publicadas</option>
            <option value="mine">Minhas</option>
          </select>
        )}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.grid}>
        {items.map((track) => (
          <Link key={track.id} to={`/faixas/${track.slug}`} className={styles.card}>
            <div className={styles.cover} data-has-audio={track.hasAudio}>
              <span>{track.originalKey ?? "—"}</span>
            </div>
            <h2>{track.title}</h2>
            <p>{track.artist?.name ?? "Artista"}</p>
            <div className={styles.meta}>
              <span>{track.bpm ? `${track.bpm} BPM` : "BPM —"}</span>
              <span>{track.difficulty}</span>
            </div>
            <div className={styles.tags}>
              {track.genres.slice(0, 2).map((g) => (
                <span key={g}>{g}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {!error && items.length === 0 ? (
        <p className={styles.empty}>Nenhuma faixa encontrada com esses filtros.</p>
      ) : null}
    </section>
  );
}
