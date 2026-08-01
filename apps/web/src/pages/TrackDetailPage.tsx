import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addFavorite,
  fetchTrack,
  publishTrack,
  removeFavorite,
  reportTrack,
} from "../features/catalog/api";
import type { TrackDetail } from "../features/catalog/types";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./TrackDetailPage.module.css";

export function TrackDetailPage() {
  const { slug = "" } = useParams();
  const { user, accessToken, hasRole } = useAuthStore();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favBusy, setFavBusy] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchTrack(slug, accessToken);
        if (!cancelled) {
          setTrack(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setTrack(null);
          setError(err instanceof ApiError ? err.message : "Faixa não encontrada");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, accessToken]);

  async function toggleFavorite() {
    if (!track || !accessToken) return;
    setFavBusy(true);
    try {
      if (isFavorite) {
        await removeFavorite(track.id, accessToken);
        setIsFavorite(false);
      } else {
        await addFavorite(track.id, accessToken);
        setIsFavorite(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha nos favoritos");
    } finally {
      setFavBusy(false);
    }
  }

  async function onPublish() {
    if (!track || !accessToken) return;
    try {
      await publishTrack(track.id, accessToken);
      const refreshed = await fetchTrack(track.slug, accessToken);
      setTrack(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao publicar");
    }
  }

  async function onReport() {
    if (!track || !accessToken) return;
    try {
      const res = await reportTrack(track.id, accessToken, {
        reason: "incorrect_sync",
        details: "Reportado pelo detalhe da faixa",
      });
      setReportMsg(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao denunciar");
    }
  }

  if (error && !track) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>{error}</p>
        <Link to="/catalogo">Voltar ao catálogo</Link>
      </section>
    );
  }

  if (!track) return <p className={styles.loading}>Carregando…</p>;

  const canPublish =
    track.status !== "published" &&
    accessToken &&
    (hasRole("creator") || hasRole("admin"));

  return (
    <section className={styles.page}>
      <Link className={styles.back} to="/catalogo">
        ← Catálogo
      </Link>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{track.artist?.name ?? "Artista"}</p>
          <h1 className={styles.title}>{track.title}</h1>
          <div className={styles.chips}>
            <span>{track.originalKey ?? "Tom —"}</span>
            <span>{track.bpm ? `${track.bpm} BPM` : "BPM —"}</span>
            <span>{track.difficulty}</span>
            <span>{track.status}</span>
            {track.genres.map((g) => (
              <span key={g}>{g}</span>
            ))}
            {track.styles.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          {track.sync ? (
            <Link className={styles.primary} to={`/praticar/${track.slug}`}>
              Praticar (Play-Along)
            </Link>
          ) : null}
          {(hasRole("creator") || hasRole("admin")) && track.sync ? (
            <Link className={styles.secondary} to={`/editar-sync/${track.slug}`}>
              Editar sync
            </Link>
          ) : null}
          {user && track.status === "published" ? (
            <button
              type="button"
              className={styles.secondary}
              disabled={favBusy}
              onClick={() => void toggleFavorite()}
            >
              {isFavorite ? "Remover favorito" : "Favoritar"}
            </button>
          ) : null}
          {canPublish ? (
            <button type="button" className={styles.secondary} onClick={() => void onPublish()}>
              Publicar
            </button>
          ) : null}
          {user && track.status === "published" ? (
            <button type="button" className={styles.secondary} onClick={() => void onReport()}>
              Denunciar
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.playerBox}>
        {track.audio ? (
          <audio controls src={track.audio.url} className={styles.audio}>
            Seu navegador não suporta áudio.
          </audio>
        ) : (
          <div className={styles.placeholder}>
            <strong>{track.sync ? "Sync fixture pronta" : "Áudio placeholder"}</strong>
            <p>
              {track.sync
                ? "Esta faixa tem cifra sincronizada para o player (Fase 3). O MP3 real é opcional."
                : "Nenhum MP3 sincronizado ainda. Creators podem enviar em "}
              {!track.sync ? <Link to="/criar">Nova faixa</Link> : null}
            </p>
          </div>
        )}
      </div>

      {reportMsg ? <p className={styles.error} style={{ color: "var(--accent)" }}>{reportMsg}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
