import { TILE, type BossKind, type LevelData, type PlatDef, type Spawn, type TileType, type WorldId } from "./types";

const PH = 28;

function grid(w: number, h: number): TileType[] {
  return new Array(w * h).fill(0) as TileType[];
}

function fillGround(tiles: TileType[], w: number, h: number, row: number) {
  for (let y = row; y < h; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = 1;
}

function pit(tiles: TileType[], w: number, h: number, x: number, width: number, row: number) {
  for (let y = row; y < h; y++) for (let i = 0; i < width; i++) tiles[y * w + (x + i)] = 0;
}

function plat(tiles: TileType[], w: number, x: number, y: number, width: number) {
  for (let i = 0; i < width; i++) tiles[y * w + x + i] = 2;
}

function ice(tiles: TileType[], w: number, x: number, y: number, width: number, height: number) {
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const idx = (y + j) * w + x + i;
      if (tiles[idx] === 1) tiles[idx] = 4;
    }
  }
}

function spikes(tiles: TileType[], w: number, x: number, y: number, width: number) {
  for (let i = 0; i < width; i++) tiles[y * w + x + i] = 3;
}

function crate(tiles: TileType[], w: number, x: number, y: number) {
  tiles[y * w + x] = 5;
}

function power(spawns: Spawn[], kind: NonNullable<Spawn["power"]>, tx: number, ground: number) {
  spawns.push({ kind: "powerbox", power: kind, x: tx * TILE + 4, y: ground * TILE - 26 });
}

function base(
  w: number,
  h: number,
  ground: number,
  world: WorldId,
  name: string,
  subtitle: string,
  hint: string,
  boss: BossKind | null,
): LevelData {
  const tiles = grid(w, h);
  fillGround(tiles, w, h, ground);
  return {
    name,
    subtitle,
    hint,
    world,
    w,
    h,
    tiles,
    player: { x: 42, y: ground * TILE - PH },
    exit: boss ? null : { x: (w - 3) * TILE + 6, y: ground * TILE },
    boss,
    spawns: [],
    platforms: [],
    lockCam: !!boss,
  };
}

function coinLine(spawns: Spawn[], tx: number, count: number, ground: number, step = 1) {
  for (let i = 0; i < count; i++) {
    spawns.push({ kind: "coin", x: (tx + i * step) * TILE + TILE / 2, y: ground * TILE - 16 });
  }
}

