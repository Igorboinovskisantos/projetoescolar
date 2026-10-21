export interface ScoreRow {
  id: string;
  name: string;
  score: number;
  stage: string;
  bosses: number;
  won: boolean;
  date: number;
}

const KEY = "finn-ooo-scores-v1";

function valid(row: unknown): row is ScoreRow {
  if (!row || typeof row !== "object") return false;
  const r = row as ScoreRow;
  return (
    typeof r.name === "string" &&
    typeof r.score === "number" &&
    Number.isFinite(r.score) &&
    typeof r.stage === "string" &&
    typeof r.date === "number"
  );
}

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid).sort((a, b) => b.score - a.score || a.date - b.date).slice(0, 8);
  } catch {
    return [];
  }
}

export function qualifies(score: number) {
  if (score <= 0) return false;
  const list = loadScores();
  return list.length < 8 || score >= list[Math.min(7, list.length - 1)].score;
}

export function saveScore(row: Omit<ScoreRow, "id" | "date"> & { date?: number }) {
  const list = loadScores();
  const entry: ScoreRow = {
    id: `${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    name: row.name.slice(0, 10) || "FINN",
    score: Math.floor(row.score),
    stage: row.stage,
    bosses: row.bosses,
    won: row.won,
    date: row.date ?? Date.now(),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.date - b.date);
  const next = list.slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return { list: next, id: entry.id, rank: next.findIndex((s) => s.id === entry.id) + 1 };
}
