import { create } from "zustand";
import { transposeChord, transposeKey } from "../../shared/lib/chords";
import { getActiveEvent } from "../../shared/lib/syncResolver";
import { AudioEngine } from "./audioEngine";
import type { CifraSyncDocument, PlayerStatus, SyncEvent } from "./types";

type LoopState = { enabled: boolean; a: number | null; b: number | null };

type PlayerState = {
  trackId: string | null;
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  playbackRate: number;
  transposeSemitones: number;
  loop: LoopState;
  activeEventId: string | null;
  activeEvent: SyncEvent | null;
  syncDoc: CifraSyncDocument | null;
  displayKey: string | null;
  engine: AudioEngine | null;
  autoScroll: boolean;
  load: (opts: {
    trackId: string;
    syncDoc: CifraSyncDocument;
    audioUrl?: string | null;
  }) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  seek: (t: number) => void;
  setPlaybackRate: (rate: number) => void;
  setTranspose: (semitones: number) => void;
  setLoopA: () => void;
  setLoopB: () => void;
  clearLoop: () => void;
  toggleLoop: () => void;
  tick: () => void;
  dispose: () => Promise<void>;
};

function withTranspose(doc: CifraSyncDocument, semitones: number): CifraSyncDocument {
  if (semitones === 0) return doc;
  return {
    ...doc,
    track: {
      ...doc.track,
      originalKey: transposeKey(doc.track.originalKey, semitones),
    },
    events: doc.events.map((e) => ({
      ...e,
      chord: transposeChord(e.chord, semitones),
    })),
  };
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  trackId: null,
  status: "idle",
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  transposeSemitones: 0,
  loop: { enabled: false, a: null, b: null },
  activeEventId: null,
  activeEvent: null,
  syncDoc: null,
  displayKey: null,
  engine: null,
  autoScroll: true,

  load: async ({ trackId, syncDoc, audioUrl }) => {
    const prev = get().engine;
    if (prev) await prev.dispose();

    const engine = new AudioEngine();
    set({ status: "loading", engine, trackId, syncDoc, transposeSemitones: 0 });
    await engine.load({
      audioUrl,
      durationSec: syncDoc.track.durationSec,
    });
    set({
      status: "ready",
      duration: engine.getDuration(),
      currentTime: 0,
      displayKey: syncDoc.track.originalKey,
      activeEvent: syncDoc.events[0] ?? null,
      activeEventId: syncDoc.events[0]?.id ?? null,
      playbackRate: 1,
      loop: { enabled: false, a: null, b: null },
    });
  },

  play: async () => {
    const { engine, status } = get();
    if (!engine || status === "loading") return;
    await engine.play();
    set({ status: "playing" });
  },

  pause: () => {
    get().engine?.pause();
    set({ status: "paused" });
  },

  toggle: async () => {
    const { status } = get();
    if (status === "playing") get().pause();
    else await get().play();
  },

  seek: (t) => {
    const { engine, syncDoc, transposeSemitones } = get();
    if (!engine || !syncDoc) return;
    engine.seek(t);
    const displayDoc = withTranspose(syncDoc, transposeSemitones);
    const active = getActiveEvent(displayDoc, t);
    set({
      currentTime: t,
      activeEvent: active,
      activeEventId: active?.id ?? null,
    });
  },

  setPlaybackRate: (rate) => {
    get().engine?.setPlaybackRate(rate);
    set({ playbackRate: rate });
  },

  setTranspose: (semitones) => {
    const clamped = Math.max(-6, Math.min(6, semitones));
    const { syncDoc, currentTime } = get();
    if (!syncDoc) return;
    const displayDoc = withTranspose(syncDoc, clamped);
    const active = getActiveEvent(displayDoc, currentTime);
    set({
      transposeSemitones: clamped,
      displayKey: displayDoc.track.originalKey,
      activeEvent: active,
      activeEventId: active?.id ?? null,
    });
  },

  setLoopA: () => {
    const t = get().currentTime;
    const loop = { ...get().loop, a: t, enabled: true };
    get().engine?.setLoop(loop);
    set({ loop });
  },

  setLoopB: () => {
    const t = get().currentTime;
    const loop = { ...get().loop, b: t, enabled: true };
    get().engine?.setLoop(loop);
    set({ loop });
  },

  clearLoop: () => {
    const loop = { enabled: false, a: null, b: null };
    get().engine?.setLoop(loop);
    set({ loop });
  },

  toggleLoop: () => {
    const prev = get().loop;
    const loop = { ...prev, enabled: !prev.enabled };
    get().engine?.setLoop(loop);
    set({ loop });
  },

  tick: () => {
    const { engine, syncDoc, transposeSemitones, status } = get();
    if (!engine || !syncDoc || status !== "playing") return;
    const t = engine.tick();
    if (status === "playing" && t >= engine.getDuration() && !get().loop.enabled) {
      set({ status: "paused", currentTime: t });
    }
    const displayDoc = withTranspose(syncDoc, transposeSemitones);
    const active = getActiveEvent(displayDoc, t);
    set({
      currentTime: t,
      activeEvent: active,
      activeEventId: active?.id ?? null,
      status: engine.getCurrentTime() >= engine.getDuration() && !get().loop.enabled
        ? "paused"
        : get().status,
    });
  },

  dispose: async () => {
    await get().engine?.dispose();
    set({
      engine: null,
      status: "idle",
      syncDoc: null,
      trackId: null,
      activeEvent: null,
      activeEventId: null,
    });
  },
}));

export function selectDisplayDoc(state: PlayerState): CifraSyncDocument | null {
  if (!state.syncDoc) return null;
  return withTranspose(state.syncDoc, state.transposeSemitones);
}
