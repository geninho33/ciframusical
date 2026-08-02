type ToneModule = typeof import("tone");
type GrainPlayer = import("tone").GrainPlayer;

type LoopBounds = { enabled: boolean; a: number | null; b: number | null };

/**
 * Play-along clock:
 * - with audio URL → Tone.GrainPlayer (time-stretch com pitch preserve)
 * - without audio → clock baseado em performance.now (fixture Phase 3)
 *
 * Tone.js is loaded lazily so mere page navigation does not create an
 * AudioContext (browser autoplay policy).
 */
export class AudioEngine {
  private tone: ToneModule | null = null;
  private player: GrainPlayer | null = null;
  private startedAudioContext = false;
  private pendingUrl: string | null = null;
  private durationSec = 0;
  private loop: LoopBounds = { enabled: false, a: null, b: null };
  private rate = 1;
  private playing = false;
  private anchorWall = 0;
  private anchorMedia = 0;

  private async getTone() {
    if (!this.tone) {
      this.tone = await import("tone");
    }
    return this.tone;
  }

  async ensureStarted() {
    const Tone = await this.getTone();
    if (!this.startedAudioContext) {
      await Tone.start();
      this.startedAudioContext = true;
    }
  }

  async load(options: { audioUrl?: string | null; durationSec: number }) {
    await this.disposePlayer();
    this.durationSec = options.durationSec;
    this.playing = false;
    this.anchorMedia = 0;
    this.anchorWall = 0;
    this.pendingUrl = options.audioUrl ?? null;

    // Defer GrainPlayer until first play() (user gesture) when possible.
    // For fixture-only tracks no Tone import is needed until play.
  }

  private async ensurePlayer() {
    if (!this.pendingUrl || this.player) return;
    const Tone = await this.getTone();
    this.player = new Tone.GrainPlayer({
      url: this.pendingUrl,
      grainSize: 0.12,
      overlap: 0.05,
      loop: false,
    }).toDestination();
    await Tone.loaded();
    if (this.player.buffer.duration > 0) {
      this.durationSec = this.player.buffer.duration;
    }
  }

  getDuration() {
    return this.durationSec;
  }

  getCurrentTime() {
    if (!this.playing) return this.anchorMedia;
    const elapsed = ((performance.now() - this.anchorWall) / 1000) * this.rate;
    return Math.min(this.durationSec, this.anchorMedia + elapsed);
  }

  async play() {
    await this.ensureStarted();
    await this.ensurePlayer();
    const t = this.getCurrentTime();
    this.anchorMedia = t;
    this.anchorWall = performance.now();
    this.playing = true;

    if (this.player) {
      this.player.stop();
      this.player.playbackRate = this.rate;
      const offset = Math.min(t, Math.max(0, this.durationSec - 0.05));
      this.player.start(undefined, offset);
    }
  }

  pause() {
    this.anchorMedia = this.getCurrentTime();
    this.playing = false;
    if (this.player) this.player.stop();
  }

  stop() {
    this.playing = false;
    this.anchorMedia = 0;
    this.anchorWall = 0;
    if (this.player) this.player.stop();
  }

  seek(seconds: number) {
    const t = Math.min(Math.max(0, seconds), this.durationSec);
    const wasPlaying = this.playing;
    if (this.player) this.player.stop();
    this.anchorMedia = t;
    this.anchorWall = performance.now();
    if (wasPlaying && this.player) {
      this.player.playbackRate = this.rate;
      this.player.start(undefined, t);
    }
  }

  setPlaybackRate(rate: number) {
    const t = this.getCurrentTime();
    this.rate = Math.min(1.5, Math.max(0.5, rate));
    this.anchorMedia = t;
    this.anchorWall = performance.now();
    if (this.player) this.player.playbackRate = this.rate;
  }

  setLoop(loop: LoopBounds) {
    this.loop = loop;
  }

  isPlaying() {
    return this.playing;
  }

  /** Call from rAF — enforces A/B loop and end-of-track */
  tick(): number {
    let t = this.getCurrentTime();
    if (
      this.loop.enabled &&
      this.loop.a != null &&
      this.loop.b != null &&
      this.loop.b > this.loop.a &&
      t >= this.loop.b
    ) {
      this.seek(this.loop.a);
      t = this.loop.a;
    } else if (t >= this.durationSec) {
      this.pause();
      this.seek(this.durationSec);
      t = this.durationSec;
    }
    return t;
  }

  private async disposePlayer() {
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }

  async dispose() {
    this.pause();
    await this.disposePlayer();
    this.pendingUrl = null;
  }
}
