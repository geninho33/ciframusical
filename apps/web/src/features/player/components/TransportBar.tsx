import { formatTime } from "../../../shared/lib/syncResolver";
import { usePlayerStore } from "../playerStore";
import styles from "./TransportBar.module.css";

export function TransportBar() {
  const status = usePlayerStore((s) => s.status);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const transposeSemitones = usePlayerStore((s) => s.transposeSemitones);
  const loop = usePlayerStore((s) => s.loop);
  const displayKey = usePlayerStore((s) => s.displayKey);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const setTranspose = usePlayerStore((s) => s.setTranspose);
  const setLoopA = usePlayerStore((s) => s.setLoopA);
  const setLoopB = usePlayerStore((s) => s.setLoopB);
  const clearLoop = usePlayerStore((s) => s.clearLoop);
  const toggleLoop = usePlayerStore((s) => s.toggleLoop);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  function nudgeTranspose(delta: number) {
    setTranspose(Math.min(6, Math.max(-6, transposeSemitones + delta)));
  }

  return (
    <div
      className={styles.bar}
      role="group"
      aria-label="Controles do player"
      // Avoid accidental form submit if this bar is ever nested in a <form>
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
    >
      <div className={styles.seekRow}>
        <button
          type="button"
          className={styles.play}
          onClick={() => void toggle()}
          disabled={status === "loading" || status === "idle"}
          aria-keyshortcuts="Space"
          aria-label={status === "playing" ? "Pausar" : "Reproduzir"}
        >
          {status === "playing" ? "Pause" : "Play"}
        </button>
        <span className={styles.time}>{formatTime(currentTime)}</span>
        <input
          className={styles.seek}
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className={styles.time}>{formatTime(duration)}</span>
      </div>
      <div className={styles.progressTrack} aria-hidden>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.controls}>
        <div className={styles.control} role="group" aria-label="Transposição de tom">
          <span className={styles.controlTitle}>Tom</span>
          <div className={styles.tomRow}>
            <button
              type="button"
              className={styles.tomBtn}
              onClick={() => nudgeTranspose(-1)}
              aria-label="Diminuir um semitom"
            >
              −
            </button>
            <button
              type="button"
              className={styles.tomBadge}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTranspose(0);
              }}
              aria-label={`Tom atual ${displayKey ?? "—"}. Clique para resetar para o original.`}
              title="Clique para voltar ao tom original"
            >
              {displayKey ?? "—"}
            </button>
            <button
              type="button"
              className={styles.tomBtn}
              onClick={() => nudgeTranspose(1)}
              aria-label="Aumentar um semitom"
            >
              +
            </button>
            <span className={styles.tomDelta}>
              {transposeSemitones > 0
                ? `+${transposeSemitones}`
                : transposeSemitones}
            </span>
          </div>
        </div>

        <div className={styles.control}>
          <span className={styles.controlTitle} id="speed-label">
            Velocidade
          </span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            aria-labelledby="speed-label"
          />
          <span>{playbackRate.toFixed(2)}×</span>
        </div>

        <div className={styles.loopGroup} role="group" aria-label="Loop A/B">
          <button type="button" onClick={setLoopA} aria-label="Marcar ponto A">
            A {loop.a != null ? formatTime(loop.a) : "—"}
          </button>
          <button type="button" onClick={setLoopB} aria-label="Marcar ponto B">
            B {loop.b != null ? formatTime(loop.b) : "—"}
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            data-on={loop.enabled}
            aria-pressed={loop.enabled}
            aria-label="Ativar ou desativar loop"
          >
            Loop {loop.enabled ? "ON" : "OFF"}
          </button>
          <button type="button" onClick={clearLoop} aria-label="Limpar loop">
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
