import * as THREE from 'three';

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth damp (exponential decay)
 */
export function smoothDamp(
  current: number,
  target: number,
  smoothness: number,
  dt: number
): number {
  return lerp(current, target, 1 - Math.exp(-smoothness * dt));
}

/**
 * Smooth damp for Vector3
 */
export function smoothDampVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  smoothness: number,
  dt: number,
  out?: THREE.Vector3
): THREE.Vector3 {
  const result = out ?? new THREE.Vector3();
  const factor = 1 - Math.exp(-smoothness * dt);

  result.x = lerp(current.x, target.x, factor);
  result.y = lerp(current.y, target.y, factor);
  result.z = lerp(current.z, target.z, factor);

  return result;
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Ease out back (slight overshoot then snap)
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Ease out cubic
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease in out cubic
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Create quaternion from Euler angles (degrees)
 */
export function quaternionFromEulerDegrees(
  x: number,
  y: number,
  z: number
): THREE.Quaternion {
  const euler = new THREE.Euler(degToRad(x), degToRad(y), degToRad(z));
  return new THREE.Quaternion().setFromEuler(euler);
}

/**
 * Create Rapier-compatible rotation from Euler degrees
 */
export function rapierRotationFromEulerDegrees(
  x: number,
  y: number,
  z: number
): { x: number; y: number; z: number; w: number } {
  const quat = quaternionFromEulerDegrees(x, y, z);
  return { x: quat.x, y: quat.y, z: quat.z, w: quat.w };
}

/**
 * Random float between min and max
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Random point on unit sphere
 */
export function randomOnSphere(out?: THREE.Vector3): THREE.Vector3 {
  const result = out ?? new THREE.Vector3();
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  result.x = Math.sin(phi) * Math.cos(theta);
  result.y = Math.sin(phi) * Math.sin(theta);
  result.z = Math.cos(phi);

  return result;
}

/**
 * Random point on upper hemisphere
 */
export function randomOnUpperHemisphere(out?: THREE.Vector3): THREE.Vector3 {
  const result = out ?? new THREE.Vector3();
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere only

  result.x = Math.sin(phi) * Math.cos(theta);
  result.y = Math.cos(phi);
  result.z = Math.sin(phi) * Math.sin(theta);

  return result;
}
