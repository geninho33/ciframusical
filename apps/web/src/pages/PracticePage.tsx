import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTrack } from "../features/catalog/api";
import type { TrackDetail } from "../features/catalog/types";
import { InteractivePlayer } from "../features/player/components/InteractivePlayer";
import type { CifraSyncDocument } from "../features/player/types";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "./PracticePage.module.css";

async function loadSyncDocument(sync: TrackDetail["sync"]): Promise<CifraSyncDocument> {
  if (!sync?.url) throw new Error("Faixa sem sync document");
  const url = sync.url.startsWith("http")
    ? sync.url
    : `${window.location.origin}${sync.url}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar sync (${res.status})`);
  return (await res.json()) as CifraSyncDocument;
}

export function PracticePage() {
  const { slug = "" } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [syncDoc, setSyncDoc] = useState<CifraSyncDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const detail = await fetchTrack(slug, accessToken);
        const doc = await loadSyncDocument(detail.sync);
        if (!cancelled) {
          setTrack(detail);
          setSyncDoc(doc);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : String(err));
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [slug, accessToken]);

  if (error) {
    return (
      <div className={styles.errorPage}>
        <p>{error}</p>
        <Link to={`/faixas/${slug}`}>Voltar</Link>
      </div>
    );
  }

  if (!track || !syncDoc) {
    return <div className={styles.errorPage}>Carregando player…</div>;
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={`/faixas/${track.slug}`}>
        ← Sair do modo estudo
      </Link>
      <InteractivePlayer
        trackId={track.id}
        syncDoc={syncDoc}
        audioUrl={track.audio?.url}
        title={track.title}
        artist={track.artist?.name ?? syncDoc.track.artist}
      />
    </div>
  );
}
