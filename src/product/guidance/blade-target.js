// src/product/guidance/blade-target.js
//
// PRODUCT LAYER — ships on real hardware.
//
// Pure blade-target computation. Takes a BladePose (where the blade is)
// and a DesignSurface (where it should be), returns the blade target —
// cut/fill mm at each tip + tolerance state + design longGrade.
//
// This is the canonical product output. Per ADR-0001, every output
// adapter (indicator display, hydraulic CAN, sim driver) consumes a
// BladeTarget. The math here is identical regardless of where the
// output goes — only the adapter changes.
//
// NO globals. NO machine state. NO rendering. Pure function.
//
// See:
//   CONTEXT.md  → "Slice 2 — Design surface seam"
//   ADR-0001    → blade-target output seam
//   blade-pose.js → produces the BladePose this module consumes

'use strict';

/**
 * @typedef {Object} TipTarget
 * @property {number}  cutFillMm    +ve = blade above design (need to CUT). -ve = below (need to FILL).
 * @property {number}  designElev   Design elevation at this tip, in metres, vOffset-adjusted.
 * @property {boolean} isOnGrade    |cutFillMm| < toleranceMm
 */

/**
 * @typedef {Object} BladeTarget
 * @property {TipTarget|null} tipA       Left tip target. null when no design at that point.
 * @property {TipTarget|null} tipB       Right tip target.
 * @property {TipTarget|null} centre     Centre target.
 * @property {number|null}    longGrade  Design longitudinal grade % (slope of design 2 m ahead vs at centre). null when design unavailable.
 * @property {{bandMm:number, anyTipOutOfTolerance:boolean}} tolerance
 * @property {Object}         bladePose  The input pose, for downstream consumers.
 */

/**
 * @typedef {Object} BladeTargetOptions
 * @property {number} [vOffset]      Vertical design offset in metres (default 0).
 * @property {number} [toleranceMm]  Half-band, default 25 mm.
 * @property {number} [fwdDistanceM] Forward sample distance for longGrade, default 2 m.
 */

/**
 * Compute the canonical BladeTarget from a pose and a design surface.
 *
 * Returns null if either input is missing. Returns a partially-populated
 * BladeTarget (with null fields where design coverage is missing) when
 * the design only partially covers the blade.
 *
 * @param {Object} bladePose                                       BladePose from blade-pose.js
 * @param {{elevAt:(x:number,z:number)=>(number|null)}} designSurface
 * @param {BladeTargetOptions} [options]
 * @returns {BladeTarget|null}
 */
function computeBladeTarget(bladePose, designSurface, options) {
  if (!bladePose || !designSurface) return null;
  const opts = options || {};
  const vOffset = opts.vOffset || 0;
  const toleranceMm = opts.toleranceMm != null ? opts.toleranceMm : 25;
  const fwdDistanceM = opts.fwdDistanceM != null ? opts.fwdDistanceM : 2;

  /**
   * @param {{x:number,y:number,z:number}} tip
   * @returns {TipTarget|null}
   */
  const sampleTip = (tip) => {
    const designY = designSurface.elevAt(tip.x, tip.z);
    if (designY === null || designY === undefined) return null;
    const adjustedDesignY = designY + vOffset;
    const cutFillMm = (adjustedDesignY - tip.y) * 1000;
    return {
      cutFillMm,
      designElev: adjustedDesignY,
      isOnGrade: Math.abs(cutFillMm) < toleranceMm,
    };
  };

  const tipA   = sampleTip(bladePose.tipA);
  const tipB   = sampleTip(bladePose.tipB);
  const centre = sampleTip(bladePose.centre);

  // Design longitudinal grade — slope of the *design* surface along blade-forward.
  // Not affected by vOffset (constant across surface). Not blade-vs-design:
  // it tells the operator how the design grade itself flows ahead.
  let longGrade = null;
  const ctrDesignY = designSurface.elevAt(bladePose.centre.x, bladePose.centre.z);
  if (ctrDesignY !== null && ctrDesignY !== undefined) {
    const fwdX = bladePose.centre.x + Math.sin(bladePose.heading) * fwdDistanceM;
    const fwdZ = bladePose.centre.z + Math.cos(bladePose.heading) * fwdDistanceM;
    const fwdDesignY = designSurface.elevAt(fwdX, fwdZ);
    if (fwdDesignY !== null && fwdDesignY !== undefined) {
      longGrade = ((fwdDesignY - ctrDesignY) / fwdDistanceM) * 100;
    }
  }

  const anyTipOutOfTolerance =
    (tipA   && !tipA.isOnGrade)   ||
    (tipB   && !tipB.isOnGrade)   ||
    (centre && !centre.isOnGrade) || false;

  return {
    tipA,
    tipB,
    centre,
    longGrade,
    tolerance: { bandMm: toleranceMm, anyTipOutOfTolerance },
    bladePose,
  };
}

if (typeof window !== 'undefined') {
  window.computeBladeTarget = computeBladeTarget;
}

export { computeBladeTarget };
