// src/product/positioning/nmea-parse.js
//
// PRODUCT LAYER — ships on real hardware.
//
// Pure NMEA-0183 parser. Initially supports only $GNGGA (the GPS fix
// sentence with position + altitude + fix quality + sat count + HDOP) —
// that's the one sentence the F9P emits at 1–10 Hz that the blade-pose
// pipeline needs.
//
// Real F9P emits these sentences over UART/USB/Bluetooth. The Pi5 reads
// the byte stream and feeds it through this parser. The sim shell
// generates fake $GNGGA strings that round-trip through the same parser
// — proving the pipeline before real hardware arrives.
//
// NO globals. NO I/O. NO transport-layer concerns. Pure string in,
// struct out.
//
// See:
//   CONTEXT.md            → "Slice 3 — F9P NMEA bridge"
//   ADR-0003              → NTRIP architecture (this parser is downstream of the NTRIP-corrected fix)
//   nmea-stream.js (sim)  → produces strings consumed here

'use strict';

/**
 * @typedef {Object} NmeaFix
 * @property {string} sentenceType  e.g. "GNGGA"
 * @property {number|null} timeUTC  UTC time in seconds since midnight, or null if invalid
 * @property {number|null} lat      Latitude in decimal degrees (+N, -S)
 * @property {number|null} lon      Longitude in decimal degrees (+E, -W)
 * @property {FixQuality} fixQuality
 * @property {number|null} satCount
 * @property {number|null} hdop     Horizontal dilution of precision
 * @property {number|null} altitudeM  Altitude (per the sentence — see note below) in metres
 * @property {number|null} geoidUndulationM  Geoid undulation in metres (signed)
 *
 * Note on altitude: $GGA altitude is *orthometric* height (above the geoid)
 * IF the receiver is configured with a geoid model. Default F9P emits
 * ellipsoidal height in this field with geoidUndulationM = 0. Downstream
 * consumers must know which they have. See geoid.js (future) for conversion.
 */

/**
 * @typedef {'NO_FIX' | 'AUTONOMOUS' | 'DGPS' | 'PPS' | 'RTK_FIXED' | 'RTK_FLOAT' | 'ESTIMATED' | 'MANUAL' | 'SIMULATION' | 'UNKNOWN'} FixQuality
 */

const FIX_QUALITY_MAP = {
  '0': 'NO_FIX',
  '1': 'AUTONOMOUS',
  '2': 'DGPS',
  '3': 'PPS',
  '4': 'RTK_FIXED',
  '5': 'RTK_FLOAT',
  '6': 'ESTIMATED',
  '7': 'MANUAL',
  '8': 'SIMULATION',
};

/**
 * Verify a NMEA sentence's checksum. Returns true if valid (or if no checksum present).
 *
 * @param {string} sentence  Including leading '$' and trailing '*HH' if present
 * @returns {boolean}
 */
function verifyChecksum(sentence) {
  const starIdx = sentence.lastIndexOf('*');
  if (starIdx < 0) return true; // no checksum to verify
  const body = sentence.slice(1, starIdx); // strip leading $ and trailing *HH
  const expected = sentence.slice(starIdx + 1, starIdx + 3).toUpperCase();
  let cs = 0;
  for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
  const actual = cs.toString(16).toUpperCase().padStart(2, '0');
  return actual === expected;
}

/**
 * Convert NMEA-format lat/lon ("ddmm.mmmm" + hemisphere) to decimal degrees.
 *
 * @param {string} ddmm     e.g. "4807.038" (lat) or "01131.000" (lon)
 * @param {string} hemi     "N" / "S" / "E" / "W"
 * @returns {number|null}   Decimal degrees, or null if invalid
 */
function ddmmToDecimal(ddmm, hemi) {
  if (!ddmm || !hemi) return null;
  const dot = ddmm.indexOf('.');
  if (dot < 2) return null;
  const degLen = dot - 2; // 2 for lat, 3 for lon
  const deg = parseInt(ddmm.slice(0, degLen), 10);
  const min = parseFloat(ddmm.slice(degLen));
  if (!isFinite(deg) || !isFinite(min)) return null;
  let dec = deg + min / 60;
  if (hemi === 'S' || hemi === 'W') dec = -dec;
  return dec;
}

/**
 * Parse an NMEA UTC time string "hhmmss.ss" to seconds-since-midnight.
 *
 * @param {string} utc  e.g. "123519" or "123519.50"
 * @returns {number|null}
 */
function parseTimeUTC(utc) {
  if (!utc || utc.length < 6) return null;
  const h = parseInt(utc.slice(0, 2), 10);
  const m = parseInt(utc.slice(2, 4), 10);
  const s = parseFloat(utc.slice(4));
  if (!isFinite(h) || !isFinite(m) || !isFinite(s)) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Parse a single NMEA sentence. Currently supports $GNGGA / $GPGGA / $GLGGA.
 * Returns null for unsupported sentence types or sentences with bad checksums.
 *
 * @param {string} sentence  A complete NMEA sentence (with leading '$', optional trailing '*HH')
 * @returns {NmeaFix|null}
 */
function parseSentence(sentence) {
  if (!sentence || sentence.length < 7 || sentence[0] !== '$') return null;
  if (!verifyChecksum(sentence)) return null;
  // Strip leading $ and trailing *HH (if present)
  const starIdx = sentence.lastIndexOf('*');
  const body = starIdx >= 0 ? sentence.slice(1, starIdx) : sentence.slice(1);
  const fields = body.split(',');
  const sentenceType = fields[0]; // e.g. "GNGGA"
  // GGA family — the only sentence Slice 3 supports.
  // Format: $xxGGA,utc,lat,N/S,lon,E/W,fix,sats,hdop,alt,M,geoid,M,age,refId*HH
  if (sentenceType.length === 5 && sentenceType.endsWith('GGA')) {
    return {
      sentenceType,
      timeUTC: parseTimeUTC(fields[1]),
      lat: ddmmToDecimal(fields[2], fields[3]),
      lon: ddmmToDecimal(fields[4], fields[5]),
      fixQuality: FIX_QUALITY_MAP[fields[6]] || 'UNKNOWN',
      satCount: fields[7] ? parseInt(fields[7], 10) : null,
      hdop: fields[8] ? parseFloat(fields[8]) : null,
      altitudeM: fields[9] ? parseFloat(fields[9]) : null,
      geoidUndulationM: fields[11] ? parseFloat(fields[11]) : null,
    };
  }
  return null;
}

/**
 * Parse a stream of NMEA bytes (multiple sentences separated by \r\n or \n).
 * Returns an array of all successfully-parsed fixes, in order.
 *
 * Useful for processing a chunk of bytes received from the F9P.
 *
 * @param {string} stream  One or more NMEA sentences, newline-delimited
 * @returns {NmeaFix[]}
 */
function parseStream(stream) {
  if (!stream) return [];
  const lines = stream.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const fixes = [];
  for (const line of lines) {
    const fix = parseSentence(line);
    if (fix) fixes.push(fix);
  }
  return fixes;
}

if (typeof window !== 'undefined') {
  window.nmeaParseSentence = parseSentence;
  window.nmeaParseStream = parseStream;
  window.nmeaVerifyChecksum = verifyChecksum;
}

export { parseSentence, parseStream, verifyChecksum, ddmmToDecimal, parseTimeUTC };
