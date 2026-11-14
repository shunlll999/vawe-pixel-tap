/** Tiny synthesized sound effects (Web Audio) — no audio files needed. Call unlock() from a user gesture. */
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Create/resume the AudioContext. Must run inside a pointer/key handler (iOS/Safari rule). */
export const unlock = () => { ensure(); };
export const setMuted = (m) => { muted = !!m; };

function tone({ type = 'square', from, to = from, at = 0, dur = 0.12, gain = 0.5 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ at = 0, dur = 0.3, from = 400, to = 4000, gain = 0.35 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  /** button / menu tap */
  click: () => tone({ type: 'square', from: 880, to: 1320, dur: 0.06, gain: 0.25 }),
  /** screen change: short rising whoosh */
  whoosh: () => { noise({ dur: 0.28, from: 500, to: 5000, gain: 0.3 }); tone({ type: 'triangle', from: 220, to: 660, dur: 0.22, gain: 0.18 }); },
  /** countdown 3 / 2 / 1 (lower pitch for 3, higher for 1) */
  tick: (n = 3) => {
    const f = { 3: 523, 2: 659, 1: 784 }[n] || 523;
    tone({ type: 'square', from: f, dur: 0.16, gain: 0.35 });
    tone({ type: 'triangle', from: f / 2, dur: 0.2, gain: 0.3 });
  },
  /** countdown finished — the song starts */
  go: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', from: f, at: i * 0.05, dur: 0.28, gain: 0.3 }));
    noise({ dur: 0.45, from: 800, to: 7000, gain: 0.3 });
  },
  /** run finished (results) */
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', from: f, at: i * 0.09, dur: 0.2, gain: 0.28 })),
  /** game over */
  lose: () => { tone({ type: 'sawtooth', from: 330, to: 110, dur: 0.6, gain: 0.3 }); tone({ type: 'square', from: 165, to: 55, dur: 0.7, gain: 0.25 }); },
};
