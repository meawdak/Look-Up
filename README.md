# Look Up 🔭

An offline night-sky field guide. Phone down, look up.

Live: LIVE_URL_HERE

Look Up tells you what's worth seeing tonight from where you stand, sends you outside to find it, and gives fewer hints the better you get, until you don't need the phone at all. A small open-weight language model runs on your device as the guide, so it keeps working under dark skies with no signal.

Built for the DEV "Touch Grass" challenge (Hacktoberfest 2026).

## Features
- **Tonight's plan:** beginner targets that are up tonight, with direction, height and best time.
- **Quests:** a puzzle first ("three bright stars in a big triangle"), hints only if you ask.
- **Point & check:** compass + tilt guide you to the target with warmer/colder feedback.
- **Local AI guide:** Qwen2.5-0.5B via wllama, fully in the browser, answers only from computed sky facts.
- **Installable + offline:** PWA with red-on-black night mode to protect dark adaptation.

## How to run
Needs Node.js 20.19+ or 22.12+ (check with `node -v`).

```bash
npm install
npm run dev
```
- Laptop: open `https://localhost:5173` and accept the certificate warning (it is a local development certificate).
- Phone on the same Wi-Fi: open the `Network:` address printed in the terminal.

Other commands:
```bash
npm test            # runs pointing maths & guide tests
npm run check-data  # verifies the datasets
npm run build       # production build in dist/
npm run preview     # serve the production build locally
```

## How it works
The sky engine (`astronomy-engine` + star catalogue) computes positions and facts. The language model only rephrases facts and is strictly validated against sky data. See [`docs/TECH.md`](docs/TECH.md).

## Licences & Third-Party Notices
- **Star data:** [HYG Database](https://codeberg.org/astronexus/hyg) by astronexus, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- **Constellation lines:** [d3-celestial](https://github.com/ofrohn/d3-celestial) © 2015 Olaf Frohn, licensed under [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause)
- **Model:** [Qwen2.5-0.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) by Alibaba Cloud, licensed under [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **Dependencies:** [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT), [@wllama/wllama](https://github.com/ngxson/wllama) (MIT)
- **Application Code:** [MIT License](LICENSE)

For full licence texts, see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`LICENSE`](LICENSE).
