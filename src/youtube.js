/**
 * YouTube IFrame player used as the song source for "YouTube songs".
 * The video plays in a <div> *behind* the game canvas (cross-origin iframes cannot be drawn into a canvas);
 * the canvas draws the notes over it with some transparency.
 */
let apiPromise = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch {} resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiPromise = null; reject(new Error('โหลด YouTube player ไม่ได้')); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function createYoutube(host) {
  let player = null;
  let ready = null; // Promise<player>
  let videoId = null;
  let state = -1; // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  let dur = 0;
  let lastYt = 0;
  let lastAt = 0;
  let seekAt = 0; // while a seek settles, getCurrentTime() may still report the old position
  let onError = () => {};
  let onEnded = () => {};

  function ensure() {
    if (ready) return ready;
    ready = loadApi().then(() => new Promise((resolve) => {
      const el = document.createElement('div');
      host.appendChild(el);
      player = new window.YT.Player(el, {
        width: '100%', height: '100%',
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, cc_load_policy: 0, origin: location.origin },
        events: {
          onReady: () => resolve(player),
          onStateChange: (e) => {
            state = e.data;
            if (state === 1 || state === 5) { try { dur = player.getDuration() || dur; } catch {} }
            if (state === 0) onEnded();
          },
          onError: (e) => onError(e.data),
        },
      });
    }));
    return ready;
  }

  const call = (fn) => (player ? (() => { try { return fn(player); } catch { return undefined; } })() : undefined);

  return {
    set onError(fn) { onError = fn; },
    set onEnded(fn) { onEnded = fn; },
    /** load (cue) a video without playing it */
    async load(id) {
      await ensure();
      if (videoId !== id) {
        videoId = id; dur = 0; lastYt = 0; state = -1;
        player.cueVideoById({ videoId: id, startSeconds: 0 });
      }
    },
    play() { call((p) => p.playVideo()); },
    pause() { call((p) => p.pauseVideo()); },
    seek(t) { if (state === 0) state = 3; lastYt = t; lastAt = seekAt = performance.now(); call((p) => p.seekTo(t, true)); },
    mute(m) { call((p) => (m ? p.mute() : p.unMute())); },
    setVolume(v) { call((p) => p.setVolume(Math.round(Math.max(0, Math.min(1, v)) * 100))); },
    get playing() { return state === 1; },
    get ended() { return state === 0; },
    get duration() { return dur || call((p) => p.getDuration()) || 0; },
    /**
     * Playhead in seconds. getCurrentTime() only updates a few times per second, so between updates we
     * extrapolate with the frame clock (and snap back as soon as the player reports a new value).
     */
    time(now = performance.now()) {
      const y = call((p) => p.getCurrentTime());
      if (typeof y !== 'number') return lastYt;
      if (now - seekAt < 700 && Math.abs(y - lastYt) > 0.6) return lastYt + (now - lastAt) / 1000;
      if (state !== 1) { lastYt = y; lastAt = now; return y; }
      if (y !== lastYt) { lastYt = y; lastAt = now; return y; }
      return lastYt + Math.min(0.3, (now - lastAt) / 1000);
    },
  };
}
