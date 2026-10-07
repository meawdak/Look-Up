# Look Up — UI / UX

## 1. Design principles
1. **The screen is the shortest part.** Every screen should push you to look away from it.
2. **Protect night vision.** Red on black only. No white flashes, no blue, no bright images. Eyes take 20+ minutes to fully adapt to the dark, and one white screen undoes it.
3. **One thing at a time.** One target, one hint, one button.
4. **Big touch targets.** Cold hands, gloves, dark. Buttons at least 44 px tall.
5. **Plain words.** "Face east, look halfway up", not "Az 92°, Alt 47°".

## 2. Colours and type

| Token | Value | Use |
|---|---|---|
| `--bg` | `#000000` | Background |
| `--text` | `#ff5a46` | Main text, active buttons |
| `--muted` | `#9a3227` | Secondary text, borders |
| `--line` | `#3a120d` | Card borders |
| `--card` | `#0b0302` | Card fill |

- Font: system font (no download needed offline). Body 17 px.
- No images except the star diagrams, drawn in red.

## 3. Screens

### S1. Tonight (home) — built
```
Look Up
26.71°, 88.43° · 7 Oct, 19:30

┌─────────────────────────────┐
│ The Summer Triangle         │
│ [Level 1]  Now: W, high up  │
│ Good 19:30–23:30 · best 19:30│
│ Face W and look high up…    │
└─────────────────────────────┘
┌─────────────────────────────┐
│ Tonight's planet: Saturn    │
│ …                           │
└─────────────────────────────┘
        Phone down. Look up.
```
Tap a card → S2.

### S2. Quest
```
← Tonight            Level 1

  THE SUMMER TRIANGLE
  "Find three bright stars that form
   a big triangle."

  [ Give me a hint ]   (reveals hints one by one)
  [ Point & check ]    → S3
  [ Ask the guide ]    → S4
  [ I found it! ]      → S5
```
- Explorer level hides the direction until the first hint.
- Stargazer level shows only the puzzle line.

### S3. Point & check
```
  Hold the phone up toward the sky.

          ●  COLDER
     (big arrow: ← turn left)
     (small arrow: ↑ tilt up)

  [ Done — I'll look myself ]
```
- Screen dims to the darkest red while pointing.
- Gentle vibration when on target (if supported).
- After "on target": "Now lower the phone and find it with your eyes." Auto-return to S2 after 5 s.

### S4. Ask the guide
```
  Ask about Saturn
  [ What am I looking at? ]   (quick chips)
  [ How far away is it?    ]
  [ type a question…       ]

  Guide: "It's the steady, slightly yellow
  point to the east. Look up from the
  screen and compare it with nearby stars."

  Answers use only the app's sky data.
```
- If the model isn't downloaded: show the template answer plus "Download guide (≈490 MB, Wi-Fi)".

### S5. Found it
```
  ✓ You found the Summer Triangle.

  "The three corners belong to three
   different constellations…"

  Put the phone away for 30 seconds
  and just look.            [30… ]
```
- A 30-second countdown with the screen at minimum brightness. This is the Touch Grass moment.

### S6. Sky darkness check
```
  How dark is your sky?
  Look at the Great Square of Pegasus.
  How many stars can you see INSIDE it?

  ( 0 )  ( 1–2 )  ( 3–5 )  ( 6+ )

  → Sky difficulty: 7/10 (bright town sky)
```

### S7. First run / setup
1. One sentence: what the app does.
2. Location permission (or type it in).
3. Optional: download guide model on Wi-Fi.
4. Tip: "Let your eyes adjust for 10 minutes. Avoid white screens."

## 4. Levels

| Level | Name | What the app shows |
|---|---|---|
| 1 | Beginner | Direction + height + puzzle + hints + Point & check |
| 2 | Explorer | Puzzle + hints. Direction after first hint. |
| 3 | Stargazer | Puzzle only. "Phone down." |

Level goes up after finding 3 targets at the current level.

## 5. Copy rules
- Max 2 sentences per hint.
- Always end with an action: "Look up now."
- Never show raw degrees unless the user taps "details".
