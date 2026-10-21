import { TILE, VIEW_H, VIEW_W, type PowerKind, type WorldId } from "./types";
import { hash2 } from "./util";

export const INK = "#1c1a17";

type Ctx = CanvasRenderingContext2D;

export const PAL: Record<
  WorldId,
  {
    skyTop: string;
    skyBot: string;
    hill: string;
    hill2: string;
    ground: string;
    top: string;
    deep: string;
    accent: string;
    slab: string;
    cloud: string;
  }
> = {
  candy: {
    skyTop: "#8fd8ff",
    skyBot: "#ffe7a8",
    hill: "#f7a8c9",
    hill2: "#8bd46a",
    ground: "#e38b45",
    top: "#6fcb4e",
    deep: "#c46b32",
    accent: "#ff5c8a",
    slab: "#f2b56b",
    cloud: "#ffffff",
  },
  ice: {
    skyTop: "#e7f7ff",
    skyBot: "#b7ddff",
    hill: "#f4fbff",
    hill2: "#d5ecf8",
    ground: "#7eb6d9",
    top: "#f7fbff",
    deep: "#5e93b8",
    accent: "#7fd7ff",
    slab: "#d7f1ff",
    cloud: "#ffffff",
  },
  lemon: {
    skyTop: "#f6efb0",
    skyBot: "#e7c84a",
    hill: "#d5de86",
    hill2: "#c4b15a",
    ground: "#8d8f4e",
    top: "#dde07a",
    deep: "#6d7038",
    accent: "#f0e14a",
    slab: "#efe07a",
    cloud: "#fff8d2",
  },
  vampire: {
    skyTop: "#1b1035",
    skyBot: "#4a1d4e",
    hill: "#2a1848",
    hill2: "#3a2048",
    ground: "#3a2748",
    top: "#6b3a4a",
    deep: "#241628",
    accent: "#e23d4a",
    slab: "#6d4a62",
    cloud: "#6a5088",
  },
  mars: {
    skyTop: "#ff8a5b",
    skyBot: "#6b2d5b",
    hill: "#c4553a",
    hill2: "#8d3a48",
    ground: "#a33b32",
    top: "#e07a4a",
    deep: "#7a2c28",
    accent: "#ffd166",
    slab: "#e08a55",
    cloud: "#ffd0b0",
  },
  space: {
    skyTop: "#07071a",
    skyBot: "#1a0b3a",
    hill: "#140824",
    hill2: "#24143f",
    ground: "#1c2438",
    top: "#3d4c6e",
    deep: "#121624",
    accent: "#b6ff6a",
    slab: "#44506e",
    cloud: "#c9c4ff",
  },
  ending: {
    skyTop: "#14082a",
    skyBot: "#3a1d58",
    hill: "#1a1030",
    hill2: "#2a1848",
    ground: "#243044",
    top: "#4a5c78",
    deep: "#161c2c",
    accent: "#ffd56a",
    slab: "#44506e",
    cloud: "#efeaff",
  },
};

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true) {
  const rw = Math.max(0.5, w);
  const rh = Math.max(0.5, h);
  const rad = Math.min(r, rw / 2, rh / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
  ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
  ctx.arcTo(x, y + rh, x, y, rad);
  ctx.arcTo(x, y, x + rw, y, rad);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.75;
    ctx.stroke();
  }
}

