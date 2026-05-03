// src/product/design/profile-designer.js
//
// PRODUCT LAYER — ships on real hardware.
//
// The "universal" design tool: take a 2D cross-section profile and an
// alignment polyline, sweep the profile along the polyline, output a
// design surface. This single tool subsumes Crown, Dam, Batter,
// Irrigation Bay, Profile, and other line-following design types.
//
// Per CONTEXT.md GQ-6: Steven specifically asked for this because
// "if we can make a really good Profile Designer, I think that's gonna
// pretty much do nearly everything we need to do."
//
// Pure math. No DOM. No globals. Inputs in, design heights out.
//
// See:
//   CONTEXT.md → "Line-based design generation modes adopted, with
//                 major v1.0 simplification"
//   GQ-6       → reduces 9-tool catalog to 3 (Flat Pad / Slope / Profile Designer)

'use strict';

/**
 * @typedef {{x:number, z:number}} PolylinePoint  Plan-view point (m).
 * @typedef {{u:number, dy:number}} ProfilePoint  Cross-section vertex.
 *   u  = perpendicular offset from the polyline (m). Negative = left of polyline.
 *   dy = elevation delta from the polyline elevation at that station (m). +ve up.
 */

/**
 * @typedef {Object} ProfileDesignerInput
 * @property {ProfilePoint[]} profile   Cross-section vertices, sorted by u (left→right).
 *   At minimum 2 points. Profile is interpolated linearly between vertices.
 *   Profile is "open" — beyond the leftmost / rightmost vertex, the surface ends.
 * @property {PolylinePoint[]} polyline Alignment in plan view, ordered along travel.
 *   At minimum 2 points. Linear interpolation between vertices.
 * @property {number[]} [polylineElev]  Elevation per polyline vertex (m). If omitted,
 *   ambient terrain elevation is assumed (the consumer fills it in from gElev).
 * @property {number} [maxWidth]        Optional: cap the profile width (m). Vertices
 *   beyond ±maxWidth/2 are clipped at the edge.
 */

/**
 * @typedef {Object} ProfileDesignerOutput
 * @property {(x:number, z:number) => number|null} elevAt  Sample the resulting
 *   design elevation at world coords. Returns null if (x,z) is outside the
 *   swept surface footprint.
 * @property {{minX,maxX,minZ,maxZ}} bbox  Bounding box of the swept surface.
 * @property {Object} _debug  Internal sample structures (for inspection / tests).
 */

/**
 * Sweep a 2D cross-section profile along a polyline alignment in 3D.
 *
 * For each query point (x, z): find the closest point on the polyline,
 * compute the perpendicular offset u, look up the profile dy at that u,
 * and add to the polyline elevation at that station.
 *
 * @param {ProfileDesignerInput} input
 * @returns {ProfileDesignerOutput}
 */
