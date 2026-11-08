/** Songs + charts come from the wciivawe gateway (GET /tap/songs, GET /tap/songs/:id/charts). */
import { GATEWAY_URL } from './config.js';

// Game difficulty -> API difficulty (the API calls the middle one "standard").
const API_DIFF = { easy: 'easy', normal: 'standard', hard: 'hard' };
const LANE_COLORS = ['#a5ff48', '#61e4fb', '#ffb147', '#ff6eb6'];

async function api(path) {
  let response;
  try {
    response = await fetch(GATEWAY_URL + path, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error(`เชื่อมต่อ gateway ไม่ได้ (${GATEWAY_URL})`);
  }
  if (!response.ok) throw new Error(`โหลดข้อมูลไม่ได้: ${path} (HTTP ${response.status})`);
  return response.json();
}

function toSong(item, index) {
  return {
    id: item.id,
    title: item.title || 'Untitled',
    artist: item.artist || '',
    bpm: Number(item.bpm) || 0,
    duration: Number(item.duration_sec) || 0,
    color: LANE_COLORS[index % LANE_COLORS.length],
    audioUrl: item.audio_url,
    previewUrl: item.preview_url || '', // 15s clip cut at beat-generation time (empty for older songs)
    coverUrl: item.cover_url || '',
    pixelCoverUrl: item.cover_url || '',
    difficulties: item.difficulties || [],
  };
}

export async function getSongLibrary() {
  const items = [];
  let cursor = null;
  do {
    const page = await api(`/tap/songs?limit=50${cursor ? `&startAfter=${encodeURIComponent(cursor)}` : ''}`);
    items.push(...(page.items || []));
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  const songs = items.filter((i) => i.audio_url).map(toSong);
  if (!songs.length) throw new Error('ยังไม่มีเพลงที่สร้าง beat แล้ว (ให้ admin กด generate ที่ wiiwave.com)');
  return songs;
}

const chartCache = new Map(); // songId -> Promise<{charts}>
function fetchCharts(songId) {
  if (!chartCache.has(songId)) {
    const p = api(`/tap/songs/${encodeURIComponent(songId)}/charts`);
    p.catch(() => chartCache.delete(songId));
    chartCache.set(songId, p);
  }
  return chartCache.get(songId);
}

export async function getChart(song, difficulty) {
  const { charts } = await fetchCharts(song.id);
  const byDiff = Object.fromEntries(charts.map((c) => [c.difficulty, c]));
  // Fall back to the nearest available difficulty if one is missing.
  const order = { easy: ['easy', 'standard', 'hard'], normal: ['standard', 'easy', 'hard'], hard: ['hard', 'standard', 'easy'] }[difficulty];
  const chart = order.map((d) => byDiff[d]).find(Boolean);
  if (!chart) throw new Error(`ไม่มี beat chart ของ ${song.title}`);
  const shift = (Number(chart.offsetMs) || 0) / 1000;
  const notes = (chart.notes || []).map((n, i) => ({
    id: i,
    time: Number(n.t) + shift,
    lane: Number(n.lane),
    type: n.type === 'hold' || n.type === 'swipe' ? n.type : 'tap',
    dir: n.type === 'swipe' && ['up', 'down', 'left', 'right'].includes(n.dir) ? n.dir : null,
    duration: n.type === 'hold' ? Number(n.dur || 0) : 0,
    status: 'pending',
  }));
  for (const n of notes) {
    if (!Number.isFinite(n.time) || n.time < 0 || !Number.isInteger(n.lane) || n.lane < 0 || n.lane > 3) {
      throw new Error(`พบโน้ตไม่ถูกต้องใน ${song.title}`);
    }
  }
  notes.sort((a, b) => a.time - b.time);
  return { ...chart, difficulty, notes };
}

// ── Signed-in calls (Bearer Firebase ID token) ──
let tokenGetter = null;
export const setTokenGetter = (fn) => { tokenGetter = fn; };

async function authed(path, options = {}) {
  const token = tokenGetter ? await tokenGetter() : null;
  let response;
  try {
    response = await fetch(GATEWAY_URL + path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error('เชื่อมต่อ gateway ไม่ได้');
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try { const b = await response.json(); if (b?.message) message = Array.isArray(b.message) ? b.message.join(', ') : b.message; } catch {}
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

/** First call after sign-in: the gateway auto-creates the wiiwave.com account (role: listener) if it is new. */
export const registerMember = () => authed('/users/me');

export const getLeaderboard = (song, difficulty) =>
  authed(`/tap/songs/${encodeURIComponent(song.id)}/leaderboard?difficulty=${API_DIFF[difficulty]}`);

export const submitScore = (song, difficulty, r) =>
  authed('/tap/scores', {
    method: 'POST',
    body: JSON.stringify({
      trackId: song.id, difficulty: API_DIFF[difficulty],
      score: r.score, maxCombo: r.maxCombo, perfect: r.perfect, great: r.great, good: r.good, miss: r.miss,
    }),
  });

/** Tell the gateway a song was started from the game (counted as a play, flagged as "via game" for the artist). */
export const recordPlay = (song, difficulty) =>
  authed(`/tap/songs/${encodeURIComponent(song.id)}/play`, { method: 'POST', body: JSON.stringify({ difficulty: API_DIFF[difficulty] }) });
