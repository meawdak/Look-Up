# Data sources

All data ships inside the app (`public/data/`), so it works offline.

| File | Size | What's in it | Source | Licence |
|---|---|---|---|---|
| `stars.json` | ~210 KB | 1,637 stars brighter than magnitude 5.0: id (Hipparcos number), name, label, RA/Dec (degrees, J2000), magnitude, constellation, spectral type, colour index, distance (light years) | [HYG Database v4.1](https://codeberg.org/astronexus/hyg) by astronexus | CC BY-SA 4.0 |
| `constellations.json` | ~45 KB | 89 constellation stick figures (Serpens is in two parts) with centre point; each line point is linked to a star id where one is within 0.25° | [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn | BSD-3-Clause |
| `targets.json` | small | 11 hand-written beginner targets: puzzle, hints, fact after finding | Written for this project | MIT (same as code) |

Planets, Sun and Moon are not stored. `astronomy-engine` (MIT) calculates them live.

## Field meanings
- **Magnitude (`mag`)**: brightness. Lower = brighter. Sirius is −1.44; the faintest stars a city sky shows are around 3–4.
- **RA / Dec**: a star's fixed address on the sky (like longitude/latitude for the sky).
- **`ly`**: distance in light years from the catalogue. For very distant stars this is uncertain (based on tiny parallax angles). Treat values over ~1,000 ly as rough.
- **`ci`**: colour index (B−V). Higher = redder (Betelgeuse 1.5), near 0 = white/blue.

## Rebuilding
```bash
# download into any folder, e.g. raw/
curl -L -o raw/hyg.csv https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv
curl -L -o raw/lines.json https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json
curl -L -o raw/cnames.json https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json
python3 tools/build_data.py raw public/data
npm run check-data
```

## Attribution (keep this in the README and the post)
- Star data: HYG Database (astronexus), CC BY-SA 4.0. Our derived `stars.json` is shared under the same licence.
- Constellation lines: d3-celestial © 2015 Olaf Frohn, BSD-3-Clause.
