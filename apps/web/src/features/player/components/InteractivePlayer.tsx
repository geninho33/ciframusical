import { useEffect, useRef } from "react";
import type { CifraSyncDocument } from "../types";
import { selectDisplayDoc, usePlayerStore } from "../playerStore";
import { ChordDiagram } from "./ChordDiagram";
import { ChordScrollViewport } from "./ChordScrollViewport";
import { TransportBar } from "./TransportBar";
import styles from "./InteractivePlayer.module.css";

type Props = {
  trackId: string;
  syncDoc: CifraSyncDocument;
  audioUrl?: string | null;
  title: string;
  artist: string;
};

export function InteractivePlayer({
  trackId,
  syncDoc,
  audioUrl,
  title,
  artist,
}: Props) {
  const status = usePlayerStore((s) => s.status);
  const activeEventId = usePlayerStore((s) => s.activeEventId);
  const activeEvent = usePlayerStore((s) => s.activeEvent);
  const displayKey = usePlayerStore((s) => s.displayKey);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const autoScroll = usePlayerStore((s) => s.autoScroll);
  const load = usePlayerStore((s) => s.load);
  const tick = usePlayerStore((s) => s.tick);
  const toggle = usePlayerStore((s) => s.toggle);
  const dispose = usePlayerStore((s) => s.dispose);
  const displayDoc = usePlayerStore(selectDisplayDoc);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    void load({ trackId, syncDoc, audioUrl });
    return () => {
      void dispose();
    };
  }, [trackId, syncDoc, audioUrl, load, dispose]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tickRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        void toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const doc = displayDoc ?? syncDoc;

  return (
    <div className={styles.root}>
      <header className={styles.hud}>
        <div>
          <p className={styles.artist}>{artist}</p>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>Tom</dt>
            <dd>{displayKey ?? doc.track.originalKey}</dd>
          </div>
          <div>
            <dt>BPM</dt>
            <dd>{Math.round(doc.track.bpm * playbackRate)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.body}>
        <ChordScrollViewport
          doc={doc}
          activeEventId={activeEventId}
          autoScroll={autoScroll}
        />
        <aside className={styles.side}>
          <ChordDiagram symbol={activeEvent?.chord.symbol ?? "—"} />
          {!audioUrl ? (
            <p className={styles.note}>
              Fixture sem MP3 — o clock Tone.js guia a cifra (play-along).
            </p>
          ) : null}
        </aside>
      </div>

      <TransportBar />
    </div>
  );
}
