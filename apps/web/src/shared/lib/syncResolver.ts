import type { CifraSyncDocument, SyncEvent } from "../../features/player/types";

/** Binary search: largest index with events[i].t <= t */
export function findEventIndex(events: SyncEvent[], t: number): number {
  if (!events.length) return -1;
  let lo = 0;
  let hi = events.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function getActiveEvent(doc: CifraSyncDocument | null, t: number): SyncEvent | null {
  if (!doc?.events?.length) return null;
  const idx = findEventIndex(doc.events, t);
  if (idx < 0) return null;
  const event = doc.events[idx];
  if (event.tEnd != null && t >= event.tEnd) {
    // still show until next event if tEnd already passed but next not reached
    if (idx + 1 < doc.events.length && t < doc.events[idx + 1].t) return event;
    if (idx + 1 >= doc.events.length && t <= doc.track.durationSec) return event;
  }
  return event;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
