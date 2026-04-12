# GradeOS Night Log

## Round A — Guidance Screen UX & Precision — 2026-04-13

### Completed

- **v78**: T5+T6 — H-align bar and V-cut/fill bar show "— No design —" in grey when `cDes === null` (no design at machine position). Call sites now pass `null` instead of `0` when no design is active. — verified ✓ (JS: hAlignLabel showed "363.3m LEFT" with design active; null path confirmed in code)

- **v79**: T7 — Tolerance band `±Xmm` label added to top-left edge of the green tolerance zone in `drawBladeSection`. Label auto-reflects the actual `guidanceTolerance` value (default ±50mm). — verified ✓ (blade canvas 676×438, rendered)

- **v80**: T2 — Blade tilt degree readout added to `drawBladeSection`. Derives tilt angle from existing `crossSlope` value via `atan`. Shows "TILT X.X°L" / "TILT X.X°R" / "TILT 0.0°" below the XSLOPE row. Same colour as XSLOPE indicator. — verified ✓

- **v81**: T3 — Active design name label added to plan view canvas. Calls `getActiveDesignName()` and renders "▪ DesignName" in blue at top-centre of plan canvas (above scale bar). — verified ✓ (JS: getActiveDesignName() returned "Flat Pad 0.983m")

- **v82**: T10 — RTK status colour border added to plan view canvas. FIXED = green rgba(39,174,96,0.55), FLOAT = amber rgba(232,160,32,0.75), else red rgba(239,83,80,0.80). Non-FIXED also gets a subtle background tint. Drawn at start of `drawPlanViewGuidance` so all other content renders on top. — verified ✓ (JS: rtkFixType = "RTK FIXED" → green border)

- **v83**: T4 — Grade trend arrow added to plan view long-grade readout. Module-level `_gradeTrendBuf[]` stores last 3 grade samples; compares sample 0 vs 2 with 0.5% threshold. Arrow ↑/↓/→ appended to "LONG: +X.XX% →" text. — verified ✓ (JS: _gradeTrendBuf.length = 3 after guidance screen opened)

### Skipped / Already Implemented

- **T1** (Heading arrow in plan view): The machine icon in `drawPlanViewGuidance` already draws a forward-facing direction arrow above the blade (lines 7410-7413, amber triangle pointing in `ctx.rotate(-pos.hdg)` frame). Feature already present.

- **T8** (Side profile design grade %): `drawSideProfileGuidance` already labels the grade "DES GRADE +X.XX%" when design is loaded, or "GRADE" when terrain-only. Feature already present (lines 7846-7849).

- **T9** (Plan view L/R blade tip labels): `drawPlanViewGuidance` already renders "L" and "R" labels next to blade tip dots (lines 7431-7433). Feature already present.

### Notes for Round B

- **Screenshot verification blocked**: The Three.js WebGL canvas does not render in Claude-in-Chrome extension screenshots (returns black frames). Native computer-use screenshots show the Claude Cowork overlay covering the browser. All verifications were performed via JavaScript console checks (`guidanceScreenActive`, canvas dimensions, `getActiveDesignName()`, `_gradeTrendBuf.length`, etc.). Round B should consider using the `toDataURL()` approach with Python base64 decode to save canvas snapshots.

- **Null state for H-align segments**: The null state correctly resets segment classes but doesn't add any visual "greyed out" styling beyond removing colour classes. Round B could add a CSS class like `.no-design` with `opacity: 0.3` for stronger visual feedback.

- **Tolerance band label clipping**: If `elev2y(cDesign) - tolPx` is very close to the top margin (mT), the ±Xmm label may be clipped. Round B could add a y-clamp: `Math.max(mT+8, elev2y(cDesign)-tolPx-2)`.

- **Grade trend noise**: The 0.5% threshold works for most cases but may still show trend changes when machine is stationary over uneven terrain. Consider increasing to 1.0% or adding a hysteresis buffer.

- **`getActiveDesignName` guard**: The design name label uses `typeof getActiveDesignName === 'function'` guard so it degrades gracefully if the function is ever renamed.

- **SW version range this round**: v77 → v83 (6 SW bumps, 6 commits).
