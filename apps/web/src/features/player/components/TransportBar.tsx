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

  return (
    <div className={styles.bar}>
      <div className={styles.seekRow}>
        <button
          type="button"
          className={styles.play}
          onClick={() => void toggle()}
          disabled={status === "loading" || status === "idle"}
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
        <label className={styles.control}>
          Tom {displayKey ?? "—"}
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={transposeSemitones}
            onChange={(e) => setTranspose(Number(e.target.value))}
          />
          <span>{transposeSemitones > 0 ? `+${transposeSemitones}` : transposeSemitones}</span>
        </label>

        <label className={styles.control}>
          Velocidade
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
          />
          <span>{playbackRate.toFixed(2)}×</span>
        </label>

        <div className={styles.loopGroup}>
          <button type="button" onClick={setLoopA}>
            A {loop.a != null ? formatTime(loop.a) : "—"}
          </button>
          <button type="button" onClick={setLoopB}>
            B {loop.b != null ? formatTime(loop.b) : "—"}
          </button>
          <button type="button" onClick={toggleLoop} data-on={loop.enabled}>
            Loop {loop.enabled ? "ON" : "OFF"}
          </button>
          <button type="button" onClick={clearLoop}>
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