export function drawOutlined(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  font = "Nunito",
) {
  ctx.save();
  ctx.font = `800 ${size}px ${font}, Trebuchet MS, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size / 7);
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawBubble(ctx: Ctx, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = "800 11px Nunito, Trebuchet MS, sans-serif";
  const w = Math.min(220, ctx.measureText(text).width + 16);
  const h = 18;
  rr(ctx, x - w / 2, y - h, w, h, 8, "#fffdf6");
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 6);
  ctx.closePath();
  ctx.fillStyle = "#fffdf6";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - h / 2);
  ctx.restore();
}

export function drawWorld(ctx: Ctx, world: WorldId, camX: number, camY: number, time: number) {
  const pal = PAL[world] ?? PAL.candy;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (world === "space" || world === "ending" || world === "vampire") {
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 97 + time * (4 + (i % 5))) % (VIEW_W + 20)) - 10;
      const sy = (i * 53 + Math.sin(time + i) * 4) % (VIEW_H * 0.72);
      ctx.globalAlpha = 0.35 + (i % 5) * 0.1;
      ctx.fillStyle = i % 7 === 0 ? "#ffe56a" : "#ffffff";
      ctx.fillRect(sx, sy, i % 4 === 0 ? 2.2 : 1.3, i % 4 === 0 ? 2.2 : 1.3);
    }
    ctx.globalAlpha = 1;
  }

  if (world === "space" || world === "ending") {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#6a3cff";
    ctx.beginPath();
    ctx.ellipse(90 - camX * 0.02, 70, 70, 28, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#39e07a";
    ctx.beginPath();
    ctx.ellipse(360 - camX * 0.03, 54, 80, 22, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f0d8a8";
    ctx.beginPath();
    ctx.arc(430, 36, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (world === "vampire") {
    ctx.fillStyle = "#f2e2c4";
    ctx.beginPath();
    ctx.arc(400 - camX * 0.02, 42, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.skyBot;
    ctx.beginPath();
    ctx.arc(392 - camX * 0.02, 40, 14, 0, Math.PI * 2);
    ctx.fill();
  } else if (world === "mars") {
    ctx.fillStyle = "#ffd1a8";
    ctx.beginPath();
    ctx.arc(80 - camX * 0.02, 48, 22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = world === "ice" ? "#fff" : "#ffe56a";
    ctx.beginPath();
    ctx.arc(78 - camX * 0.02, 46, world === "ice" ? 16 : 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const hillBase = world === "space" || world === "ending" ? 188 : 168;
  ctx.fillStyle = pal.hill2;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 12) {
    const wx = x + camX * 0.18 + camY * 0.05;
    ctx.lineTo(x, hillBase + Math.sin(wx * 0.02) * 16 + Math.sin(wx * 0.007) * 8);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.fill();

  ctx.fillStyle = pal.hill;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 12) {
    const wx = x + camX * 0.32;
    ctx.lineTo(x, hillBase + 28 + Math.sin(wx * 0.028 + 1) * 14);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.fill();

  const spacing = 86;
  const parallax = 0.42;
  const start = Math.floor((camX * parallax) / spacing) - 1;
  for (let i = start; i < start + 10; i++) {
    const x = i * spacing - camX * parallax;
    drawProp(ctx, world, x, 176 + (Math.abs(i) % 3) * 6, i, time);
  }

  for (let i = 0; i < 6; i++) {
    const cx = ((i * 150 - camX * 0.12 + time * (6 + i) + 800) % (VIEW_W + 140)) - 70;
    const cy = 28 + (i % 3) * 22;
    drawCloud(ctx, cx, cy, 0.75 + (i % 3) * 0.18, pal.cloud, world === "vampire" ? 0.35 : 0.9);
  }
}

function drawCloud(ctx: Ctx, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 22 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 16 * s, y + 2, 16 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 16 * s, y + 3, 14 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProp(ctx: Ctx, world: WorldId, x: number, y: number, seed: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  if (world === "candy") {
    if (seed % 2 === 0) {
      rr(ctx, -3, -28, 6, 32, 2, "#fff");
      ctx.strokeStyle = "#ff5c8a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -22);
      ctx.lineTo(3, -16);
      ctx.moveTo(-3, -12);
      ctx.lineTo(3, -6);
      ctx.stroke();
      ctx.fillStyle = "#ff5c8a";
      ctx.beginPath();
      ctx.arc(0, -34, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else {
      rr(ctx, -10, -8, 20, 12, 4, "#7dce6a");
      rr(ctx, -4, -26, 8, 20, 3, "#e07a3d");
    }
  } else if (world === "ice") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.strokeStyle = "#8fb8d4";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(8, -4);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (world === "lemon") {
    ctx.fillStyle = "#f2e15a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, -16, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#6a8a32";
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -20);
    ctx.moveTo(0, -28);
    ctx.lineTo(6, -24);
    ctx.stroke();
  } else if (world === "vampire") {
    ctx.strokeStyle = "#1a1020";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -28);
    ctx.moveTo(0, -20);
    ctx.lineTo(-12, -8);
    ctx.moveTo(0, -16);
    ctx.lineTo(14, -4);
    ctx.stroke();
  } else if (world === "mars") {
    ctx.fillStyle = "#d4654a";
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(0, -18 + (seed % 3) * -4);
    ctx.lineTo(12, 4);
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = seed % 2 === 0 ? "#7cf0ff" : "#d2b4ff";
    ctx.fillRect(-1, -10 - (seed % 4) * 6, 2, 2);
  }
  ctx.restore();
  void time;
}

export function drawTiles(
  ctx: Ctx,
  tiles: number[],
  w: number,
  h: number,
  camX: number,
  camY: number,
  world: WorldId,
  time: number,
) {
  const pal = PAL[world] ?? PAL.candy;
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const x1 = Math.min(w - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const y1 = Math.min(h - 1, Math.ceil((camY + VIEW_H) / TILE) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = tiles[y * w + x];
      if (!t) continue;
      const px = x * TILE;
      const py = y * TILE;
      if (t === 3) {
        drawSpike(ctx, px, py, world, x + y);
        continue;
      }
      if (t === 5) {
        drawCrate(ctx, px, py, time, world);
        continue;
      }
      if (t === 2) {
        rr(ctx, px + 1, py, TILE - 2, 12, 4, pal.slab);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(px + 4, py + 2, TILE - 10, 3);
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = pal.accent;
          ctx.fillRect(px + 6, py + 5, 4, 4);
        }
        continue;
      }
      const above = y > 0 ? tiles[(y - 1) * w + x] : 0;
      const topped = !above || above === 3;
      ctx.fillStyle = topped ? pal.ground : pal.deep;
      ctx.fillRect(px, py, TILE + 0.5, TILE + 0.5);
      if (topped) {
        ctx.fillStyle = t === 4 ? "#f4fbff" : pal.top;
        ctx.fillRect(px, py, TILE + 0.5, 8);
        const n = hash2(x, y);
        ctx.fillStyle = t === 4 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)";
        if (n % 3 !== 0) ctx.fillRect(px + (n % 18), py + 2, 6, 3);
        if (t !== 4 && world === "candy" && n % 4 === 0) {
          ctx.fillStyle = n % 2 === 0 ? "#ff5c8a" : "#ffe56a";
          ctx.beginPath();
          ctx.arc(px + 8 + (n % 12), py + 5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (t === 4) {
          ctx.strokeStyle = "rgba(120,170,210,0.8)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 14);
          ctx.lineTo(px + 14, py + 22);
          ctx.moveTo(px + 20, py + 12);
          ctx.lineTo(px + 28, py + 24);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "rgba(28,26,23,0.28)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawSpike(ctx: Ctx, x: number, y: number, world: WorldId, seed: number) {
  const c = world === "lemon" ? "#f2e15a" : world === "vampire" ? "#c43b48" : world === "ice" ? "#e7f7ff" : "#d7dde6";
  ctx.fillStyle = c;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const bx = x + 4 + i * 9;
    ctx.beginPath();
    ctx.moveTo(bx, y + TILE - 2);
    ctx.lineTo(bx + 4, y + 8 + (seed + i) % 3);
    ctx.lineTo(bx + 8, y + TILE - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawCrate(ctx: Ctx, x: number, y: number, time: number, world: WorldId) {
  const bob = Math.sin(time * 3 + x) * 1.5;
  ctx.save();
  ctx.translate(0, bob);
  rr(ctx, x + 4, y + 4, 24, 24, 4, world === "candy" ? "#f0a05a" : "#c4894a");
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 8);
  ctx.lineTo(x + 24, y + 24);
  ctx.moveTo(x + 24, y + 8);
  ctx.lineTo(x + 8, y + 24);
  ctx.stroke();
  ctx.fillStyle = "#ffe56a";
  ctx.font = "800 12px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("?", x + 16, y + 20);
  ctx.restore();
}

export function drawPlatform(ctx: Ctx, x: number, y: number, w: number, h: number, world: WorldId, time: number) {
  const pal = PAL[world] ?? PAL.candy;
  rr(ctx, x, y, w, h, 5, pal.slab);
  ctx.fillStyle = pal.accent;
  const arrows = Math.max(1, Math.floor(w / 28));
  for (let i = 0; i < arrows; i++) {
    const ax = x + 10 + i * 28 + Math.sin(time * 4) * 1.5;
    ctx.fillRect(ax, y + 4, 8, 3);
  }
}

export interface FinnOpts {
  w: number;
  h: number;
  facing: number;
  pose: "idle" | "run" | "jump" | "fall" | "dead" | "cheer";
  time: number;
  attack: number;
  stretch: number;
  alpha: number;
  socks: boolean;
  spin: number;
  hold?: boolean;
  demon?: boolean;
  leaf?: boolean;
  shield?: boolean;
}

export function drawFinn(ctx: Ctx, x: number, y: number, o: FinnOpts) {
  if (o.alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = o.alpha;
  ctx.translate(x + o.w / 2, y + o.h);
  if (o.spin) ctx.rotate(o.spin);
  ctx.scale(o.facing || 1, 1);
  ctx.scale(1 + o.stretch, 1 - o.stretch * 0.82);
  const step = o.pose === "run" ? Math.sin(o.time * 17) * 2.4 : 0;
  const skin = "#f5d2b8";
  const sock = o.socks ? "#f7d748" : "#ffffff";
  // Finn's green backpack is visible behind his light blue shirt.
  rr(ctx, -12, -20, 6, 13, 2.5, "#68a738");
  rr(ctx, -10, -19, 3, 11, 1, "#92cb58", false);
  // Short legs, rolled white socks and black shoes.
  rr(ctx, -6, -8 + step, 4, 5, 1.5, skin);
  rr(ctx, 2, -8 - step, 4, 5, 1.5, skin);
  rr(ctx, -7, -5 + step, 5, 3, 1, sock);
  rr(ctx, 2, -5 - step, 5, 3, 1, sock);
  rr(ctx, -8, -2 + step, 7, 3, 1.5, "#28272a");
  rr(ctx, 2, -2 - step, 7, 3, 1.5, "#28272a");
  rr(ctx, -7, -12, 14, 5, 2, "#326cae");
  rr(ctx, -7, -21, 14, 11, 3, "#8cddf5");
  // The white hood, with its unmistakable two upright ears.
  rr(ctx, -8, -39, 5, 14, 2.4, "#fffefa");
  rr(ctx, 3, -39, 5, 14, 2.4, "#fffefa");
  rr(ctx, -10, -33, 20, 16, 6.5, "#fffefa");
  ctx.fillStyle = skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.ellipse(0, -25, 7.6, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  if (o.pose === "dead") {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, -27); ctx.lineTo(-1, -24); ctx.moveTo(-1, -27); ctx.lineTo(-4, -24);
    ctx.moveTo(2, -27); ctx.lineTo(5, -24); ctx.moveTo(5, -27); ctx.lineTo(2, -24);
    ctx.stroke();
  } else if (o.pose === "cheer" || Math.sin(o.time * 1.7) > 0.985) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(-3, -26, 1.6, 0.1, Math.PI - 0.1); ctx.arc(3, -26, 1.6, 0.1, Math.PI - 0.1); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-3, -26, 1, 0, Math.PI * 2);
    ctx.arc(3, -26, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (o.pose === "fall") ctx.arc(0, -22, 1.3, 0, Math.PI * 2);
  else ctx.arc(0, -23, 2.1, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Thin swinging arms and mitten-like hands.
  const arm = o.attack > 0 ? -6 : o.pose === "cheer" ? -9 : -13 + step;
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  // While carrying an enemy both arms reach straight up.
  ctx.moveTo(-7, -18);
  ctx.lineTo(o.hold ? -8 : -9, o.hold ? -31 : o.pose === "cheer" ? -27 : -13 - step);
  ctx.moveTo(7, -18);
  ctx.lineTo(o.hold ? 8 : 11, o.hold ? -31 : arm);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (!o.hold) drawSword(ctx, o.attack, o.time, o.demon);
  if (o.leaf) {
    ctx.save();
    ctx.translate(10, o.shield ? -19 : -12);
    ctx.rotate(o.shield ? -0.28 : 0.45);
    ctx.fillStyle = o.shield ? "#8fed63" : "#69b749";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 7); ctx.quadraticCurveTo(-14, -5, 1, -23);
    ctx.quadraticCurveTo(14, -5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#376b30";
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(1, -20); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawSword(ctx: Ctx, attack: number, time: number, demon = false) {
  ctx.save();
  ctx.translate(11, attack > 0 ? -13 : -12);
  const ang = attack > 0 ? -1.7 + attack * 2.4 : 0.4 + Math.sin(time * 2) * 0.05;
  ctx.rotate(ang);
  rr(ctx, 0, -1.5, demon ? 20 : 15, demon ? 4 : 3, 1, demon ? "#d22339" : "#e9eef2");
  if (demon) {
    ctx.fillStyle = "#ff8a5a";
    ctx.fillRect(6, -0.5, 11, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(7, -1, 6, 1);
  rr(ctx, -2, -3, 3, 6, 1, "#e1b21e");
  ctx.fillStyle = "#e23d4a";
  ctx.beginPath();
  ctx.arc(-1.2, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function drawSlash(ctx: Ctx, x: number, y: number, facing: number, progress: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(4, 0, 18 + progress * 8, -1.3, 0.9);
  ctx.stroke();
  ctx.strokeStyle = "#ffe56a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(4, 0, 12, -1.1, 0.7);
  ctx.stroke();
  ctx.restore();
}

export interface EnemyOpts {
  kind: "penguin" | "crown" | "bat" | "vampire" | "lemonling" | "warrenling";
  w: number;
  h: number;
  dir: number;
  state: string;
  time: number;
  squash: number;
  flash: boolean;
  alpha: number;
}

export function drawEnemy(ctx: Ctx, x: number, y: number, e: EnemyOpts) {
  ctx.save();
  ctx.globalAlpha = e.alpha;
  ctx.translate(x + e.w / 2, y + e.h);
  ctx.scale((e.dir || 1) * (1 + e.squash * 0.55), 1 - e.squash * 0.72);
  if (e.kind === "lemonling" || e.kind === "warrenling") {
    ctx.save();
    ctx.translate(-e.w / 2 - 1, -e.h - 3);
    ctx.scale(0.52, 0.39);
    const opts: BossOpts = {
      kind: e.kind === "lemonling" ? "lemongrab" : "warren",
      w: e.kind === "lemonling" ? 36 : 40, h: 80,
      facing: e.dir, phase: 1, hurt: e.flash, vulnerable: true,
      form: "walk", attack: "", open: 1, time: e.time, attackT: 0,
    };
    if (e.kind === "lemonling") drawLemongrab(ctx, opts);
    else drawWarren(ctx, opts);
    ctx.restore();
  } else if (e.kind === "bat") drawBat(ctx, e);
  else if (e.kind === "vampire") drawVampire(ctx, e);
  else drawPenguin(ctx, e);
  ctx.restore();
}

export function drawPowerBox(ctx: Ctx, x: number, y: number, kind: PowerKind, time: number) {
  const colors: Record<PowerKind, string> = { fire: "#ff814b", frost: "#8edcff", demon: "#e9455b", leaf: "#84df74" };
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 3 + x) * 1.5);
  rr(ctx, 0, 0, 24, 24, 4, colors[kind]);
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(4, 4, 16, 16);
  ctx.fillStyle = "#fff";
  ctx.font = "900 16px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(({ fire: "F", frost: "G", demon: "D", leaf: "E" } as Record<PowerKind, string>)[kind], 12, 12);
  ctx.restore();
}

export function drawMagic(ctx: Ctx, x: number, y: number, kind: "fire" | "frost", time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = kind === "fire" ? "#ff7b38" : "#a5efff";
  ctx.strokeStyle = kind === "fire" ? "#e63b30" : "#35aee6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 7 + Math.sin(time * 22) * 1.2, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-2, -2, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPenguin(ctx: Ctx, e: EnemyOpts) {
  const body = e.flash ? "#fff" : "#20242b";
  const belly = e.flash ? "#fff" : "#f5f5ef";
  const bob = e.state === "walk" ? Math.abs(Math.sin(e.time * 10)) : 0;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.fillStyle = "#edae4d";
  ctx.beginPath();
  ctx.ellipse(-6, -2 + bob, 4, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(6, -2 - bob, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Gunter's rounded black body and white bib.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -12, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(0, -9, 6.6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-9, -9, 2.5, 6, -0.25, 0, Math.PI * 2);
  ctx.ellipse(9, -9, 2.5, 6, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5f5ef";
  ctx.beginPath();
  ctx.ellipse(-3.2, -16, 2.6, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(3.2, -16, 2.6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17171b";
  ctx.beginPath();
  ctx.arc(-2.5, -16, 1, 0, Math.PI * 2);
  ctx.arc(3.9, -16, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9ae50";
  ctx.beginPath();
  ctx.moveTo(-3, -13);
  ctx.lineTo(4, -13);
  ctx.lineTo(1, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (e.kind === "crown") {
    ctx.fillStyle = "#f0c84a";
    ctx.beginPath();
    ctx.moveTo(-7, -21);
    ctx.lineTo(-6, -28);
    ctx.lineTo(-2, -24);
    ctx.lineTo(0, -30);
    ctx.lineTo(2, -24);
    ctx.lineTo(6, -28);
    ctx.lineTo(7, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e23d4a";
    ctx.fillRect(-1, -25, 2, 2);
  }
  if (e.state === "hop") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, -8, 4, 2);
  }
}

function drawBat(ctx: Ctx, e: EnemyOpts) {
  const flap = Math.sin(e.time * (e.state === "dive" ? 28 : 16)) * (e.state === "tele" ? 1 : 5);
  ctx.fillStyle = e.flash ? "#fff" : "#4f335d";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  // Scalloped wings read clearly even when the bat is small.
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.quadraticCurveTo(-13, -14 - flap, -22, -7 - flap);
  ctx.quadraticCurveTo(-17, -9 - flap, -15, -4);
  ctx.quadraticCurveTo(-11, -7, -9, -3);
  ctx.lineTo(0, -8);
  ctx.lineTo(9, -3);
  ctx.quadraticCurveTo(11, -7, 15, -4);
  ctx.quadraticCurveTo(17, -9 - flap, 22, -7 - flap);
  ctx.quadraticCurveTo(13, -14 - flap, 4, -10);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -12); ctx.lineTo(-4, -19); ctx.lineTo(0, -14);
  ctx.lineTo(4, -19); ctx.lineTo(6, -12); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -9, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = e.state === "tele" ? "#ff5a6a" : "#f6f0ec";
  ctx.beginPath();
  ctx.arc(-2.5, -10, 1.7, 0, Math.PI * 2);
  ctx.arc(2.5, -10, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-2, -10, 0.7, 0, Math.PI * 2);
  ctx.arc(3, -10, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(-2, -5); ctx.lineTo(-1, -2); ctx.lineTo(0, -5);
  ctx.moveTo(1, -5); ctx.lineTo(2, -2); ctx.lineTo(3, -5);
  ctx.fill();
  if (e.state === "tele") {
    ctx.fillStyle = "#ff5a6a";
    ctx.font = "800 10px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 0, -22);
  }
}

function drawVampire(ctx: Ctx, e: EnemyOpts) {
  const cape = e.flash ? "#fff" : "#bd263b";
  const pale = e.flash ? "#fff" : "#ded1d6";
  ctx.fillStyle = "#24212a";
  ctx.fillRect(-6, -5, 5, 5);
  ctx.fillRect(2, -5, 5, 5);
  ctx.fillStyle = cape;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const wave = Math.sin(e.time * 8 + (e.state === "dash" ? 2 : 0)) * 3;
  ctx.moveTo(-8, -26);
  ctx.quadraticCurveTo(-14, -22, -15, -4 + wave);
  ctx.lineTo(-7, -7);
  ctx.lineTo(0, -2);
  ctx.lineTo(7, -7);
  ctx.lineTo(15, -4 - wave);
  ctx.quadraticCurveTo(13, -24, 8, -26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  rr(ctx, -6, -20, 12, 14, 3, e.flash ? "#fff" : "#29212e");
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(-5, -21); ctx.lineTo(0, -14); ctx.lineTo(5, -21); ctx.fill();
  ctx.fillStyle = pale;
  ctx.beginPath();
  ctx.ellipse(0, -27, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#25202c";
  ctx.beginPath();
  ctx.moveTo(-8, -31);
  ctx.lineTo(-5, -36);
  ctx.lineTo(0, -33);
  ctx.lineTo(6, -37);
  ctx.lineTo(8, -29);
  ctx.lineTo(4, -31);
  ctx.lineTo(0, -27);
  ctx.lineTo(-5, -31);
  ctx.fill();
  const eye = e.state === "tele" || e.state === "dash" ? "#ff4d58" : "#ffe56a";
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.ellipse(-2.6, -27, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(2.6, -27, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-4, -23); ctx.quadraticCurveTo(0, -21, 4, -23); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(-3, -23); ctx.lineTo(-1.6, -20); ctx.lineTo(-1, -23);
  ctx.moveTo(1, -23); ctx.lineTo(2.2, -20); ctx.lineTo(3, -23);
  ctx.fill();
  if (e.state === "tele") {
    ctx.strokeStyle = "#ff4d58";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -8, 12 + Math.sin(e.time * 30) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export interface BossOpts {
  kind: "iceking" | "lemongrab" | "warren" | "orgalorg";
  w: number;
  h: number;
  facing: number;
  phase: number;
  hurt: boolean;
  vulnerable: boolean;
  form: string;
  attack: string;
  open: number;
  time: number;
  attackT: number;
}

export function drawBoss(ctx: Ctx, x: number, y: number, b: BossOpts) {
  ctx.save();
  ctx.translate(x, y);
  if (b.kind === "iceking") drawIceKing(ctx, b);
  else if (b.kind === "lemongrab") drawLemongrab(ctx, b);
  else if (b.kind === "warren") drawWarren(ctx, b);
  else drawOrgalorg(ctx, b);
  ctx.restore();
}

function drawIceKing(ctx: Ctx, b: BossOpts) {
  const robe = b.hurt ? "#fff" : "#68aeee";
  const skin = b.hurt ? "#fff" : "#b8ddf7";
  const beard = b.hurt ? "#fff" : "#edf9ff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  // Ragged blue royal robe, blue sleeves and ice-white fur edging.
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(15, 32); ctx.lineTo(37, 32);
  ctx.lineTo(47, 58); ctx.lineTo(37, 56); ctx.lineTo(26, 61);
  ctx.lineTo(15, 56); ctx.lineTo(5, 58); ctx.closePath();
  ctx.fill(); ctx.stroke();
  rr(ctx, 7, 30, 10, 22, 5, robe);
  rr(ctx, 35, 30, 10, 22, 5, robe);
  ctx.fillStyle = beard;
  ctx.beginPath();
  ctx.moveTo(13, 33); ctx.quadraticCurveTo(26, 24, 39, 33);
  ctx.lineTo(35, 36); ctx.lineTo(30, 34); ctx.lineTo(26, 38);
  ctx.lineTo(21, 34); ctx.lineTo(16, 36); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(26, 24, 13, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Crown of uneven gold points and three bright red jewels.
  ctx.fillStyle = "#f5c846";
  ctx.beginPath();
  ctx.moveTo(13, 17); ctx.lineTo(12, 3); ctx.lineTo(19, 10);
  ctx.lineTo(26, 0); ctx.lineTo(33, 10); ctx.lineTo(40, 3);
  ctx.lineTo(39, 17); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e33f55";
  for (const px of [18, 26, 34]) {
    ctx.beginPath(); ctx.arc(px, px === 26 ? 10 : 14, px === 26 ? 2.5 : 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#e8f6ff";
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(13, 30); ctx.quadraticCurveTo(10, 39, 18, 43); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(39, 30); ctx.quadraticCurveTo(42, 39, 35, 43); ctx.stroke();
  ctx.fillStyle = beard;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(16, 29); ctx.quadraticCurveTo(12, 36, 20, 43);
  ctx.lineTo(22, 41); ctx.lineTo(26, 51); ctx.lineTo(30, 41);
  ctx.lineTo(33, 43); ctx.quadraticCurveTo(42, 36, 36, 29);
  ctx.lineTo(30, 32); ctx.lineTo(26, 35); ctx.lineTo(22, 32); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(25, 23); ctx.quadraticCurveTo(33, 22, 34, 27);
  ctx.quadraticCurveTo(31, 30, 25, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(21, 22, 1.3, 0, Math.PI * 2); ctx.arc(31, 22, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5687a7"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(17, 19); ctx.lineTo(23, 17); ctx.moveTo(29, 17); ctx.lineTo(35, 19); ctx.stroke();
  if (b.attack === "bolt") {
    ctx.fillStyle = "#b7e6ff";
    ctx.beginPath();
    ctx.arc(b.w / 2 + 23 * b.facing, 40, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const a = b.time * 2 + i * 2;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(b.w / 2 + Math.cos(a) * 22, 20 + Math.sin(a) * 10, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawLemongrab(ctx: Ctx, b: BossOpts) {
  const yell = b.attack === "scream";
  const skin = b.hurt ? "#fff" : "#ffe449";
  const suit = b.hurt ? "#fff" : "#303641";
  rr(ctx, 10, 50, 6, 29, 2, suit);
  rr(ctx, 21, 50, 6, 29, 2, suit);
  rr(ctx, 7, 74, 11, 5, 2, "#242630");
  rr(ctx, 20, 74, 11, 5, 2, "#242630");
  rr(ctx, 8, 43, 20, 24, 3, suit);
  ctx.fillStyle = "#f8f2df";
  ctx.beginPath(); ctx.moveTo(13, 44); ctx.lineTo(19, 56); ctx.lineTo(24, 44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ee9850";
  ctx.fillRect(17, 51, 3, 9);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(8, 48); ctx.lineTo(3, 64); ctx.moveTo(28, 48); ctx.lineTo(34, 63); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(3, 65, 3, 0, Math.PI * 2); ctx.arc(34, 64, 3, 0, Math.PI * 2); ctx.fill();
  // Tall lemon head and little dark green stem.
  ctx.strokeStyle = "#5a8a32";
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(18, 8); ctx.lineTo(17, 1); ctx.moveTo(17, 3); ctx.lineTo(22, 5); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(18, 7);
  ctx.bezierCurveTo(30, 10, 34, 20, 32, 34);
  ctx.quadraticCurveTo(31, 44, 26, 48);
  ctx.lineTo(10, 48);
  ctx.quadraticCurveTo(4, 38, 5, 28);
  ctx.bezierCurveTo(5, 15, 10, 9, 18, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(8, yell ? 20 : 23);
  ctx.lineTo(15, yell ? 26 : 25);
  ctx.moveTo(29, yell ? 20 : 23);
  ctx.lineTo(22, yell ? 26 : 25);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(13, 29, 1.1, 2.1, 0, 0, Math.PI * 2);
  ctx.ellipse(23, 29, 1.1, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (yell) {
    ctx.fillStyle = "#2a2418";
    ctx.beginPath();
    ctx.ellipse(18, 38, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(12, 35, 3, 4);
    ctx.fillRect(17, 34, 3, 5);
    ctx.fillRect(22, 35, 3, 4);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(18, 40, 16 + Math.sin(b.time * 30) * 2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(13, 38);
    ctx.lineTo(23, 38);
    ctx.stroke();
  }
}

function drawWarren(ctx: Ctx, b: BossOpts) {
  const skin = b.hurt ? "#fff" : "#8653ae";
  const belly = b.hurt ? "#fff" : "#c8a5de";
  ctx.fillStyle = skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  if (b.form === "ball") {
    ctx.beginPath();
    ctx.ellipse(b.w / 2, b.h / 2, b.w / 2 - 2, b.h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(b.w / 2, b.h / 2 + 4, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    warrenFace(ctx, b.w / 2, b.h / 2 - 2, 1);
    return;
  }
  const tall = b.form === "tower";
  // His silhouette changes from a lanky alien to a springy ball.
  ctx.strokeStyle = skin;
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, tall ? 42 : 36);
  ctx.quadraticCurveTo(-8, tall ? 52 : 43, 1, tall ? 64 : 53);
  ctx.stroke();
  rr(ctx, 8, tall ? 28 : 24, b.w - 16, b.h - (tall ? 32 : 28), 10, skin);
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(b.w / 2, b.h * 0.62, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(b.w / 2, tall ? 22 : 20, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(b.w / 2 - 11, tall ? 13 : 11);
  ctx.lineTo(b.w / 2 - 9, tall ? 1 : -3);
  ctx.lineTo(b.w / 2 - 3, tall ? 10 : 8);
  ctx.moveTo(b.w / 2 + 4, tall ? 10 : 8);
  ctx.lineTo(b.w / 2 + 11, tall ? 1 : -3);
  ctx.lineTo(b.w / 2 + 12, tall ? 14 : 12);
  ctx.fill();
  warrenFace(ctx, b.w / 2, tall ? 22 : 20, tall ? 1.15 : 1);
  if (tall) {
    ctx.strokeStyle = skin;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    const drop = b.attack === "slam" ? Math.min(1, b.attackT) : 0.2;
    ctx.beginPath();
    ctx.moveTo(b.w - 6, 40);
    ctx.quadraticCurveTo(b.w + 20, 20, b.w / 2, 30 + drop * 70);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function warrenFace(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = "#161018";
  ctx.beginPath();
  ctx.ellipse(x - 5 * s, y - 1, 3.4 * s, 4.4 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 5 * s, y - 1, 3.4 * s, 4.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 4 * s, y - 2.4 * s, 1.2, 0, Math.PI * 2);
  ctx.arc(x + 6 * s, y - 2.4 * s, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, y + 6 * s, 2.2, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawOrgalorg(ctx: Ctx, b: BossOpts) {
  const body = b.hurt ? "#eaffd4" : "#212637";
  ctx.fillStyle = body;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  // The final form is a looming one-eyed cosmic penguin, not a normal enemy.
  ctx.fillStyle = b.hurt ? "#eaffd4" : "#39445a";
  ctx.beginPath();
  ctx.moveTo(58, 30); ctx.quadraticCurveTo(122, 8, 135, 57);
  ctx.quadraticCurveTo(144, 85, 112, 105);
  ctx.lineTo(80, 98); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(25, 10);
  ctx.bezierCurveTo(65, -12, 115, 18, 114, 67);
  ctx.bezierCurveTo(112, 117, 85, 133, 43, 122);
  ctx.bezierCurveTo(13, 114, 3, 50, 25, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = b.hurt ? "#f4fff4" : "#151d2d";
  ctx.beginPath();
  ctx.ellipse(77, 78, 28, 36, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#619f68";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#a8db88";
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(63 + (i % 3) * 13, 61 + (i % 2) * 21, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.hurt ? "#fff" : "#a9d77b";
  ctx.beginPath();
  ctx.moveTo(12, 60);
  ctx.lineTo(-5, 69);
  ctx.lineTo(18, 73);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = b.hurt ? "#fff" : "#333c4f";
  ctx.beginPath();
  ctx.ellipse(b.w - 6, 55, 16, 10, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eye
  const ex = 22;
  const ey = 42;
  const open = b.open;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ex, ey, 16, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#f7fff4";
  ctx.fillRect(ex - 18, ey - 18, 36, 36);
  ctx.fillStyle = "#acff4a";
  ctx.beginPath();
  ctx.arc(ex, ey, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(ex - 1.4, ey - 7, 3, 14);
  ctx.fillStyle = "#263044";
  ctx.fillRect(ex - 18, ey - 18, 36, 32 * (1 - open));
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ex, ey, 16, 0, Math.PI * 2);
  ctx.stroke();
  if (b.vulnerable) {
    ctx.strokeStyle = "#d6ff4a";
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.65 + Math.sin(b.time * 12) * 0.35;
    ctx.beginPath();
    ctx.arc(ex, ey, 20 + Math.sin(b.time * 10) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // tentacle nubs
  ctx.strokeStyle = b.hurt ? "#fff" : "#435665";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(30, b.h - 8);
  ctx.quadraticCurveTo(10, b.h + 6, 20 + Math.sin(b.time * 2) * 6, b.h + 8);
  ctx.moveTo(70, b.h - 6);
  ctx.quadraticCurveTo(90, b.h + 8, 80, b.h + 10);
  ctx.stroke();
}

export function drawItem(ctx: Ctx, kind: string, x: number, y: number, time: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 4 + x) * 1.5);
  if (kind === "coin") {
    const sx = 0.45 + Math.abs(Math.sin(time * 6 + y)) * 0.55;
    ctx.scale(sx, 1);
    ctx.fillStyle = "#ffe56a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e1a820";
    ctx.font = "800 8px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("c", 0, 3);
  } else if (kind === "gem") {
    ctx.fillStyle = "#ff4f8b";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -2);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3, -1);
    ctx.lineTo(0, 1);
    ctx.fill();
  } else if (kind === "heart") {
    heart(ctx, 0, 2, 8, "#ff4f6a");
  } else {
    rr(ctx, -7, -4, 6, 5, 2, "#f0c84a");
    rr(ctx, 1, -4, 6, 5, 2, "#f0c84a");
    ctx.fillStyle = "#fff";
    ctx.fillRect(-6, -1, 4, 2);
    ctx.fillRect(2, -1, 4, 2);
  }
  ctx.restore();
}

function heart(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.2, y - s * 0.7, x, y - s * 0.2);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.7, x + s, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawFlag(ctx: Ctx, x: number, y: number, world: WorldId, time: number) {
  const pal = PAL[world] ?? PAL.candy;
  ctx.fillStyle = "#f4e2c0";
  ctx.fillRect(x, y - 62, 3, 62);
  ctx.strokeStyle = INK;
  ctx.strokeRect(x, y - 62, 3, 62);
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  const wave = Math.sin(time * 6) * 3;
  ctx.moveTo(x + 3, y - 60);
  ctx.lineTo(x + 22, y - 52 + wave);
  ctx.lineTo(x + 3, y - 42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe56a";
  ctx.beginPath();
  ctx.arc(x + 12, y - 51 + wave * 0.4, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCheckpoint(ctx: Ctx, x: number, y: number, on: boolean, time: number) {
  ctx.fillStyle = on ? "#f0c84a" : "#d7d0c4";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, y - 28, 3, 28);
  ctx.strokeRect(x, y - 28, 3, 28);
  ctx.fillStyle = on ? "#ff5c8a" : "#b9b2a6";
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 28);
  ctx.lineTo(x + 14, y - 23);
  ctx.lineTo(x + 3, y - 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (on) {
    ctx.globalAlpha = 0.5 + Math.sin(time * 5) * 0.2;
    ctx.fillStyle = "#ffe56a";
    ctx.beginPath();
    ctx.arc(x + 2, y - 30, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawProjectile(ctx: Ctx, kind: string, x: number, y: number, w: number, h: number, time: number) {
  ctx.save();
  if (kind === "ice") {
    ctx.fillStyle = "#dff6ff";
    ctx.strokeStyle = "#7eb6d9";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "lemon") {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(time * 6);
    ctx.fillStyle = "#f2e15a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "wave") {
    ctx.strokeStyle = "#f2e15a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h, w / 2, Math.PI, 0);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff3a0";
    ctx.fillRect(x, y, w, h);
  } else if (kind === "meteor") {
    ctx.fillStyle = "#d6ff4a";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHazard(
  ctx: Ctx,
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  warn: number,
  armed: boolean,
  time: number,
) {
  ctx.save();
  if (kind === "circle") {
    const pulse = 0.55 + Math.sin(time * 24) * 0.45;
    ctx.strokeStyle = armed ? "#ff4d4d" : `rgba(255,70,70,${pulse})`;
    ctx.fillStyle = armed ? "rgba(255,70,70,0.35)" : "rgba(255,70,70,0.12)";
    ctx.lineWidth = armed ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r * (armed ? 1 : 0.55 + (1 - warn) * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "beam") {
    if (!armed) {
      ctx.strokeStyle = `rgba(190,255,90,${0.45 + Math.sin(time * 30) * 0.4})`;
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "rgba(214,255,74,0.35)";
      ctx.fillRect(x, y - 4, w, h + 8);
      ctx.fillStyle = "#f4ffe4";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#d6ff4a";
      ctx.strokeRect(x, y, w, h);
    }
  } else {
    ctx.fillStyle = armed ? "rgba(255,80,60,0.4)" : "rgba(255,80,60,0.15)";
    ctx.strokeStyle = "#ff5a3c";
    ctx.setLineDash(armed ? [] : [5, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawTentacle(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, time: number) {
  ctx.save();
  ctx.strokeStyle = "#6f9e3e";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 20 + Math.sin(time * 8) * 6, x2, y2);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = "#d6ff4a";
  ctx.beginPath();
  ctx.arc(x2, y2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export interface ParticleDraw {
  x: number;
  y: number;
  size: number;
  color: string;
  life: number;
  max: number;
  rot: number;
  kind: "circ" | "star" | "sq";
}

export function drawParticle(ctx: Ctx, p: ParticleDraw) {
  const a = Math.max(0, p.life / p.max);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  if (p.kind === "star") {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(ang) * p.size, Math.sin(ang) * p.size);
      ctx.lineTo(Math.cos(ang + Math.PI / 4) * p.size * 0.35, Math.sin(ang + Math.PI / 4) * p.size * 0.35);
    }
    ctx.closePath();
    ctx.fill();
  } else if (p.kind === "sq") {
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawShock(ctx: Ctx, x: number, y: number, r: number, max: number, life: number, color: string) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, life);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r + (1 - life) * max, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawWeather(ctx: Ctx, world: WorldId, time: number) {
  if (world === "ice") {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 36; i++) {
      const x = (i * 47 + time * (18 + (i % 5) * 6)) % VIEW_W;
      const y = (i * 29 + time * (28 + (i % 7) * 4)) % VIEW_H;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  } else if (world === "candy") {
    ctx.fillStyle = "#ff8ab0";
    for (let i = 0; i < 12; i++) {
      const x = (i * 80 + time * 10) % VIEW_W;
      const y = (i * 36 + Math.sin(time + i) * 8) % (VIEW_H * 0.7);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(x, y, 3, 2, time + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (world === "vampire" || world === "space" || world === "ending") {
    const g = ctx.createLinearGradient(0, VIEW_H * 0.55, 0, VIEW_H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, world === "vampire" ? "rgba(40,0,20,0.28)" : "rgba(0,0,0,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, VIEW_H * 0.5, VIEW_W, VIEW_H * 0.5);
  }
}

export function drawJake(ctx: Ctx, x: number, y: number, stretch: number, mood: "happy" | "worry") {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#efb93f";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  rr(ctx, -10, -6, 8, 7, 3, "#efb93f");
  rr(ctx, 2, -6, 8, 7, 3, "#efb93f");
  // Jake's shape is one continuous stretchy yellow body.
  rr(ctx, -16, -31, 32, 29, 11, "#efb93f");
  ctx.fillStyle = "#efb93f";
  ctx.beginPath();
  ctx.ellipse(-11, -31, 4, 7, -0.4, 0, Math.PI * 2);
  ctx.ellipse(11, -31, 4, 7, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#efb93f";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.lineTo(-28 - stretch, -10);
  ctx.moveTo(14, -18);
  ctx.lineTo(28 + stretch * 0.3, -12);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-5, -23, 4, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -23, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-4, -23, 1.5, 0, Math.PI * 2);
  ctx.arc(6, -23, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5c34c";
  ctx.beginPath();
  ctx.ellipse(0, -15, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, -18, 3.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (mood === "happy") {
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(0, -14, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBMO(ctx: Ctx, x: number, y: number, hop: number, mood: "happy" | "worry" | "beep") {
  ctx.save();
  ctx.translate(x, y - hop);
  rr(ctx, -16, -36, 32, 36, 5, "#70c8ba");
  rr(ctx, -12, -31, 24, 18, 3, "#d4efc2", true);
  ctx.fillStyle = INK;
  if (mood === "worry") {
    ctx.fillRect(-7, -26, 2, 3);
    ctx.fillRect(4, -26, 2, 3);
    ctx.beginPath();
    ctx.arc(0, -18, 3, Math.PI + 0.4, -0.4);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-5, -24, 1.6, 0, Math.PI * 2);
    ctx.arc(5, -24, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -20, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = "#e44545";
  ctx.beginPath();
  ctx.arc(5, -7, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6d34a";
  ctx.beginPath();
  ctx.arc(10, -11, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#234d55";
  ctx.fillRect(-10, -9, 9, 2);
  ctx.fillRect(-6.5, -12.5, 2, 9);
  ctx.fillRect(-8, -4, 5, 1);
  ctx.fillStyle = "#222";
  ctx.fillRect(-8, 0, 5, 6);
  ctx.fillRect(3, 0, 5, 6);
  if (mood === "beep") {
    ctx.fillStyle = "#fff";
    ctx.font = "800 10px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("♪", 18, -24);
  }
  ctx.restore();
}

export function drawCrystal(ctx: Ctx, x: number, y: number, crack: number, alpha = 0.45) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#b9ffe0";
  ctx.strokeStyle = "#f4fff8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(26, -12);
  ctx.lineTo(16, 36);
  ctx.lineTo(-16, 36);
  ctx.lineTo(-26, -12);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  if (crack > 0) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = crack;
    ctx.beginPath();
    ctx.moveTo(-4, -20);
    ctx.lineTo(2, -4);
    ctx.lineTo(-6, 12);
    ctx.moveTo(6, -16);
    ctx.lineTo(10, 4);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEnding(ctx: Ctx, t: number, camHint: number) {
  drawWorld(ctx, "ending", camHint, 0, t);
  const w = VIEW_W;
  const h = VIEW_H;
  const final = t >= 8.15;
  let caption = "";
  if (t < 1.3) caption = "O olho cósmico se apaga...";
  else if (t < 2.5) caption = "Um cristal pulsa no vazio.";
  else if (t < 4.1) caption = "Finn! Aqui dentro!";
  else if (t < 5.3) caption = "";
  else if (t < 7.2) caption = "Jake e BMO estão livres!";
  else caption = "Você salvou Jake e o BMO!";

  const groundY = final ? h * 0.38 : h * 0.62;
  if (!final && t > 1.15 && t < 4.15) {
    const crack = t > 3.5 ? (t - 3.5) / 0.6 : 0;
    drawCrystal(ctx, w * 0.56, groundY - 10, crack, 0.5);
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawJake(ctx, w * 0.52, groundY - 8, 4, "worry");
    drawBMO(ctx, w * 0.62, groundY - 4, 0, "worry");
    ctx.restore();
  }

  const finnX = final ? w * 0.36 : t < 2.4 ? -30 : t < 3.7 ? -30 + ((t - 2.4) / 1.3) * (w * 0.34 + 30) : w * 0.34;
  const finnPose = t > 6.4 || final ? "cheer" : t > 3.55 && t < 4.15 ? "run" : "run";
  const attack = !final && t > 3.55 && t < 4.05 ? (t - 3.55) / 0.5 : 0;
  if (t > 2.3 || final) {
    drawFinn(ctx, finnX, groundY - 28, {
      w: 18,
      h: 28,
      facing: 1,
      pose: finnPose,
      time: t,
      attack,
      stretch: attack ? -0.15 : 0,
      alpha: 1,
      socks: true,
      spin: 0,
    });
  }
  if (attack > 0.2) drawSlash(ctx, finnX + 20, groundY - 16, 1, attack);

  if (t > 5.15 || final) {
    const gather = final ? 1 : Math.min(1, (t - 5.15) / 1.1);
    const jx = w * 0.56 - gather * 28;
    drawJake(ctx, jx, groundY, 18 * gather, "happy");
    drawBMO(ctx, w * 0.66 - gather * 8, groundY + 2, Math.abs(Math.sin(t * 8)) * 4, t > 6 ? "beep" : "happy");
  }

  if (t > 4.15 && t < 5.4) {
    for (let i = 0; i < 8; i++) {
      const a = i + t * 4;
      ctx.fillStyle = i % 2 ? "#b9ffe0" : "#ffe56a";
      ctx.globalAlpha = 0.8;
      ctx.fillRect(w * 0.56 + Math.cos(a) * (20 + (t - 4) * 30), groundY - 20 + Math.sin(a) * 20, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  if (caption) {
    drawOutlined(ctx, caption, w / 2, final ? h * 0.72 : h * 0.18, final ? 16 : 13, "#fff6df", '"Lilita One"');
  }
  if (final) {
    drawOutlined(ctx, "ALGÉBRICO!", w / 2, h * 0.8, 12, "#ffe56a", '"Lilita One"');
  }
}

export function drawAttract(ctx: Ctx, time: number) {
  drawWorld(ctx, "candy", time * 12, 0, time);
  for (let x = -1; x < 18; x++) {
    ctx.fillStyle = "#e38b45";
    ctx.fillRect(x * TILE, 232, TILE + 0.5, 56);
    ctx.fillStyle = "#6fcb4e";
    ctx.fillRect(x * TILE, 232, TILE + 0.5, 8);
  }
  const cycle = time % 3.8;
  const jumping = cycle > 1.15 && cycle < 1.7;
  const stomping = cycle > 1.62 && cycle < 2.15;
  const hidden = cycle > 1.85 && cycle < 2.7;
  const finnX = 150 + Math.sin(Math.min(cycle, 1.2) * 2) * 10;
  const finnY = jumping ? 168 - Math.sin(((cycle - 1.15) / 0.55) * Math.PI) * 36 : 204;
  drawCoinSpin(ctx, 210, 150, time);
  drawCoinSpin(ctx, 232, 142, time + 0.4);
  drawCoinSpin(ctx, 254, 150, time + 0.8);
  if (!hidden) {
    drawEnemy(ctx, 250, stomping ? 214 : 210, {
      kind: "penguin",
      w: 22,
      h: 22,
      dir: -1,
      state: "walk",
      time,
      squash: stomping ? 0.85 : 0,
      flash: false,
      alpha: 1,
    });
  } else {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "#ffe56a";
      ctx.globalAlpha = 1 - (cycle - 1.85) / 0.8;
      ctx.fillRect(258 + Math.cos(i) * 12, 200 + Math.sin(i + time * 8) * 10, 3, 3);
      ctx.globalAlpha = 1;
    }
  }
  drawFinn(ctx, finnX, finnY, {
    w: 18,
    h: 28,
    facing: 1,
    pose: jumping ? "jump" : "run",
    time,
    attack: 0,
    stretch: stomping ? 0.28 : jumping ? -0.18 : 0,
    alpha: 1,
    socks: false,
    spin: 0,
  });
  drawEnemy(ctx, 400, 150 + Math.sin(time * 2) * 8, {
    kind: "bat",
    w: 26,
    h: 16,
    dir: -1,
    state: "patrol",
    time,
    squash: 0,
    flash: false,
    alpha: 1,
  });
}

function drawCoinSpin(ctx: Ctx, x: number, y: number, time: number) {
  drawItem(ctx, "coin", x, y, time);
}
