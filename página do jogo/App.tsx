import { useEffect, useRef, useState, type ReactNode } from "react";
import { audio } from "./game/audio";
import { drawAttract } from "./game/draw";
import { OooGame } from "./game/engine";
import { loadScores, qualifies, saveScore, type ScoreRow } from "./game/scores";
import type { BannerState, BossKind, GameHooks, HudState, OverlayState, WorldId } from "./game/types";

const BOSS_LABEL: Record<BossKind, string> = {
  iceking: "Rei Gelado",
  lemongrab: "Conde Limãograb",
  warren: "Warren Ampersand",
  orgalorg: "Orgalorg",
};
const BOSS_ORDER: BossKind[] = ["iceking", "lemongrab", "warren", "orgalorg"];
const BOSS_KEY = "finn-ooo-bosses-v1";

function loadBosses(): Partial<Record<BossKind, number>> {
  try {
    const raw = localStorage.getItem(BOSS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Record<BossKind, number>> = {};
    for (const k of BOSS_ORDER) {
      const v = (parsed as Record<string, unknown>)[k];
      if (typeof v === "number") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

const INITIAL_HUD: HudState = {
  score: 0,
  lives: 3,
  maxLives: 6,
  coins: 0,
  combo: 0,
  stage: 1,
  stages: 8,
  worldName: "Colinas de Doce",
  world: "candy",
  muted: false,
  socks: false,
  held: false,
  powers: [],
  element: null,
  shield: false,
  shieldEnergy: 1,
  boss: null,
};

function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useCountUp(target: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function Attract() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = 512 * dpr;
    canvas.height = 288 * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    const loop = (now: number) => {
      drawAttract(ctx, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="attract" aria-hidden />;
}

function Hats({ n }: { n: number }) {
  const show = Math.min(5, Math.max(0, n));
  return (
    <span className="hats" aria-label={`${n} vidas`}>
      {Array.from({ length: show }, (_, i) => (
        <i key={i} className="hat" />
      ))}
      {n > 5 && <b>x{n}</b>}
      {n <= 0 && <b>0</b>}
    </span>
  );
}

function HoldButton({
  className,
  label,
  onHold,
  onTap,
  children,
}: {
  className: string;
  label: string;
  onHold: (down: boolean) => void;
  onTap?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
        onTap?.();
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onLostPointerCapture={() => onHold(false)}
    >
      {children}
      <small>{label}</small>
    </button>
  );
}

function ScoreTable({ rows, highlight }: { rows: ScoreRow[]; highlight?: string }) {
  if (!rows.length) {
    return <p className="empty">Nenhuma aventura ainda. Seja o primeiro herói do mural.</p>;
  }
  return (
    <table className="scores">
      <thead>
        <tr>
          <th>#</th>
          <th>Nome</th>
          <th>Pontos</th>
          <th>Fase</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.id} className={row.id === highlight ? "fresh" : i === 0 ? "gold" : ""}>
            <td>{i + 1}</td>
            <td>
              {row.name} {row.won ? "★" : ""}
            </td>
            <td>{row.score.toLocaleString("pt-BR")}</td>
            <td>{row.stage}</td>
            <td>{new Date(row.date).toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [mode, setMode] = useState<"menu" | "howto" | "scores" | "run">("menu");
  const [overlay, setOverlay] = useState<OverlayState>({ type: "none" });
  const [hud, setHud] = useState<HudState>({ ...INITIAL_HUD, muted: audio.muted });
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>(() => loadScores());
  const [name, setName] = useState("FINN");
  const [rankNote, setRankNote] = useState("");
  const [lastId, setLastId] = useState("");
  const [runId, setRunId] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [bossesReached, setBossesReached] = useState<Partial<Record<BossKind, number>>>(() => loadBosses());
  const [touchOn, setTouchOn] = useState(() => {
    try {
      const saved = localStorage.getItem("finn-ooo-touch");
      if (saved === "1") return true;
      if (saved === "0") return false;
    } catch {
      /* ignore */
    }
    return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 860;
  });
  const [portrait, setPortrait] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<OooGame | null>(null);
  const hooksRef = useRef<GameHooks>({
    onHud: () => {},
    onOverlay: () => {},
    onBanner: () => {},
    requestRestart: () => {},
    onBossReached: () => {},
  });
  const savedRef = useRef(false);
  const overlayRef = useRef(overlay);
  const nameRef = useRef(name);
  overlayRef.current = overlay;
  nameRef.current = name;

  const commitScore = () => {
    const current = overlayRef.current;
    if (savedRef.current) return;
    if (current.type !== "gameover" && current.type !== "victory") return;
    savedRef.current = true;
    if (!qualifies(current.stats.score)) return;
    const result = saveScore({
      name: nameRef.current.trim() || "FINN",
      score: current.stats.score,
      stage: current.stats.stage,
      bosses: current.stats.bosses,
      won: current.stats.won,
    });
    setScores(result.list);
    setLastId(result.id);
    setRankNote(result.rank === 1 ? "Novo recorde!" : result.rank > 0 ? `Top ${result.rank}!` : "");
  };

  hooksRef.current = {
    onHud: (next) => setHud(next),
    onOverlay: (next) => {
      if (next.type === "gameover" || next.type === "victory") savedRef.current = false;
      setOverlay(next);
    },
    onBanner: (next) => setBanner(next),
    requestRestart: () => {
      commitScore();
      gameRef.current?.restart();
      setRankNote("");
    },
    onBossReached: (boss, levelIndex) => {
      setBossesReached((prev) => {
        if (prev[boss] === levelIndex) return prev;
        const next = { ...prev, [boss]: levelIndex };
        try {
          localStorage.setItem(BOSS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
  };

  useEffect(() => {
    if (mode !== "run") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new OooGame(canvas, () => hooksRef.current, startIndex);
    gameRef.current = game;
    game.start();
    return () => {
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [mode, runId]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 2500);
    return () => window.clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    if (mode === "run" && hud.stage === 1 && overlay.type === "none") {
      setHintOn(true);
      const t = window.setTimeout(() => setHintOn(false), 5400);
      return () => window.clearTimeout(t);
    }
    setHintOn(false);
    return undefined;
  }, [mode, hud.stage, overlay.type, runId]);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
    const apply = () => setPortrait(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const startRef = useRef((_index = 0) => {});
  startRef.current = (index = 0) => {
    audio.unlock();
    audio.click();
    setOverlay({ type: "none" });
    setBanner(null);
    setRankNote("");
    setStartIndex(index);
    setMode("run");
    setRunId((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (mode === "menu" && (e.code === "Enter" || e.code === "Space")) {
        e.preventDefault();
        startRef.current();
      }
      if ((mode === "howto" || mode === "scores") && e.code === "Escape") setMode("menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const setTouch = (on: boolean) => {
    setTouchOn(on);
    try {
      localStorage.setItem("finn-ooo-touch", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const toggleMute = () => {
    if (gameRef.current) {
      setHud((h) => ({ ...h, muted: gameRef.current?.toggleMute() ?? h.muted }));
    } else {
      setHud((h) => ({ ...h, muted: audio.toggleMute() }));
    }
    audio.click();
  };

  const backToMenu = () => {
    commitScore();
    audio.click();
    gameRef.current?.destroy();
    gameRef.current = null;
    audio.setPaused(false);
    setMode("menu");
    setOverlay({ type: "none" });
    setScores(loadScores());
  };

  const best = scores[0]?.score ?? 0;
  const world: WorldId = mode === "run" ? hud.world : "candy";
  const showHud = mode === "run" && overlay.type !== "ending" && overlay.type !== "victory";

  return (
    <div className="app" data-world={world} data-mode={mode}>
      <div className="sky-bubbles" aria-hidden>
        <i />
        <i />
        <i />
      </div>

      {mode !== "run" && (
        <div className="menu-wrap">
          <header className="title-block">
            <p className="eyebrow">Cartucho de Ooo</p>
            <h1>FINN</h1>
            <p className="sub">Herói de Ooo</p>
            <p className="tag">Salve Jake e o BMO antes que o Orgalorg engula o céu.</p>
          </header>

          {mode === "menu" && (
            <>
              <div className="bmo">
                <div className="bmo-arm left" />
                <div className="bmo-body">
                  <div className="bmo-screen">
                    <Attract />
                  </div>
                  <div className="bmo-face" aria-hidden>
                    <span className="dpad" />
                    <span className="dots">
                      <i className="red" />
                      <i className="yellow" />
                      <i className="blue" />
                    </span>
                  </div>
                </div>
                <div className="bmo-arm right" />
              </div>
              <ol className="roadmap">
                <li>Rei Gelado</li>
                <li>Limãograb</li>
                <li>Warren</li>
                <li className="final">Orgalorg</li>
              </ol>
              {BOSS_ORDER.some((b) => bossesReached[b] !== undefined) && (
                <section className="boss-select">
                  <p className="eyebrow">Voltar para um chefe</p>
                  <div className="boss-select-row">
                    {BOSS_ORDER.map((b) => {
                      const idx = bossesReached[b];
                      if (idx === undefined) return null;
                      return (
                        <button key={b} className="btn boss-btn" onClick={() => startRef.current(idx)}>
                          {BOSS_LABEL[b]}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              <div className="menu-actions">
                <button className="btn primary big" onClick={() => startRef.current(0)}>
                  Jogar
                </button>
                <button className="btn" onClick={() => { audio.click(); setMode("howto"); }}>
                  Como jogar
                </button>
                <button className="btn" onClick={() => { audio.click(); setScores(loadScores()); setMode("scores"); }}>
                  Recordes
                </button>
              </div>
              <div className="menu-meta">
                <span>Recorde {best.toLocaleString("pt-BR")}</span>
                <button type="button" className="linkish" onClick={toggleMute}>
                  {hud.muted ? "Som off" : "Som on"}
                </button>
                <button type="button" className="linkish" onClick={() => setTouch(!touchOn)}>
                  Toque {touchOn ? "on" : "off"}
                </button>
              </div>
            </>
          )}

          {mode === "howto" && (
            <section className="panel page-panel">
              <h2>Como jogar</h2>
              <div className="howto-grid">
                <div>
                  <h3>Teclado</h3>
                  <ul>
                    <li><kbd>A</kbd> <kbd>D</kbd> ou setas — correr</li>
                    <li><kbd>Espaço</kbd> <kbd>W</kbd> — pular (solte cedo para pulo curto)</li>
                    <li><kbd>Clique Esquerdo</kbd> ou <kbd>J</kbd> <kbd>X</kbd> — bater com a espada</li>
                    <li><kbd>Q</kbd> — lançar bola de fogo ou de gelo (o último poder pego)</li>
                    <li><kbd>F</kbd> — pegar pinguim ou morcego · <kbd>F</kbd> de novo — arremessar</li>
                    <li><kbd>E</kbd> — segurar escudo de folhas (quando desbloqueado)</li>
                    <li><kbd>S</kbd> — descer de plataforma</li>
                    <li><kbd>P</kbd> pausa · <kbd>M</kbd> mudo · <kbd>R</kbd> reinicia</li>
                  </ul>
                </div>
                <div>
                  <h3>Toque e controle</h3>
                  <ul>
                    <li>Botões na tela: mover, pular, espada, Q (poder), F (pegar/jogar)</li>
                    <li>Toque em E para ligar ou desligar o escudo.</li>
                    <li>Segure pular para ir mais alto</li>
                    <li>Gamepad: analógico, A pula, X corta</li>
                  </ul>
                </div>
              </div>
              <h3>Inimigos</h3>
              <ul className="legend">
                <li><b>Pinguins</b> do Rei Gelado andam e viram. Pise ou corte.</li>
                <li><b>Morcegos</b> avisam e mergulham. Pule na hora.</li>
                <li><b>Vampiros</b> brilham antes do avanço. São pesados demais para pegar.</li>
                <li><b>Arremesso (F):</b> pegue um pinguim ou morcego, jogue em outro bicho e atravesse até 3. Em chefes causa 3x o dano da espada, e 2x no Orgalorg (só no olho aberto). Cuidado: o bicho escapa em 6 segundos.</li>
              </ul>
              <h3>Chefes, nesta ordem</h3>
              <ol className="boss-list">
                <li>Rei Gelado — raios de gelo e pinguins</li>
                <li>Conde Limãograb — grito inaceitável</li>
                <li>Warren Ampersand — muda de forma</li>
                <li>Orgalorg — o mais forte. Só o olho aberto toma dano.</li>
              </ol>
              <h3>Caixas de poder</h3>
              <ul className="legend">
                <li><b>Fogo:</b> Q lança bolas de fogo.</li>
                <li><b>Gelo:</b> Q lança gelo que congela inimigos e chefes por 5 segundos.</li>
                <li>Só um elemento por vez: o último poder pego substitui o anterior.</li>
                <li><b>Chefes salvos:</b> ao chegar em um chefe, ele aparece no menu para você voltar direto.</li>
                <li><b>Espada vermelha:</b> causa o dobro de dano nos chefes.</li>
                <li><b>Braço-folha:</b> segure E para bloquear golpes. A energia recarrega ao soltar.</li>
              </ul>
              <p className="tag">Depois do último chefe, Finn salva Jake e o BMO.</p>
              <button className="btn yellow" onClick={() => setMode("menu")}>Voltar</button>
            </section>
          )}

          {mode === "scores" && (
            <section className="panel page-panel">
              <h2>Mural de heróis</h2>
              <ScoreTable rows={scores} highlight={lastId} />
              <button className="btn yellow" onClick={() => setMode("menu")}>Voltar</button>
            </section>
          )}
        </div>
      )}

      {mode === "run" && (
        <div className="bezel">
          <div className="bezel-label">
            <span>BMO</span>
            <span>FINN / OOO</span>
          </div>
          <div className={`screen ${hud.boss ? "boss-screen" : ""}`} data-world={hud.world}>
            <canvas ref={canvasRef} />
            {showHud && (
              <div className="hud">
                <div className="hud-row">
                  <div className="pill">
                    <Hats n={hud.lives} />
                  </div>
                  <div className="pill score">{hud.score.toLocaleString("pt-BR")}</div>
                  <div className="pill coin">c {hud.coins}</div>
                  <div className="pill stage">
                    <strong>{hud.worldName}</strong>
                    <em>{hud.stage}/{hud.stages}</em>
                  </div>
                  <button type="button" className="icon-btn" onClick={toggleMute} aria-label={hud.muted ? "Ativar som" : "Mutar"}>
                    {hud.muted ? "🔇" : "🔊"}
                  </button>
                  <button type="button" className="icon-btn" onClick={() => gameRef.current?.togglePause()} aria-label="Pausar">
                    II
                  </button>
                </div>
                <div className="stage-dots" aria-hidden>
                  {Array.from({ length: hud.stages }, (_, i) => (
                    <i key={i} className={i < hud.stage ? "on" : ""} data-star={i === 2 || i === 4 || i === 6 || i === 7 ? "1" : "0"} />
                  ))}
                </div>
                {hud.powers.length > 0 && (
                  <div className="power-hud" aria-label="Poderes de Finn">
                    {hud.element && <span className={`power-token ${hud.element}`}>{hud.element === "fire" ? "FOGO" : "GELO"}</span>}
                    {hud.powers.includes("demon") && <span className="power-token demon">ESPADA +</span>}
                    {hud.powers.includes("leaf") && (
                      <span className={`power-token leaf ${hud.shield ? "active" : ""}`}>
                        E ESCUDO <i style={{ width: `${hud.shieldEnergy * 100}%` }} />
                      </span>
                    )}
                  </div>
                )}
                {hud.socks && <div className="sock-pill">Jake</div>}
              </div>
            )}
            {banner && !hud.boss && overlay.type === "none" && (
              <div className="banner" key={banner.id}>
                <strong>{banner.title}</strong>
                <span>{banner.subtitle}</span>
                <em>{banner.hint}</em>
              </div>
            )}
            {hintOn && overlay.type === "none" && (
              <div className="control-hint">← → mover · Espaço pular · Clique Esq / J espada · Q poder · F pegar/jogar</div>
            )}
            {portrait && overlay.type === "none" && <div className="rotate-hint">Gire o celular para ver mais Ooo</div>}

            {touchOn && overlay.type === "none" && (
              <div className="touch">
                <div className="cluster">
                  <HoldButton className="pad" label="esq" onHold={(d) => gameRef.current?.hold("left", d)}>◀</HoldButton>
                  <HoldButton className="pad" label="dir" onHold={(d) => gameRef.current?.hold("right", d)}>▶</HoldButton>
                  <HoldButton className="pad slim" label="desce" onHold={(d) => gameRef.current?.hold("down", d)}>▼</HoldButton>
                </div>
                <div className="cluster right">
                  {hud.powers.includes("leaf") && (
                    <HoldButton className={`pad shield-pad ${hud.shield ? "on" : ""}`} label="escudo" onHold={() => {}} onTap={() => gameRef.current?.tap("shield")}>E</HoldButton>
                  )}
                  {hud.element && (
                    <HoldButton
                      className={`pad magic ${hud.element}`}
                      label={hud.element === "fire" ? "fogo" : "gelo"}
                      onHold={() => {}}
                      onTap={() => gameRef.current?.tap("magic")}
                    >
                      Q
                    </HoldButton>
                  )}
                  <HoldButton
                    className={`pad grab ${hud.held ? "on" : ""}`}
                    label={hud.held ? "jogar" : "pegar"}
                    onHold={() => {}}
                    onTap={() => gameRef.current?.tap("grab")}
                  >
                    F
                  </HoldButton>
                  <HoldButton className="pad sword" label="espada" onHold={(d) => gameRef.current?.hold("attack", d)} onTap={() => gameRef.current?.tap("attack")}>
                    <SwordIcon />
                  </HoldButton>
                  <HoldButton className="pad jump" label="pular" onHold={(d) => gameRef.current?.hold("jump", d)} onTap={() => gameRef.current?.tap("jump")}>
                    ↑
                  </HoldButton>
                </div>
              </div>
            )}

            {overlay.type === "pause" && (
              <div className="overlay">
                <div className="panel">
                  <h2>Pausado</h2>
                  <p>Finn segura o chapéu. Ooo espera.</p>
                  <div className="stack">
                    <button className="btn primary" onClick={() => { audio.click(); gameRef.current?.resume(); }}>Continuar</button>
                    <button className="btn yellow" onClick={() => { audio.click(); gameRef.current?.restart(); }}>Reiniciar</button>
                    <button className="btn" onClick={() => setTouch(!touchOn)}>Toque {touchOn ? "ligado" : "desligado"}</button>
                    <button className="btn" onClick={backToMenu}>Menu</button>
                  </div>
                  <p className="fine">R reinicia · Esc continua</p>
                </div>
              </div>
            )}

            {overlay.type === "ending" && (
              <button className="btn skip" onClick={() => gameRef.current?.skipEnding()}>Pular</button>
            )}

            {(overlay.type === "gameover" || overlay.type === "victory") && (
              <EndCard
                overlay={overlay}
                name={name}
                setName={setName}
                rankNote={rankNote}
                scores={scores}
                lastId={lastId}
                onAgain={() => {
                  commitScore();
                  audio.click();
                  gameRef.current?.restart();
                }}
                onMenu={backToMenu}
              />
            )}
          </div>
          {hud.boss && showHud && (
            <div className={`boss-rail ${hud.boss.vulnerable ? "hot" : ""}`} role="status" aria-label={`Vida de ${hud.boss.name}: ${hud.boss.hp} de ${hud.boss.max}`}>
              <div className="boss-rail-head">
                <strong>{hud.boss.name}</strong>
                <span>FASE {hud.boss.phase}</span>
              </div>
              <div className="boss-rail-life">
                <i style={{ width: `${Math.max(0, (hud.boss.hp / hud.boss.max) * 100)}%` }} />
              </div>
              <span className="boss-rail-hint">{hud.boss.hint}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EndCard({
  overlay,
  name,
  setName,
  rankNote,
  scores,
  lastId,
  onAgain,
  onMenu,
}: {
  overlay: Extract<OverlayState, { type: "gameover" | "victory" }>;
  name: string;
  setName: (v: string) => void;
  rankNote: string;
  scores: ScoreRow[];
  lastId: string;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const stats = overlay.stats;
  const shown = useCountUp(stats.score);
  const win = overlay.type === "victory";
  const canSave = qualifies(stats.score) || rankNote !== "";
  return (
    <div className={`overlay ${win ? "victory-overlay" : ""}`}>
      {win && <Confetti />}
      <div className={`panel ${win ? "sheet" : ""}`}>
        <p className="eyebrow">{win ? "Fim da aventura" : "A espada caiu"}</p>
        <h2>{win ? "Jake e BMO salvos!" : "Fim de jogo"}</h2>
        <p>
          {win
            ? "Finn quebrou o cristal. Jake esticou os braços e o BMO soltou um beep feliz."
            : "Ooo ainda precisa de você. Os pinguins não vão se expulsar sozinhos."}
        </p>
        <div className="stat-grid">
          <div><span>Pontos</span><strong>{shown.toLocaleString("pt-BR")}</strong></div>
          <div><span>Moedas</span><strong>{stats.coins}</strong></div>
          <div><span>Abates</span><strong>{stats.kills}</strong></div>
          <div><span>Chefes</span><strong>{stats.bosses}/4</strong></div>
          <div><span>Combo</span><strong>x{stats.maxCombo}</strong></div>
          <div><span>Tempo</span><strong>{formatTime(stats.time)}</strong></div>
        </div>
        {rankNote && <p className="rank-note">{rankNote}</p>}
        {canSave && (
          <label className="name-field">
            Nome no mural
            <input
              value={name}
              maxLength={10}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAgain();
                }
              }}
            />
          </label>
        )}
        {!canSave && stats.score > 0 && <p className="fine">Fora do top 8 desta vez.</p>}
        <div className="stack">
          <button className="btn primary" onClick={onAgain}>Jogar de novo</button>
          <button className="btn" onClick={onMenu}>Menu</button>
        </div>
        <ScoreTable rows={scores} highlight={lastId} />
        <p className="fine">R ou Enter reinicia na hora</p>
      </div>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 26 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 8) * 0.12}s`,
    color: ["#ff4f8b", "#ffd23f", "#7ed6f5", "#b6e354", "#fff"][i % 5],
  }));
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: b.left, animationDelay: b.delay, background: b.color }} />
      ))}
    </div>
  );
}

function SwordIcon() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <path d="M8 24 L20 8" stroke="#1c1a17" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 6 L24 8 L20 14" fill="#e9eef2" stroke="#1c1a17" strokeWidth="2" />
      <rect x="6" y="20" width="8" height="4" rx="1" fill="#e1b21e" stroke="#1c1a17" />
    </svg>
  );
}
