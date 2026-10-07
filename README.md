# Look Up 🔭

**An offline night-sky field guide. Phone down, look up.**

Look Up tells you what's worth seeing tonight from where you stand, sends you outside to find it, and gives fewer hints the better you get, until you don't need the phone at all. A small open-weight language model runs on your device as the guide, so it keeps working under dark skies with no signal.

Built for the DEV "Touch Grass" challenge (Hacktoberfest 2026).

## Features
- **Tonight's plan:** beginner targets that are up tonight, with direction, height and best time.
- **Quests:** a puzzle first ("three bright stars in a big triangle"), hints only if you ask.
- **Point & check:** compass + tilt say warmer/colder. *(in progress)*
- **Local AI guide:** Qwen2.5-0.5B via wllama, fully in the browser, answers only from computed sky facts. *(in progress)*
- **Sky darkness check:** count stars, get a difficulty score. *(in progress)*
- **Installable + offline**, red-on-black night mode.

## Run it
Needs Node.js 20.19+ or 22.12+ (check with `node -v`).

```bash
npm install
npm run dev
```
- Laptop: open `https://localhost:5173` and accept the certificate warning (it's a local test certificate).
- Phone on the same Wi-Fi: open the `Network:` address that the terminal prints.

Other commands:
```bash
npm run check-data   # verifies the datasets
npm run build        # production build in dist/
npm run preview      # serve the build
```

## How it works
The sky engine (astronomy-engine + star catalogue) decides **what is true**. The language model only decides **how to say it**. See [`docs/TECH.md`](docs/TECH.md).

## Docs
- [PRD](docs/PRD.md) · [Tech](docs/TECH.md) · [UI/UX](docs/UI_UX.md) · [Plan](docs/PLAN.md) · [Data sources](docs/DATA_SOURCES.md)

## Credits
- Star data: [HYG Database](https://codeberg.org/astronexus/hyg), CC BY-SA 4.0
- Constellation lines: [d3-celestial](https://github.com/ofrohn/d3-celestial) © Olaf Frohn, BSD-3-Clause
- [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT), [wllama](https://github.com/ngxson/wllama) (MIT)
- Model: [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) (Apache-2.0)

Code: MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
