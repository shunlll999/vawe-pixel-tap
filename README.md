# VAWE TAP v0.4 — Adaptive Full Width / Height

## Responsive fix
- All screens measure the actual canvas height; no menu-wide zoom-out or content clipping.
- Layout uses top/bottom anchoring with explicit spacing, so artwork, title, BPM and controls do not overlap.
- On extremely short mobile viewports, menus can scroll vertically; gameplay stays fixed at full viewport height.
- Touch/drag on menus scrolls; taps on release select a button.
- Desktop presentation stays in a centered portrait arcade viewport.

## Run on Mac
```bash
python3 -m http.server 5173 --bind 0.0.0.0
```
Browse `http://localhost:5173`, or on iPhone connected to the same Wi-Fi open `http://<MAC_LAN_IP>:5173/?v=0.4`.

## Adding songs
Place each MP3 + cover in `public/songs/<song-id>/`, add metadata to `public/songs/index.json`, then keep notes in `public/charts/<song-id>.<difficulty>.json`.

---

# VAWE TAP v0.3 — iPhone Edge-to-Edge Fix

## What changed (Nov 8, 2026)

**Fixed:** iPhone 17 screenshot showed internal side gutters because the previous `withMenuLayout()` uniformly shrank the 390×844 menu when the browser viewport was shorter. The new compact scene layouts preserve the **full logical 390px width**, reflow art/title/buttons vertically, and keep square cover art and pixel notes proportional. The game canvas now uses the measured `visualViewport.height` and CSS safe-area paddings. The standalone HTML contains the same fix. Audio and JSON beat sync remain unchanged.

**Tested:** Headless Chromium at 402×630 and 402×650 mobile-sized viewports. Canvas occupied x=0 to the full viewport width, without in-game side letterbox. The bundled HTML progressed Home → Song Select → Difficulty → Gameplay and played audio (1.48s sampled), with no JS page errors. Physical iPhone Safari was not available for device testing.

### IMPORTANT — updating an existing Mac server / iPhone connection

