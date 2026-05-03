// src/product/guidance/alignment-guidance.js
//
// PRODUCT LAYER — ships on real hardware.
//
// Compute the operator's "offline" distance to a selected guidance line —
// the perpendicular distance from the blade focus to the closest point
// on the line. Drives the top alignment LED bar (Trimble convention,
// per CONTEXT.md GQ-1: centre = horizontal alignment, sides = cut/fill).
//
// Pure math. No globals. No DOM.
//
// See:
//   CONTEXT.md → "Centre LED bar = horizontal alignment guidance"
//   GQ-1, GQ-9 → wired via Slice 9

'use strict';

/**
 * @typedef {{x:number, z:number}} LinePoint  Plan-view point (m).
 *
 * @typedef {Object} GuidanceLine
 * @property {string} name
 * @property {LinePoint[]} points    Ordered list, ≥2 points required.
 * @property {string} [source]       e.g. 'recorded' / 'design' / 'manual'.
 *
 * @typedef {Object} AlignmentGuidance
 * @property {number} offlineDistanceM   Signed perpendicular distance from
 *   the blade-focus point to the closest point on the line, in metres.
 *   Positive = right of the line (looking along travel direction).
 *   Negative = left of the line.
 *   Result already includes any horizontal alignment offset (i.e. the
 *   operator wants this number to be zero when grading on the offset line).
 * @property {number} chainageM   Distance along the line from the start
 *   to the closest-point projection (m). 0 at start, length at end.
 *   Useful for "how far along the alignment am I?" displays.
 * @property {number} totalLengthM   Total polyline length (m).
 * @property {number} headingRad   Tangent direction at the closest point
 *   (radians, sim convention: 0 = +Z forward).
 * @property {boolean} isOnLine   true when |offlineDistanceM| <= toleranceM.
 * @property {{x:number, z:number}} closestPoint   The closest point on the
 *   raw (un-offset) polyline to the focus. Useful for visualisation.
 */

/**
 * Compute alignment guidance for the operator.
 *
 * @param {{x:number, z:number}} focusXZ   Plan-view position of the blade focus
 * @param {GuidanceLine} line              The selected polyline
 * @param {number} [horizontalOffsetM]     Operator-set offset perpendicular
 *   to the line (m). Positive = right, negative = left. Default 0.
 * @param {number} [toleranceM]            On-line tolerance half-band (m).
 *   Default 0.05 m (50 mm).
 * @returns {AlignmentGuidance|null}       null if line invalid (<2 points).
 */
function computeAlignmentGuidance(focusXZ, line, horizontalOffsetM, toleranceM) {
  if (!line || !Array.isArray(line.points) || line.points.length < 2) return null;
  if (!focusXZ || typeof focusXZ.x !== 'number' || typeof focusXZ.z !== 'number') return null;
  const offset = horizontalOffsetM || 0;
  const tol = (toleranceM != null) ? toleranceM : 0.05;
  const pts = line.points;

  // Walk segments, find closest projection point.
  let bestSeg = -1;
  let bestT = 0;        // 0..1 along segment
  let bestDistSq = Infinity;
  let bestPerp = 0;     // signed perpendicular distance (right of travel = +)
  let bestTanX = 0, bestTanZ = 0; // tangent direction at closest point
  let cumLen = 0;       // cumulative length up to start of segment
  let cumLenAtBest = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) { cumLen += len; continue; }
    const ux = dx / len, uz = dz / len;
    // Project (focus - p0) onto (ux, uz)
    const vx = focusXZ.x - p0.x;
    const vz = focusXZ.z - p0.z;
    const along = Math.max(0, Math.min(len, vx * ux + vz * uz));
    const t = along / len;
    const cx = p0.x + dx * t;
    const cz = p0.z + dz * t;
    const ddx = focusXZ.x - cx;
    const ddz = focusXZ.z - cz;
    const distSq = ddx * ddx + ddz * ddz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSeg = i;
      bestT = t;
      // Right-of-travel perp = (uz, -ux). Signed distance = v · perp.
      bestPerp = vx * uz + vz * (-ux);
      bestTanX = ux;
      bestTanZ = uz;
      cumLenAtBest = cumLen + along;
    }
    cumLen += len;
  }

  if (bestSeg < 0) return null;

  // Apply horizontal offset: operator wants displayedDistance = perp - offset
  // (so when blade is at +offset, displayedDistance = 0 = on-line).
  const offlineDistanceM = bestPerp - offset;

  // Closest point on the raw polyline (for visualisation).
  const p0 = pts[bestSeg];
  const closestPoint = {
    x: p0.x + (pts[bestSeg + 1].x - p0.x) * bestT,
    z: p0.z + (pts[bestSeg + 1].z - p0.z) * bestT,
  };

  // Heading at the tangent — sim convention: 0 = +Z, +ve clockwise from above.
  const headingRad = Math.atan2(bestTanX, bestTanZ);

  return {
    offlineDistanceM,
    chainageM: cumLenAtBest,
    totalLengthM: cumLen,
    headingRad,
    isOnLine: Math.abs(offlineDistanceM) <= tol,
    closestPoint,
  };
}

if (typeof window !== 'undefined') {
  window.computeAlignmentGuidance = computeAlignmentGuidance;
}

export { computeAlignmentGuidance };
