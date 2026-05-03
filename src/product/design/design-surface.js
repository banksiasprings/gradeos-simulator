// src/product/design/design-surface.js
//
// PRODUCT LAYER — ships on real hardware.
//
// Thin interface over the design-surface heightmap. Slice 2 keeps the
// underlying storage (the `design[]` Float32Array + `hasD[]` mask in
// index.html) untouched — this module just hides the global lookup
// behind a clean `elevAt(x, z)` method.
//
// Future slices add:
//   - load-from-file (LandXML, DXF — workflow A)
//   - region/operation methods (so the 9 design tools write through this
//     interface instead of mutating the global array directly)
//   - multi-design layering (currently in `designLibrary` global)
//
// See:
//   CONTEXT.md  → "Slice 2 — Design surface seam" (added when this lands)
//   ADR-0001    → blade-target output seam (this module feeds blade-target)

'use strict';

/**
 * @typedef {Object} DesignSurface
 * @property {(x:number, z:number) => (number|null)} elevAt
 *   Sample design elevation at world coords. Returns null if no design
 *   covers that point.
 * @property {() => boolean} isEmpty
 *   True when no design is loaded anywhere on the surface.
 */

/**
 * The current canonical design surface for the running session.
 *
 * Implementation note: in Slice 2 this delegates to the global `dElev`
 * function and `designCount` global defined in index.html. As more of
 * index.html migrates to modules, those globals disappear and this
 * file owns the storage directly.
 *
 * @type {DesignSurface}
 */
const designSurface = {
  elevAt(x, z) {
    if (typeof window === 'undefined' || typeof window.dElev !== 'function') return null;
    return window.dElev(x, z);
  },
  isEmpty() {
    if (typeof window === 'undefined') return true;
    return !(window.designCount > 0);
  },
};

if (typeof window !== 'undefined') {
  window.designSurface = designSurface;
}

export { designSurface };
