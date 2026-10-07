# Look Up — Product Requirements (PRD)

## 1. One-line pitch
An offline night-sky field guide that sends you outside, helps you find real stars and planets, and slowly takes its own hints away until you don't need the phone.

## 2. Why this fits "Touch Grass"
- The app is useless indoors. Every quest ends with you looking at the real sky.
- It tells you **when** to go out ("best time tonight 9:40"), then gets out of the way.
- Levels remove help step by step. The last level is "phone down".
- Darker skies unlock harder challenges, so the game nudges you away from city lights.

## 3. Why open-weight AI matters here (the post's key argument)
- **No signal under dark skies.** The best stargazing spots (hills, fields, treks) have no network. A cloud AI fails exactly where the app is needed. A local open-weight model keeps working.
- **Your location stays on your phone.** GPS position never leaves the device.
- **Costs nothing to run.** No API key, no per-request bill.
- **Swappable.** Any small GGUF model can replace the default.

## 4. Users
- **Primary:** a curious beginner who knows almost no stars and lives in a light-polluted town.
- **Secondary:** someone on a trek or trip with a dark sky and no network.

## 5. MVP features (must ship by Oct 12)

| # | Feature | What it does | Done when |
|---|---|---|---|
| F1 | Tonight's plan | Lists beginner targets that are up tonight, with direction, height and best time | Shows correct targets for your location and time (check against a known sky app) |
| F2 | Quest card | One target at a time: a puzzle, then hints on request | You can step through hints and mark "Found it" |
| F3 | Point & check | Uses compass + tilt sensors to say "warmer / colder / on target" | Phone pointed at a target shows "on target" within ~10° |
| F4 | Local AI guide | Small open-weight model answers questions using only computed facts | Answers offline (airplane mode) and doesn't invent numbers |
| F5 | Star-count challenge | "How many stars of the Great Square / Pleiades can you see?" → sky darkness score | Saves the score and adjusts difficulty |
| F6 | Levels | Beginner → Explorer → Stargazer; fewer hints each level | Level 3 shows only the puzzle, no direction |
| F7 | Offline install | Installable PWA; works in airplane mode after first load | App + data open with network off |
| F8 | Night mode | Red-on-black UI only | No white screens anywhere |

## 6. Not in the MVP (say so honestly in the post)
- Camera-based star recognition (phone cameras catch few stars; real solution is plate solving, not an LLM).
- Full sky map / AR overlay.
- Accounts, cloud sync, social features.
- Weather or cloud forecast (needs internet).

## 7. Success criteria
- Works on your own Android phone in airplane mode.
- You use it outside on at least one night and log what happened (for the post).
- Model answers stay inside the given facts in your tests.

## 8. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Model too slow on phone | Template hints (already built in `src/ai/guide.js`); AI becomes "Ask the guide" only |
| Compass is inaccurate (phones often are, near metal or before calibration) | Show "within ~15°" ranges; tell user to wave phone in a figure 8 to calibrate |
| Cloudy night on test day | Test whatever targets are visible; write honestly about it |
| iPhone sensor permission quirks | Primary target is Android Chrome; iOS is "best effort" |
