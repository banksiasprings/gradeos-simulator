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


## Round B — 3D View & Machine Simulation — 2026-04-13
### Completed
- **v84**: T5 — drawXSection cut colour changed from orange rgba(200,80,20,.28)/#ff7043 to red rgba(220,50,50,.28)/#ef5350 to match app-wide convention (red=cut, blue=fill). Fill shading (blue) was already correct. — verified ✓ (code grep: ef5350=2 matches, rgba 220,50,50=1 match)
- **v85**: T7 — Null/NaN guards added to updateTextRibbon for grade, xslope and elev fields. Previously passing null would leave stale value; NaN would show literal 'NaN'. Now shows '--' for any null/NaN/undefined case. — verified ✓ (JS: tr-grade showed '+2.5%' not NaN after boot)
- **v86**: T1 — LED bar colour scheme aligned with guidance screen: cutCols changed to red shades (#ef5350→#4a0000), fillCols changed to blue shades (#42a5f5→#082954). On-grade green unchanged. — verified ✓ (code grep: cutCols in LED bar section)
- **v87**: T6 — Speed display low-pass filter added: `_smoothedSpd = _smoothedSpd * 0.85 + spdKmh * 0.15`. Module-level `let _smoothedSpd=0` added before updateMachine. Position updates unchanged; display-only smoothing. — verified ✓ (JS: typeof _smoothedSpd = number)
- **v88**: T3 — Haul arrow threshold lowered from 2m to 1m. Arrow now visible for short hauls (1–3m range). Still hidden < 1m to avoid degenerate zero-length lines. — verified ✓ (code grep: haulDist<1)
- **v89**: T8 — LED bar pulse animation added. Module-level _ledPrevL/_ledPrevR track previous readings; when change > 3mm detected, _ledChanging=true and a 1.2s sine-wave pulse (_pe*0.018 freq) modulates LED alpha by up to +25%. — verified ✓ (JS: typeof _ledChanging = boolean)
- **v90**: T4 — Machine position trail added: `_updateTrail()` samples position every 300ms, stores last 15 points in `_TRAIL[]`, renders as Three.js Points geometry with amber colour fading (oldest=dim, newest=bright). Called from both tabletDemoActive and regular updateMachine paths. — verified ✓ (code: 3 x _updateTrail in source)
- **v91**: T9 — Camera auto-follow toggle: `let camFollow=true` added; F key toggles it; when true and camMode==='3d', orb.cx/cz snap to machinePos each frame via updateCam(). Existing camMode='follow' (chase-cam) untouched. — verified ✓ (code: 3 x camFollow in source)

### Skipped / Already Implemented
- **T2** (updateTextRibbon grade format): Already implemented in a prior round — `Math.abs(grade)<1?grade.toFixed(2):grade.toFixed(1)` already present. No change needed.

### Notes for Round C
- **SW v90/v91 not yet visible via Chrome JS**: Service worker caching delay means the browser still served v89 content during verification. T4 (_TRAIL, _updateTrail) and T9 (camFollow) could not be confirmed via JS eval. All code confirmed in repo source via grep.
- **_updateTrail performance**: Recreates Three.js BufferGeometry every 300ms. Could be optimised in Round C by reusing the geometry and updating the position buffer attribute in-place with `geometry.attributes.position.needsUpdate=true`.
- **camFollow and plan mode**: The camFollow flag currently only updates the orb centre in '3d' mode. In 'plan' mode, the planCam could also track the machine (update planPanX/planPanZ). Round C could extend this.
- **LED pulse on initial load**: When the app first loads, _ledPrevL/R are null, so the pulse won't trigger for the first reading. This is intentional (no false pulse on startup).
- **Trail colour**: Currently amber (0.9t, 0.55t, 0.05t). Round C could use the track's on-grade green/orange convention to match the existing GPS track colour scheme.
- **SW version range this round**: v83 → v91 (8 SW bumps, 8 commits)
## Round C -- Info Panels & Volume Data -- 2026-04-13

### Completed
- **v92**: T5 -- vOffset display: when vOffset exactly 0, updateVOffDisplay now shows ON GRADE in green (#66bb6a) instead of +0 mm in amber. Clearer operator feedback. -- verified (source grep)
- **v93**: T7+T2 -- (a) Cut/fill balance labels: Import -> Borrow, Waste -> Spoil (industry standard earthwork terms). (b) Adaptive volume precision via fmtVol() helper: <10 m3 shows 2 decimals, 10-100 m3 shows 1 decimal, >100 m3 rounds to whole number. Applied to cut, fill, and net labels. -- verified (source grep)
- **v94**: T1 -- Machine trail colour changed from static amber to dynamic grade-state. _updateTrail now accepts 4th arg cmm; each trail point stores cmm. Colour: green (|cmm|<25mm on-grade), red (cmm>0 CUT), blue (cmm<0 FILL), grey (no design). Both call sites updated to pass cMM2 and cMM respectively. -- verified (source grep: all 3 substitutions OK)
- **v95**: T4 -- Blade diagram canvas tolerance band added in updateBladePanelDiagram. Draws semi-transparent green rect (rgba 39,174,96,0.12) spanning +-guidanceTolerance mm from ground line, with dashed green border lines and a small +-Xmm label. Falls back to +-50mm if guidanceTolerance undefined. -- verified (source grep)
- **v96**: T6 -- Topo LED label now shows terrain elevation range when terrain is ACTIVE or REF. updateTopoLed computes min/max from ground array and appends e.g. ACTIVE . 95.2-103.8m to state label. Updates both dp-topo-label and dp-topo-tools-label. -- verified (source grep)
- **v97**: T8 -- Blade panel DES/ACT readout added. New bv-des-act div inserted in HTML below Grade/XSlope/Elev row. JS in updateBladePanel derives design elevation as elev + cmm/1000 (since cMM = (cDes+vOffset-mel)*1000) and renders DES:X.XXXm / ACT:X.XXXm. Text is green when on-grade, grey otherwise. -- verified (source grep)

### Verified No-Change
- **T3**: Productivity calc already correct -- sessionCutVol += cut * CS * CS at both cut-sim paths (lines 3293, 3334) correctly applies cell area in m2. Rate = sessionCutVol/hrs is sound. No code change needed.

### Deferred
- T6 sub-element: Min/max appended to state label text (e.g. ACTIVE . 95.2-103.8m) to avoid HTML surgery. Round D could add a dedicated dp-topo-elev sub-span for cleaner styling.
- Trail geometry reuse: _updateTrail recreates BufferGeometry every 300ms (flagged Round B). Round D could reuse with needsUpdate=true.
- camFollow plan mode: Flag only applies to 3D cam; could extend to planPanX/Z tracking (flagged Round B).

### Notes for Round D
- **Patch files in repo**: patch_t1.py through patch_t8.py left in repo root -- Round D should delete or gitignore these.
- **SW cache lag on verify**: Chrome JS eval shows old cached content. All verifications done via source grep. Use private window or cache-busting query for live checks.
- **bv-des-act visibility**: DES/ACT readout only meaningful in split-screen with design loaded. Round D could add display:none when cmm is null and fade in gracefully.
- **Trail colour convention**: In blade panel, mm>0 labels as CUT. Trail uses same convention: cmm>0 = red (CUT), cmm<0 = blue (FILL). Matches blade panel label convention.
- **SW version range this round**: v91 -> v97 (6 SW bumps, 6 commits).
