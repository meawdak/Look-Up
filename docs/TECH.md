# Look Up — Technical Design

## 1. Big picture

```
 GPS + clock ──► Sky engine (astronomy-engine + star data) ──► FACTS (JSON)
                                                                  │
 Compass/tilt ──► Pointing (where is the phone aimed?) ───────────┤
                                                                  ▼
                               Guide: templates  OR  local LLM (wllama + Qwen2.5-0.5B)
                                                                  │
                                                                  ▼
                                                     Short hint on a red-on-black screen
```

**Golden rule:** the sky engine decides *what is true*. The language model only decides *how to say it*. The model never calculates positions and is never asked for facts that aren't in the FACTS JSON.

## 2. Stack

| Part | Choice | Version | Licence | Why |
|---|---|---|---|---|
| App type | PWA (website that installs like an app) | — | — | One codebase for phone + laptop, works offline |
| Build tool | Vite | 8.x | MIT | Fast, simple dev server |
| Offline | vite-plugin-pwa (Workbox) | 2.x | MIT | Generates the service worker (the background script that caches files for offline use) |
| Dev HTTPS | @vitejs/plugin-basic-ssl | 2.x | MIT | Phones only allow GPS/compass on `https://` pages |
| Astronomy | astronomy-engine | 2.1.x | MIT | Sun, Moon, planets, Earth rotation |
| LLM runtime | @wllama/wllama | 3.x | MIT | Runs llama.cpp in the browser via WebAssembly, CPU only (no GPU needed) |
| Model | Qwen2.5-0.5B-Instruct, GGUF Q4_K_M | — | Apache-2.0 | ~491 MB, small enough for phones |
| Language | Plain JavaScript (no React) | — | — | Less to learn, smaller app |

## 3. Folder structure

```
look-up/
├── AGENTS.md              rules for the AI agent in Antigravity
├── index.html
├── vite.config.js
├── public/
│   ├── data/              offline datasets (see DATA_SOURCES.md)
│   └── icons/
├── src/
│   ├── main.js            screens + wiring
│   ├── styles.css         night mode
│   ├── sky/engine.js      alt/az maths, tonight window      (done)
│   ├── sky/targets.js     which targets are up tonight      (done)
│   ├── sensors/pointing.js  compass + tilt                  (Day 3)
│   ├── ai/guide.js        facts, templates, prompt          (done)
│   ├── ai/model.js        load + run wllama                 (Day 4)
│   ├── ai/modelStore.js   download once, keep offline       (Day 4)
│   └── game/progress.js   levels, found targets, sky score  (Day 2/4)
├── tools/                 data build + checks
└── docs/
```

## 4. Key modules

### 4.1 Sky engine (`src/sky/`) — done
- `starAltAz(star, date, observer)` → altitude (height above horizon, degrees) and azimuth (compass direction, degrees: 0 = N, 90 = E).
- `bodyAltAz('Saturn', date, observer)` → same for Sun/Moon/planets.
- `tonightWindow(fn, start, observer)` → first/last time tonight a target is ≥20° high while the Sun is ≥12° below the horizon.
- Star positions are J2000; we skip precession (~0.4°, invisible to the eye).

### 4.2 Pointing (`src/sensors/pointing.js`) — Day 3
- **Android Chrome:** listen to `deviceorientationabsolute`. `alpha` gives compass heading (heading = `360 - alpha`). `beta` gives tilt.
- **iOS Safari:** call `DeviceOrientationEvent.requestPermission()` from a button tap, then use `event.webkitCompassHeading`.
- Phone held upright, screen facing you, back camera toward the sky: **pointing altitude ≈ `beta - 90`**.
- Compare with the target's alt/az → angular distance → "warmer / colder / on target (<10°)".
- Smooth readings (average of the last ~10 values); compasses are jumpy.
- Known catch: `360 - alpha` is exact only when the phone is flat. Held upright, the reading can jump. If that happens, compute the back-camera direction from the full alpha/beta/gamma rotation instead.
- Must be tested on a real phone; the laptop has no compass.

### 4.3 Local AI guide (`src/ai/`) — Day 4
1. **Download once:** `modelStore.js` fetches the GGUF file from Hugging Face with a progress bar, saves it in Cache Storage, and calls `navigator.storage.persist()` so the browser doesn't delete it.
2. **Load:** read the file back as a `Blob` and pass it to `wllama.loadModel([blob])`.
3. **Ask:** `wllama.createChatCompletion({ messages: buildMessages(facts, question), max_tokens: 80, temperature: 0.3 })`.
4. **Fallback:** if download hasn't happened or the device is too slow, use `templateHint()`.

Model URL:
`https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf`

Notes:
- The model is **not** precached by the service worker (too big, ~491 MB). The user taps "Download guide for offline use" on Wi-Fi.
- wllama runs single-threaded unless the site sends `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers. GitHub Pages can't send them, so expect single-thread speed there. That's acceptable for 1–2 sentence answers.
- 4 GB RAM laptop: close other tabs while testing. A 0.5B model should fit, but measure it rather than assume.

### 4.4 Star-count challenge (F5)
- For the Great Square or Pleiades, show the target stars sorted by magnitude (brightness number; **lower = brighter**).
- User picks how many they can see.
- Faintest magnitude counted ≈ the sky's "limiting magnitude". Map to a 1–10 difficulty score and store it.
- Same idea as the Globe at Night citizen-science project.

## 5. Data flow for one quest
1. `planTonight()` → list of targets with `now` and `window`.
2. User opens one → `buildFacts()` makes the FACTS JSON.
3. Hints come from templates (level-based) or the model (questions).
4. "Found it" → `progress.js` records it, unlocks `requires` chains (e.g. Sirius after Orion's Belt).

## 6. Storage

| What | Where | Note |
|---|---|---|
| App + data | Service worker cache | Automatic |
| Model file | Cache Storage (own key) | Manual download button |
| Location, progress, sky score | localStorage | Wrap in try/catch; can be blocked |

## 7. Testing checklist
- `npm run check-data` passes.
- Compare tonight's list against Stellarium Web for the same place/time.
- Airplane mode on phone: app opens, list shows, guide answers.
- Pointing: aim at a known bright object; "on target" appears.
- Ask the model something not in the facts → it should say it's not sure.

## 8. Deploy
- `npm run build` → `dist/` folder.
- Host on GitHub Pages (free, HTTPS). `base: './'` in `vite.config.js` makes it work from a sub-folder.
