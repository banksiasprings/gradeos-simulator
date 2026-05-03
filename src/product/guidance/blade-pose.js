// src/product/guidance/blade-pose.js
//
// PRODUCT LAYER — ships on real hardware.
//
// Pure blade-pose computation. Takes two GPS antenna positions (world coords,
// metres) plus a mounting calibration, returns where the blade is in space.
//
// NO terrain. NO design. NO machine state. NO globals. Pure function.
//
// See:
//   CONTEXT.md  → "Slice 1 — Blade pose"
//   ADR-0002    → "Dual GPS antennas on the blade corners"
//
// When real F9P hardware arrives, the GPS source is swapped (NMEA reader
// instead of sim shell), but THIS module does not change.

'use strict';

/**
 * @typedef {Object} Vec3
 * @property {number} x  East / sim X (m, world frame)
 * @property {number} y  Up / elevation (m, world frame)
 * @property {number} z  North / sim Z (m, world frame)
 */

/**
 * Calibration offset from one antenna phase centre to its corresponding
 * blade tip cutting edge. Measured at install time; does not change at runtime.
 *
 * Convention: dy is typically NEGATIVE — the blade tip is below the antenna
 * by the height of the mounting pole.
 *
 * @typedef {Object} AntennaMounting
 * @property {number} dx  East offset (m)
 * @property {number} dy  Vertical offset (m, antenna-frame negative = down to blade)
 * @property {number} dz  North offset (m)
 */

/**
 * @typedef {Object} BladePoseMounting
 * @property {AntennaMounting} antennaA  Antenna A → blade tip A (left)
 * @property {AntennaMounting} antennaB  Antenna B → blade tip B (right)
 */

/**
 * @typedef {Object} BladePose
 * @property {Vec3}   tipA         Left blade tip cutting edge, world coords (m)
 * @property {Vec3}   tipB         Right blade tip cutting edge, world coords (m)
 * @property {Vec3}   centre       Midpoint of tipA and tipB
 * @property {number} heading      Blade-forward heading (rad). 0 = +Z; matches sim machinePos.hdg convention.
 * @property {number} crossSlope   Cross-slope %, +ve = right side (tipB) high relative to left side (tipA)
 * @property {number} bladeWidth   Horizontal distance tipA→tipB (m)
 */

/**
 * Compute blade pose from two GPS antenna positions and the mounting calibration.
 *
 * Input frame: world coordinates in metres. The GPS source must have already
 * resolved to local Cartesian (the F9P NMEA bridge or sim shell does that).
 *
 * Output is a plain data struct. No side effects.
 *
 * @param {Vec3} gps1                    Raw antenna A position (world, m)
 * @param {Vec3} gps2                    Raw antenna B position (world, m)
 * @param {BladePoseMounting} mounting   Antenna→tip calibration offsets
 * @returns {BladePose}
 */
function computeBladePose(gps1, gps2, mounting) {
  const tipA = {
    x: gps1.x + mounting.antennaA.dx,
    y: gps1.y + mounting.antennaA.dy,
    z: gps1.z + mounting.antennaA.dz,
  };
  const tipB = {
    x: gps2.x + mounting.antennaB.dx,
    y: gps2.y + mounting.antennaB.dy,
    z: gps2.z + mounting.antennaB.dz,
  };
  const centre = {
    x: (tipA.x + tipB.x) / 2,
    y: (tipA.y + tipB.y) / 2,
    z: (tipA.z + tipB.z) / 2,
  };
  const dxH = tipB.x - tipA.x;
  const dzH = tipB.z - tipA.z;
  const bladeWidth = Math.hypot(dxH, dzH);
  // Heading: blade forward is perpendicular to (tipA→tipB), rotated -90° to match
  // the sim's machinePos.hdg convention (machinePos.hdg=0 → forward = +Z, +X = right).
  // tipA→tipB has angle atan2(dxH, dzH); rotating by -π/2 yields blade-forward.
  const heading = Math.atan2(dxH, dzH) - Math.PI / 2;
  const crossSlope = bladeWidth > 1e-6 ? ((tipB.y - tipA.y) / bladeWidth) * 100 : 0;
  return { tipA, tipB, centre, heading, crossSlope, bladeWidth };
}

// Transitional bridge: expose to non-module inline code in index.html.
// Removed once more of index.html migrates to modules.
if (typeof window !== 'undefined') {
  window.computeBladePose = computeBladePose;
}

export { computeBladePose };
