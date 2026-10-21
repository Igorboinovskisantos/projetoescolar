import { audio } from "./audio";
import {
  drawBoss,
  drawBubble,
  drawCheckpoint,
  drawEnding,
  drawEnemy,
  drawFlag,
  drawFinn,
  drawHazard,
  drawItem,
  drawMagic,
  drawOutlined,
  drawParticle,
  drawPlatform,
  drawPowerBox,
  drawProjectile,
  drawShock,
  drawSlash,
  drawTentacle,
  drawTiles,
  drawWeather,
  drawWorld,
  PAL,
} from "./draw";
import { buildLevel, levelCount } from "./levels";
import type { BossKind, GameHooks, HudState, LevelData, PowerKind, RunStats, WorldId } from "./types";
import { TILE, VIEW_H, VIEW_W } from "./types";
import { clamp, overlap } from "./util";

const PW = 18;
const PH = 28;
const GRAVITY = 2150;
const JUMP_V = 730;
const MAX_FALL = 860;
const MAX_RUN = 196;
const GROUND_ACCEL = 1550;
const AIR_ACCEL = 1080;
const FRICTION = 1750;
const ICE_ACCEL = 420;
const ICE_FRICTION = 150;
const ICE_MAX = 236;
const COYOTE = 0.12;
const STEP = 1 / 120;
const MAX_LIVES = 6;
const HOLD_MAX = 6;
const THROW_BOSS_DMG = 3;
const THROW_ORGA_DMG = 2;

function enemySize(kind: Enemy["kind"]) {
  if (kind === "lemonling" || kind === "warrenling") return { w: 20, h: 30 };
  if (kind === "bat") return { w: 26, h: 16 };
  if (kind === "vampire") return { w: 18, h: 34 };
  if (kind === "crown") return { w: 22, h: 24 };
  return { w: 22, h: 22 };
}

interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Enemy extends Body {
  kind: "penguin" | "crown" | "bat" | "vampire" | "lemonling" | "warrenling";
  dir: number;
  state: string;
  aiT: number;
  homeX: number;
  homeY: number;
  death: number;
  minion: boolean;
  phase: number;
  frozen: number;
}

interface Item {
  kind: "coin" | "gem" | "heart" | "socks";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  phys: boolean;
}

interface Proj extends Body {
  kind: "ice" | "lemon" | "wave" | "meteor";
  life: number;
  grav: number;
}

interface MagicBall extends Body {
  kind: "fire" | "frost";
  life: number;
}

interface PowerBox {
  x: number;
  y: number;
  kind: PowerKind;
  opened: boolean;
}

interface Held {
  kind: Enemy["kind"];
  t: number;
  phase: number;
}

interface Thrown extends Body {
  kind: Enemy["kind"];
  life: number;
  spin: number;
  dir: number;
  hits: number;
  trail: number;
  phase: number;
}

interface Hazard {
  kind: "circle" | "beam" | "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  warn: number;
  maxWarn: number;
  active: number;
  armed: boolean;
  spawn: "" | "meteor";
  vx: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  g: number;
  rot: number;
  vr: number;
  kind: "circ" | "star" | "sq";
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
  vy: number;
}

interface Shock {
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
}

interface CP {
  x: number;
  y: number;
  on: boolean;
}

interface Boss extends Body {
  kind: BossKind;
  hp: number;
  maxHp: number;
  phase: number;
  facing: number;
  state: string;
  timer: number;
  attack: string;
  hurt: number;
  invuln: number;
  vulnerable: boolean;
  form: string;
  open: number;
  attacksDone: number;
  bounces: number;
  formIndex: number;
  targetX: number;
  targetY: number;
  lastSwing: number;
  frozen: number;
  summonT: number;
}

interface Holds {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  down: boolean;
}

const emptyHolds = (): Holds => ({ left: false, right: false, jump: false, attack: false, down: false });

const BOSS_NAME: Record<BossKind, string> = {
  iceking: "Rei Gelado",
  lemongrab: "Conde Limãograb",
  warren: "Warren Ampersand",
  orgalorg: "Orgalorg",
};

const BOSS_REWARD: Record<BossKind, number> = {
  iceking: 2500,
  lemongrab: 4000,
  warren: 5500,
  orgalorg: 8000,
};

export class OooGame {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private dead = false;
  private last = 0;
  private acc = 0;
  private time = 0;
  private runTime = 0;
  private levelTime = 0;
  private reduce: boolean;
  private dpr: number;

  private level: LevelData = buildLevel(0);
  private levelIndex = 0;
  private mode: "play" | "clear" | "dying" | "bossdie" | "ending" | "gameover" = "play";
  private paused = false;
  private clearT = 0;
  private deathT = 0;
  private bossDieT = 0;
  private fxT = 0;
  private endingT = 0;
  private endingHold = false;
  private victorySent = false;
  private didShatter = false;
  private bannerId = 1;

  private player: Body & { spin: number } = { x: 40, y: 40, w: PW, h: PH, vx: 0, vy: 0, spin: 0 };
  private facing = 1;
  private onGround = false;
  private onIce = false;
  private onOneway = false;
  private coyote = 0;
  private airJumps = 0;
  private hasSocks = false;
  private powers: PowerKind[] = [];
  private element: "fire" | "frost" | null = null;
  private magic: MagicBall[] = [];
  private powerBoxes: PowerBox[] = [];
  private magicCooldown = 0;
  private shieldHeld = false;
  private shieldEnergy = 1;
  private shieldCooldown = 0;
  private shieldActive = false;
  private invuln = 0;
  private attackT = 0;
  private swingId = 1;
  private jumpBuffer = 0;
  private attackQueued = false;
  private jumpHeldPrev = false;
  private dropT = 0;
  private stretch = 0;
  private spawnX = 40;
  private spawnY = 40;
  private trail: { x: number; y: number; a: number }[] = [];

  private kb: Holds = emptyHolds();
  private touchH: Holds = emptyHolds();
  private pad: Holds = emptyHolds();
  private input: Holds = emptyHolds();
  private padJumpWas = false;
  private padStartWas = false;

  private enemies: Enemy[] = [];
  private items: Item[] = [];
  private projectiles: Proj[] = [];
  private thrown: Thrown[] = [];
  private held: Held | null = null;
  private grabQueued = false;
  private grabTarget: Enemy | null = null;
  private grabCount = 0;
  private magicQueued = false;
  private padGrabWas = false;
  private padShieldWas = false;
  private hazards: Hazard[] = [];
  private checkpoints: CP[] = [];
  private plats: (LevelData["platforms"][number] & { dir: number; prevX: number; prevY: number })[] = [];
  private boss: Boss | null = null;
  private didSummon = false;
  private phaseHeart = false;
  private eyeHint = false;

