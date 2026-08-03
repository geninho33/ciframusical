import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  completeUpload,
  createTrack,
  fetchJob,
  fetchTaxonomy,
  initUpload,
} from "../features/catalog/api";
import {
  UploadProgressBar,
  type UploadProgressState,
} from "../features/catalog/UploadProgressBar";
import type { Taxonomy } from "../features/catalog/types";
import { useAuthStore } from "../features/auth/authStore";
import { API_BASE, ApiError } from "../shared/api/client";
import styles from "../features/auth/AuthForm.module.css";
import pageStyles from "./CreatorUploadPage.module.css";

const IDLE_PROGRESS: UploadProgressState = {
  percent: 0,
  label: "",
  phase: "idle",
};

function putFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Upload S3 falhou (${xhr.status})${xhr.responseText ? `: ${xhr.responseText.slice(0, 200)}` : ""}`,
        ),
      );
    };
    xhr.onerror = () =>
      reject(new Error("Upload S3 falhou (rede/CORS). Verifique MinIO CORS."));
    xhr.send(file);
  });
}

async function waitForJob(
  jobId: string,
  token: string,
  onProgress: (label: string, jobPercent: number) => void,
) {
  // Análise real (librosa) pode passar de 2 min em VPS pequena
  for (let i = 0; i < 300; i++) {
    const job = await fetchJob(jobId, token);
    const stuckQueued = (job.stage === "queued" || job.progress === 0) && i >= 45;
    onProgress(
      stuckQueued
        ? `Análise ainda enfileirada… verifique audio-worker (${job.stage ?? job.status})`
        : `Análise: ${job.stage ?? job.status}`,
      job.progress ?? 0,
    );
    if (job.status === "completed") return job;
    if (job.status === "failed") {
      const err = job.error;
      const detail =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: string }).message) +
            ("detail" in err && (err as { detail?: string }).detail
              ? ` — ${String((err as { detail?: string }).detail)}`
              : "")
          : "Análise falhou";
      throw new Error(detail);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    "Timeout aguardando análise. Confira: docker compose logs audio-worker api --tail=100",
  );
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
  const [progress, setProgress] = useState<UploadProgressState>(IDLE_PROGRESS);
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
    setProgress({
      percent: 4,
      label: "Criando faixa…",
      phase: "preparing",
    });

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
        setProgress({
          percent: 10,
          label: "Gerando URL de upload…",
          phase: "preparing",
        });
        const upload = await initUpload(
          {
            trackId: track.id,
            filename: file.name,
            mimeType: file.type || "audio/mpeg",
            sizeBytes: file.size,
          },
          accessToken,
        );

        setProgress({
          percent: 15,
          label: "Enviando MP3…",
          phase: "uploading",
        });
        const contentType =
          upload.headers?.["Content-Type"] || file.type || "audio/mpeg";
        // Default: proxy via API (no browser→MinIO CORS). Presigned only if requested.
        const useProxy =
          upload.uploadMode !== "presigned" || !upload.uploadUrl;
        const putUrl = useProxy
          ? `${API_BASE}${upload.proxyUploadPath}`
          : upload.uploadUrl;
        const putHeaders: Record<string, string> = {
          "Content-Type": contentType,
        };
        if (useProxy) {
          putHeaders.Authorization = `Bearer ${accessToken}`;
        }
        await putFileWithProgress(putUrl, file, putHeaders, (ratio) => {
          setProgress({
            percent: 15 + ratio * 40,
            label: `Enviando MP3… ${Math.round(ratio * 100)}%`,
            phase: "uploading",
          });
        });

        setProgress({
          percent: 58,
          label: "Confirmando upload e enfileirando análise…",
          phase: "analyzing",
        });
        const completed = await completeUpload(
          upload.uploadId,
          accessToken,
          true,
        );
        if (completed.jobId) {
          try {
            await waitForJob(
              completed.jobId,
              accessToken,
              (label, jobPercent) => {
                setProgress({
                  percent: 60 + (jobPercent / 100) * 35,
                  label,
                  phase: "analyzing",
                });
              },
            );
          } catch (analyzeErr) {
            // Upload ok — abre editor mesmo se a análise falhar/timeout
            setError(
              analyzeErr instanceof Error
                ? `${analyzeErr.message} (abrindo editor com draft)`
                : String(analyzeErr),
            );
          }
        }
      }

      setProgress({
        percent: 100,
        label: "Abrindo Sync Editor…",
        phase: "finishing",
      });
      navigate(`/editar-sync/${track.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setProgress(IDLE_PROGRESS);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`${styles.page} ${pageStyles.widePage}`}>
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
            placeholder={
              "Uma linha por verso…\nAcreditei no seu amor\nE acabei como eu estou"
            }
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
        <UploadProgressBar state={progress} />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Processando…" : "Criar, analisar e publicar"}
        </button>
      </form>
    </section>
  );
}
