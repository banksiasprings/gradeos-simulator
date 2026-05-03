// src/sim/fake-gps/nmea-stream.js
//
// SIM SHELL — replaced when real F9P hardware arrives.
//
// Generates a stream of fake $GNGGA NMEA-0183 sentences from the sim's
// internal `machinePos`. Models two F9P units mounted at the blade
// corners (per ADR-0002), producing one sentence per antenna per "tick".
//
// When real F9P arrives, this module is REPLACED by an NMEA reader that
// pulls bytes from Bluetooth. nmea-parse.js does not change — it just
// gets fed real bytes instead of these synthetic ones. That's the seam.
//
// This module exists so the entire NMEA pipeline (generate → parse →
// project to local frame → BladePose) is exercised end-to-end during
// sim development, eliminating the "untested data path" risk for the
// hardware bring-up.
//
// See:
//   CONTEXT.md           → "Slice 3 — F9P NMEA bridge"
//   ADR-0002             → dual GPS antennas at blade corners
//   ADR-0003             → NTRIP-corrected fixes (this module models post-correction output)
//   nmea-parse.js        → consumer of the bytes this module produces

'use strict';

/**
 * Format a number to a fixed-width zero-padded integer string.
 * @param {number} n
 * @param {number} width
 * @returns {string}
 */
function padInt(n, width) {
  const s = String(Math.abs(Math.trunc(n)));
  return (n < 0 ? '-' : '') + s.padStart(width, '0');
}

/**
 * Convert decimal degrees to NMEA "ddmm.mmmm" format.
 * @param {number} dec
 * @param {boolean} isLat  true → 2-digit deg, false → 3-digit deg
 * @returns {{ddmm:string, hemi:string}}
 */
function decimalToDdmm(dec, isLat) {
  const hemi = isLat ? (dec >= 0 ? 'N' : 'S') : (dec >= 0 ? 'E' : 'W');
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = String(deg).padStart(isLat ? 2 : 3, '0');
  const minStr = min.toFixed(6).padStart(9, '0'); // mm.mmmmmm — 6 decimal places of arc-minutes
  return { ddmm: degStr + minStr, hemi };
}

/**
 * Compute the XOR checksum for an NMEA sentence body (between '$' and '*').
 * @param {string} body
 * @returns {string}  Two uppercase hex chars
 */
function checksum(body) {
  let cs = 0;
  for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
  return cs.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Convert a JS Date or seconds-since-epoch to NMEA UTC "hhmmss.ss".
 * @param {Date|number} when
 * @returns {string}
 */
function utcStamp(when) {
  const d = typeof when === 'number' ? new Date(when) : (when || new Date());
  const h = padInt(d.getUTCHours(), 2);
  const m = padInt(d.getUTCMinutes(), 2);
  const s = padInt(d.getUTCSeconds(), 2);
  const ms = padInt(d.getUTCMilliseconds(), 3).slice(0, 2); // hundredths
  return `${h}${m}${s}.${ms}`;
}

/**
 * Format a single $GNGGA sentence from a fix snapshot.
 *
 * @param {{
 *   lat: number, lon: number, altM: number,
 *   fixQuality?: '0'|'1'|'2'|'4'|'5',
 *   satCount?: number, hdop?: number,
 *   geoidUndulationM?: number,
 *   timestamp?: Date|number,
 * }} fix
 * @returns {string}  Full sentence including leading '$' and trailing '*HH'
 */
function formatGNGGA(fix) {
  const utc = utcStamp(fix.timestamp);
  const lat = decimalToDdmm(fix.lat, true);
  const lon = decimalToDdmm(fix.lon, false);
  const fixQ = fix.fixQuality || '4'; // default RTK FIXED for sim
  const sats = padInt(fix.satCount != null ? fix.satCount : 12, 2);
  const hdop = (fix.hdop != null ? fix.hdop : 0.6).toFixed(1);
  const alt = fix.altM.toFixed(3);
  const geoid = (fix.geoidUndulationM != null ? fix.geoidUndulationM : 0).toFixed(1);
  // body = everything between '$' and '*'
  const body = `GNGGA,${utc},${lat.ddmm},${lat.hemi},${lon.ddmm},${lon.hemi},${fixQ},${sats},${hdop},${alt},M,${geoid},M,,`;
  return `$${body}*${checksum(body)}`;
}

/**
 * Generate two synthetic NMEA fixes (one per blade-corner antenna) from
 * the sim's machine pose. Returns the bytes as if the F9Ps had just
 * emitted them over Bluetooth.
 *
 * The geometry mirrors the existing `bladeAntennasFromMachinePos()`:
 * machine perpendicular axis = (cos(hdg), -sin(hdg)); tip A is left,
 * tip B is right; both antennas raised by the mounting pole height
 * above their respective tip cutting edges (so the antennas' local Y =
 * tipY - mounting.dy).
 *
 * @param {{x:number, z:number, hdg:number}} machinePos
 * @param {number} machineElev          Local Z of the machine centre (sim Y, in metres)
 * @param {number} bladeHalfWidth       Half the blade width (m)
 * @param {{antennaA:{dx,dy,dz}, antennaB:{dx,dy,dz}}} mounting
 * @param {{geodeticToLocal: Function, localToGeodetic: Function}} frame  Local-frame definition for the site
 * @returns {{ sentenceA: string, sentenceB: string }}
 */
function nmeaFromMachinePos(machinePos, machineElev, bladeHalfWidth, mounting, frame) {
  // Sim cheat: both blade tips at machine-centre elevation (matches blade-antennas.js).
  const tipY = machineElev;
  // Perpendicular-to-heading right vector.
  const perpX = Math.cos(machinePos.hdg);
  const perpZ = -Math.sin(machinePos.hdg);
  // Antenna positions in local frame (tip position - mounting offset).
  const aLocal = {
    x: machinePos.x - perpX * bladeHalfWidth - mounting.antennaA.dx,
    y: tipY - mounting.antennaA.dy,
    z: machinePos.z - perpZ * bladeHalfWidth - mounting.antennaA.dz,
  };
  const bLocal = {
    x: machinePos.x + perpX * bladeHalfWidth - mounting.antennaB.dx,
    y: tipY - mounting.antennaB.dy,
    z: machinePos.z + perpZ * bladeHalfWidth - mounting.antennaB.dz,
  };
  // Local → geodetic for NMEA encoding.
  const aGeo = frame.localToGeodetic(aLocal.x, aLocal.y, aLocal.z);
  const bGeo = frame.localToGeodetic(bLocal.x, bLocal.y, bLocal.z);
  return {
    sentenceA: formatGNGGA({ lat: aGeo.lat, lon: aGeo.lon, altM: aGeo.altM }),
    sentenceB: formatGNGGA({ lat: bGeo.lat, lon: bGeo.lon, altM: bGeo.altM }),
  };
}

if (typeof window !== 'undefined') {
  window.formatGNGGA = formatGNGGA;
  window.nmeaFromMachinePos = nmeaFromMachinePos;
}

export { formatGNGGA, nmeaFromMachinePos, decimalToDdmm, checksum };