  private particles: Particle[] = Array.from({ length: 200 }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff", g: 0, rot: 0, vr: 0, kind: "circ" as const,
  }));
  private popups: Popup[] = [];
  private shocks: Shock[] = [];

  private score = 0;
  private lives = 3;
  private coins = 0;
  private kills = 0;
  private bosses = 0;
  private combo = 0;
  private comboT = 0;
  private maxCombo = 0;
  private coinChain = 0;
  private coinChainT = 0;

  private camX = 0;
  private camY = 0;
  private shakeT = 0;
  private shakeMag = 0;
  private hitStop = 0;
  private flashA = 0;
  private flashColor = "#fff";
  private hudKey = "";

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onHide: () => void;

  private startIndex = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private getHooks: () => GameHooks,
    startIndex = 0,
  ) {
    this.startIndex = startIndex;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    this.ctx = ctx;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dpr = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.floor(VIEW_W * this.dpr);
    canvas.height = Math.floor(VIEW_H * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    this.onKeyDown = (e) => this.keyDown(e);
    this.onKeyUp = (e) => this.keyUp(e);
    this.onMouseDown = (e) => this.mouseDown(e);
    this.onHide = () => {
      if (document.hidden && this.mode === "play" && !this.paused) this.togglePause();
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("visibilitychange", this.onHide);
    this.last = performance.now();
  }

  start() {
    audio.unlock();
    this.loadLevel(this.startIndex);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("visibilitychange", this.onHide);
    audio.stop();
  }

  private mouseDown(e: MouseEvent) {
    // Apenas clique esquerdo (button === 0)
    if (e.button !== 0) return;
    if (this.mode === "play" && !this.paused) {
      // Ajusta o facing do Finn na direção do clique em relação ao centro da tela/canvas
      const rect = this.canvas.getBoundingClientRect();
      const mouseCanvasX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const playerScreenX = this.player.x + PW / 2 - this.camX;
      if (mouseCanvasX < playerScreenX - 6) this.facing = -1;
      else if (mouseCanvasX > playerScreenX + 6) this.facing = 1;

      this.attackQueued = true;
    }
  }

  hold(action: keyof Holds, down: boolean) {
    this.touchH[action] = down;
  }

  tap(action: "jump" | "attack" | "grab" | "shield" | "magic") {
    if (action === "jump") this.jumpBuffer = 0.14;
    if (action === "attack") this.attackQueued = true;
    if (action === "grab" && this.mode === "play") this.grabQueued = true;
    if (action === "magic" && this.mode === "play") this.magicQueued = true;
    if (action === "shield") this.shieldHeld = !this.shieldHeld;
  }

  togglePause() {
    if (this.mode === "gameover" || this.mode === "ending" || this.mode === "dying") return;
    this.paused = !this.paused;
    audio.setPaused(this.paused);
    this.getHooks().onOverlay(this.paused ? { type: "pause" } : { type: "none" });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    audio.setPaused(false);
    this.getHooks().onOverlay({ type: "none" });
  }

  toggleMute() {
    const muted = audio.toggleMute();
    this.hudKey = "";
    this.emitHud();
    return muted;
  }

  skipEnding() {
    if (this.mode !== "ending" || this.endingHold) return;
    this.endingT = 9;
    this.endingHold = true;
    if (!this.didShatter) {
      this.didShatter = true;
      this.burst(VIEW_W * 0.56, 120, "#b9ffe0", 18, 140, "star");
    }
    if (!this.victorySent) {
      this.victorySent = true;
      audio.victory();
      this.getHooks().onOverlay({ type: "victory", stats: this.makeStats(true) });
    }
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.coins = 0;
    this.kills = 0;
    this.bosses = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.coinChain = 0;
    this.grabCount = 0;
    this.powers = [];
    this.element = null;
    this.shieldEnergy = 1;
    this.shieldHeld = false;
    this.shieldActive = false;
    this.hasSocks = false;
    this.runTime = 0;
    this.paused = false;
    audio.setPaused(false);
    this.endingHold = false;
    this.victorySent = false;
    this.mode = "play";
    this.kb = emptyHolds();
    this.touchH = emptyHolds();
    this.loadLevel(this.startIndex);
    this.getHooks().onOverlay({ type: "none" });
  }

  private loop = (now: number) => {
    if (this.dead) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.render();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.step(STEP);
        this.acc -= STEP;
        steps++;
      }
    }
    this.render();
    this.emitHud();
    this.raf = requestAnimationFrame(this.loop);
  };

  private keyDown(e: KeyboardEvent) {
    if (this.isTyping(e)) return;
    const code = e.code;
    if (code === "ArrowLeft" || code === "KeyA") this.kb.left = true;
    if (code === "ArrowRight" || code === "KeyD") this.kb.right = true;
    if (code === "ArrowDown" || code === "KeyS") this.kb.down = true;
    if (code === "ArrowUp" || code === "KeyW" || code === "Space" || code === "KeyZ") {
      this.kb.jump = true;
      if (!e.repeat && this.mode === "play") this.jumpBuffer = 0.14;
      e.preventDefault();
    }
    if (code === "KeyJ" || code === "KeyK" || code === "KeyX" || code === "KeyC" || code === "ControlLeft") {
      this.kb.attack = true;
      e.preventDefault();
    }
    if (code === "KeyF" && !e.repeat && this.mode === "play" && !this.paused) {
      this.grabQueued = true;
      e.preventDefault();
    }
    if (code === "KeyQ" && !e.repeat && this.mode === "play" && !this.paused) {
      this.magicQueued = true;
      e.preventDefault();
    }
    if (code === "KeyE") { this.shieldHeld = true; e.preventDefault(); }
    if (code === "KeyP" || code === "Escape") {
      e.preventDefault();
      if (this.mode === "ending" && !this.endingHold) this.skipEnding();
      else this.togglePause();
    }
    if (code === "KeyM") this.toggleMute();
    if ((code === "Enter" || code === "Space") && this.mode === "ending" && !this.endingHold) this.skipEnding();
    if ((code === "KeyR" || code === "Enter") && (this.mode === "gameover" || this.endingHold)) {
      e.preventDefault();
      this.getHooks().requestRestart();
    } else if (code === "KeyR" && this.paused) {
      this.restart();
    }
  }

  private keyUp(e: KeyboardEvent) {
    const code = e.code;
    if (code === "ArrowLeft" || code === "KeyA") this.kb.left = false;
    if (code === "ArrowRight" || code === "KeyD") this.kb.right = false;
    if (code === "ArrowDown" || code === "KeyS") this.kb.down = false;
    if (code === "ArrowUp" || code === "KeyW" || code === "Space" || code === "KeyZ") this.kb.jump = false;
    if (code === "KeyJ" || code === "KeyK" || code === "KeyX" || code === "KeyC" || code === "ControlLeft") this.kb.attack = false;
    if (code === "KeyE") this.shieldHeld = false;
  }

  private isTyping(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
  }

  private pollPad() {
    this.pad = emptyHolds();
    const list = navigator.getGamepads?.();
    const gp = list ? list[0] : null;
    if (!gp) return;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    if (ax < -0.35 || gp.buttons[14]?.pressed) this.pad.left = true;
    if (ax > 0.35 || gp.buttons[15]?.pressed) this.pad.right = true;
    if (ay > 0.55 || gp.buttons[13]?.pressed) this.pad.down = true;
    const jump = !!(gp.buttons[0]?.pressed || gp.buttons[1]?.pressed);
    if (jump && !this.padJumpWas && this.mode === "play") this.jumpBuffer = 0.14;
    this.padJumpWas = jump;
    this.pad.jump = jump;
    if (gp.buttons[2]?.pressed || gp.buttons[3]?.pressed) this.pad.attack = true;
    const grabBtn = !!(gp.buttons[4]?.pressed || gp.buttons[5]?.pressed || gp.buttons[7]?.pressed);
    if (grabBtn && !this.padGrabWas && this.mode === "play" && !this.paused) this.grabQueued = true;
    this.padGrabWas = grabBtn;
    const shieldBtn = !!gp.buttons[6]?.pressed;
    if (shieldBtn && !this.padShieldWas) this.shieldHeld = true;
    if (!shieldBtn && this.padShieldWas) this.shieldHeld = false;
    this.padShieldWas = shieldBtn;
    const start = !!gp.buttons[9]?.pressed;
    if (start && !this.padStartWas) this.togglePause();
    this.padStartWas = start;
  }

  private mergeInput() {
    this.pollPad();
    (Object.keys(this.input) as (keyof Holds)[]).forEach((k) => {
      this.input[k] = this.kb[k] || this.touchH[k] || this.pad[k];
    });
  }

  private step(dt: number) {
    this.time += dt;
    this.runTime += dt;
    if (this.mode === "play") this.levelTime += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT === 0) this.shakeMag = 0;
    this.flashA = Math.max(0, this.flashA - dt * 1.6);
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackT = Math.max(0, this.attackT - dt);
    this.magicCooldown = Math.max(0, this.magicCooldown - dt);
    this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    this.shieldActive = this.powers.includes("leaf") && this.shieldHeld && this.shieldEnergy > 0.03 && this.shieldCooldown <= 0 && this.mode === "play";
    this.shieldEnergy = clamp(this.shieldEnergy + (this.shieldActive ? -0.24 : 0.16) * dt, 0, 1);
    if (this.shieldEnergy <= 0 && this.shieldActive) { this.shieldActive = false; this.shieldCooldown = 1.5; }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.coinChainT = Math.max(0, this.coinChainT - dt);
    if (this.coinChainT === 0) this.coinChain = 0;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.stretch += (0 - this.stretch) * Math.min(1, dt * 10);
    this.mergeInput();

    if (this.mode === "play") {
      this.updatePlatforms(dt);
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateBoss(dt);
      this.updateProjectiles(dt);
      this.updateMagic(dt);
      this.updateThrown(dt);
      this.updateHazards(dt);
      this.updateItems(dt);
      this.checkCombat();
      this.checkSpikes();
      this.checkExit();
      this.updateCamera(dt);
      if (this.boss) audio.tempoScale = this.boss.kind === "orgalorg" && this.boss.phase === 3 ? 1.28 : this.boss.phase > 1 ? 1.16 : 1.08;
    } else if (this.mode === "dying") {
      this.deathT -= dt;
      this.player.vy = Math.min(MAX_FALL, this.player.vy + GRAVITY * dt);
      this.player.y += this.player.vy * dt;
      this.player.x += this.player.vx * dt;
      this.player.spin += dt * 11;
      if (this.deathT <= 0) this.finishGameOver();
    } else if (this.mode === "clear") {
      this.clearT -= dt;
      if (this.clearT <= 0) this.nextLevel();
    } else if (this.mode === "bossdie") {
      this.bossDieT -= dt;
      this.fxT -= dt;
      if (this.boss && this.fxT <= 0) {
        this.fxT = 0.07;
        this.burst(this.boss.x + Math.random() * this.boss.w, this.boss.y + Math.random() * this.boss.h, this.boss.kind === "orgalorg" ? "#d6ff4a" : "#ffe56a", 5, 110, "star");
      }
      if (this.boss) this.boss.y += dt * 16;
      if (this.bossDieT <= 0) this.nextLevel();
    } else if (this.mode === "ending" && !this.endingHold) {
      this.stepEnding(dt);
    }

    this.updateParticles(dt);
    this.updatePopups(dt);
    this.updateShocks(dt);
    if (this.mode !== "gameover") audio.tick(dt);
  }

  private loadLevel(index: number) {
    this.levelIndex = index;
    this.level = buildLevel(index);
    this.levelTime = 0;
    this.mode = "play";
    this.player.x = this.level.player.x;
    this.player.y = this.level.player.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.spin = 0;
    this.spawnX = this.player.x;
    this.spawnY = this.player.y;
    this.facing = 1;
    this.onGround = false;
    this.invuln = 1.05;
    this.attackT = 0;
    this.coyote = COYOTE;
    this.airJumps = this.hasSocks ? 1 : 0;
    this.enemies = [];
    this.items = [];
    this.projectiles = [];
    this.magic = [];
    this.powerBoxes = [];
    this.hazards = [];
    this.checkpoints = [];
    this.thrown = [];
    this.held = null;
    this.grabQueued = false;
    this.grabTarget = null;
    this.boss = null;
    this.didSummon = false;
    this.phaseHeart = false;
    this.eyeHint = false;
    this.trail = [];

    for (const s of this.level.spawns) {
      if (s.kind === "coin" || s.kind === "gem" || s.kind === "heart" || s.kind === "socks") {
        this.items.push({ kind: s.kind, x: s.x, y: s.y, vx: 0, vy: 0, age: 1, phys: false });
      } else if (s.kind === "checkpoint") {
        this.checkpoints.push({ x: s.x, y: s.y, on: false });
      } else if (s.kind === "powerbox" && s.power) {
        this.powerBoxes.push({ x: s.x, y: s.y, kind: s.power, opened: false });
      } else if (s.kind !== "powerbox") {
        this.enemies.push(this.makeEnemy(s.kind, s.x, s.y, false));
      }
    }
    this.plats = this.level.platforms.map((p) => ({ ...p, dir: 1, prevX: p.x, prevY: p.y }));
    if (this.level.boss) {
      this.initBoss(this.level.boss);
      this.getHooks().onBossReached(this.level.boss, index);
      const floorLives = this.level.boss === "orgalorg" ? 4 : 3;
      if (this.lives < floorLives) {
        this.lives = floorLives;
        this.popup(this.player.x, this.player.y - 18, "FORÇAS RENOVADAS", "#9dffb0", 11);
      }
    }
    this.snapCamera();
    this.burst(this.player.x + 8, this.player.y + PH, "#e7c39a", 6, 46, "circ");
    const world = this.level.world;
    audio.setMusic(world);
    audio.tempoScale = this.level.boss ? 1.08 : 1;
    this.bannerId++;
    this.getHooks().onBanner({
      id: this.bannerId,
      title: this.level.name,
      subtitle: this.level.subtitle,
      hint: this.level.hint,
    });
    this.hudKey = "";
  }

  private nextLevel() {
    this.boss = null;
    if (this.levelIndex >= levelCount() - 1) this.startEnding();
    else this.loadLevel(this.levelIndex + 1);
  }

  private startEnding() {
    this.mode = "ending";
    this.endingT = 0;
    this.endingHold = false;
    this.victorySent = false;
    this.didShatter = false;
    this.boss = null;
    this.camX = 0;
    this.camY = 0;
    audio.setMusic("ending");
    audio.ending();
    this.flashColor = "#ffffff";
    this.flashA = 0.75;
    this.getHooks().onOverlay({ type: "ending" });
  }

  private stepEnding(dt: number) {
    this.endingT += dt;
    if (!this.didShatter && this.endingT >= 4.05) {
      this.didShatter = true;
      this.burst(VIEW_W * 0.56, 130, "#b9ffe0", 22, 160, "star");
      this.burst(VIEW_W * 0.56, 130, "#ffe56a", 12, 110, "sq");
      this.addShake(8, 0.32);
      audio.explode();
    }
    if (this.endingT >= 8.25 && !this.victorySent) {
      this.victorySent = true;
      this.endingHold = true;
      audio.victory();
      this.getHooks().onOverlay({ type: "victory", stats: this.makeStats(true) });
    }
  }

  private finishGameOver() {
    if (this.mode === "gameover") return;
    this.mode = "gameover";
    audio.setMusic(null);
    this.getHooks().onOverlay({ type: "gameover", stats: this.makeStats(false) });
  }

  private initBoss(kind: BossKind) {
    const surface = 7 * TILE;
    const common = {
      vx: 0, vy: 0, phase: 1, facing: -1, state: "intro", timer: 1.15, attack: "", hurt: 0, invuln: 0.4,
      vulnerable: true, form: "walk", open: 1, attacksDone: 0, bounces: 0, formIndex: -1, targetX: 0, targetY: 0, lastSwing: 0,
      frozen: 0, summonT: 3.3,
    };
    if (kind === "iceking") {
      this.boss = { ...common, kind, x: 210, y: 36, w: 52, h: 62, hp: 5, maxHp: 5 };
    } else if (kind === "lemongrab") {
      this.boss = { ...common, kind, x: 320, y: surface - 80, w: 36, h: 80, hp: 7, maxHp: 7 };
    } else if (kind === "warren") {
      this.boss = { ...common, kind, x: 300, y: surface - 62, w: 40, h: 62, hp: 8, maxHp: 8, timer: 0.9 };
    } else {
      this.boss = {
        ...common, kind, x: 392, y: 96, w: 120, h: 130, hp: 10, maxHp: 10,
        vulnerable: false, open: 0.2, timer: 1.35,
      };
    }
  }

  private makeEnemy(kind: Enemy["kind"], x: number, y: number, minion: boolean): Enemy {
    const size = enemySize(kind);
    return {
      kind, x, y, ...size, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1,
      state: kind === "bat" ? "patrol" : "walk", aiT: 0.3 + Math.random() * 0.6,
      homeX: x, homeY: y, death: 0, minion, phase: Math.random() * 6, frozen: 0,
    };
  }

  private spawnMinion(kind: Enemy["kind"], x: number, y: number) {
    if (this.enemies.filter((e) => e.death <= 0).length >= 6) return;
    this.enemies.push(this.makeEnemy(kind, x, y, true));
  }

  private updatePlatforms(dt: number) {
    for (const p of this.plats) {
      p.prevX = p.x;
      p.prevY = p.y;
      if (p.speed <= 0) continue;
      if (p.axis === "x") {
        p.x += p.dir * p.speed * dt;
        if (p.x < p.min || p.x > p.max) {
          p.dir *= -1;
          p.x = clamp(p.x, p.min, p.max);
        }
      } else {
        p.y += p.dir * p.speed * dt;
        if (p.y < p.min || p.y > p.max) {
          p.dir *= -1;
          p.y = clamp(p.y, p.min, p.max);
        }
      }
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (this.input.down && this.onGround && this.onOneway && this.dropT <= 0) {
      p.y += 5;
      this.onGround = false;
      this.dropT = 0.16;
      this.coyote = 0;
    }

    const ice = this.onIce && this.onGround;
    const dir = (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0);
    const accel = this.onGround ? (ice ? ICE_ACCEL : GROUND_ACCEL) : AIR_ACCEL;
    const max = ice ? ICE_MAX : MAX_RUN;
    if (dir !== 0) {
      p.vx += dir * accel * dt;
      this.facing = dir;
    } else if (this.onGround) {
      const s = Math.sign(p.vx);
      if (s) {
        p.vx -= s * (ice ? ICE_FRICTION : FRICTION) * dt;
        if (Math.sign(p.vx) !== s) p.vx = 0;
      }
    }
    p.vx = clamp(p.vx, -max, max);
    if (!this.onGround) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
    else if (p.vy > 0) p.vy = 0;

    if (this.grabQueued) {
      this.grabQueued = false;
      if (this.held) this.throwHeld();
      else this.tryGrab();
    }
    if (this.held) {
      this.held.t += dt;
      this.attackQueued = false;
      if (this.held.t >= HOLD_MAX) this.escapeHeld();
    }

    if (!this.held && this.attackT <= 0 && (this.input.attack || this.attackQueued)) {
      this.attackQueued = false;
      this.attackT = 0.28;
      this.swingId++;
      audio.sword();
      p.vx += this.facing * 26;
      this.stretch = -0.1;
    }
    if (this.magicQueued) {
      this.magicQueued = false;
      this.castMagic();
    }

    const fallSpeed = p.vy;
    this.moveX(p);
    const hit = this.moveY(p);
    this.playerPrevBottom = this.prevBottom;
    this.onGround = hit.ground;
    this.onIce = hit.ice;
    this.onOneway = hit.oneway;
    if (hit.crate) this.breakCrate(hit.crate.tx, hit.crate.ty);

    if (this.dropT <= 0 && p.vy >= 0) {
      for (const plat of this.plats) {
        const prevBottom = this.spawnSafePrev(p) ;
        const overlapX = p.x + p.w > plat.x + 2 && p.x < plat.x + plat.w - 2;
        if (!overlapX) continue;
        if (prevBottom <= plat.y + 10 && p.y + p.h >= plat.y && p.y + p.h <= plat.y + 18) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.x += plat.x - plat.prevX;
          this.onGround = true;
          this.onOneway = true;
          this.onIce = false;
        }
      }
    }

    if (this.onGround && !this.onGroundPrev && fallSpeed > 300) {
      this.stretch = 0.28;
      this.burst(p.x + PW / 2, p.y + PH, this.dustColor(), 5, 50, "circ");
    }
    this.onGroundPrev = this.onGround;

    if (this.onGround) {
      this.coyote = COYOTE;
      this.airJumps = this.hasSocks ? 1 : 0;
    } else this.coyote = Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        this.doJump(false);
        this.airJumps = this.hasSocks ? 1 : 0;
      } else if (this.airJumps > 0) {
        this.doJump(true);
        this.airJumps--;
      }
    }
    if (!this.input.jump && p.vy < 0 && this.jumpHeldPrev) p.vy *= 0.5;
    this.jumpHeldPrev = this.input.jump;

    if (this.onGround && Math.abs(p.vx) > 40 && Math.floor(this.time * 10) !== Math.floor((this.time - dt) * 10)) {
      this.burst(p.x + PW / 2, p.y + PH - 2, this.dustColor(), 1, 24, "circ");
    }
    if (Math.abs(p.vx) > 150 && this.onGround) {
      this.trail.push({ x: p.x, y: p.y, a: 0.28 });
      if (this.trail.length > 4) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();

    this.grabTarget = this.held || this.mode !== "play" ? null : this.findGrabbable();

    if (p.y > this.level.h * TILE + 48) this.pitFall();
    p.x = clamp(p.x, 0, this.level.w * TILE - PW);
  }

  private onGroundPrev = false;
  private prevBottom = 0;
  private playerPrevBottom = 0;

  private spawnSafePrev(p: Body) {
    return this.prevBottom || p.y + p.h;
  }

  private doJump(air: boolean) {
    this.player.vy = air ? -JUMP_V * 0.9 : -JUMP_V;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.onGround = false;
    this.stretch = air ? -0.4 : -0.3;
    audio.jump(air);
    if (air) this.burst(this.player.x + 8, this.player.y + PH, "#f0c84a", 8, 90, "star");
  }

  private moveX(body: Body) {
    const prev = body.x;
    body.x += body.vx * STEP;
    let hit = false;
    const x0 = Math.floor(body.x / TILE);
    const x1 = Math.floor((body.x + body.w - 0.01) / TILE);
    const y0 = Math.floor(body.y / TILE);
    const y1 = Math.floor((body.y + body.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1 && !hit; ty++) {
      for (let tx = x0; tx <= x1 && !hit; tx++) {
        if (!this.solidAt(tx, ty)) continue;
        if (body.vx > 0) body.x = tx * TILE - body.w;
        else body.x = tx * TILE + TILE;
        body.vx = 0;
        hit = true;
      }
    }
    if (body.x < 0) { body.x = 0; body.vx = 0; hit = true; }
    const maxX = this.level.w * TILE - body.w;
    if (body.x > maxX) { body.x = maxX; body.vx = 0; hit = true; }
    void prev;
    return hit;
  }

  private moveY(body: Body) {
    this.prevBottom = body.y + body.h;
    body.y += body.vy * STEP;
    let ground = false;
    let ice = false;
    let oneway = false;
    let crate: { tx: number; ty: number } | null = null;
    const x0 = Math.floor(body.x / TILE);
    const x1 = Math.floor((body.x + body.w - 0.01) / TILE);
    const y0 = Math.floor(body.y / TILE);
    const y1 = Math.floor((body.y + body.h - 0.01) / TILE);
    let done = false;
    for (let ty = y0; ty <= y1 && !done; ty++) {
      for (let tx = x0; tx <= x1 && !done; tx++) {
        const t = this.tile(tx, ty);
        const top = ty * TILE;
        const overlapX = body.x + body.w > tx * TILE + 1 && body.x < tx * TILE + TILE - 1;
        if (!overlapX) continue;
        if (t === 1 || t === 4 || t === 5) {
          if (body.vy >= 0 && this.prevBottom <= top + 8) {
            body.y = top - body.h;
            body.vy = 0;
            ground = true;
            ice = t === 4;
            done = true;
          } else if (body.vy < 0) {
            body.y = top + TILE;
            body.vy = 40;
            if (t === 5) crate = { tx, ty };
            done = true;
          }
        } else if (t === 2 && this.dropT <= 0 && body.vy >= 0 && this.prevBottom <= top + 8) {
          body.y = top - body.h;
          body.vy = 0;
          ground = true;
          oneway = true;
          done = true;
        }
      }
    }
    return { ground, ice, oneway, crate };
  }

  private tile(tx: number, ty: number) {
    if (tx < 0 || tx >= this.level.w) return 1;
    if (ty < 0 || ty >= this.level.h) return 0;
    return this.level.tiles[ty * this.level.w + tx];
  }

  private solidAt(tx: number, ty: number) {
    const t = this.tile(tx, ty);
    return t === 1 || t === 4 || t === 5;
  }

  private solidAhead(e: Enemy) {
    const ahead = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
    const tx = Math.floor(ahead / TILE);
    const ty = Math.floor((e.y + e.h + 2) / TILE);
    const t = this.tile(tx, ty);
    return t === 1 || t === 4 || t === 2 || t === 5;
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.death > 0) {
        e.death -= dt;
        e.vy += GRAVITY * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.death <= 0) this.enemies.splice(i, 1);
        continue;
      }
      if (e.frozen > 0) {
        e.frozen = Math.max(0, e.frozen - dt);
        continue;
      }
      if (e.state === "toss") {
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
        const wall = this.moveX(e);
        const landed = this.moveY(e);
        if (wall) e.vx *= -0.5;
        if (landed.ground) { e.state = "walk"; e.vx = 0; e.aiT = 0.8; }
      } else if (e.kind === "bat") this.updateBat(e, dt);
      else if (e.kind === "vampire") this.updateVampire(e, dt);
      else this.updateWalker(e, dt);
      if (e.y > this.level.h * TILE + 80) this.enemies.splice(i, 1);
    }
  }

  private updateWalker(e: Enemy, dt: number) {
    e.aiT -= dt;
    const speed = (e.kind === "crown" ? 64 : e.kind === "warrenling" ? 72 : e.kind === "lemonling" ? 58 : 44) * (this.tile(Math.floor((e.x + e.w / 2) / TILE), Math.floor((e.y + e.h + 2) / TILE)) === 4 ? 1.35 : 1);
    e.vx = e.dir * speed;
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    if (e.kind === "crown" && e.vy === 0 && e.aiT <= 0) {
      e.vy = -220;
      e.aiT = 1.2 + Math.random() * 0.5;
      e.state = "hop";
    }
    if (this.moveX(e)) e.dir *= -1;
    this.moveY(e);
    if (e.vy === 0) e.state = "walk";
    if (e.vy === 0 && !this.solidAhead(e)) e.dir *= -1;
  }

  private updateBat(e: Enemy, dt: number) {
    e.aiT -= dt;
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.dir = dx > 0 ? 1 : -1;
    if (e.state === "patrol") {
      e.x = e.homeX + Math.sin(this.time * 1.5 + e.phase) * 26;
      e.y = e.homeY + Math.sin(this.time * 2.4 + e.phase) * 8;
      if (dist < 148 && e.aiT <= 0) {
        e.state = "tele";
        e.aiT = 0.32;
      }
    } else if (e.state === "tele") {
      e.x += Math.sin(this.time * 42) * 0.45;
      if (e.aiT <= 0) {
        e.state = "dive";
        e.vx = (dx / dist) * 150;
        e.vy = (dy / dist) * 150;
        e.aiT = 0.62;
      }
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.aiT <= 0) {
        e.state = "patrol";
        e.aiT = 1.15;
        e.homeX = e.x;
        e.homeY = e.y;
      }
    }
  }

  private updateVampire(e: Enemy, dt: number) {
    e.aiT -= dt;
    const dx = this.player.x - e.x;
    if (Math.abs(dx) < 230 && e.state !== "dash") e.dir = dx > 0 ? 1 : -1;
    if (e.state === "walk") {
      e.vx = e.dir * 40;
      e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
      if (this.moveX(e)) e.dir *= -1;
      this.moveY(e);
      if (e.vy === 0 && !this.solidAhead(e)) e.dir *= -1;
      if (e.aiT <= 0 && Math.abs(dx) < 168 && Math.abs(this.player.y - e.y) < 52) {
        e.state = "tele";
        e.aiT = 0.4;
        e.vx = 0;
      }
    } else if (e.state === "tele") {
      e.x += Math.sin(this.time * 48) * 0.55;
      if (e.aiT <= 0) {
        e.state = "dash";
        e.aiT = 0.24;
        e.vx = e.dir * 245;
      }
    } else {
      e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
      const wall = this.moveX(e);
      this.moveY(e);
      if (wall || e.aiT <= 0 || !this.solidAhead(e)) {
        e.state = "walk";
        e.aiT = 1.05;
        e.vx = 0;
        if (!this.solidAhead(e)) e.dir *= -1;
      }
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || this.mode !== "play") return;
    if (b.frozen > 0) {
      b.frozen = Math.max(0, b.frozen - dt);
      b.invuln = Math.max(0, b.invuln - dt);
      return;
    }
    if (b.state !== "intro") {
      b.summonT -= dt;
      if (b.summonT <= 0) {
        b.summonT = b.phase >= 2 ? 5.8 : 7.2;
        const soldier: Enemy["kind"] = b.kind === "lemongrab" ? "lemonling" : b.kind === "warren" ? "warrenling" : "penguin";
        const n = b.phase >= 2 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          if (this.minionCount() >= 3) break;
          const dir = this.player.x < b.x ? -1 : 1;
          const x = clamp(b.x + (dir < 0 ? -18 : Math.min(b.w, 48)), 20, 450);
          const y = clamp(b.y + 24, 35, 7 * TILE - 46);
          const minion = this.makeEnemy(soldier, x, y, true);
          minion.state = "toss";
          minion.dir = dir;
          minion.vx = dir * (110 + i * 35);
          minion.vy = -125 - i * 65;
          this.enemies.push(minion);
        }
        this.popup(b.x + b.w / 2, b.y - 14, "SOLDADOS!", "#fff", 11);
        this.burst(b.x + b.w / 2, b.y + 20, "#ffe56a", 8, 60, "star");
      }
    }
    b.hurt = Math.max(0, b.hurt - dt);
    b.invuln = Math.max(0, b.invuln - dt);
    b.facing = this.player.x + PW / 2 > b.x + b.w / 2 ? 1 : -1;
    if (b.kind === "iceking") this.updateIceKing(b, dt);
    else if (b.kind === "lemongrab") this.updateLemongrab(b, dt);
    else if (b.kind === "warren") this.updateWarren(b, dt);
    else this.updateOrgalorg(b, dt);

    if (b.state !== "intro" && b.kind !== "orgalorg" && overlap(this.player.x, this.player.y, PW, PH, b.x, b.y, b.w, b.h)) {
      const stomping = b.kind !== "warren" || b.form === "ball";
      if (!(stomping && this.canStomp(b.x, b.y, b.w, Math.min(28, b.h)))) {
        this.hurt(this.player.x < b.x ? -1 : 1);
      }
    }
    if (b.kind === "orgalorg" && b.state !== "intro") {
      const hx = b.x + 46;
      if (overlap(this.player.x, this.player.y, PW, PH, hx, b.y + 28, b.w - 50, b.h - 28)) {
        this.hurt(-1);
      }
    }
  }

  private updateIceKing(b: Boss, dt: number) {
    if (b.state === "intro") {
      b.timer -= dt;
      b.y = 40 + Math.sin(this.time * 2) * 6;
      if (b.timer <= 0) { b.state = "wait"; b.timer = 0.45; }
      return;
    }
    if (b.state === "wait") {
      b.x = 168 + Math.sin(this.time * 0.85) * 86;
      b.y = 38 + Math.sin(this.time * 1.7) * 14;
      b.timer -= dt;
      if (b.timer <= 0) this.iceAttack(b);
    } else if (b.state === "windup") {
      b.timer -= dt;
      b.x += Math.sin(this.time * 32) * 0.35;
      if (b.timer <= 0) this.iceFire(b);
    } else if (b.state === "swoop") {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.timer -= dt;
      if (b.timer <= 0 || b.y > 168) {
        b.state = "recover";
        b.timer = 0.42;
        b.vy = -90;
      }
    } else {
      b.y += b.vy * dt;
      b.timer -= dt;
      if (b.timer <= 0) { b.state = "wait"; b.timer = b.phase === 2 ? 0.5 : 0.85; }
    }
    b.x = clamp(b.x, 16, 440);
    b.y = clamp(b.y, 12, 176);
  }

  private iceAttack(b: Boss) {
    b.attacksDone++;
    const roll = b.attacksDone === 1 ? 0.9 : Math.random();
    if (roll < 0.42 || this.minionCount() >= 2 && roll < 0.7) {
      b.attack = "bolt";
      b.state = "windup";
      b.timer = 0.4;
    } else if (roll < 0.74) {
      b.attack = "swoop";
      b.state = "windup";
      b.timer = 0.46;
      b.targetX = this.player.x;
      b.targetY = this.player.y + 8;
    } else {
      b.attack = "summon";
      b.state = "windup";
      b.timer = 0.32;
    }
  }

  private iceFire(b: Boss) {
    if (b.attack === "bolt") {
      const n = b.phase === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ang = Math.atan2(this.player.y - (b.y + 16), this.player.x - (b.x + 20)) + (i === 0 ? 0 : 0.32);
        this.projectiles.push({
          kind: "ice", x: b.x + 18, y: b.y + 22, w: 12, h: 12,
          vx: Math.cos(ang) * 155, vy: Math.sin(ang) * 155, life: 3.2, grav: 0,
        });
      }
      b.state = "wait";
      b.timer = b.phase === 2 ? 0.42 : 0.7;
    } else if (b.attack === "swoop") {
      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const len = Math.hypot(dx, dy) || 1;
      b.vx = (dx / len) * 240;
      b.vy = (dy / len) * 240;
      b.state = "swoop";
      b.timer = 0.52;
    } else {
      this.spawnMinion("penguin", clamp(70 + Math.random() * 280, 30, 420), 7 * TILE - 22);
      b.state = "wait";
      b.timer = 0.55;
    }
  }

  private updateLemongrab(b: Boss, dt: number) {
    const surface = 7 * TILE;
    b.w = 36;
    b.h = 80;
    b.y = surface - b.h;
    if (b.state === "intro") {
      b.timer -= dt;
      if (b.timer <= 0) { b.state = "wait"; b.timer = 0.4; }
      return;
    }
    if (b.state === "wait") {
      const speed = b.phase === 2 ? 72 : 50;
      const dx = this.player.x - b.x;
      if (Math.abs(dx) > 34) b.x += Math.sign(dx) * speed * dt;
      b.x = clamp(b.x, 12, VIEW_W - b.w - 12);
      b.timer -= dt;
      if (b.timer <= 0) {
        b.attacksDone++;
        const roll = b.attacksDone === 1 ? 0 : Math.random();
        if (roll < 0.4) { b.attack = "scream"; b.timer = 0.68; }
        else if (roll < 0.72) { b.attack = "lemon"; b.timer = 0.32; }
        else { b.attack = "bite"; b.timer = 0.3; }
        b.state = "windup";
      }
    } else if (b.state === "windup") {
      b.timer -= dt;
      if (b.timer <= 0) this.lemonFire(b);
    } else {
      b.timer -= dt;
      if (b.timer <= 0) { b.state = "wait"; b.timer = b.phase === 2 ? 0.62 : 0.95; b.attack = ""; }
    }
  }

  private lemonFire(b: Boss) {
    if (b.attack === "scream") {
      const y = 7 * TILE - 22;
      this.projectiles.push({ kind: "wave", x: b.x - 8, y, w: 30, h: 22, vx: -175, vy: 0, life: 2.4, grav: 0 });
      this.projectiles.push({ kind: "wave", x: b.x + b.w, y, w: 30, h: 22, vx: 175, vy: 0, life: 2.4, grav: 0 });
      this.popup(b.x + 8, b.y - 8, "INACEITÁVEL!", "#f2e15a", 11);
      audio.clang();
      b.state = "wait";
      b.timer = b.phase === 2 ? 0.8 : 1.15;
    } else if (b.attack === "lemon") {
      const dir = Math.sign(this.player.x - b.x) || 1;
      const n = b.phase === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.projectiles.push({
          kind: "lemon", x: b.x + 10, y: b.y + 18, w: 12, h: 10,
          vx: dir * (110 + i * 36), vy: -250 - i * 16, life: 3, grav: 540,
        });
      }
      b.state = "wait";
      b.timer = 0.65;
    } else {
      const hx = b.facing > 0 ? b.x + b.w - 4 : b.x - 48;
      if (overlap(this.player.x, this.player.y, PW, PH, hx, b.y + 8, 52, 28)) this.hurt(b.facing);
      b.state = "bite";
      b.timer = 0.2;
    }
  }

  private updateWarren(b: Boss, dt: number) {
    const surface = 7 * TILE;
    if (b.state === "intro") {
      b.timer -= dt;
      b.y = surface - b.h;
      if (b.timer <= 0) this.warrenNext(b);
      return;
    }
    if (b.state === "morph") {
      b.timer -= dt;
      b.x += Math.sin(this.time * 40) * 0.4;
      if (b.timer <= 0) this.warrenNext(b);
      return;
    }
    if (b.form === "walk") {
      b.w = 40; b.h = 62; b.y = surface - b.h;
      const dx = this.player.x - b.x;
      if (Math.abs(dx) > 28) b.x += Math.sign(dx) * (b.phase === 2 ? 78 : 60) * dt;
      b.x = clamp(b.x, 16, VIEW_W - b.w - 16);
      b.timer -= dt;
      if (b.timer <= 0) {
        if (Math.abs(dx) < 46 && overlap(this.player.x, this.player.y, PW, PH, b.x - 8, b.y, b.w + 16, b.h)) this.hurt(Math.sign(dx) || 1);
        this.startMorph(b);
      }
    } else if (b.form === "tower") {
      b.w = 46; b.h = 100; b.y = surface - b.h;
      b.timer -= dt;
      if (b.timer <= 0) this.startMorph(b);
    } else {
      b.w = 50; b.h = 50;
      b.vy = Math.min(MAX_FALL, b.vy + 1700 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y + b.h > surface) {
        b.y = surface - b.h;
        b.vy = -300 - b.bounces * 10;
        b.bounces++;
        this.addShake(3, 0.08);
        this.burst(b.x + 25, surface, "#e08a55", 6, 70, "circ");
      }
      if (b.x < 12 || b.x + b.w > VIEW_W - 12) b.vx *= -1;
      b.x = clamp(b.x, 8, VIEW_W - b.w - 8);
      b.timer -= dt;
      if (b.bounces >= 3 || b.timer <= 0) this.startMorph(b);
    }
  }

  private startMorph(b: Boss) {
    b.state = "morph";
    b.form = "morph";
    b.timer = 0.32;
  }

  private warrenNext(b: Boss) {
    b.formIndex = (b.formIndex + 1) % 3;
    const form = (["walk", "tower", "ball"] as const)[b.formIndex];
    b.form = form;
    b.state = "act";
    b.bounces = 0;
    b.attack = form === "tower" ? "slam" : "";
    if (form === "walk") {
      b.w = 40; b.h = 62; b.timer = b.phase === 2 ? 1.05 : 1.45; b.y = 7 * TILE - b.h;
    } else if (form === "tower") {
      b.w = 46; b.h = 100; b.timer = 1.2; b.y = 7 * TILE - b.h;
      this.hazards.push(this.circle(clamp(this.player.x + 8, 28, 470), 7 * TILE, 26, b.phase === 2 ? 0.48 : 0.58));
      if (b.phase === 2) this.hazards.push(this.circle(clamp(this.player.x + 70, 28, 470), 7 * TILE, 22, 0.72));
    } else {
      b.w = 50; b.h = 50; b.timer = 2; b.y = 7 * TILE - b.h;
      b.vx = this.player.x > b.x ? 165 : -165;
      b.vy = -280;
    }
  }

  private updateOrgalorg(b: Boss, dt: number) {
    b.x = 392;
    b.y = 96;
    b.w = 120;
    b.h = 130;
    const want = b.vulnerable || b.attack === "beam" ? 1 : 0.12;
    b.open += (want - b.open) * Math.min(1, dt * 8);
    if (b.state === "intro") {
      b.timer -= dt;
      b.vulnerable = false;
      if (b.timer <= 0) { b.state = "wait"; b.timer = 0.7; b.vulnerable = true; }
      return;
    }
    if (b.state === "wait") {
      b.vulnerable = true;
      b.timer -= dt;
      if (b.timer <= 0) this.orgAttack(b);
    } else if (b.state === "windup") {
      b.vulnerable = b.attack === "beam";
      b.timer -= dt;
      if (b.attack === "inhale") this.player.x -= (this.input.right ? 28 : 110) * dt;
      if (b.timer <= 0) this.orgFire(b);
    } else {
      b.vulnerable = false;
      if (b.attack === "inhale") this.player.x -= (this.input.right ? 36 : 130) * dt;
      b.timer -= dt;
      if (b.timer <= 0) {
        b.state = "wait";
        b.vulnerable = true;
        b.attack = "";
        b.timer = b.phase === 3 ? 0.62 : b.phase === 2 ? 0.78 : 0.92;
      }
    }
    this.player.x = clamp(this.player.x, 0, this.level.w * TILE - PW);
  }

  private orgAttack(b: Boss) {
    const seq = b.phase === 3
      ? ["tentacle", "beam", "meteor", "charge", "summon"]
      : b.phase === 2
        ? ["tentacle", "beam", "inhale", "meteor", "summon"]
        : ["tentacle", "beam", "meteor", "summon"];
    const name = b.attacksDone === 0 ? "tentacle" : seq[b.attacksDone % seq.length];
    b.attacksDone++;
    b.attack = name;
    b.state = "windup";
    b.vulnerable = name === "beam";
    if (name === "tentacle") {
      b.timer = b.phase === 3 ? 0.5 : 0.68;
      const n = b.phase === 3 ? 3 : 2;
      for (let i = 0; i < n; i++) this.hazards.push(this.circle(36 + Math.random() * 300, 7 * TILE, 24, 0.6 + i * 0.06));
    } else if (name === "beam") {
      b.timer = b.phase === 3 ? 0.55 : 0.78;
      const aim = clamp(this.player.y + PH / 2 - 6, 40, 210);
      this.hazards.push({
        kind: "beam", x: 0, y: aim, w: b.x + 8, h: 14, r: 0,
        warn: b.timer, maxWarn: b.timer, active: 0.28, armed: false, spawn: "", vx: 0,
      });
    } else if (name === "meteor") {
      b.timer = 0.3;
      const n = b.phase === 3 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const hz = this.circle(28 + Math.random() * 330, 7 * TILE, 14, 0.55);
        hz.spawn = "meteor";
        this.hazards.push(hz);
      }
    } else if (name === "charge") {
      b.timer = 0.52;
      this.hazards.push({
        kind: "rect", x: 430, y: 7 * TILE - 34, w: 78, h: 34, r: 0,
        warn: b.timer, maxWarn: b.timer, active: 0.85, armed: false, spawn: "", vx: -300,
      });
    } else if (name === "inhale") {
      b.timer = 0.35;
    } else {
      b.timer = 0.25;
    }
  }

  private orgFire(b: Boss) {
    if (b.attack === "summon") {
      this.spawnMinion("penguin", 70 + Math.random() * 140, 7 * TILE - 22);
      b.state = "wait";
      b.timer = 0.55;
      b.vulnerable = true;
      return;
    }
    if (b.attack === "inhale") {
      b.state = "active";
      b.timer = b.phase === 3 ? 1.05 : 0.9;
      b.vulnerable = false;
      return;
    }
    b.state = "active";
    b.timer = b.attack === "beam" ? 0.32 : 0.45;
    b.vulnerable = false;
  }

  private circle(x: number, y: number, r: number, warn: number): Hazard {
    return { kind: "circle", x, y, w: 0, h: 0, r, warn, maxWarn: warn, active: 0.22, armed: false, spawn: "", vx: 0 };
  }

  private minionCount() {
    return this.enemies.filter((e) => e.minion && e.death <= 0).length;
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.kind === "wave") p.w += 18 * dt;
      const tx = Math.floor((p.x + p.w / 2) / TILE);
      const ty = Math.floor((p.y + p.h / 2) / TILE);
      if ((p.kind === "ice" || p.kind === "lemon" || p.kind === "meteor") && this.solidAt(tx, ty)) {
        p.life = 0;
        this.burst(p.x, p.y, p.kind === "lemon" ? "#f2e15a" : "#dff6ff", 5, 60, "circ");
      }
      if (p.y > this.level.h * TILE + 30) p.life = 0;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private castMagic() {
    const p = this.player;
    if (!this.element) {
      this.popup(p.x, p.y - 18, "SEM PODER!", "#ff9d9d", 10);
      audio.whiff();
      return;
    }
    if (this.magicCooldown > 0 || this.held) return;
    this.magicCooldown = 0.45;
    this.magic.push({
      kind: this.element, x: p.x + PW / 2 + this.facing * 14, y: p.y + 9,
      w: 14, h: 14, vx: this.facing * 305, vy: -20, life: 1.8,
    });
    this.stretch = -0.12;
    audio.throwSfx();
    this.burst(p.x + PW / 2 + this.facing * 17, p.y + 16, this.element === "fire" ? "#ff9048" : "#9befff", 6, 70, "star");
  }

  private openPowerBox(box: PowerBox) {
    if (box.opened) return;
    box.opened = true;
    if (!this.powers.includes(box.kind)) this.powers.push(box.kind);
    if (box.kind === "fire" || box.kind === "frost") this.element = box.kind;
    if (box.kind === "leaf") this.shieldEnergy = 1;
    const label: Record<PowerKind, string> = {
      fire: "BOLA DE FOGO!", frost: "GELO: 5 SEGUNDOS!",
      demon: "ESPADA DO DEMÔNIO!", leaf: "BRAÇO-FOLHA: E!",
    };
    const color = box.kind === "fire" ? "#ff9048" : box.kind === "frost" ? "#a5efff" : box.kind === "demon" ? "#ff4b64" : "#9dec70";
    this.score += 350;
    this.popup(box.x + 12, box.y - 12, label[box.kind], color, 11);
    this.burst(box.x + 12, box.y + 12, color, 16, 110, "star");
    this.addShake(3, 0.12);
    audio.gem();
  }

  private updateMagic(dt: number) {
    for (const box of this.powerBoxes) {
      if (box.opened) continue;
      const touch = overlap(this.player.x, this.player.y, PW, PH, box.x, box.y, 24, 24);
      const slash = this.swordBox();
      if (touch || (slash && overlap(slash.x, slash.y, slash.w, slash.h, box.x, box.y, 24, 24))) this.openPowerBox(box);
    }
    for (const ball of this.magic) {
      ball.life -= dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const color = ball.kind === "fire" ? "#ff9048" : "#a5efff";
      if (Math.random() < 0.18) this.burst(ball.x + 7, ball.y + 7, color, 1, 25, "star");
      if (this.solidAt(Math.floor((ball.x + 7) / TILE), Math.floor((ball.y + 7) / TILE))) ball.life = 0;
      if (ball.life <= 0) continue;
      for (const enemy of this.enemies) {
        if (enemy.death > 0 || !overlap(ball.x, ball.y, ball.w, ball.h, enemy.x, enemy.y, enemy.w, enemy.h)) continue;
        if (ball.kind === "frost") {
          enemy.frozen = 5;
          enemy.vx = 0;
          this.popup(enemy.x, enemy.y - 12, "CONGELADO!", "#a5efff", 10);
        } else this.killEnemy(enemy, "sword");
        ball.life = 0;
        break;
      }
      if (ball.life <= 0) { this.burst(ball.x, ball.y, color, 6, 70, "star"); continue; }
      const b = this.boss;
      if (!b || b.state === "intro" || b.hp <= 0) continue;
      const target = b.kind === "orgalorg"
        ? { x: b.x - 16, y: b.y + 16, w: 52, h: 40 }
        : { x: b.x, y: b.y, w: b.w, h: b.h };
      if (overlap(ball.x, ball.y, ball.w, ball.h, target.x, target.y, target.w, target.h)) {
        if (ball.kind === "frost") {
          b.frozen = 5;
          b.invuln = 0;
          this.popup(b.x, b.y - 18, "CONGELADO: 5S!", "#a5efff", 11);
        } else if (b.invuln <= 0 && (b.kind !== "orgalorg" || b.vulnerable || b.attack === "beam")) this.hitBoss(1);
        ball.life = 0;
        this.burst(ball.x, ball.y, color, 10, 75, "star");
      }
    }
    this.magic = this.magic.filter((ball) => ball.life > 0);
  }

  private updateHazards(dt: number) {
    for (const hz of this.hazards) {
      if (!hz.armed) {
        hz.warn -= dt;
        if (hz.warn <= 0) {
          if (hz.spawn === "meteor") {
            this.projectiles.push({ kind: "meteor", x: hz.x - 7, y: -16, w: 14, h: 14, vx: 0, vy: 250, life: 1.8, grav: 40 });
            hz.active = 0;
          }
          hz.armed = true;
        }
      } else if (hz.spawn !== "meteor") {
        hz.active -= dt;
        if (hz.vx) hz.x += hz.vx * dt;
        if (hz.active > 0 && this.hazardHits(hz)) this.hurt(this.player.x < hz.x ? -1 : 1);
      }
    }
    this.hazards = this.hazards.filter((h) => !h.armed || h.active > 0);
  }

  private hazardHits(hz: Hazard) {
    if (hz.kind === "circle") {
      const cx = this.player.x + PW / 2;
      const cy = this.player.y + PH - 6;
      return Math.hypot(cx - hz.x, cy - hz.y) < hz.r + 6;
    }
    return overlap(this.player.x, this.player.y, PW, PH, hz.x, hz.y, hz.w, hz.h);
  }

  private updateItems(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.phys) {
        it.vy += 720 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        const tx = Math.floor(it.x / TILE);
        const ty = Math.floor((it.y + 8) / TILE);
        if (this.solidAt(tx, ty) && it.vy > 0) {
          it.y = ty * TILE - 8;
          it.vy = 0;
          it.phys = false;
        }
      }
      if (it.age > 0.18 && (it.kind === "coin" || it.kind === "gem")) {
        const dx = this.player.x + PW / 2 - it.x;
        const dy = this.player.y + PH / 2 - it.y;
        const d = Math.hypot(dx, dy);
        if (d < 40 && d > 0.5) {
          it.x += (dx / d) * 150 * dt;
          it.y += (dy / d) * 150 * dt;
        }
      }
      const hit = overlap(this.player.x - 4, this.player.y - 4, PW + 8, PH + 8, it.x - 7, it.y - 7, 14, 14);
      if (hit) {
        this.collect(it);
        this.items.splice(i, 1);
      }
    }
    for (const c of this.checkpoints) {
      if (!c.on && this.player.x + PW / 2 >= c.x) {
        c.on = true;
        this.spawnX = c.x;
        this.spawnY = c.y;
        audio.checkpoint();
        this.popup(c.x, c.y - 24, "CHECKPOINT", "#ffe56a", 10);
        this.burst(c.x, c.y - 10, "#ffe56a", 8, 70, "star");
      }
    }
  }

  private collect(it: Item) {
    if (it.kind === "coin") {
      this.coins++;
      this.coinChain = this.coinChainT > 0 ? Math.min(8, this.coinChain + 1) : 1;
      this.coinChainT = 0.42;
      this.score += 100;
      audio.coin(this.coinChain - 1);
      this.popup(it.x, it.y - 8, "+100", "#ffe56a", 10);
      this.burst(it.x, it.y, "#ffe56a", 5, 60, "star");
    } else if (it.kind === "gem") {
      this.score += 500;
      audio.gem();
      this.popup(it.x, it.y - 10, "+500", "#ff8ab8", 12);
      this.burst(it.x, it.y, "#ff4f8b", 8, 80, "star");
      this.addShake(2, 0.08);
    } else if (it.kind === "heart") {
      if (this.lives < MAX_LIVES) {
        this.lives++;
        audio.heal();
        this.popup(it.x, it.y - 10, "+1 VIDA", "#ff8ab0", 11);
      } else {
        this.score += 300;
        this.popup(it.x, it.y - 10, "+300", "#ff8ab0", 11);
      }
      this.burst(it.x, it.y, "#ff4f6a", 7, 70, "star");
    } else if (!this.hasSocks) {
      this.hasSocks = true;
      this.airJumps = 1;
      this.score += 1000;
      audio.gem();
      this.popup(it.x, it.y - 12, "JAKE TE ESTICA!", "#f0c84a", 11);
      this.burst(it.x, it.y, "#f0c84a", 10, 90, "star");
    } else {
      this.score += 500;
      this.popup(it.x, it.y - 8, "+500", "#f0c84a", 11);
    }
  }

  private grabBox() {
    const p = this.player;
    const reach = 40;
    return { x: this.facing > 0 ? p.x + PW - 8 : p.x - reach + 8, y: p.y - 12, w: reach, h: PH + 16 };
  }

  private findGrabbable(): Enemy | null {
    const g = this.grabBox();
    const cx = this.player.x + PW / 2;
    const cy = this.player.y + PH / 2;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.death > 0 || e.kind === "vampire") continue;
      if (!overlap(g.x, g.y, g.w, g.h, e.x, e.y, e.w, e.h)) continue;
      const d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private tryGrab() {
    const e = this.findGrabbable();
    if (!e) {
      const g = this.grabBox();
      const heavy = this.enemies.some(
        (v) => v.death <= 0 && v.kind === "vampire" && overlap(g.x, g.y, g.w, g.h, v.x, v.y, v.w, v.h),
      );
      if (heavy) this.popup(this.player.x, this.player.y - 18, "PESADO DEMAIS!", "#ff9d9d", 10);
      audio.whiff();
      return;
    }
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.held = { kind: e.kind, t: 0, phase: e.phase };
    this.grabCount++;
    this.grabTarget = null;
    this.stretch = 0.18;
    this.hitStop = 0.03;
    this.addShake(1.8, 0.08);
    audio.grab();
    this.buzz(8);
    this.shocks.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, life: 1, max: 18, color: "#9be7ff" });
    this.burst(e.x + e.w / 2, e.y + e.h / 2, "#9be7ff", 9, 90, "star");
    this.popup(e.x, e.y - 10, e.kind === "bat" ? "MORCEGO!" : "PEGOU!", "#9be7ff", 11);
  }

  private throwHeld() {
    const h = this.held;
    if (!h) return;
    const p = this.player;
    const size = enemySize(h.kind);
    const dir = this.facing || 1;
    this.thrown.push({
      kind: h.kind,
      x: p.x + PW / 2 - size.w / 2 + dir * 8,
      y: p.y - 4,
      w: size.w,
      h: size.h,
      vx: dir * 410 + clamp(p.vx, -120, 120) * 0.4,
      vy: this.input.down ? 70 : -60,
      life: 1.5,
      spin: 0,
      dir,
      hits: 0,
      trail: 0,
      phase: h.phase,
    });
    this.held = null;
    p.vx -= dir * 30;
    this.stretch = -0.22;
    this.addShake(2, 0.09);
    audio.throwSfx();
    this.buzz(10);
    this.burst(p.x + PW / 2 + dir * 10, p.y + 4, "#ffb347", 7, 100, "star");
    this.shocks.push({ x: p.x + PW / 2 + dir * 12, y: p.y + 6, life: 1, max: 14, color: "#ffb347" });
  }

  private escapeHeld() {
    const h = this.held;
    if (!h) return;
    this.held = null;
    audio.whiff();
    this.popup(this.player.x, this.player.y - 24, "ESCAPOU!", "#ff9d9d", 11);
    this.burst(this.player.x + PW / 2, this.player.y - 14, "#fff", 8, 70, "circ");
  }

  private popThrown(t: Thrown, big: boolean) {
    t.life = 0;
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    this.burst(cx, cy, big ? "#ffb347" : "#fff", big ? 16 : 7, big ? 150 : 80, "star");
    this.shocks.push({ x: cx, y: cy, life: 1, max: big ? 34 : 18, color: big ? "#ffb347" : "#fff" });
    if (big) {
      this.addShake(6, 0.2);
      audio.smash();
    } else {
      this.addShake(2.2, 0.09);
      audio.clang();
    }
  }

  private updateThrown(dt: number) {
    for (const t of this.thrown) {
      t.vy += 380 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      t.spin += t.dir * 18 * dt;
      t.trail -= dt;
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      if (t.trail <= 0) {
        t.trail = 0.03;
        this.burst(cx - t.dir * 8, cy, "#ffb347", 1, 24, "star");
      }
      if (t.y > this.level.h * TILE + 30) t.life = 0;
      if (t.life <= 0) continue;

      const tx = Math.floor((cx + t.dir * (t.w / 2)) / TILE);
      const ty = Math.floor(cy / TILE);
      const tt = this.tile(tx, ty);
      if (tt === 5) this.breakCrate(tx, ty);
      else if (tt === 1 || tt === 4) {
        this.popThrown(t, false);
        continue;
      }

      for (const e of this.enemies) {
        if (e.death > 0) continue;
        if (!overlap(t.x, t.y, t.w, t.h, e.x - 2, e.y - 2, e.w + 4, e.h + 4)) continue;
        this.killEnemy(e, "throw");
        t.hits++;
        this.popup(e.x, e.y - 24, t.hits >= 2 ? "STRIKE!" : "ARREMESSO!", "#ffb347", 11);
        if (t.hits >= 3) {
          this.popThrown(t, true);
          break;
        }
      }
      if (t.life <= 0) continue;

      const b = this.boss;
      if (!b || b.state === "intro" || b.invuln > 0 || b.hp <= 0 || this.mode !== "play") continue;
      if (b.kind === "orgalorg") {
        const eye = { x: b.x - 16, y: b.y + 16, w: 52, h: 40 };
        if (overlap(t.x, t.y, t.w, t.h, eye.x, eye.y, eye.w, eye.h)) {
          if (b.vulnerable || b.attack === "beam") {
            this.hitBoss(THROW_ORGA_DMG);
            this.popup(b.x - 6, b.y - 20, "ARREMESSO!", "#ffb347", 12);
            this.popThrown(t, true);
          } else {
            this.popThrown(t, false);
            if (!this.eyeHint) {
              this.eyeHint = true;
              this.popup(200, 48, "OLHO FECHADO!", "#ff8a8a", 12);
            }
          }
        } else if (overlap(t.x, t.y, t.w, t.h, b.x + 10, b.y + 10, b.w - 10, b.h - 10)) {
          this.popThrown(t, false);
        }
      } else if (overlap(t.x, t.y, t.w, t.h, b.x, b.y, b.w, b.h)) {
        this.hitBoss(THROW_BOSS_DMG);
        this.popup(b.x + b.w / 2, b.y - 20, "ARREMESSO!", "#ffb347", 12);
        this.popThrown(t, true);
      }
    }
    this.thrown = this.thrown.filter((t) => t.life > 0);
  }

  private drawHeld(ctx: CanvasRenderingContext2D) {
    const h = this.held;
    if (!h) return;
    const p = this.player;
    const size = enemySize(h.kind);
    const warn = h.t > HOLD_MAX - 1.5;
    const wob = Math.sin(this.time * 30) * (warn ? 2.4 : 1);
    ctx.save();
    ctx.translate(p.x + PW / 2 + wob, p.y - 6 - size.h / 2 - Math.abs(Math.sin(this.time * 14)) * 1.2);
    ctx.rotate(Math.sin(this.time * 20) * 0.14);
    drawEnemy(ctx, -size.w / 2, -size.h / 2, {
      kind: h.kind,
      w: size.w,
      h: size.h,
      dir: this.facing,
      state: h.kind === "bat" ? "patrol" : "walk",
      time: this.time + h.phase,
      squash: 0,
      flash: warn && Math.floor(this.time * 12) % 2 === 0,
      alpha: 1,
    });
    ctx.restore();
    if (h.t < 3) drawBubble(ctx, p.x + PW / 2, p.y - 14 - size.h, "F: JOGAR");
  }

  private drawThrown(ctx: CanvasRenderingContext2D, t: Thrown) {
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const paint = (x: number, y: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.spin);
      drawEnemy(ctx, -t.w / 2, -t.h / 2, {
        kind: t.kind,
        w: t.w,
        h: t.h,
        dir: 1,
        state: "hop",
        time: this.time + t.phase,
        squash: 0,
        flash: false,
        alpha,
      });
      ctx.restore();
    };
    for (let i = 3; i >= 1; i--) paint(cx - t.vx * 0.012 * i, cy - t.vy * 0.012 * i, 0.16);
    ctx.save();
    ctx.strokeStyle = "rgba(255,179,71,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(t.w, t.h) / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    paint(cx, cy, 1);
  }

  private checkCombat() {
    const sword = this.swordBox();
    if (sword) {
      this.forEachTile(sword.x, sword.y, sword.w, sword.h, (tx, ty) => {
        if (this.tile(tx, ty) === 5) this.breakCrate(tx, ty);
      });
    }
    for (const e of this.enemies) {
      if (e.death > 0) continue;
      const stomp = this.canStomp(e.x, e.y, e.w, e.h);
      if (stomp) {
        this.killEnemy(e, "stomp");
        continue;
      }
      if (sword && overlap(sword.x, sword.y, sword.w, sword.h, e.x, e.y, e.w, e.h)) {
        this.killEnemy(e, "sword");
        continue;
      }
      if (e.frozen <= 0 && overlap(this.player.x, this.player.y, PW, PH, e.x + 2, e.y + 2, e.w - 4, e.h - 4)) {
        this.hurt(this.player.x < e.x ? -1 : 1);
      }
    }
    if (this.boss && this.boss.state !== "intro" && this.mode === "play") this.fightBoss(sword);
    for (const p of this.projectiles) {
      if (sword && overlap(sword.x, sword.y, sword.w, sword.h, p.x, p.y, p.w, p.h)) {
        p.life = 0;
        this.score += 50;
        audio.reflect();
        this.popup(p.x, p.y, "+50", "#fff", 10);
        this.burst(p.x, p.y, "#fff", 5, 70, "star");
        continue;
      }
      if (overlap(this.player.x, this.player.y, PW, PH, p.x, p.y, p.w, p.h)) {
        this.hurt(p.vx > 0 ? 1 : -1);
        p.life = 0;
      }
    }
  }

  private fightBoss(sword: { x: number; y: number; w: number; h: number } | null) {
    const b = this.boss;
    if (!b) return;
    const canStomp = b.kind !== "orgalorg" && (b.kind !== "warren" || b.form === "ball") && this.canStomp(b.x, b.y, b.w, Math.min(28, b.h));
    if (canStomp && b.invuln <= 0) {
      const dmg = b.kind === "iceking" && b.state === "swoop" ? 2 : 1;
      this.hitBoss(dmg);
      this.player.vy = this.input.jump ? -560 : -430;
      this.onGround = false;
      this.stretch = 0.3;
      return;
    }
    if (!sword || b.invuln > 0 || b.lastSwing === this.swingId) return;
    if (b.kind === "orgalorg") {
      const eye = { x: b.x - 16, y: b.y + 16, w: 52, h: 40 };
      if (overlap(sword.x, sword.y, sword.w, sword.h, eye.x, eye.y, eye.w, eye.h)) {
        if (b.vulnerable || b.attack === "beam") this.hitBoss(this.powers.includes("demon") ? 2 : 1);
        else {
          b.lastSwing = this.swingId;
          audio.clang();
          this.burst(eye.x + 12, eye.y + 12, "#fff", 5, 50, "star");
          if (!this.eyeHint) {
            this.eyeHint = true;
            this.popup(200, 48, "OLHO FECHADO!", "#ff8a8a", 12);
          }
        }
      }
    } else if (overlap(sword.x, sword.y, sword.w, sword.h, b.x, b.y, b.w, b.h)) {
      this.hitBoss(this.powers.includes("demon") ? 2 : 1);
    }
  }

  private canStomp(x: number, y: number, w: number, h: number) {
    if (this.player.vy < 40) return false;
    const prevBottom = this.playerPrevBottom;
    const overlapX = this.player.x + PW > x + 3 && this.player.x < x + w - 3;
    const landing = this.player.y + PH >= y && this.player.y + PH <= y + Math.max(16, h * 0.55);
    return overlapX && landing && prevBottom <= y + 14;
  }

  private swordBox() {
    if (!(this.attackT > 0.13)) return null;
    const reach = 46;
    const x = this.facing > 0 ? this.player.x + PW - 6 : this.player.x - reach + 6;
    return { x, y: this.player.y + 1, w: reach, h: PH + 2 };
  }

  private killEnemy(e: Enemy, cause: "stomp" | "sword" | "throw") {
    if (e.death > 0) return;
    e.death = 0.2;
    e.vx = this.facing * 80;
    e.vy = -90;
    const base = e.kind === "vampire" ? 450 : e.kind === "bat" ? 300 : e.kind === "crown" ? 350 : 200;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 1.5;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = base * this.combo * (cause === "throw" ? 2 : 1);
    this.score += pts;
    this.kills++;
    this.popup(e.x, e.y - 10, `+${pts}`, "#fff6df", 11);
    const hue = cause === "stomp" ? "#ffe56a" : cause === "throw" ? "#ffb347" : "#fff";
    this.hitStop = cause === "stomp" ? 0.05 : cause === "throw" ? 0.065 : 0.03;
    this.addShake(cause === "stomp" ? 3.8 : cause === "throw" ? 5 : 2.5, 0.12);
    this.shocks.push({ x: e.x + e.w / 2, y: e.y + 6, life: 1, max: cause === "throw" ? 26 : 16, color: hue });
    this.burst(e.x + e.w / 2, e.y + 6, hue, cause === "throw" ? 12 : 8, cause === "throw" ? 130 : 90, "star");
    if (cause === "throw") audio.smash();
    else audio.stomp(this.combo);
    this.buzz(cause === "stomp" ? 12 : 8);
    if (cause === "stomp") {
      this.player.vy = this.input.jump ? -560 : -410;
      this.onGround = false;
      this.coyote = 0;
      this.stretch = 0.32;
    }
    if ((e.kind === "penguin" || e.kind === "crown") && Math.random() < 0.3) this.popup(e.x, e.y - 24, "Wenk!", "#fff", 10);
    if (e.kind === "crown" && Math.random() < 0.2 && this.lives < MAX_LIVES) {
      this.items.push({ kind: "heart", x: e.x, y: e.y, vx: 0, vy: -40, age: 0, phys: true });
    }
  }

  private hitBoss(dmg: number) {
    const b = this.boss;
    if (!b || b.hp <= 0) return;
    b.lastSwing = this.swingId;
    b.invuln = 0.38;
    b.hurt = 0.22;
    b.hp -= dmg;
    this.score += 120 * dmg;
    this.popup(b.x + b.w / 2, b.y - 6, `-${dmg}`, "#ffb15a", 12);
    this.hitStop = 0.055;
    this.addShake(b.kind === "orgalorg" ? 6 : 4.5, 0.16);
    audio.bossHit();
    this.buzz(16);
    this.burst(b.x + b.w / 2, b.y + 16, "#fff", 8, 100, "star");
    const next = b.kind === "orgalorg"
      ? b.hp <= b.maxHp * 0.3 ? 3 : b.hp <= b.maxHp * 0.6 ? 2 : 1
      : b.hp <= b.maxHp * 0.5 ? 2 : 1;
    if (next > b.phase) {
      b.phase = next;
      b.invuln = Math.max(b.invuln, 0.45);
      this.addShake(7, 0.28);
      audio.explode();
      if (b.kind === "orgalorg" && next === 2 && !this.phaseHeart) {
        this.phaseHeart = true;
        this.items.push({ kind: "heart", x: 88, y: 130, vx: 10, vy: -50, age: 0, phys: true });
      }
      if (b.kind === "warren" && next === 2 && !this.didSummon) {
        this.didSummon = true;
        this.spawnMinion("warrenling", 64, 7 * TILE - 30);
      }
    }
    if (b.hp <= 0) this.defeatBoss();
  }

  private defeatBoss() {
    const b = this.boss;
    if (!b) return;
    this.score += BOSS_REWARD[b.kind];
    this.bosses++;
    this.kills++;
    this.mode = "bossdie";
    this.bossDieT = b.kind === "orgalorg" ? 1.45 : 1.05;
    this.fxT = 0;
    this.projectiles = [];
    this.hazards = [];
    this.addShake(b.kind === "orgalorg" ? 12 : 8, 0.45);
    this.hitStop = 0.09;
    this.flashColor = "#fff";
    this.flashA = 0.55;
    audio.explode();
    audio.clear();
    this.popup(b.x, b.y - 16, `+${BOSS_REWARD[b.kind]}`, "#ffe56a", 13);
  }

  private hurt(dir: number) {
    if (this.invuln > 0 || this.mode !== "play") return;
    if (this.shieldActive) {
      this.shieldEnergy = Math.max(0, this.shieldEnergy - 0.22);
      this.invuln = 0.35;
      this.addShake(2, 0.1);
      this.burst(this.player.x + PW / 2 + this.facing * 9, this.player.y + 12, "#9dec70", 9, 85, "star");
      this.popup(this.player.x, this.player.y - 18, "DEFESA!", "#9dec70", 10);
      audio.clang();
      this.buzz(8);
      if (this.shieldEnergy <= 0) { this.shieldActive = false; this.shieldCooldown = 1.5; }
      return;
    }
    this.lives--;
    if (this.held) {
      this.held = null;
      this.popup(this.player.x, this.player.y - 22, "SOLTOU!", "#ff9d9d", 10);
    }
    this.combo = 0;
    this.comboT = 0;
    audio.hurt();
    this.addShake(7, 0.28);
    this.flashColor = "rgba(255,50,60,0.5)";
    this.flashA = 0.5;
    this.buzz(22);
    this.hitStop = 0.06;
    if (this.lives <= 0) {
      this.mode = "dying";
      this.deathT = 0.82;
      this.player.vy = -280;
      this.player.vx = dir * 70;
      this.player.spin = 0.2;
    } else {
      this.invuln = 1.2;
      this.player.vy = -310;
      this.player.vx = dir * 180;
      this.stretch = 0.22;
    }
  }

  private pitFall() {
    if (this.mode !== "play") return;
    this.lives--;
    audio.hurt();
    this.addShake(6, 0.2);
    this.flashColor = "rgba(80,120,255,0.35)";
    this.flashA = 0.35;
    if (this.lives <= 0) {
      this.mode = "dying";
      this.deathT = 0.35;
    } else this.respawn();
  }

  private respawn() {
    this.player.x = this.spawnX;
    this.player.y = this.spawnY;
    this.player.vx = 0;
    this.player.vy = 0;
    this.invuln = 1.45;
    this.projectiles = [];
    this.hazards = [];
    this.enemies = this.enemies.filter((e) => !e.minion);
    this.thrown = [];
    this.held = null;
    this.grabQueued = false;
    this.snapCamera();
  }

  private checkSpikes() {
    this.forEachTile(this.player.x + 3, this.player.y + PH - 8, PW - 6, 8, (tx, ty) => {
      if (this.tile(tx, ty) === 3) this.hurt(this.facing * -1 || -1);
    });
  }

  private checkExit() {
    const exit = this.level.exit;
    if (!exit || this.mode !== "play") return;
    if (overlap(this.player.x, this.player.y, PW, PH, exit.x - 8, exit.y - 70, 28, 70)) {
      this.mode = "clear";
      this.clearT = 0.92;
      this.score += 500;
      this.player.vx = 0;
      audio.clear();
      this.flashColor = "#fff";
      this.flashA = 0.4;
      this.popup(this.player.x, this.player.y - 20, "+500", "#fff", 12);
    }
  }

  private breakCrate(tx: number, ty: number) {
    const idx = ty * this.level.w + tx;
    if (this.level.tiles[idx] !== 5) return;
    this.level.tiles[idx] = 0;
    audio.stomp(1);
    this.addShake(2.4, 0.08);
    this.burst(tx * TILE + 16, ty * TILE + 16, "#e0a060", 8, 80, "sq");
    for (let i = 0; i < 4; i++) {
      this.items.push({
        kind: "coin",
        x: tx * TILE + 16,
        y: ty * TILE + 8,
        vx: (i - 1.5) * 46,
        vy: -160 - i * 10,
        age: 0,
        phys: true,
      });
    }
  }

  private forEachTile(x: number, y: number, w: number, h: number, fn: (tx: number, ty: number) => void) {
    const x0 = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + w) / TILE);
    const y1 = Math.floor((y + h) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) fn(tx, ty);
  }

  private updateCamera(dt: number) {
    if (this.level.lockCam) {
      this.camX = 0;
      this.camY = 0;
      return;
    }
    const look = clamp(this.player.vx * 0.08, -24, 24);
    let tx = this.player.x + PW / 2 - VIEW_W * 0.42 + look;
    let ty = this.player.y + PH / 2 - VIEW_H * 0.58;
    if (this.player.vy < -40) ty -= 12;
    tx = clamp(tx, 0, Math.max(0, this.level.w * TILE - VIEW_W));
    ty = clamp(ty, 0, Math.max(0, this.level.h * TILE - VIEW_H));
    const k = 1 - Math.exp(-9 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  private snapCamera() {
    if (this.level.lockCam) {
      this.camX = 0;
      this.camY = 0;
      return;
    }
    this.camX = clamp(this.player.x + PW / 2 - VIEW_W * 0.38, 0, Math.max(0, this.level.w * TILE - VIEW_W));
    this.camY = clamp(this.player.y + PH / 2 - VIEW_H * 0.58, 0, Math.max(0, this.level.h * TILE - VIEW_H));
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  private updatePopups(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  private updateShocks(dt: number) {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      this.shocks[i].life -= dt * 2.4;
      if (this.shocks[i].life <= 0) this.shocks.splice(i, 1);
    }
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, kind: Particle["kind"]) {
    for (let i = 0; i < n; i++) {
      const p = this.particles.find((q) => q.life <= 0) ?? this.particles[i % this.particles.length];
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.75);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 20;
      p.life = 0.35 + Math.random() * 0.25;
      p.max = p.life;
      p.size = 1.6 + Math.random() * 2.4;
      p.color = color;
      p.g = 280;
      p.rot = Math.random() * 6;
      p.vr = (Math.random() - 0.5) * 8;
      p.kind = kind;
    }
  }

  private popup(x: number, y: number, text: string, color: string, size: number) {
    this.popups.push({ x, y, text, color, size, life: 0.7, max: 0.7, vy: -28 });
    if (this.popups.length > 16) this.popups.shift();
  }

  private addShake(mag: number, dur: number) {
    const scale = this.reduce ? 0.2 : 1;
    this.shakeMag = Math.max(this.shakeMag, mag * scale);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  private buzz(ms: number) {
    if (this.reduce) return;
    navigator.vibrate?.(ms);
  }

  private dustColor() {
    const world = this.level.world;
    if (world === "ice") return "#f4fbff";
    if (world === "lemon") return "#efe07a";
    if (world === "vampire") return "#6b3a4a";
    if (world === "mars") return "#e07a4a";
    if (world === "space") return "#9aa4c0";
    return "#e7c39a";
  }

  private comboWord() {
    if (this.combo >= 6) return "LENDA DE OOO!";
    if (this.combo >= 5) return "OOO!";
    if (this.combo >= 4) return "ALGÉBRICO!";
    if (this.combo >= 3) return "MATEMÁTICO!";
    return `x${this.combo}`;
  }

  private makeStats(won: boolean): RunStats {
    return {
      score: this.score,
      coins: this.coins,
      kills: this.kills,
      bosses: this.bosses,
      maxCombo: this.maxCombo,
      time: this.runTime,
      stage: won ? "Jake e BMO salvos" : this.level.name,
      stageIndex: this.levelIndex,
      won,
    };
  }

  private makeHud(): HudState {
    const b = this.boss;
    return {
      score: this.score,
      lives: Math.max(0, this.lives),
      maxLives: MAX_LIVES,
      coins: this.coins,
      combo: this.comboT > 0 ? this.combo : 0,
      stage: this.levelIndex + 1,
      stages: levelCount(),
      worldName: this.level.name,
      world: this.mode === "ending" ? "ending" : this.level.world,
      muted: audio.muted,
      held: !!this.held,
      socks: this.hasSocks,
      powers: [...this.powers],
      element: this.element,
      shield: this.shieldActive,
      shieldEnergy: Math.floor(this.shieldEnergy * 10) / 10,
      boss: b && this.mode !== "ending"
        ? {
            name: BOSS_NAME[b.kind],
            hp: Math.max(0, b.hp),
            max: b.maxHp,
            phase: b.phase,
            vulnerable: b.kind === "orgalorg" ? b.vulnerable || b.attack === "beam" : false,
            hint: this.bossHint(b),
          }
        : null,
    };
  }

  private bossHint(b: Boss) {
    if (b.kind === "orgalorg") return b.vulnerable || b.attack === "beam" ? "OLHO ABERTO — ATAQUE!" : "Desvie e espere o olho abrir.";
    if (b.kind === "iceking") return "Corte os raios ou pule quando ele mergulhar.";
    if (b.kind === "lemongrab") return "Pule o grito. Corte os limões.";
    return "Saia do círculo vermelho. Pise na bola.";
  }

  private emitHud() {
    const hud = this.makeHud();
    const key = `${hud.score}|${hud.lives}|${hud.coins}|${hud.combo}|${hud.stage}|${hud.muted}|${hud.socks}|${hud.held}|${hud.powers.join(",")}|${hud.element}|${hud.shield}|${hud.shieldEnergy}|${hud.world}|${hud.boss?.hp ?? "-"}|${hud.boss?.vulnerable ?? ""}|${hud.boss?.phase ?? ""}|${hud.boss?.hint ?? ""}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.getHooks().onHud(hud);
  }

  private render() {
    const ctx = this.ctx;
    const world: WorldId = this.mode === "ending" ? "ending" : this.level.world;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = (PAL[world] ?? PAL.candy).skyBot;
    ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
    ctx.save();
    if (this.shakeT > 0) {
      const m = this.shakeMag * Math.min(1, this.shakeT * 5);
      ctx.translate(Math.sin(this.time * 90) * m, Math.cos(this.time * 73) * m);
    }

    if (this.mode === "ending" || this.endingHold) {
      drawEnding(ctx, this.endingHold ? 9 : this.endingT, this.time * 8);
    } else {
      drawWorld(ctx, world, this.camX, this.camY, this.time);
      ctx.save();
      ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
      drawTiles(ctx, this.level.tiles, this.level.w, this.level.h, this.camX, this.camY, world, this.time);
      for (const p of this.plats) drawPlatform(ctx, p.x, p.y, p.w, p.h, world, this.time);
      if (this.level.exit) drawFlag(ctx, this.level.exit.x, this.level.exit.y, world, this.time);
      for (const c of this.checkpoints) drawCheckpoint(ctx, c.x, c.y + PH, c.on, this.time);
      for (const it of this.items) drawItem(ctx, it.kind, it.x, it.y, this.time + it.x);
      for (const box of this.powerBoxes) if (!box.opened) drawPowerBox(ctx, box.x, box.y, box.kind, this.time);
      for (const hz of this.hazards) {
        if (!hz.armed || hz.kind !== "circle" || !this.boss || this.boss.kind !== "orgalorg" || hz.spawn === "meteor") continue;
        drawTentacle(ctx, this.boss.x + 30, this.boss.y + 70, hz.x, hz.y, this.time);
      }
      for (const e of this.enemies) {
        if (e.state === "dash") {
          drawEnemy(ctx, e.x - e.dir * 16, e.y, { ...this.enemyOpt(e), alpha: 0.25 });
        }
        drawEnemy(ctx, e.x, e.y, this.enemyOpt(e));
        if (e.frozen > 0 && e.death <= 0) {
          ctx.fillStyle = "rgba(142,220,255,0.43)";
          ctx.strokeStyle = "#e6faff";
          ctx.lineWidth = 1.5;
          ctx.fillRect(e.x - 2, e.y - 2, e.w + 4, e.h + 4);
          ctx.strokeRect(e.x - 2, e.y - 2, e.w + 4, e.h + 4);
        }
      }
      if (this.boss && this.mode !== "clear") {
        const b = this.boss;
        drawBoss(ctx, b.x, b.y, {
          kind: b.kind, w: b.w, h: b.h, facing: b.facing, phase: b.phase,
          hurt: b.hurt > 0 && Math.floor(this.time * 24) % 2 === 0,
          vulnerable: b.vulnerable || b.attack === "beam",
          form: b.form, attack: b.attack, open: b.open, time: this.time, attackT: b.timer,
        });
        if (b.frozen > 0) {
          ctx.fillStyle = "rgba(130,220,255,0.32)";
          ctx.strokeStyle = "#b9f4ff";
          ctx.lineWidth = 2;
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        if (this.levelTime < 2.3 && b.state === "intro") {
          const quote = b.kind === "lemongrab" ? "INACEITÁVEL!" : b.kind === "iceking" ? "Minha coroa!" : b.kind === "warren" ? "Eu me transformo!" : "";
          if (quote) drawBubble(ctx, b.x + b.w / 2, b.y - 8, quote);
        }
      }
      for (const g of this.trail) {
        drawFinn(ctx, g.x, g.y, this.finnOpt(g.a * 0.5));
      }
      ctx.save();
      ctx.globalAlpha = this.onGround ? 0.22 : 0.12;
      ctx.fillStyle = "#1c1a17";
      ctx.beginPath();
      ctx.ellipse(this.player.x + PW / 2, this.player.y + PH + 1, this.onGround ? 8 : 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const alpha = this.invuln > 0 && Math.sin(this.time * 42) > 0 ? 0.45 : 1;
      drawFinn(ctx, this.player.x, this.player.y, this.finnOpt(alpha));
      if (this.held) this.drawHeld(ctx);
      for (const t of this.thrown) this.drawThrown(ctx, t);
      const gt = this.grabTarget;
      if (gt && !this.held && this.grabCount < 3 && this.mode === "play") {
        drawBubble(ctx, gt.x + gt.w / 2, gt.y - 8, "F");
      }
      if (this.attackT > 0) {
        drawSlash(ctx, this.player.x + PW / 2 + this.facing * 8, this.player.y + 12, this.facing, 1 - this.attackT / 0.28);
      }
      for (const p of this.projectiles) drawProjectile(ctx, p.kind, p.x, p.y, p.w, p.h, this.time);
      for (const ball of this.magic) drawMagic(ctx, ball.x + 7, ball.y + 7, ball.kind, this.time);
      for (const hz of this.hazards) {
        drawHazard(ctx, hz.kind, hz.x, hz.y, hz.w, hz.h, hz.r, Math.max(0, hz.warn / (hz.maxWarn || 1)), hz.armed, this.time);
      }
      for (const s of this.shocks) drawShock(ctx, s.x, s.y, 4, s.max, s.life, s.color);
      for (const p of this.particles) if (p.life > 0) drawParticle(ctx, p);
      for (const p of this.popups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        drawOutlined(ctx, p.text, p.x, p.y, p.size, p.color);
        ctx.restore();
      }
      if (this.levelIndex === 0 && this.levelTime < 6.5) {
        drawOutlined(ctx, "PULAR", 16.5 * TILE, 7 * TILE, 11, "#fff");
      }
      if (this.level.boss === "orgalorg" && this.levelTime < 10) {
        drawOutlined(ctx, "▼", 7.4 * TILE, 3.2 * TILE, 14, "#d6ff4a");
      }
      ctx.restore();
      drawWeather(ctx, world, this.time);
      if (this.level.exit) {
        const sx = this.level.exit.x - this.camX;
        if (sx > VIEW_W - 8) drawOutlined(ctx, "►", VIEW_W - 18, 36, 14, "#ffe56a");
      }
    }

    if (this.mode === "ending") {
      for (const p of this.particles) if (p.life > 0) drawParticle(ctx, p);
    }

    ctx.restore();
    if (this.lives === 1 && this.mode === "play") {
      ctx.fillStyle = `rgba(255,40,50,${0.08 + Math.sin(this.time * 6) * 0.05})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.flashA > 0) {
      ctx.fillStyle = this.flashColor.startsWith("rgba") ? this.flashColor : `rgba(255,255,255,${this.flashA})`;
      if (!this.flashColor.startsWith("rgba")) ctx.globalAlpha = this.flashA;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (this.combo >= 2 && this.comboT > 0 && this.mode === "play") {
      drawOutlined(ctx, this.comboWord(), VIEW_W / 2, 28, this.combo >= 3 ? 18 : 14, "#ffe56a", '"Lilita One"');
    }
    if (this.mode === "clear") drawOutlined(ctx, "ESTÁGIO LIMPO!", VIEW_W / 2, VIEW_H / 2 - 10, 22, "#fff6df", '"Lilita One"');
    if (this.mode === "bossdie" && this.boss) {
      drawOutlined(ctx, `${BOSS_NAME[this.boss.kind]} caiu!`, VIEW_W / 2, 32, 16, "#ffe56a", '"Lilita One"');
    }
    if (this.boss && this.boss.attack === "inhale" && (this.boss.state === "active" || this.boss.state === "windup")) {
      drawOutlined(ctx, "SEGURE →", VIEW_W / 2, 52, 12, "#d6ff4a");
    }
  }

  private finnOpt(alpha: number) {
    let pose: "idle" | "run" | "jump" | "fall" | "dead" | "cheer" = "idle";
    if (this.mode === "dying") pose = "dead";
    else if (this.mode === "clear") pose = "cheer";
    else if (!this.onGround) pose = this.player.vy < 0 ? "jump" : "fall";
    else if (Math.abs(this.player.vx) > 16) pose = "run";
    return {
      w: PW,
      h: PH,
      facing: this.facing,
      pose,
      time: this.time,
      attack: this.attackT > 0 ? 1 - this.attackT / 0.28 : 0,
      stretch: this.stretch,
      alpha,
      socks: this.hasSocks,
      spin: this.player.spin,
      hold: !!this.held,
      demon: this.powers.includes("demon"),
      leaf: this.powers.includes("leaf"),
      shield: this.shieldActive,
    };
  }

  private enemyOpt(e: Enemy) {
    const squash = e.death > 0 ? 1 - e.death / 0.2 : 0;
    return {
      kind: e.kind,
      w: e.w,
      h: e.h,
      dir: e.dir,
      state: e.state,
      time: this.time + e.phase,
      squash,
      flash: e.death > 0,
      alpha: 1,
    };
  }
}