function coinAt(spawns: Spawn[], tx: number, ty: number) {
  spawns.push({ kind: "coin", x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
}

function enemy(spawns: Spawn[], kind: Spawn["kind"], tx: number, surface: number, eh: number, ew = 22) {
  spawns.push({
    kind,
    x: tx * TILE + (TILE - ew) / 2,
    y: surface - eh,
  });
}

function air(spawns: Spawn[], kind: Spawn["kind"], tx: number, ty: number) {
  spawns.push({ kind, x: tx * TILE + 4, y: ty * TILE + 6 });
}

function itemAbove(spawns: Spawn[], kind: Spawn["kind"], tx: number, row: number) {
  spawns.push({ kind, x: tx * TILE + TILE / 2, y: row * TILE - 10 });
}

function checkpoint(spawns: Spawn[], tx: number, ground: number) {
  spawns.push({ kind: "checkpoint", x: tx * TILE, y: ground * TILE - PH });
}

function levelCandy(): LevelData {
  const ground = 9;
  const L = base(44, 12, ground, "candy", "Colinas de Doce", "Os pinguins fugiram do Reino Gelado!", "Pise, corte, pegue com F ou use o poder com Q!", null);
  const s = L.spawns;
  coinLine(s, 3, 6, ground);
  power(s, "fire", 6, ground);
  enemy(s, "penguin", 9, ground * TILE, 22);
  crate(L.tiles, L.w, 13, 7);
  coinAt(s, 13, 6);
  pit(L.tiles, L.w, L.h, 16, 2, ground);
  coinAt(s, 16, 7);
  coinAt(s, 17, 7);
  enemy(s, "penguin", 20, ground * TILE, 22);
  plat(L.tiles, L.w, 10, 6, 4);
  coinAt(s, 11, 5);
  coinAt(s, 12, 5);
  itemAbove(s, "socks", 13, 6);
  plat(L.tiles, L.w, 22, 6, 5);
  coinAt(s, 23, 5);
  coinAt(s, 24, 5);
  coinAt(s, 25, 5);
  spikes(L.tiles, L.w, 27, 8, 2);
  enemy(s, "crown", 30, ground * TILE, 24, 22);
  checkpoint(s, 24, ground);
  power(s, "leaf", 25, ground);
  pit(L.tiles, L.w, L.h, 33, 2, ground);
  coinAt(s, 33, 7);
  coinAt(s, 34, 7);
  crate(L.tiles, L.w, 36, 8);
  enemy(s, "penguin", 38, ground * TILE, 22);
  air(s, "bat", 29, 4);
  plat(L.tiles, L.w, 36, 7, 3);
  plat(L.tiles, L.w, 39, 5, 4);
  itemAbove(s, "gem", 40, 5);
  itemAbove(s, "heart", 41, 5);
  coinAt(s, 39, 4);
  return L;
}

function levelIce(): LevelData {
  const ground = 9;
  const L = base(50, 12, ground, "ice", "Reino Gelado", "O chão mente. Os morcegos não.", "Gelo escorrega. A plataforma móvel atravessa o vão.", null);
  const s = L.spawns;
  coinLine(s, 3, 5, ground);
  enemy(s, "penguin", 8, ground * TILE, 22);
  ice(L.tiles, L.w, 12, ground, 18, 3);
  coinLine(s, 13, 6, ground);
  power(s, "frost", 14, ground);
  enemy(s, "penguin", 16, ground * TILE, 22);
  enemy(s, "crown", 21, ground * TILE, 24, 22);
  air(s, "bat", 18, 5);
  air(s, "bat", 24, 4);
  plat(L.tiles, L.w, 14, 6, 4);
  coinAt(s, 15, 5);
  itemAbove(s, "heart", 17, 6);
  spikes(L.tiles, L.w, 28, 8, 2);
  checkpoint(s, 31, ground);
  enemy(s, "penguin", 33, ground * TILE, 22);
  pit(L.tiles, L.w, L.h, 36, 6, ground);
  const mover: PlatDef = {
    x: 33 * TILE,
    y: ground * TILE - 18,
    w: 3 * TILE,
    h: 12,
    axis: "x",
    min: 33 * TILE,
    max: 40 * TILE,
    speed: 72,
  };
  L.platforms.push(mover);
  coinAt(s, 37, 6);
  coinAt(s, 39, 6);
  air(s, "bat", 38, 4);
  enemy(s, "penguin", 44, ground * TILE, 22);
  plat(L.tiles, L.w, 45, 6, 3);
  itemAbove(s, "gem", 46, 6);
  coinLine(s, 43, 4, ground);
  return L;
}

function arena(
  world: WorldId,
  name: string,
  subtitle: string,
  hint: string,
  boss: BossKind,
): LevelData {
  const L = base(16, 9, 7, world, name, subtitle, hint, boss);
  L.player = { x: 36, y: 7 * TILE - PH };
  L.lockCam = true;
  return L;
}

function levelIceKing(): LevelData {
  const L = arena("ice", "Rei Gelado", "“Devolve meus pinguins, aventureiro!”", "Corte os raios de gelo ou pule neles.", "iceking");
  plat(L.tiles, L.w, 2, 4, 3);
  plat(L.tiles, L.w, 11, 4, 3);
  plat(L.tiles, L.w, 6, 5, 4);
  power(L.spawns, "frost", 4, 7);
  itemAbove(L.spawns, "heart", 12, 4);
  coinAt(L.spawns, 3, 3);
  coinAt(L.spawns, 7, 4);
  coinAt(L.spawns, 8, 4);
  return L;
}

function levelLemon(): LevelData {
  const ground = 10;
  const L = base(46, 13, ground, "lemon", "Condado Azedo", "Tudo aqui é quase inaceitável.", "Morcegos mergulham. O vampiro avisa antes de avançar.", null);
  const s = L.spawns;
  coinLine(s, 3, 5, ground);
  power(s, "demon", 5, ground);
  enemy(s, "penguin", 8, ground * TILE, 22);
  plat(L.tiles, L.w, 6, 8, 4);
  plat(L.tiles, L.w, 11, 6, 4);
  plat(L.tiles, L.w, 16, 4, 5);
  coinAt(s, 7, 7);
  coinAt(s, 12, 5);
  coinAt(s, 17, 3);
  coinAt(s, 18, 3);
  itemAbove(s, "gem", 19, 4);
  air(s, "bat", 13, 4);
  air(s, "bat", 20, 6);
  spikes(L.tiles, L.w, 24, 9, 2);
  enemy(s, "penguin", 27, ground * TILE, 22);
  checkpoint(s, 29, ground);
  pit(L.tiles, L.w, L.h, 31, 2, ground);
  coinAt(s, 31, 8);
  coinAt(s, 32, 8);
  air(s, "bat", 33, 6);
  air(s, "bat", 37, 5);
  enemy(s, "vampire", 36, ground * TILE, 34, 18);
  itemAbove(s, "heart", 34, 8);
  plat(L.tiles, L.w, 33, 8, 3);
  coinLine(s, 39, 4, ground);
  enemy(s, "crown", 41, ground * TILE, 24, 22);
  return L;
}

function levelLemongrab(): LevelData {
  const L = arena("lemon", "Conde Limãograb", "“INACEITÁVEL!”", "Pule o grito amarelo. Corte os limões no ar.", "lemongrab");
  plat(L.tiles, L.w, 1, 4, 3);
  plat(L.tiles, L.w, 12, 4, 3);
  plat(L.tiles, L.w, 6, 5, 4);
  power(L.spawns, "fire", 4, 7);
  itemAbove(L.spawns, "heart", 2, 4);
  coinAt(L.spawns, 7, 4);
  coinAt(L.spawns, 8, 4);
  return L;
}

function levelVampire(): LevelData {
  const ground = 9;
  const L = base(52, 12, ground, "vampire", "Pináculo Carmesim", "Presas, capas e nenhum convite.", "O vampiro brilha antes do avanço. Corte ou pule.", null);
  const s = L.spawns;
  coinLine(s, 3, 4, ground);
  power(s, "leaf", 8, ground);
  air(s, "bat", 6, 5);
  enemy(s, "vampire", 10, ground * TILE, 34, 18);
  coinLine(s, 12, 3, ground);
  checkpoint(s, 15, ground);
  pit(L.tiles, L.w, L.h, 18, 10, ground);
  plat(L.tiles, L.w, 17, 8, 3);
  plat(L.tiles, L.w, 21, 8, 3);
  plat(L.tiles, L.w, 25, 8, 4);
  coinAt(s, 18, 7);
  coinAt(s, 22, 7);
  coinAt(s, 26, 7);
  air(s, "bat", 22, 5);
  air(s, "bat", 26, 4);
  enemy(s, "penguin", 30, ground * TILE, 22);
  spikes(L.tiles, L.w, 33, 8, 2);
  enemy(s, "vampire", 36, ground * TILE, 34, 18);
  plat(L.tiles, L.w, 38, 6, 3);
  itemAbove(s, "heart", 39, 6);
  coinAt(s, 39, 5);
  L.platforms.push({
    x: 42 * TILE,
    y: 8 * TILE,
    w: 2 * TILE,
    h: 12,
    axis: "y",
    min: 5 * TILE,
    max: 8 * TILE,
    speed: 36,
  });
  s.push({ kind: "gem", x: 42 * TILE + TILE, y: 5 * TILE - 12 });
  air(s, "bat", 44, 5);
  enemy(s, "vampire", 46, ground * TILE, 34, 18);
  enemy(s, "crown", 48, ground * TILE, 24, 22);
  coinLine(s, 47, 3, ground);
  return L;
}

function levelWarren(): LevelData {
  const L = arena("mars", "Warren Ampersand", "“Eu posso ser qualquer forma.”", "Saia das marcas vermelhas. Pise nele quando virar bola.", "warren");
  plat(L.tiles, L.w, 1, 3, 4);
  plat(L.tiles, L.w, 11, 3, 4);
  plat(L.tiles, L.w, 6, 5, 4);
  power(L.spawns, "demon", 4, 7);
  itemAbove(L.spawns, "heart", 2, 3);
  coinAt(L.spawns, 7, 4);
  coinAt(L.spawns, 8, 4);
  coinAt(L.spawns, 12, 2);
  return L;
}

function levelOrgalorg(): LevelData {
  const L = arena("space", "Orgalorg", "O devorador de mundos abre o olho.", "Acerte o olho aberto. Caia no vão para desviar do raio.", "orgalorg");
  plat(L.tiles, L.w, 1, 2, 4);
  plat(L.tiles, L.w, 1, 4, 6);
  power(L.spawns, "frost", 3, 7);
  // Eye perch sits a little lower than the mid platforms so the sword meets the eye.
  L.platforms.push({
    x: 8 * TILE,
    y: 146,
    w: 4 * TILE + 20,
    h: 12,
    axis: "x",
    min: 8 * TILE,
    max: 8 * TILE,
    speed: 0,
  });
  itemAbove(L.spawns, "heart", 2, 2);
  coinAt(L.spawns, 3, 3);
  coinAt(L.spawns, 4, 3);
  L.spawns.push({ kind: "coin", x: 9 * TILE + 16, y: 136 });
  L.spawns.push({ kind: "coin", x: 10 * TILE + 16, y: 136 });
  return L;
}

const BUILDERS = [
  levelCandy,
  levelIce,
  levelIceKing,
  levelLemon,
  levelLemongrab,
  levelVampire,
  levelWarren,
  levelOrgalorg,
];

export function levelCount() {
  return BUILDERS.length;
}

export function buildLevel(index: number): LevelData {
  const fn = BUILDERS[index] ?? BUILDERS[0];
  return fn();
}
