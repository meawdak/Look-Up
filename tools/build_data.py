"""Build the small offline datasets for Look Up.

Inputs (download first, see DATA_SOURCES.md):
  hyg.csv       HYG star database v4.1 (CC BY-SA 4.0)
  lines.json    d3-celestial constellations.lines.json (BSD-3)
  cnames.json   d3-celestial constellations.json (BSD-3)
Usage: python3 build_data.py <raw_dir> <out_dir>
"""
import csv, json, math, sys, os

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
MAG_LIMIT = 5.0          # faintest star kept (naked eye under decent skies)
PC_TO_LY = 3.26156

stars = []
with open(os.path.join(raw, "hyg.csv"), newline="") as f:
    for r in csv.DictReader(f):
        if r["proper"] == "Sol" or not r["mag"]:
            continue
        mag = float(r["mag"])
        if mag > MAG_LIMIT:
            continue
        dist_pc = float(r["dist"]) if r["dist"] else None
        # HYG uses 100000 pc as "unknown distance"
        ly = round(dist_pc * PC_TO_LY) if dist_pc and dist_pc < 100000 else None
        label = (r["bayer"] or r["flam"] or "") + (" " + r["con"] if r["con"] else "")
        stars.append({
            "id": int(r["hip"]) if r["hip"] else None,
            "name": r["proper"] or None,
            "label": label.strip() or None,
            "ra": round(float(r["ra"]) * 15, 4),   # hours -> degrees
            "dec": round(float(r["dec"]), 4),
            "mag": round(mag, 2),
            "con": r["con"] or None,
            "spect": r["spect"] or None,
            "ci": float(r["ci"]) if r["ci"] else None,  # B-V colour index
            "ly": ly,
        })
stars.sort(key=lambda s: s["mag"])

def nearest_star(ra, dec):
    best, bd = None, 1e9
    for s in stars:
        d = (min(abs(s["ra"] - ra), 360 - abs(s["ra"] - ra)) * math.cos(math.radians(dec))) ** 2 + (s["dec"] - dec) ** 2
        if d < bd:
            best, bd = s, d
    return best if bd < 0.25 ** 2 else None   # within 0.25 degree

names = {f["id"]: f["properties"]["name"] for f in json.load(open(os.path.join(raw, "cnames.json")))["features"]}
cons = []
for f in json.load(open(os.path.join(raw, "lines.json")))["features"]:
    lines, ras, decs = [], [], []
    for line in f["geometry"]["coordinates"]:
        pts = []
        for ra, dec in line:
            ra = ra % 360
            ras.append(ra); decs.append(dec)
            s = nearest_star(ra, dec)
            pts.append({"ra": round(ra, 4), "dec": round(dec, 4), "star": s["id"] if s else None})
        lines.append(pts)
    # centre: average of unit vectors (handles RA wrap-around)
    x = sum(math.cos(math.radians(d)) * math.cos(math.radians(r)) for r, d in zip(ras, decs))
    y = sum(math.cos(math.radians(d)) * math.sin(math.radians(r)) for r, d in zip(ras, decs))
    z = sum(math.sin(math.radians(d)) for d in decs)
    cra = math.degrees(math.atan2(y, x)) % 360
    cdec = math.degrees(math.atan2(z, math.hypot(x, y)))
    cons.append({"id": f["id"], "name": names.get(f["id"], f["id"]),
                 "center": {"ra": round(cra, 3), "dec": round(cdec, 3)}, "lines": lines})

json.dump(stars, open(os.path.join(out, "stars.json"), "w"), separators=(",", ":"))
json.dump(cons, open(os.path.join(out, "constellations.json"), "w"), separators=(",", ":"))
print(len(stars), "stars;", len(cons), "constellations")