1. Extract `VAWE_TAP_PIXEL_GAME_IPHONE_FULLSCREEN_SOURCE.zip`.
2. Replace the **old** `vawe_pixel_tap` folder entirely, or copy the new `index.html`, `src/main.js`, `src/styles.css`, `manifest.webmanifest`, and `icons/` into your existing project folder.
3. In Terminal, **in the updated `vawe_pixel_tap/` folder**, run `python3 -m http.server 5173 --bind 0.0.0.0`. If an old server is running, stop it with Ctrl+C first.
4. On your iPhone, visit `http://YOUR-MAC-IP:5173/?v=0.3` (e.g. `http://192.168.1.144:5173/?v=0.3` **only if that is still your Mac's IP**). Close the old tab / refresh to avoid old CSS/JS from Safari cache.
5. On the song-select screen, the graphic now extends to both edges **inside the website viewport**. iOS status bar and Safari bottom toolbar are browser UI, not part of the game and cannot be removed with CSS. Hosting via HTTPS and adding the web app to the Home Screen can provide a less obstructed standalone experience.

**Offline one-file demo:** `VAWE_TAP_PLAY_IPHONE_FULLSCREEN.html` contains the audio, cover, and beat charts. If iOS Files Preview restricts HTML/JS, use the project on the LAN server or HTTPS hosting.

---

# VAWE TAP — Pixel Rhythm Arcade (Playable Demo)

เกมกดโน้ต 4 เลนที่เล่นบนเบราว์เซอร์มือถือและคอมพิวเตอร์ได้จริง ใช้เพลงเดโม **รับครับพี่ — wachii** และภาพปกที่แนบมา แสดงโน้ต Pixel Art ขนาดใหญ่ **74 × 51 pixel / ความกว้างเลน 85.5 pixel** (คิดเป็น ~87% ของเลน)

## Start in 1 minute

**Quickest:** Open `VAWE_TAP_PLAY_OFFLINE.html` (supplied separately) in Chrome, Edge or Safari. The song, image and chart data are embedded inside this version; no server is required.

**Editable source project:** Run inside the `vawe_pixel_tap` folder:

- macOS / Linux: `./start.sh`
- Windows: double-click `start.bat`
- Or: `python3 -m http.server 5173`

Then open `http://localhost:5173` on the same machine. A web server is required for the source-project version because it loads JSON with `fetch()`. To play on your phone, deploy the folder to an HTTPS static host (Firebase Hosting, Netlify, etc.). Browsing `localhost` on a computer does not automatically make that address available on another device.

There is **no npm install** and no game-engine runtime required. Stack: **HTML5 Canvas + vanilla JavaScript ES modules + CSS + HTMLAudioElement**. Can later be packaged as a PWA.

## Controls

- **Touch / mouse:** Tap anywhere within the relevant colored lane.
- **Keyboard:** `D` `F` `J` `K` from left to right.
- `Space` or `Esc`: Pause / resume.
- Choose Easy, Normal, Hard before starting.
- Timing Settings: adjust +/− 25 ms (per-device calibration, saved to localStorage); the actual chart note timestamps remain unchanged.

The judgement uses `audio.currentTime` as the clock (not animation time). Perfect ±65 ms; Great ±115 ms; Good ±185 ms. Music pauses when the game pauses or browser loses focus. Some platforms support vibration; it is optional and device-dependent.

## File structure

```text
vawe_pixel_tap/
├─ index.html                # App entry
├─ src/
│  ├─ main.js               # Scenes, UI, input, audio sync, scoring
│  ├─ data.js               # Song registry and chart loader
│  └─ styles.css            # Mobile / desktop presentation
├─ public/
│  ├─ songs/
│  │  ├─ index.json         # Song registry; add each track here
│  │  └─ rap-krap-pee/
│  │     ├─ audio.mp3        # User-supplied song
│  │     ├─ cover.png        # Original user-supplied album art
│  │     ├─ cover_pixel.png  # In-game small pixel version
│  │     └─ meta.json        # Song title, artist, bpm, asset paths
│  └─ charts/
│     ├─ rap-krap-pee.easy.json
│     ├─ rap-krap-pee.normal.json
│     └─ rap-krap-pee.hard.json
├─ screenshots/             # Screen previews
├─ analyze_audio.py         # Optional offline chart generation
├─ requirements-chart-tools.txt
├─ start.sh
└─ start.bat
```

## Add a song later

1. Make `public/songs/new-song/` containing `audio.mp3` and `cover.png`.
2. Optional auto-generate draft beat charts:

   ```bash
   pip install -r requirements-chart-tools.txt
   # Also install FFmpeg and make sure it is in your PATH.
   python analyze_audio.py new-song --title 'New Song' --artist 'Artist Name'
   ```

3. The analyzer writes `new-song.easy.json`, `new-song.normal.json`, and `new-song.hard.json` into `public/charts/`, creates `meta.json`, and updates `public/songs/index.json`.
4. Relaunch or refresh. The song selector supports multiple tracks with previous/next actions.
5. **Important:** This analyzer produces rough, automatically estimated BPM and onset-aligned beat grids, not manually verified note charts. For release-quality note timing, test along to the music and tweak the charts by ear or an audio waveform editor.

Alternatively, create these JSON files yourself; no Python tools are required at game runtime.

## Beat chart JSON example

```json
{
  "version": 1,
  "songId": "new-song",
  "difficulty": "normal",
  "bpm": 128,
  "beatOffset": 0.12,
  "notes": [
    { "time": 1.532, "lane": 0, "type": "tap" },
    { "time": 2.001, "lane": 2, "type": "tap" },
    { "time": 2.470, "lane": 1, "type": "hold", "duration": 0.4 }
  ]
}
```

- `time`: absolute seconds from the beginning of the audio file (after any silence)
- `lane`: `0` (left / D) through `3` (right / K)
- `type`: `tap` or `hold`; holds must be kept pressed until close to the tail time
- `duration`: seconds of a hold note
- `beatOffset`: generator metadata only; timing is determined by each note's `time`
- `bpm`: informational in the game UI; note spawning uses `notes[].time`

Game-wide latency adjustment is set in **Timing Settings**. To permanently fix a chart's sync, edit individual `time` values (or shift all of them by the measured delta).

## Demo limitations

The included Easy, Normal and Hard charts are machine-generated **starter charts** based on the supplied MP3. They are not hand-authored to every rap syllable and may require fine timing and note selection before public release. Multi-song support is data-driven but the first demo ships with one song. This game does not connect to Wiiwave, Firebase, third-party APIs or any account system yet.

The bundled audio and cover are the user-supplied demo assets. Confirm you hold the necessary rights before redistribution or public hosting.


## Responsive UI (v0.2)

- **Portrait phones:** game expands to the full available viewport (`100dvh`), accounting for iOS/Android safe areas.
- **Short phones:** menus scale uniformly to fit; no text/buttons cropped.
- **Tall phones:** the playfield grows vertically, while the hit line and pads remain near the bottom. Notes remain square pixel-art blocks rather than stretched rectangles.
- **Tablets / desktop:** the portrait arcade is centered and scales to available screen height, avoiding distortion.
- **Landscape phones:** the portrait stage stays fully visible in a centered, letterboxed view; portrait is recommended for comfortably sized controls.
- Input coordinates track the actual canvas dimensions; window resize/orientation changes are handled automatically.

Implementation is in `src/styles.css` and `src/main.js` (`resizeCanvas`, `withMenuLayout`). The base game width is 390 logical pixels; game canvas height is calculated from the available CSS dimensions.


## v0.5 Game Over fix

- Life reaching zero on missed tap or early hold release immediately stops the audio and transitions to a GAME OVER results screen.
- Further notes and inputs are ignored until PLAY AGAIN or SONG SELECT.
- Restart restores Life to 100 and resets scoring.
- Music, cover artwork and beat charts remain unchanged.


## v0.6 — Songs & charts from the gateway

Songs and beat charts are no longer read from `public/songs` / `public/charts`. The game calls the wciivawe gateway:

- `GET /tap/songs` → published tracks that have a generated beat (title, artist, cover, audio URL)
- `GET /tap/songs/:trackId/charts` → charts (`easy` / `standard` / `hard`; `standard` = NORMAL in the UI)

Gateway URL: `src/config.js` (production `https://wch0984.wiiwave.com`, `http://localhost:3000` on localhost; override once with `?api=<url>`).
Beats are generated by an admin (button on /admin/tracks/:id in wciivawe.ii → `POST /tap/admin/generate/:trackId`). Swipe notes: swipe the lane in the arrow's direction on touch, or press the arrow keys on keyboard.
**CORS:** add `https://game.wiiwave.com` to the gateway's `FRONTEND_URL` env.
The old `public/` folder and `analyze_audio.py` are no longer used at runtime.
