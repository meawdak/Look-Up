// src/sensors/pointing.js
// Handles phone orientation sensors to determine where the back camera is pointing in the sky.
// Math functions are kept pure and DOM-free so they can be tested in Node.

const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

/**
 * Converts alpha, beta, gamma (in degrees) to the BACK-CAMERA direction vector
 * in Earth coordinates: x = East, y = North, z = Up.
 * Formula from specs:
 *   vx = -(cos(a)*sin(g) + sin(a)*sin(b)*cos(g))
 *   vy = -(sin(a)*sin(g) - cos(a)*sin(b)*cos(g))
 *   vz = -(cos(b)*cos(g))
 */
export function orientationToVector(alpha = 0, beta = 0, gamma = 0) {
  const a = alpha * deg2rad;
  const b = beta * deg2rad;
  const g = gamma * deg2rad;

  const vx = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
  const vy = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
  const vz = -(Math.cos(b) * Math.cos(g));

  return { x: vx, y: vy, z: vz };
}

/**
 * Converts a 3D unit vector (x = East, y = North, z = Up) into Altitude and Azimuth.
 * altitude = asin(vz) in degrees (-90..90)
 * azimuth = atan2(vx, vy) normalised to 0..360 (0 = North, 90 = East)
 */
export function vectorToAltAz(v) {
  const vzClamped = Math.max(-1, Math.min(1, v.z));
  const alt = Math.asin(vzClamped) * rad2deg;
  let az = Math.atan2(v.x, v.y) * rad2deg;
  az = ((az % 360) + 360) % 360;
  return { alt, az };
}

/**
 * Direct conversion from alpha, beta, gamma to { alt, az }.
 */
export function orientationToAltAz(alpha = 0, beta = 0, gamma = 0) {
  const v = orientationToVector(alpha, beta, gamma);
  return vectorToAltAz(v);
}

/**
 * Averages an array of 3D vectors and returns the normalised average vector.
 * Smoothing vectors prevents jumpiness around angle boundaries (0/360 wrap).
 */
export function averageVectors(vectors) {
  if (!vectors.length) return { x: 0, y: 1, z: 0 };
  let sx = 0, sy = 0, sz = 0;
  for (const v of vectors) {
    sx += v.x;
    sy += v.y;
    sz += v.z;
  }
  const len = Math.hypot(sx, sy, sz);
  if (len === 0) return { x: 0, y: 1, z: 0 };
  return { x: sx / len, y: sy / len, z: sz / len };
}

/**
 * Great-circle angular distance between two sky coordinates in degrees:
 * cos d = sin(alt1)sin(alt2) + cos(alt1)cos(alt2)cos(az1 - az2)
 */
export function angularDistance(alt1, az1, alt2, az2) {
  const rAlt1 = alt1 * deg2rad;
  const rAlt2 = alt2 * deg2rad;
  const rDiffAz = (az1 - az2) * deg2rad;

  const cosD = Math.sin(rAlt1) * Math.sin(rAlt2) + Math.cos(rAlt1) * Math.cos(rAlt2) * Math.cos(rDiffAz);
  const clamped = Math.max(-1, Math.min(1, cosD));
  return Math.acos(clamped) * rad2deg;
}

// Sensor state & listener management
const recentVectors = [];
const MAX_SMOOTH_SAMPLES = 10;
let pointingListeners = [];
let activeHandler = null;
let activeEventName = null;
let isAbsoluteCompass = false;

function notifyListeners(altAzData) {
  for (const cb of pointingListeners) {
    cb(altAzData);
  }
}

function handleOrientationEvent(event) {
  let alpha = event.alpha;
  const beta = event.beta;
  const gamma = event.gamma;

  // On iOS, webkitCompassHeading gives compass heading directly (0 = North)
  // When webkitCompassHeading is available, convert heading to alpha
  if (typeof event.webkitCompassHeading === 'number') {
    alpha = (360 - event.webkitCompassHeading + 360) % 360;
  }

  if (alpha == null || beta == null || gamma == null) {
    return;
  }

  const v = orientationToVector(alpha, beta, gamma);
  recentVectors.push(v);
  if (recentVectors.length > MAX_SMOOTH_SAMPLES) {
    recentVectors.shift();
  }

  const smoothedV = averageVectors(recentVectors);
  const { alt, az } = vectorToAltAz(smoothedV);

  notifyListeners({
    alt,
    az,
    raw: { alpha, beta, gamma },
    isAbsolute: isAbsoluteCompass,
    inaccurate: !isAbsoluteCompass,
  });
}

/**
 * Subscribe a callback to receive pointing updates: { alt, az, isAbsolute, inaccurate }
 */
export function onPointing(callback) {
  pointingListeners.push(callback);
  return () => {
    pointingListeners = pointingListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Starts listening to device orientation.
 * Must be triggered by a user tap to satisfy iOS Safari permission requirements.
 */
export async function start() {
  stop();

  // 1. iOS Safari permission request
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response !== 'granted') {
        throw new Error('Permission not granted for orientation sensors');
      }
    } catch (err) {
      throw err;
    }
  }

  // 2. Android: check for 'deviceorientationabsolute' first
  activeHandler = (e) => handleOrientationEvent(e);

  if ('ondeviceorientationabsolute' in window) {
    activeEventName = 'deviceorientationabsolute';
    isAbsoluteCompass = true;
    window.addEventListener(activeEventName, activeHandler, true);
  } else if ('ondeviceorientation' in window) {
    activeEventName = 'deviceorientation';
    isAbsoluteCompass = false;
    window.addEventListener(activeEventName, activeHandler, true);
  } else {
    throw new Error('Device orientation events are not supported on this browser');
  }
}

/**
 * Stops orientation sensor listeners and clears history.
 */
export function stop() {
  if (activeHandler && activeEventName) {
    window.removeEventListener(activeEventName, activeHandler, true);
  }
  activeHandler = null;
  activeEventName = null;
  recentVectors.length = 0;
  isAbsoluteCompass = false;
}