function extrudeProfileAlongPolyline(input) {
  const profile = (input.profile || []).slice().sort((a, b) => a.u - b.u);
  const polyline = input.polyline || [];
  const polyElev = input.polylineElev || [];
  if (profile.length < 2 || polyline.length < 2) {
    return {
      elevAt: () => null,
      bbox: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
      _debug: { reason: 'insufficient input' },
    };
  }
  const halfWidth = (input.maxWidth != null)
    ? input.maxWidth / 2
    : Math.max(Math.abs(profile[0].u), Math.abs(profile[profile.length - 1].u));

  // Pre-compute polyline segment data: per segment store p0, p1, length.
  const segs = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const p0 = polyline[i];
    const p1 = polyline[i + 1];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    segs.push({ p0, p1, dx, dz, len, e0: polyElev[i], e1: polyElev[i + 1] });
  }

  // Profile sample (linear interp; null beyond ends).
  function sampleProfile(u) {
    if (u < profile[0].u || u > profile[profile.length - 1].u) return null;
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i], b = profile[i + 1];
      if (u >= a.u && u <= b.u) {
        const t = (b.u === a.u) ? 0 : (u - a.u) / (b.u - a.u);
        return a.dy + t * (b.dy - a.dy);
      }
    }
    return null;
  }

  // Bounding box for fast reject.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of segs) {
    for (const p of [s.p0, s.p1]) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
  }
  minX -= halfWidth; maxX += halfWidth;
  minZ -= halfWidth; maxZ += halfWidth;

  /**
   * For a query point (x,z): find the closest segment and station along it.
   * Returns { segIdx, t (0..1 along seg), perpU (signed perpendicular offset), distSq }.
   */
  function closestPointOnPolyline(x, z) {
    let best = null;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.len < 1e-9) continue;
      const ux = s.dx / s.len, uz = s.dz / s.len;
      // Project (x,z) - p0 onto (ux,uz)
      const vx = x - s.p0.x;
      const vz = z - s.p0.z;
      const along = vx * ux + vz * uz;       // signed distance along segment
      const t = Math.max(0, Math.min(s.len, along)) / s.len;
      // Closest point on segment
      const cx = s.p0.x + (s.p1.x - s.p0.x) * t;
      const cz = s.p0.z + (s.p1.z - s.p0.z) * t;
      const ddx = x - cx, ddz = z - cz;
      const distSq = ddx * ddx + ddz * ddz;
      // Signed perpendicular offset: cross-product sign of (segDir × pointDir)
      // perp = (-uz, ux) — left-of-segment when looking along travel.
      // Right-of-segment is positive u; left is negative u (matches design conventions).
      const perpU = (vx * (-uz) + vz * ux); // signed perpendicular distance from p0
      // The sign of perpU should be relative to how "right" the point is.
      // perp vector pointing right of travel = (uz, -ux), so dot with v gives:
      const perpURight = vx * uz + vz * (-ux);
      if (best === null || distSq < best.distSq) {
        best = { segIdx: i, t, perpU: perpURight, distSq };
      }
    }
    return best;
  }

  function elevAt(x, z) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
    const cl = closestPointOnPolyline(x, z);
    if (!cl) return null;
    const dy = sampleProfile(cl.perpU);
    if (dy === null) return null;
    const seg = segs[cl.segIdx];
    const e0 = (seg.e0 != null) ? seg.e0 : 0;
    const e1 = (seg.e1 != null) ? seg.e1 : 0;
    const polyElevAtT = e0 + (e1 - e0) * cl.t;
    return polyElevAtT + dy;
  }

  return {
    elevAt,
    bbox: { minX, maxX, minZ, maxZ },
    _debug: { segCount: segs.length, profileCount: profile.length, halfWidth },
  };
}

/**
 * Built-in profile presets for common earthworks shapes.
 * Each preset returns an array of ProfilePoint for the given parameters.
 */
const ProfilePresets = {
  /** Symmetric crown (road shape): peak at centre, falls equally to both sides. */
  crown(halfWidth, peakHeightAboveEdge, edgeDrop) {
    return [
      { u: -halfWidth, dy: -edgeDrop },
      { u: 0, dy: peakHeightAboveEdge },
      { u: halfWidth, dy: -edgeDrop },
    ];
  },
  /** V-drain: low at centre, rises equally to both sides. */
  vdrain(halfWidth, depthBelowEdge) {
    return [
      { u: -halfWidth, dy: 0 },
      { u: 0, dy: -depthBelowEdge },
      { u: halfWidth, dy: 0 },
    ];
  },
  /** Trapezoidal channel: flat bottom, sloped sides. */
  trapChannel(bottomHalfWidth, depth, sideSlopeRatio) {
    // sideSlopeRatio = horizontal:vertical (e.g. 2 means 2:1 slope)
    const sideRun = depth * sideSlopeRatio;
    return [
      { u: -(bottomHalfWidth + sideRun), dy: 0 },
      { u: -bottomHalfWidth, dy: -depth },
      { u: bottomHalfWidth, dy: -depth },
      { u: bottomHalfWidth + sideRun, dy: 0 },
    ];
  },
  /** Single-side batter: flat top, sloped down on right (or left if negative). */
  batter(topWidth, batterRun, batterDrop) {
    return [
      { u: 0, dy: 0 },
      { u: topWidth, dy: 0 },
      { u: topWidth + batterRun, dy: -batterDrop },
    ];
  },
  /** Dam profile: gentle upstream slope + crest + steeper downstream batter. */
  dam(crestHalfWidth, upstreamRun, upstreamRise, downstreamRun, downstreamDrop) {
    return [
      { u: -(crestHalfWidth + upstreamRun), dy: -upstreamRise },
      { u: -crestHalfWidth, dy: 0 },
      { u: crestHalfWidth, dy: 0 },
      { u: crestHalfWidth + downstreamRun, dy: -downstreamDrop },
    ];
  },
  /** Flat ribbon: horizontal at the polyline elevation across the given width. */
  flat(halfWidth) {
    return [
      { u: -halfWidth, dy: 0 },
      { u: halfWidth, dy: 0 },
    ];
  },
};

if (typeof window !== 'undefined') {
  window.extrudeProfileAlongPolyline = extrudeProfileAlongPolyline;
  window.ProfilePresets = ProfilePresets;
}

export { extrudeProfileAlongPolyline, ProfilePresets };
