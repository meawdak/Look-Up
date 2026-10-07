// test/pointing_test.mjs
// Verifies orientation math and vector functions in Node.

import assert from 'node:assert/strict';
import {
  orientationToVector,
  vectorToAltAz,
  orientationToAltAz,
  averageVectors,
  angularDistance,
} from '../src/sensors/pointing.js';

function approx(actual, expected, tolerance = 1e-4, msg = '') {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${msg} Expected ${expected} ± ${tolerance}, got ${actual} (diff: ${diff})`
  );
}

// 1. Sanity check 1: beta=90, alpha=0, gamma=0 -> azimuth 0 (North), altitude 0
{
  const v = orientationToVector(0, 90, 0);
  approx(v.x, 0, 1e-6, 'vx for beta=90');
  approx(v.y, 1, 1e-6, 'vy for beta=90');
  approx(v.z, 0, 1e-6, 'vz for beta=90');

  const { alt, az } = vectorToAltAz(v);
  approx(alt, 0, 1e-6, 'Altitude for beta=90');
  approx(az, 0, 1e-6, 'Azimuth for beta=90');
}

// 2. Sanity check 2: beta=180, alpha=0, gamma=0 -> altitude 90 (Zenith)
{
  const v = orientationToVector(0, 180, 0);
  approx(v.x, 0, 1e-6, 'vx for beta=180');
  approx(v.y, 0, 1e-6, 'vy for beta=180');
  approx(v.z, 1, 1e-6, 'vz for beta=180');

  const { alt } = vectorToAltAz(v);
  approx(alt, 90, 1e-6, 'Altitude for beta=180');
}

// 3. Direct orientationToAltAz checks
{
  const r1 = orientationToAltAz(0, 90, 0);
  approx(r1.alt, 0, 1e-6);
  approx(r1.az, 0, 1e-6);

  const r2 = orientationToAltAz(0, 180, 0);
  approx(r2.alt, 90, 1e-6);
}

// 4. Vector averaging and normalisation
{
  const vectors = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 1, z: 0.1 },
    { x: 0.1, y: 1, z: 0 },
  ];
  const avg = averageVectors(vectors);
  const length = Math.hypot(avg.x, avg.y, avg.z);
  approx(length, 1, 1e-6, 'Averaged vector must be normalised to length 1');
  assert.ok(avg.y > 0.99, 'Averaged vector predominantly points North');
}

// 5. Angular distance checks
{
  // Identical points -> 0 deg
  approx(angularDistance(45, 120, 45, 120), 0, 1e-6, 'Distance to self is 0');

  // Horizon North to Horizon East -> 90 deg
  approx(angularDistance(0, 0, 0, 90), 90, 1e-6, 'North to East along horizon');

  // Horizon North to Zenith -> 90 deg
  approx(angularDistance(0, 0, 90, 0), 90, 1e-6, 'North to Zenith');

  // Small separation
  const dSmall = angularDistance(30, 100, 30, 105);
  assert.ok(dSmall > 4 && dSmall < 5, 'Small azimuth difference at altitude 30');
}

console.log('✓ All pointing maths tests passed successfully!');
