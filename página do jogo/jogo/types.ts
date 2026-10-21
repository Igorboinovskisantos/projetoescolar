export const TILE = 32;
export const VIEW_W = 512;
export const VIEW_H = 288;

export type WorldId = "candy" | "ice" | "lemon" | "vampire" | "mars" | "space" | "ending";
export type TileType = 0 | 1 | 2 | 3 | 4 | 5;
export type BossKind = "iceking" | "lemongrab" | "warren" | "orgalorg";
export type PowerKind = "fire" | "frost" | "demon" | "leaf";
export type SpawnKind =
  | "penguin"
  | "crown"
  | "bat"
  | "vampire"
  | "lemonling"
  | "warrenling"
  | "powerbox"
  | "coin"
  | "gem"
  | "heart"
  | "socks"
  | "checkpoint";

export interface Spawn {
  kind: SpawnKind;
  x: number;
  y: number;
  power?: PowerKind;
}

export interface PlatDef {
  x: number;
  y: number;
  w: number;
  h: number;
  axis: "x" | "y";
  min: number;
  max: number;
  speed: number;
}

export interface LevelData {
  name: string;
  subtitle: string;
  hint: string;
  world: WorldId;
  w: number;
  h: number;
  tiles: TileType[];
  player: { x: number; y: number };
  exit: { x: number; y: number } | null;
  boss: BossKind | null;
  spawns: Spawn[];
  platforms: PlatDef[];
  lockCam: boolean;
}

export interface HudState {
  score: number;
  lives: number;
  maxLives: number;
  coins: number;
  combo: number;
  stage: number;
  stages: number;
  worldName: string;
  world: WorldId;
  muted: boolean;
  socks: boolean;
  held: boolean;
  powers: PowerKind[];
  element: "fire" | "frost" | null;
  shield: boolean;
  shieldEnergy: number;
  boss: null | {
    name: string;
    hp: number;
    max: number;
    phase: number;
    vulnerable: boolean;
    hint: string;
  };
}

export interface RunStats {
  score: number;
  coins: number;
  kills: number;
  bosses: number;
  maxCombo: number;
  time: number;
  stage: string;
  stageIndex: number;
  won: boolean;
}

export type OverlayState =
  | { type: "none" }
  | { type: "pause" }
  | { type: "ending" }
  | { type: "gameover"; stats: RunStats }
  | { type: "victory"; stats: RunStats };

export interface BannerState {
  id: number;
  title: string;
  subtitle: string;
  hint: string;
}

export interface GameHooks {
  onHud: (hud: HudState) => void;
  onOverlay: (overlay: OverlayState) => void;
  onBanner: (banner: BannerState) => void;
  requestRestart: () => void;
  onBossReached: (boss: BossKind, levelIndex: number) => void;
}
