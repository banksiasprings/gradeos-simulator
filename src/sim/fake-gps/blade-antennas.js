// src/sim/fake-gps/blade-antennas.js
//
// SIM SHELL — replaced when real F9P hardware arrives.
//
// Generates two synthetic GPS antenna positions from the simulator's
// machinePos, mimicking what real F9P modules will eventually feed in.
//
// When real F9P arrives, this module is REPLACED by an NMEA reader.
// blade-pose.js does not change — that's the whole point of the seam.
//
// See:
//   CONTEXT.md  → "Slice 1 — Blade pose"
//   ADR-0002    → mounting calibration shape

'use strict';

/**
 * Default mounting calibration for the sim's reference machine.
 *
 * Modelled on the Banksia Springs first machine: a vertical pole at each top
 * blade corner (magnetic mount), with the F9P antenna at the top of each pole.
 *
 * dy = -0.5 m means: the blade tip cutting edge is 0.5 m below the antenna
 * phase centre. dx and dz are 0 (poles assumed perfectly vertical for sim).
 *
 * In real-machine deployment this comes from a config file written at install
 * calibration. For sim we hard-code it.
 */
const SIM_BLADE_MOUNTING = {
  antennaA: { dx: 0, dy: -0.5, dz: 0 },
  antennaB: { dx: 0, dy: -0.5, dz: 0 },
};

/**
 * Generate two synthetic GPS antenna positions from the sim's machine pose.
 *
 * Models the existing sim simplification (both blade tips at the machine-centre
 * elevation) by setting both antennas to (machineCentreElev + poleHeight). Any
 * future sim improvement — independent blade tilt from a hydraulic-state model,
 * GPS noise/jitter, RTK FLOAT degradation, dropped fixes — lives in THIS module.
 * The blade-pose math stays pure.
 *
 * The output (gps1, gps2) is what blade-pose.js → computeBladePose() consumes.
 *
 * @param {{x:number, z:number, hdg:number}} machinePos  Sim machine pose
 * @param {number} machineElev          Terrain elevation at machine centre (m)
 * @param {number} bladeHalfWidth       Half the blade width (m) — distance from machine centre to each tip
 * @param {{antennaA:{dx,dy,dz}, antennaB:{dx,dy,dz}}} mounting  Calibration
 * @returns {{ gps1: {x,y,z}, gps2: {x,y,z} }}
 */
function bladeAntennasFromMachinePos(machinePos, machineElev, bladeHalfWidth, mounting) {
  // Perpendicular-to-heading unit vector (right side of machine).
  // Matches the existing sim convention at index.html:3250: perpX = cos(hdg), perpZ = -sin(hdg).
  const perpX = Math.cos(machinePos.hdg);
  const perpZ = -Math.sin(machinePos.hdg);
  // Tip A is the LEFT corner (away from perpendicular vector).
  const tipAx = machinePos.x - perpX * bladeHalfWidth;
  const tipAz = machinePos.z - perpZ * bladeHalfWidth;
  const tipBx = machinePos.x + perpX * bladeHalfWidth;
  const tipBz = machinePos.z + perpZ * bladeHalfWidth;
  // Sim simplification: both tips at machine-centre elevation.
  // Real machine will have independent tip Z values from the hydraulics + ground contact.
  const tipY = machineElev;
  // Antenna position = tip position MINUS the mounting offset (because mounting goes antenna→tip).
  return {
    gps1: {
      x: tipAx - mounting.antennaA.dx,
      y: tipY  - mounting.antennaA.dy,
      z: tipAz - mounting.antennaA.dz,
    },
    gps2: {
      x: tipBx - mounting.antennaB.dx,
      y: tipY  - mounting.antennaB.dy,
      z: tipBz - mounting.antennaB.dz,
    },
  };
}

if (typeof window !== 'undefined') {
  window.bladeAntennasFromMachinePos = bladeAntennasFromMachinePos;
  window.SIM_BLADE_MOUNTING = SIM_BLADE_MOUNTING;
}

export { bladeAntennasFromMachinePos, SIM_BLADE_MOUNTING };
