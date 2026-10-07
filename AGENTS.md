# Rules for AI agents working on Look Up

Read `docs/PRD.md`, `docs/TECH.md` and `docs/UI_UX.md` before making changes. `docs/PLAN.md` says what to build today.

## About the developer
- A student still learning programming. Explain changes in simple words, and briefly define jargon.
- After each task, say: what changed, why, and how to check it works.
- Prefer simple, readable code over clever code.

## Hard rules
1. **Plain JavaScript + Vite only.** No React, no TypeScript, no CSS frameworks, no new dependencies without asking first.
2. **Offline first.** Never add a feature that needs the internet at runtime, except the one-time model download in `src/ai/modelStore.js`. No CDNs, no web fonts, no analytics.
3. **The model never makes facts.** All sky positions, times, distances and brightness come from `src/sky/` and `public/data/`. The LLM only rephrases the FACTS JSON from `buildFacts()`. Don't let it calculate anything.
4. **Night mode only.** Use the CSS variables in `src/styles.css`. No white, grey or blue colours, no bright images.
5. **Don't edit `public/data/*.json` by hand** except `targets.json`. Rebuild the others with `tools/build_data.py`.
6. **Keep `src/sky/` pure:** no DOM, no `fetch`, so it can be tested with Node.
7. **Guard `localStorage`** with try/catch. It can be blocked.
8. **Sensors need HTTPS and a user tap** (iOS). Never request permission on page load.
9. Don't invent API names. If unsure how a library works, check its README in `node_modules/<pkg>/README.md`.

## Checks before saying a task is done
- `npm run check-data` passes.
- `npm run build` passes with no errors.
- The feature was opened in the browser and works (say what you clicked).
- For sky changes: compare one result with Stellarium Web for the same place and time.

## Style
- Small files, one job each. Comments explain *why*, not *what*.
- User-facing text: max 2 short sentences, plain words, ends with an action ("Look up now.").
