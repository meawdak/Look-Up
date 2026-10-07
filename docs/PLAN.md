# Build plan — deadline Mon 12 Oct 2026, 12:29 IST

Tick items as you go. Each day ends with something that works.

## Day 1 — Wed 7 / Thu 8 Oct: run the skeleton
- [x] Datasets built and checked
- [x] Sky engine + "Tonight" list (done in starter)
- [ ] Open in Antigravity, `npm install`, `npm run dev`
- [ ] Open on laptop: `https://localhost:5173` (accept the certificate warning)
- [ ] Open on phone (same Wi-Fi): `https://<laptop-IP>:5173`, allow location
- [ ] Compare the list with Stellarium Web for your place and time
- [ ] Create GitHub repo, first commit, add MIT LICENSE

## Day 2 — Thu 8 Oct: quests and progress
- [ ] S2 Quest screen (puzzle, hints one by one, "I found it")
- [ ] S5 Found screen with 30-second "phone away" timer
- [ ] `src/game/progress.js`: found targets, level, unlock `requires`
- [ ] Night-mode check: no white anywhere

## Day 3 — Fri 9 Oct: point & check
- [ ] `src/sensors/pointing.js` (Android first)
- [ ] S3 screen: warmer/colder + arrows + vibration
- [ ] Test outside on a bright target (a planet or Vega)

## Day 4 — Sat 10 Oct: local AI guide
- [ ] `src/ai/modelStore.js`: download with progress, cache, `storage.persist()`
- [ ] `src/ai/model.js`: load into wllama, ask with `buildMessages()`
- [ ] S4 Ask screen + quick chips
- [ ] Airplane-mode test on phone; time an answer (write the number down for the post)
- [ ] S6 sky-darkness check

## Day 5 — Sun 11 Oct: deploy + go outside
- [ ] Build, deploy to GitHub Pages
- [ ] Install to home screen, airplane mode, go outside
- [ ] Fill in `docs/FIELD_LOG.md` honestly (what worked, what didn't)
- [ ] Screenshots / short screen recording (use phone's red mode)

## Day 6 — Mon 12 Oct morning: write and submit (before 12:29)
- [ ] Write the DEV post from `docs/POST_OUTLINE.md`
- [ ] Final README, links, licence credits
- [ ] Submit by ~11:30 to leave a buffer

## Cut list (drop in this order if late)
1. Sky-darkness check (S6)
2. iOS support
3. Level 3
Never cut: the outside test and the post. Writing quality is weighted most heavily.
