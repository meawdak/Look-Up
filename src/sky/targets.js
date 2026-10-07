// Decides which beginner targets are worth looking for tonight.
import { starAltAz, bodyAltAz, bodyMagnitude, tonightWindow, PLANETS } from './engine.js';

export async function loadData(base = import.meta.env.BASE_URL) {
  const get = (f) => fetch(`${base}data/${f}`).then((r) => r.json());
  const [stars, constellations, targetFile] = await Promise.all([
    get('stars.json'), get('constellations.json'), get('targets.json'),
  ]);
  const starById = new Map(stars.filter((s) => s.id).map((s) => [s.id, s]));
  return { stars, starById, constellations, targets: targetFile.targets };
}

// Average direction of several alt/az points (done with 3D vectors so N wrap-around works).
function centre(points) {
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    const a = (p.alt * Math.PI) / 180, b = (p.az * Math.PI) / 180;
    x += Math.cos(a) * Math.cos(b); y += Math.cos(a) * Math.sin(b); z += Math.sin(a);
  }
  return {
    alt: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
    az: (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360,
  };
}

// Returns a function date -> {alt, az} for one target, or null if we can't place it.
export function positionFn(target, data, observer, now) {
  if (target.kind === 'moon') return (d) => bodyAltAz('Moon', d, observer);
  if (target.kind === 'planet') {
    const body = target.body === 'auto' ? pickPlanet(observer, now) : target.body;
    if (!body) return null;
    const fn = (d) => bodyAltAz(body, d, observer);
    fn.body = body;
    return fn;
  }
  const stars = (target.stars || []).map((id) => data.starById.get(id)).filter(Boolean);
  if (!stars.length) return null;
  return (d) => centre(stars.map((s) => starAltAz(s, d, observer)));
}

// The planet you can see soonest tonight (brighter one wins if two are up together).
function pickPlanet(observer, now) {
  let best = null;
  for (const p of PLANETS) {
    const w = tonightWindow((d) => bodyAltAz(p, d, observer), now, observer, { minAlt: 15 });
    if (!w) continue;
    const c = { p, from: w.from.getTime(), mag: bodyMagnitude(p, w.best.date) };
    if (!best || c.from < best.from || (c.from === best.from && c.mag < best.mag)) best = c;
  }
  return best?.p ?? null;
}

// Main entry: every target with "now" position and tonight's viewing window.
export function planTonight(data, observer, now = new Date()) {
  return data.targets
    .map((t) => {
      const at = positionFn(t, data, observer, now);
      if (!at) return { target: t, now: null, window: null };
      return { target: t, body: at.body, now: at(now), window: tonightWindow(at, now, observer) };
    })
    .filter((r) => r.window)
    .sort((a, b) => a.window.from - b.window.from || a.target.level - b.target.level);
}
