// src/product/positioning/local-frame.js
//
// PRODUCT LAYER — ships on real hardware.
//
// Convert between geodetic (lat, lon, ellipsoidalH) and a local Cartesian
// frame (x_east, y_up, z_north, in metres) used by the rest of the
// product (BladePose, BladeTarget, design surface).
//
// Slice 3 implementation: **flat-earth approximation** centred on a
// configurable origin lat/lon. Accurate to <1 cm over a few-km radius —
// fine for the Banksia Springs paddock-sized work area.
//
// Future slices replace this with proper UTM (or local construction
// grid) projection. The interface stays the same, only the math changes.
//
// NO globals (other than window-export bridge). NO I/O. Pure functions.
//
// See:
//   CONTEXT.md → "Geoid + single-point site calibration"
//   ADR-0003   → coordinate-frame setup at site calibration time

'use strict';

const EARTH_R = 6378137.0;            // WGS-84 equatorial radius (m)
const M_PER_DEG_LAT = Math.PI * EARTH_R / 180; // ~111,320 m

/**
 * @typedef {Object} LocalFrameOrigin
 * @property {number} originLatDeg   Reference latitude (decimal degrees)
 * @property {number} originLonDeg   Reference longitude (decimal degrees)
 * @property {number} originAltM     Reference altitude (m, ellipsoidal — must match what NMEA gives)
 * @property {number} elevationOffsetM  Calibration constant added to (alt - originAltM) to give local Z (orthometric).
 *                                        Set during single-point benchmark calibration.
 *                                        Default 0.
 */

/**
 * Build a local-frame definition rooted at a given lat/lon/alt origin.
 *
 * The returned object exposes `geodeticToLocal()` and `localToGeodetic()`
 * methods bound to this origin. Use one frame per site / coordinate
 * system; switching sites = building a new frame.
 *
 * @param {{originLatDeg:number, originLonDeg:number, originAltM:number, elevationOffsetM?:number}} origin
 * @returns {{
 *   originLatDeg:number, originLonDeg:number, originAltM:number, elevationOffsetM:number,
 *   geodeticToLocal: (lat:number, lon:number, altM:number) => {x:number, y:number, z:number},
 *   localToGeodetic: (x:number, y:number, z:number) => {lat:number, lon:number, altM:number},
 * }}
 */
function makeLocalFrame(origin) {
  const originLatDeg = origin.originLatDeg;
  const originLonDeg = origin.originLonDeg;
  const originAltM = origin.originAltM;
  const elevationOffsetM = origin.elevationOffsetM || 0;
  // Pre-compute the metres-per-degree-longitude scaling at this latitude.
  const cosLat = Math.cos(originLatDeg * Math.PI / 180);
  const M_PER_DEG_LON = M_PER_DEG_LAT * cosLat;

  /**
   * Convert geodetic lat/lon/alt to local x/y/z.
   * x = east (m), y = up (m, orthometric after elevationOffset), z = north (m).
   *
   * Convention matches the existing sim: +X east, +Z north, +Y up.
   */
  function geodeticToLocal(lat, lon, altM) {
    const dLat = lat - originLatDeg;
    const dLon = lon - originLonDeg;
    const x = dLon * M_PER_DEG_LON;
    const z = dLat * M_PER_DEG_LAT;
    const y = (altM - originAltM) + elevationOffsetM;
    return { x, y, z };
  }

  /**
   * Inverse: convert local x/y/z back to geodetic. Round-trip with
   * geodeticToLocal is exact within floating-point precision over the
   * scales we care about (paddocks).
   */
  function localToGeodetic(x, y, z) {
    const dLat = z / M_PER_DEG_LAT;
    const dLon = x / M_PER_DEG_LON;
    const lat = originLatDeg + dLat;
    const lon = originLonDeg + dLon;
    const altM = (y - elevationOffsetM) + originAltM;
    return { lat, lon, altM };
  }

  return {
    originLatDeg, originLonDeg, originAltM, elevationOffsetM,
    geodeticToLocal, localToGeodetic,
  };
}

/**
 * Default sim-only frame — Banksia Springs Farm reference origin.
 * Real deployments override this at site-calibration time.
 */
const SIM_DEFAULT_FRAME = makeLocalFrame({
  originLatDeg: -30.0,    // rural NSW reference
  originLonDeg: 145.0,
  originAltM: 100.0,      // arbitrary ellipsoidal reference
  elevationOffsetM: 0,
});

if (typeof window !== 'undefined') {
  window.makeLocalFrame = makeLocalFrame;
  window.SIM_DEFAULT_FRAME = SIM_DEFAULT_FRAME;
}

export { makeLocalFrame, SIM_DEFAULT_FRAME };
