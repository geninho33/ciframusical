import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  completeUpload,
  createTrack,
  fetchJob,
  fetchTaxonomy,
  initUpload,
} from "../features/catalog/api";
import type { Taxonomy } from "../features/catalog/types";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import styles from "../features/auth/AuthForm.module.css";
import pageStyles from "./CreatorUploadPage.module.css";

async function waitForJob(
  jobId: string,
  token: string,
  onProgress: (label: string) => void,
) {
  for (let i = 0; i < 120; i++) {
    const job = await fetchJob(jobId, token);
    onProgress(`Análise: ${job.stage ?? job.status} (${job.progress}%)`);
    if (job.status === "completed") return job;
    if (job.status === "failed") {
      throw new Error(
        typeof job.error === "object" && job.error && "message" in job.error
          ? String((job.error as { message: string }).message)
          : "Análise falhou",
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timeout aguardando análise");
}

export function CreatorUploadPage() {
  const navigate = useNavigate();
  const { user, accessToken, hasRole } = useAuthStore();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("mpb");
  const [style, setStyle] = useState("playalong");
  const [originalKey, setOriginalKey] = useState("C");
  const [bpm, setBpm] = useState("100");
  const [lyricsPlain, setLyricsPlain] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchTaxonomy().then(setTaxonomy).catch(() => setTaxonomy(null));
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole("creator") && !hasRole("admin")) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Acesso restrito</h1>
        <p className={styles.subtitle}>
          É preciso o role <code>creator</code>. Peça a um admin em Admin → Usuários.
        </p>
        <Link to="/catalogo">Voltar</Link>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setProgress("Criando faixa…");

    try {
      const track = await createTrack(
        {
          title,
          artistName,
          genres: [genre],
          styles: [style],
          originalKey,
          bpm: Number(bpm) || undefined,
          difficulty: "intermediate",
          lyricsPlain: lyricsPlain.trim() || undefined,
        },
        accessToken,
      );

      if (file) {
        setProgress("Gerando URL de upload…");
        const upload = await initUpload(
          {
            trackId: track.id,
            filename: file.name,
            mimeType: file.type || "audio/mpeg",
            sizeBytes: file.size,
          },
          accessToken,
        );

        setProgress("Enviando MP3…");
        const put = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: upload.headers,
          body: file,
        });
        if (!put.ok) throw new Error(`Upload S3 falhou (${put.status})`);

        setProgress("Confirmando upload e enfileirando análise…");
        const completed = await completeUpload(upload.uploadId, accessToken, true);
        if (completed.jobId) {
          await waitForJob(completed.jobId, accessToken, setProgress);
        }
      }

      setProgress("Abrindo Sync Editor…");
      navigate(`/editar-sync/${track.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Nova faixa</h1>
      <p className={styles.subtitle}>
        Upload MP3 → análise (BPM/tom/acordes/letra) → Modo Estudo → publicar.
      </p>
      <form className={`${styles.form} ${pageStyles.wide}`} onSubmit={onSubmit}>
        <label className={styles.label}>
          Título
          <input
            className={styles.input}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          Artista
          <input
            className={styles.input}
            required
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
          />
        </label>
        <div className={pageStyles.row}>
          <label className={styles.label}>
            Gênero
            <select
              className={styles.input}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              {taxonomy?.genres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Estilo
            <select
              className={styles.input}
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              {taxonomy?.styles.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={pageStyles.row}>
          <label className={styles.label}>
            Tom (hint)
            <input
              className={styles.input}
              value={originalKey}
              onChange={(e) => setOriginalKey(e.target.value)}
            />
          </label>
          <label className={styles.label}>
            BPM (hint)
            <input
              className={styles.input}
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
            />
          </label>
        </div>
        <label className={styles.label}>
          Letra completa (opcional)
          <textarea
            className={styles.input}
            rows={6}
            placeholder={"Uma linha por verso…\nAcreditei no seu amor\nE acabei como eu estou"}
            value={lyricsPlain}
            onChange={(e) => setLyricsPlain(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          Arquivo MP3
          <input
            className={styles.input}
            type="file"
            accept="audio/mpeg,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {progress ? <p className={styles.success}>{progress}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Processando…" : "Criar, analisar e publicar"}
        </button>
      </form>
    </section>
  );
}
