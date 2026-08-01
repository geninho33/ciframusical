import { useEffect, useRef } from "react";
import type { CifraSyncDocument } from "../types";
import styles from "./ChordScrollViewport.module.css";

type Props = {
  doc: CifraSyncDocument;
  activeEventId: string | null;
  autoScroll: boolean;
};

export function ChordScrollViewport({ doc, activeEventId, autoScroll }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || !activeRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const el = activeRef.current;
    const top =
      el.offsetTop - container.clientHeight * 0.35 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeEventId, autoScroll]);

  const sections = doc.sections.length
    ? doc.sections
    : [{ id: "all", name: "Faixa", startSec: 0, endSec: doc.track.durationSec }];

  return (
    <div className={styles.viewport} ref={containerRef}>
      {sections.map((section) => {
        const events = doc.events.filter((e) =>
          section.id === "all" ? true : e.sectionId === section.id,
        );
        if (!events.length) return null;
        return (
          <section key={section.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.name}</h2>
            <div className={styles.events}>
              {events.map((event) => {
                const active = event.id === activeEventId;
                return (
                  <div
                    key={event.id}
                    ref={active ? activeRef : undefined}
                    className={active ? `${styles.event} ${styles.active}` : styles.event}
                    data-event-id={event.id}
                  >
                    <span className={styles.chord}>{event.chord.symbol}</span>
                    {event.lyricLine ? (
                      <span className={styles.lyric}>{event.lyricLine}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
