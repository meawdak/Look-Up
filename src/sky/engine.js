// Sky maths. Pure functions: no DOM, no network. Everything here works offline.
// Uses astronomy-engine (MIT) for the Sun, Moon, planets and Earth's rotation.
import * as Astronomy from 'astronomy-engine';

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function makeObserver(lat, lon, heightM = 0) {
  return new Astronomy.Observer(lat, lon, heightM);
}

// Star (catalogue RA/Dec in degrees, J2000) -> altitude/azimuth in degrees.
// Precession since 2000 is ~0.4 degrees: invisible to the naked eye, so we skip it.
export function starAltAz(star, date, observer) {
  const h = Astronomy.Horizon(date, observer, star.ra / 15, star.dec, 'normal');
  return { alt: h.altitude, az: h.azimuth };
}

// Sun, Moon or planet -> altitude/azimuth in degrees.
export function bodyAltAz(bodyName, date, observer) {
  const eq = Astronomy.Equator(bodyName, date, observer, true, true);
  const h = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
  return { alt: h.altitude, az: h.azimuth };
}

// Brightness (magnitude) of a planet or the Moon right now.
export function bodyMagnitude(bodyName, date) {
  return Astronomy.Illumination(bodyName, date).mag;
}

// Moon phase: 0 = new, 90 = first quarter, 180 = full, 270 = last quarter.
export function moonPhase(date) {
  const angle = Astronomy.MoonPhase(date);
  const lit = Astronomy.Illumination('Moon', date).phase_fraction;
  return { angle, litPercent: Math.round(lit * 100) };
}

export function isDark(date, observer) {
  // "Dark enough": Sun more than 12 degrees below the horizon (nautical twilight over).
  return bodyAltAz('Sun', date, observer).alt < -12;
}

// 0..360 degrees -> "N", "NE", "E" ...
export function compassWord(az) {
  const words = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return words[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

// Altitude -> words a beginner understands.
export function heightWord(alt) {
  if (alt < 0) return 'below the horizon';
  if (alt < 15) return 'very low, just above the horizon';
  if (alt < 35) return 'low in the sky';
  if (alt < 60) return 'halfway up';
  if (alt < 80) return 'high up';
  return 'almost straight overhead';
}

// Look through tonight (from `start` for `hours`) in 15-minute steps and find
// when `altAzAt(date)` is above `minAlt` while the sky is dark.
export function tonightWindow(altAzAt, start, observer, { hours = 12, minAlt = 20 } = {}) {
  const STEP = 15 * 60 * 1000;
  let first = null, last = null, best = null;
  for (let t = start.getTime(); t <= start.getTime() + hours * 3600e3; t += STEP) {
    const d = new Date(t);
    if (!isDark(d, observer)) continue;
    const p = altAzAt(d);
    if (p.alt < minAlt) continue;
    if (!first) first = d;
    last = d;
    if (!best || p.alt > best.alt) best = { date: d, alt: p.alt, az: p.az };
  }
  return first ? { from: first, to: last, best } : null;
}
