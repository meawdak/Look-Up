# Look Up

Look Up: an offline night-sky field guide. Phone down, look up.  
Built for the DEV Touch Grass challenge (Hacktoberfest 2026).  
Try it: https://lookupsky.netlify.app/

## What it does
- Tells you what is worth seeing tonight from where you stand, with direction, height, and best time.
- Offers puzzle-style quests for night-sky targets, with hints revealed on request.
- Provides Point & check guidance using compass and tilt sensors without using the camera.
- Includes a small open-weight AI guide that runs locally in your browser, completely offline.
- Works offline as an installable progressive web app (PWA).

## Why open-source and open-weight
- Works with no signal under dark skies away from cell towers.
- Location data stays on your device and is never sent to a server.
- Runs without API keys, accounts, or ongoing running costs.
- The model is swappable with any small GGUF model supported by wllama.

## How the AI is kept honest
The sky engine computes positions from catalogue data and decides what is true. The language model only rephrases facts built by code and never calculates coordinates or times. Every AI answer is checked against the sky data and rejected if it contains unknown names or numbers. Quick code answers show first.

## Not built
The following features are not built:
- Camera star recognition
- AR sky map
- Accounts
- Cloud sync
- Weather
- Sky darkness check

Levels 2 and 3 are partly implemented.

## Tech stack

| Component | Technology | Version / Details |
|---|---|---|
| Build tool | Vite | `^8.3.3` |
| PWA support | vite-plugin-pwa | `^2.0.0` |
| Development SSL | @vitejs/plugin-basic-ssl | `^2.3.0` |
| Language | Plain JavaScript | ES modules (no framework, no TypeScript) |
| Astronomy calculations | astronomy-engine | `^2.1.19` |
| On-device LLM runtime | @wllama/wllama | `^3.8.1` |
| Language model | Qwen2.5-0.5B-Instruct GGUF | Q4_K_M quantization (~463 MiB) |
| Star catalogue | HYG Database v4.1 | 1,637 stars (magnitude <= 5.0) |
| Constellation lines | d3-celestial | 89 constellation outlines |

## Requirements
- Node.js: tested with v24.21.0
- npm: tested with 11.19.0
- Browser: Google Chrome (desktop or Android)
- Storage: about 500 MB free storage for the model download
- HTTPS: required for phone sensors and geolocation

## Setup
```bash
git clone https://github.com/meawdak/Look-Up.git
cd Look-Up
npm install
npm run dev
```

Open the HTTPS URL that Vite prints in your terminal. On a phone on the same Wi-Fi, use the laptop's network address printed by Vite. Accept the self-signed certificate warning.

## Commands
- `npm run dev`: Starts the Vite development server with HTTPS and host access.
- `npm test`: Runs unit tests for pointing maths and guide verification.
- `npm run check-data`: Verifies the star, constellation, and target JSON datasets.
- `npm run build`: Bundles the application and generates PWA precache assets in `dist/`.
- `npm run preview`: Serves the production build locally with HTTPS.

## Using it offline
Open the live site while online. Ask one question so the model downloads (~470 MB, stored in the browser Origin Private File System). Install the app to your home screen or desktop. It then works in airplane mode with no internet connection.

## Deploying
Build the project with `npm run build` and deploy the `dist/` directory to Netlify.

The file `public/_headers` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so the model can use multiple threads via WebAssembly and `SharedArrayBuffer`. GitHub Pages cannot set these headers.

## Project structure
```text
look-up/
├── src/            # Application source code
│   ├── ai/         # Model loader and prompt builder for the local AI guide
│   ├── game/       # Progress tracking, level state, and localStorage persistence
│   ├── sensors/    # Device orientation math and vector smoothing
│   └── sky/        # Astronomy calculations and tonight's target planner
├── public/data/    # Verified JSON datasets (stars, constellations, targets)
├── test/           # Test suites for pointing math and guide verification
├── tools/          # Dataset processing and validation scripts
└── docs/           # Documentation (PRD, architecture, UI/UX specs, data sources)
```

## Credits and licences
- **Model:** Qwen2.5-0.5B-Instruct-GGUF by Alibaba Cloud, licensed under Apache-2.0.
- **Star data:** HYG Database v4.1 by astronexus, licensed under CC BY-SA 4.0. The derived star data in `public/data/stars.json` stays CC BY-SA 4.0.
- **Constellation lines:** d3-celestial constellation outlines © 2015 Olaf Frohn, licensed under BSD-3-Clause.
- **astronomy-engine:** astronomy-engine © Don Cross, licensed under MIT.
- **@wllama/wllama:** wllama © NgxSon, licensed under MIT.

For full licence texts, see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Licence
Application code is licensed under the MIT Licence. See [`LICENSE`](LICENSE).
