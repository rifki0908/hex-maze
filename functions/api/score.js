// Cloudflare Pages Function: KV-backed leaderboard for Hex Maze
// GET  /api/score?mode=classic|daily  →  top 100
// POST /api/score                      →  submit score

const TOP_N = 100;
const MAX_NAME_LEN = 20;
const MAX_SCORE = 10_000_000;
const MAX_MOVES = 100_000;
const MAX_DURATION_MS = 86_400_000;
const SUBMIT_COOLDOWN_MS = 2_000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function sanitizeName(s) {
  return String(s || "Anonim")
    .replace(/[^\p{L}\p{N}\s_\-.]/gu, "")
    .trim()
    .slice(0, MAX_NAME_LEN) || "Anonim";
}

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function keyFor(mode, day) {
  if (mode === "daily") return `lb:daily:${day || todayUTC()}`;
  return "lb:classic";
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "daily" ? "daily" : "classic";
  const day = url.searchParams.get("day") || todayUTC();
  const key = keyFor(mode, day);
  const raw = await env.LEADERBOARD.get(key);
  const list = raw ? JSON.parse(raw) : [];
  return json({ ok: true, mode, day, count: list.length, scores: list.slice(0, TOP_N) });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

  const name = sanitizeName(body.name);
  const score = Math.floor(Number(body.score) || 0);
  const level = Math.floor(Number(body.level) || 0);
  const mode = body.mode === "daily" ? "daily" : "classic";
  const day = mode === "daily" ? (body.day || todayUTC()) : null;
  const moves = Math.floor(Number(body.moves) || 0);
  const durationMs = Math.floor(Number(body.durationMs) || 0);

  if (score < 0 || score > MAX_SCORE) return json({ ok: false, error: "score range" }, 400);
  if (moves < 0 || moves > MAX_MOVES) return json({ ok: false, error: "moves range" }, 400);
  if (durationMs < 0 || durationMs > MAX_DURATION_MS) return json({ ok: false, error: "duration range" }, 400);

  // Per-IP cooldown
  const ip = request.headers.get("CF-Connecting-IP") || "x";
  const ipKey = `rl:${ip}`;
  const lastTs = parseInt((await env.LEADERBOARD.get(ipKey)) || "0", 10);
  const now = Date.now();
  if (now - lastTs < SUBMIT_COOLDOWN_MS) return json({ ok: false, error: "slow down" }, 429);
  await env.LEADERBOARD.put(ipKey, String(now), { expirationTtl: 60 });

  const key = keyFor(mode, day);
  const raw = await env.LEADERBOARD.get(key);
  const list = raw ? JSON.parse(raw) : [];

  const entry = { name, score, level, moves, durationMs, ts: now };

  // Best-per-name dedup
  const filtered = list.filter(e => e.name !== name || e.score > score);
  filtered.push(entry);
  filtered.sort((a, b) => b.score - a.score || a.durationMs - b.durationMs || a.moves - b.moves);
  const trimmed = filtered.slice(0, TOP_N);
  const rank = trimmed.findIndex(e => e.ts === entry.ts && e.name === entry.name) + 1;

  const opts = mode === "daily" ? { expirationTtl: 7 * 24 * 60 * 60 } : undefined;
  await env.LEADERBOARD.put(key, JSON.stringify(trimmed), opts);

  return json({ ok: true, rank: rank || null, total: trimmed.length, mode, day });
}
