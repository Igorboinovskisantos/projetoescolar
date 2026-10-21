import type { WorldId } from "./types";

type MusicId = WorldId;

interface Pattern {
  step: number;
  melody: number[];
  bass: number[];
}

const PATTERNS: Record<MusicId, Pattern> = {
  candy: {
    step: 0.21,
    melody: [72, 76, 79, 76, 81, 79, 77, 74, 72, 74, 76, 79, 81, 79, 76, 72],
    bass: [48, 0, 55, 0, 53, 0, 48, 0, 45, 0, 53, 0, 48, 0, 43, 0],
  },
  ice: {
    step: 0.24,
    melody: [76, 0, 79, 83, 0, 79, 74, 0, 72, 76, 79, 0, 83, 81, 79, 76],
    bass: [48, 0, 0, 55, 0, 0, 46, 0, 48, 0, 0, 53, 0, 0, 43, 0],
  },
  lemon: {
    step: 0.23,
    melody: [70, 73, 68, 75, 70, 0, 68, 63, 70, 73, 75, 68, 66, 0, 63, 70],
    bass: [46, 0, 49, 0, 46, 0, 44, 0, 46, 0, 51, 0, 44, 0, 42, 0],
  },
  vampire: {
    step: 0.28,
    melody: [63, 0, 65, 0, 58, 60, 63, 0, 65, 63, 58, 0, 56, 58, 60, 0],
    bass: [39, 0, 0, 46, 0, 0, 41, 0, 39, 0, 0, 44, 0, 0, 36, 0],
  },
  mars: {
    step: 0.25,
    melody: [67, 70, 74, 70, 65, 0, 62, 65, 67, 74, 0, 70, 67, 62, 65, 67],
    bass: [43, 0, 50, 0, 41, 0, 48, 0, 43, 0, 50, 0, 38, 0, 45, 0],
  },
  space: {
    step: 0.31,
    melody: [60, 0, 0, 63, 0, 0, 58, 0, 0, 67, 0, 0, 55, 0, 0, 58],
    bass: [36, 0, 0, 0, 43, 0, 0, 0, 34, 0, 0, 0, 41, 0, 0, 0],
  },
  ending: {
    step: 0.2,
    melody: [76, 79, 84, 79, 81, 84, 88, 84, 79, 76, 72, 76, 79, 84, 79, 72],
    bass: [48, 0, 55, 0, 53, 0, 48, 0, 45, 0, 52, 0, 48, 0, 43, 48],
  },
};

function mtof(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  private music: MusicId | null = null;
  tempoScale = 1;
  private beat = 0;
  private stepIndex = 0;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem("finn-ooo-mute") === "1";
    } catch {
      this.muted = false;
    }
  }

  unlock() {
    this.ensure();
  }

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.75;
    try {
      localStorage.setItem("finn-ooo-mute", this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  setPaused(paused: boolean) {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setMusic(id: MusicId | null) {
    this.music = id;
    this.beat = 0;
    this.stepIndex = 0;
    this.setDrone(id === "space" ? 49 : id === "vampire" ? 44 : id === "ending" ? 52 : null);
  }

  private setDrone(freq: number | null) {
    if (!this.ctx || !this.master) return;
    if (this.drone) {
      try {
        this.drone.stop();
      } catch {
        /* already stopped */
      }
      this.drone.disconnect();
      this.drone = null;
    }
    if (this.droneGain) {
      this.droneGain.disconnect();
      this.droneGain = null;
    }
    if (freq == null) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = 0.018;
    o.connect(g);
    g.connect(this.master);
    o.start();
    this.drone = o;
    this.droneGain = g;
  }

  tick(dt: number) {
    if (!this.music || !this.ctx || !this.master) return;
    const pattern = PATTERNS[this.music];
    const stepDur = pattern.step / this.tempoScale;
    this.beat += dt;
    let guard = 0;
    while (this.beat >= stepDur && guard++ < 4) {
      this.beat -= stepDur;
      this.playStep(pattern, this.stepIndex % pattern.melody.length);
      this.stepIndex++;
    }
  }

  private playStep(pattern: Pattern, i: number) {
    const m = pattern.melody[i];
    const b = pattern.bass[i];
    if (m) this.tone(mtof(m), 0.13, "square", 0.028);
    if (b) this.tone(mtof(b), 0.16, "triangle", 0.04);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, freq2?: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq2), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, gain: number, freq = 800) {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  jump(high = false) {
    this.tone(high ? 620 : 340, 0.09, "square", 0.045, high ? 880 : 560);
  }

  sword() {
    this.burst(0.08, 0.06, 1400);
    this.tone(520, 0.07, "sawtooth", 0.02, 180);
  }

  clang() {
    this.tone(180, 0.08, "square", 0.04, 90);
    this.burst(0.05, 0.04, 400);
  }

  stomp(combo = 1) {
    this.burst(0.09, 0.08, 220);
    this.tone(160 + combo * 18, 0.1, "sine", 0.06, 70);
  }

  coin(step = 0) {
    const notes = [988, 1175, 1319, 1568, 1760, 1976, 2349, 2637];
    this.tone(notes[Math.min(step, notes.length - 1)], 0.07, "square", 0.04);
  }

  gem() {
    this.tone(880, 0.1, "square", 0.045);
    this.tone(1320, 0.14, "triangle", 0.04);
  }

  hurt() {
    this.tone(240, 0.18, "sawtooth", 0.05, 70);
    this.burst(0.12, 0.05, 180);
  }

  heal() {
    this.tone(660, 0.08, "triangle", 0.04);
    this.tone(880, 0.12, "triangle", 0.035);
  }

  bossHit() {
    this.burst(0.08, 0.07, 300);
    this.tone(140, 0.1, "square", 0.05, 80);
  }

  explode() {
    this.burst(0.35, 0.09, 160);
    this.tone(90, 0.3, "sawtooth", 0.04, 40);
  }

  clear() {
    [72, 76, 79, 84].forEach((n, i) => {
      window.setTimeout(() => this.tone(mtof(n), 0.16, "square", 0.045), i * 90);
    });
  }

  checkpoint() {
    this.tone(740, 0.08, "triangle", 0.04);
    this.tone(988, 0.12, "triangle", 0.03);
  }

  click() {
    this.tone(660, 0.04, "square", 0.03);
  }

  grab() {
    this.tone(380, 0.07, "triangle", 0.055, 700);
    this.burst(0.05, 0.04, 1600);
  }

  throwSfx() {
    this.burst(0.12, 0.07, 900);
    this.tone(260, 0.14, "sawtooth", 0.04, 820);
  }

  smash() {
    this.burst(0.22, 0.1, 240);
    this.tone(130, 0.2, "square", 0.06, 45);
    this.tone(520, 0.08, "triangle", 0.04, 1040);
  }

  whiff() {
    this.burst(0.05, 0.03, 1300);
  }

  reflect() {
    this.tone(1040, 0.06, "square", 0.035, 1560);
  }

  ending() {
    [72, 76, 79, 84, 88].forEach((n, i) => {
      window.setTimeout(() => this.tone(mtof(n), 0.2, "triangle", 0.05), i * 110);
    });
  }

  victory() {
    [76, 79, 84, 88, 91, 96].forEach((n, i) => {
      window.setTimeout(() => this.tone(mtof(n), 0.22, "square", 0.045), i * 100);
    });
  }

  stop() {
    this.setMusic(null);
  }
}

export const audio = new AudioEngine();
