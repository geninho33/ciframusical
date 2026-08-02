import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  fetchTrack,
  getTrackSync,
  publishTrack,
  putTrackSync,
} from "../features/catalog/api";
import type { TrackDetail } from "../features/catalog/types";
import type { CifraSyncDocument, SyncEvent } from "../features/player/types";
import { useAuthStore } from "../features/auth/authStore";
import { ApiError } from "../shared/api/client";
import { formatTime } from "../shared/lib/syncResolver";
import styles from "./SyncEditorPage.module.css";

function cloneDoc(doc: CifraSyncDocument): CifraSyncDocument {
  return structuredClone(doc);
}

export function SyncEditorPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user, accessToken, hasRole } = useAuthStore();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [doc, setDoc] = useState<CifraSyncDocument | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startT: number } | null>(null);

  const selected = useMemo(
    () => doc?.events.find((e) => e.id === selectedId) ?? null,
    [doc, selectedId],
  );

  useEffect(() => {
    if (!accessToken || !slug) return;
    let cancelled = false;
    async function load() {
      try {
        const detail = await fetchTrack(slug, accessToken!);
        let syncDoc: CifraSyncDocument;
        let syncVersion: number | null = null;
        try {
          const sync = await getTrackSync(detail.id, accessToken!);
          syncDoc = cloneDoc(sync.document);
          syncVersion = sync.version;
        } catch {
          // bootstrap from public fixture when no SyncVersion yet
          if (!detail.sync?.url) throw new Error("Faixa sem sync para editar");
          const url = detail.sync.url.startsWith("http")
            ? detail.sync.url
            : `${window.location.origin}${detail.sync.url}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Falha ao carregar fixture de sync");
          syncDoc = cloneDoc((await res.json()) as CifraSyncDocument);
        }
        if (cancelled) return;
        setTrack(detail);
        setDoc(syncDoc);
        setVersion(syncVersion);
        setSelectedId(syncDoc.events[0]?.id ?? null);
        if (detail.audio?.url) {
          const decoded = await decodePeaks(detail.audio.url);
          if (!cancelled) setPeaks(decoded);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : String(err));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, slug]);

  useEffect(() => {
    drawWaveform(canvasRef.current, peaks, doc, selectedId);
  }, [peaks, doc, selectedId]);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole("creator") && !hasRole("admin")) {
    return <Navigate to="/" replace />;
  }

  function updateSelected(patch: Partial<SyncEvent>) {
    if (!doc || !selected) return;
    setDoc({
      ...doc,
      events: doc.events
        .map((e) => (e.id === selected.id ? { ...e, ...patch } : e))
        .sort((a, b) => a.t - b.t),
    });
  }

  function updateSelectedChord(field: "symbol" | "root" | "quality", value: string) {
    if (!selected) return;
    const chord = { ...selected.chord, [field]: value };
    if (field === "symbol") {
      // keep root/quality best-effort
    }
    updateSelected({ chord });
  }

  function addEvent() {
    if (!doc) return;
    const t = selected?.t ?? 0;
    const id = `e${Date.now()}`;
    const event: SyncEvent = {
      id,
      t,
      tEnd: Math.min(doc.track.durationSec, t + 2),
      chord: { symbol: "C", root: "C", quality: "maj", bass: null, extensions: [] },
      lyricLine: "",
      sectionId: doc.sections[0]?.id ?? null,
    };
    setDoc({ ...doc, events: [...doc.events, event].sort((a, b) => a.t - b.t) });
    setSelectedId(id);
  }

  function removeSelected() {
    if (!doc || !selected || doc.events.length <= 1) return;
    const next = doc.events.filter((e) => e.id !== selected.id);
    setDoc({ ...doc, events: next });
    setSelectedId(next[0]?.id ?? null);
  }

  async function onSave() {
    if (!accessToken || !doc || !track) return;
    setSaving(true);
    setError(null);
    try {
      const res = await putTrackSync(track.id, accessToken, doc);
      setVersion(res.version);
      setMessage(`Salvo como v${res.version}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (!accessToken || !track) return;
    setSaving(true);
    setError(null);
    try {
      let syncVersion = version ?? undefined;
      if (doc) {
        const saved = await putTrackSync(track.id, accessToken, doc);
        syncVersion = saved.version;
        setVersion(saved.version);
      }
      const res = await publishTrack(track.id, accessToken, {
        syncVersion,
        changelog: "Ajustes no editor de sync",
      });
      setMessage(res.message);
      if (res.status === "published") {
        navigate(`/praticar/${track.slug}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!doc || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * doc.track.durationSec;
    const nearest = doc.events.reduce((best, ev) =>
      Math.abs(ev.t - t) < Math.abs(best.t - t) ? ev : best,
    );
    if (Math.abs(nearest.t - t) < doc.track.durationSec * 0.02) {
      setSelectedId(nearest.id);
      dragRef.current = { id: nearest.id, startX: x, startT: nearest.t };
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || !doc || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const deltaT = ((x - dragRef.current.startX) / rect.width) * doc.track.durationSec;
    const nextT = Math.min(
      Math.max(0, dragRef.current.startT + deltaT),
      doc.track.durationSec,
    );
    setDoc({
      ...doc,
      events: doc.events
        .map((ev) =>
          ev.id === dragRef.current!.id
            ? {
                ...ev,
                t: Number(nextT.toFixed(3)),
                tEnd:
                  ev.tEnd != null
                    ? Number(Math.max(nextT + 0.1, ev.tEnd + (nextT - ev.t)).toFixed(3))
                    : ev.tEnd,
              }
            : ev,
        )
        .sort((a, b) => a.t - b.t),
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  if (error && !doc) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>{error}</p>
        <Link to="/catalogo">Voltar</Link>
      </section>
    );
  }

  if (!doc || !track) {
    return <section className={styles.page}>Carregando editor…</section>;
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sync Editor · v{version ?? "—"}</p>
          <h1 className={styles.title}>{track.title}</h1>
        </div>
        <div className={styles.actions}>
          <Link className={styles.ghost} to={`/faixas/${track.slug}`}>
            Detalhe
          </Link>
          <button type="button" className={styles.ghost} onClick={addEvent}>
            + Evento
          </button>
          <button type="button" className={styles.ghost} onClick={removeSelected}>
            Remover
          </button>
          <button type="button" className={styles.secondary} disabled={saving} onClick={() => void onSave()}>
            Salvar
          </button>
          <button type="button" className={styles.primary} disabled={saving} onClick={() => void onPublish()}>
            Publicar
          </button>
        </div>
      </header>

      <div className={styles.waveWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={1200}
          height={160}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <p className={styles.hint}>
          Arraste marcadores na waveform para ajustar o tempo do acorde.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.list}>
          {doc.events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={
                event.id === selectedId ? `${styles.item} ${styles.itemActive}` : styles.item
              }
              onClick={() => setSelectedId(event.id)}
            >
              <strong>{event.chord.symbol}</strong>
              <span>{formatTime(event.t)}</span>
              <em>{event.lyricLine || "—"}</em>
            </button>
          ))}
        </div>

        <div className={styles.inspector}>
          <h2>Inspetor</h2>
          {selected ? (
            <>
              <label>
                Tempo (s)
                <input
                  type="number"
                  step="0.01"
                  value={selected.t}
                  onChange={(e) => updateSelected({ t: Number(e.target.value) })}
                />
              </label>
              <label>
                Acorde (symbol)
                <input
                  value={selected.chord.symbol}
                  onChange={(e) => updateSelectedChord("symbol", e.target.value)}
                />
              </label>
              <label>
                Root
                <input
                  value={selected.chord.root}
                  onChange={(e) => updateSelectedChord("root", e.target.value)}
                />
              </label>
              <label>
                Quality
                <input
                  value={selected.chord.quality}
                  onChange={(e) => updateSelectedChord("quality", e.target.value)}
                />
              </label>
              <label>
                Letra
                <textarea
                  rows={3}
                  value={selected.lyricLine ?? ""}
                  onChange={(e) => updateSelected({ lyricLine: e.target.value })}
                />
              </label>
            </>
          ) : (
            <p>Selecione um evento</p>
          )}
        </div>
      </div>

      {message ? <p className={styles.ok}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}

async function decodePeaks(url: string): Promise<Float32Array> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const ctx = new AudioContext();
  const audio = await ctx.decodeAudioData(buf.slice(0));
  await ctx.close();
  const data = audio.getChannelData(0);
  const bars = 600;
  const block = Math.floor(data.length / bars);
  const peaks = new Float32Array(bars);
  for (let i = 0; i < bars; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      max = Math.max(max, Math.abs(data[start + j] ?? 0));
    }
    peaks[i] = max;
  }
  return peaks;
}

function drawWaveform(
  canvas: HTMLCanvasElement | null,
  peaks: Float32Array | null,
  doc: CifraSyncDocument | null,
  selectedId: string | null,
) {
  if (!canvas || !doc) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#14181f";
  ctx.fillRect(0, 0, w, h);

  if (peaks) {
    ctx.fillStyle = "#3dde9a66";
    const mid = h / 2;
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const amp = peaks[i] * (h * 0.45);
      ctx.fillRect(x, mid - amp, Math.max(1, w / peaks.length - 0.5), amp * 2);
    }
  } else {
    ctx.fillStyle = "#222a3a";
    ctx.fillRect(0, h * 0.35, w, h * 0.3);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "14px monospace";
    ctx.fillText("Sem áudio — marcadores sobre timeline vazia", 16, h / 2);
  }

  for (const event of doc.events) {
    const x = (event.t / doc.track.durationSec) * w;
    ctx.strokeStyle = event.id === selectedId ? "#3dde9a" : "#c9d1d988";
    ctx.lineWidth = event.id === selectedId ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillStyle = event.id === selectedId ? "#3dde9a" : "#c9d1d9";
    ctx.font = "12px monospace";
    ctx.fillText(event.chord.symbol, x + 4, 16);
  }
}
