# GradeOS — CONTEXT

> Open-source RTK GPS machine control for earthmoving. Hardware target: under $2,000 AUD per machine vs $50,000+ for Trimble Earthworks.

This document is the canonical "what is GradeOS" anchor. Read it first in any new session. If something here is wrong, update it; if something here conflicts with the code, the code is wrong (or this doc is stale — fix one of them).

---

## Identity (locked 2026-05-03)

**GradeOS is a real machine control product, developed simulator-first.**

The end goal is for software from this repo to run on a Pi5 + u-blox F9P RTK module bolted to a real dozer, grader, or loader. The simulator is the development environment — it provides fake terrain, fake GPS, and fake machine physics so the product can be built and tested without a $300k machine in the workshop. When real hardware arrives, the simulator's "world" layer is replaced; the machine-control core is the same code.

### Implication: two layers, currently tangled

Every feature in this repo belongs to exactly one of these layers:

- **Product layer** (ships on real hardware) — terrain model, design surface, position fix → blade guidance math, operator display, design-tool data structures, volume/cut-fill calculation, survey/as-built data, design-file I/O.
- **Sim shell** (replaced when hardware arrives) — THREE.js 3D rendering, terrain generators, fake GPS noise/jitter, fake machine kinematics, camera modes, dozer silhouettes, scenario scripts.

These layers are currently mixed inside a single ~10,000-line `index.html`. Re-establishing the seam between them is the highest-priority architectural work, because:
- Without the seam, every new feature accidentally tangles product and sim concerns.
- Without the seam, you can't tell which work moves the product forward vs. only polishes the demo.
- Without the seam, you can never swap the sim for real hardware — there is nothing to swap *into*.

## End-user (locked 2026-05-03)

**The user is an owner-operator: either a farmer running their own machine on their own land, or a small civil contractor (1–2 machines) doing dams, drains, bays, or farm tracks.**

These are treated as *one* user in v1.0 because they look operationally identical:
- One machine, one site, one operator at a time.
- No project portfolio, no billing system, no multi-operator dispatch, no user accounts.
- Priced out of Trimble. Under-$2k hardware is genuinely the only commercial machine-control they can afford.
- Wants the *machine* to do the right thing — does not want a CRM.

### User-shaped scope cuts

These are out for v1.0 because they serve a different user we have *explicitly* deferred:

- ❌ **Fleet operations** (multiple machines coordinating). Belongs to a "large contractor" user we haven't committed to.
- ❌ **Multi-operator user accounts / permissions / login.**
- ❌ **Project portfolios, billing, billable hours, customer management.**
- ❌ **Operator-training mode** (that's the simulator-as-product identity, ruled out).
- ❌ **Vendor / OEM / white-label features.**

### Existing features in tension with this user

These are flagged as suspect — to be revisited when we draw the product/sim seam:

- **Fleet mode** (3 AI machines on auto-steer) — likely sim-shell-only demo, not product.
- **Multi-machine MQTT telemetry** (in roadmap) — defer indefinitely; that's a contractor-fleet feature.

## Non-identities (explicitly ruled out)

- ❌ **Simulator-as-training-tool.** The sim is a means, not the product.
- ❌ **Pitch demo only.** GradeOS is meant to deploy, not just to impress.
- ❌ **Research playground without a product target.** There is one product; everything else is scaffolding for it.

---

## Operating modes (locked 2026-05-03)

GradeOS supports two output modes for blade guidance, in this order:

### v1.0 — Indicate-only

The product computes a **blade target** ("blade tip A should be 50mm above current; tip B 30mm below; longitudinal grade +1.2%") and renders it on the operator display. The human moves the hydraulics by hand. No physical control of the machine. Works on *any* dozer/grader/loader. No safety certification needed. No actuator hardware required. This is what ships first and is the entire user-visible product on v1.0 hardware.

### Future — Auto-blade (for factory-prep'd machines)

For machines that ship from factory with auto-blade-ready hydraulics and a CAN interface (e.g. Cat XE, Komatsu iMC, John Deere SmartGrade-ready), GradeOS sends blade target commands directly to the valve controller over CAN. **The blade-guidance math is identical** to indicate mode — only the *output* layer differs.

### Architectural consequence: pluggable blade-target output

The product layer must produce a **blade target** as its canonical output, and the rendering/actuation must be a *pluggable adapter* downstream of it. This means:
- Indicate output: blade target → 3-bar LEDs, text ribbon, cut/fill bar, blade canvas. (v1.0)
- Hydraulic output: blade target → CAN command frames to factory valve controller. (future)
- Sim output (for the sim shell): blade target → drives the simulated machine kinematics, so the operator-display logic can be exercised against a live blade-target stream during dev.

If we draw this seam correctly *now*, auto-blade is a future plug-in adapter, not a rewrite. If we don't, it's a rewrite.

### Auto-steer (current sim feature) — separate concern

"Auto-steer" in the current sim drives the *machine path* (boustrophedon strip passes), not the blade. That's a different decision (autonomous-vehicle territory) and is **out of scope** for v1.0 product. It stays as a sim-shell scenario for demo/testing only.

---

## Canonical workflow (locked 2026-05-03)

**Workflow B — In-app design — is the canonical happy path.**

End-to-end, an owner-operator using GradeOS does this:

1. **Site setup.** Drive onto site. RTK base + rover lock. Coordinate frame established (UTM zone or local grid).
2. **Existing terrain.** Capture the current ground surface — either by driving the machine/rover over the site (live survey) or by loading a prior survey file (CSV import already supported).
3. **Design.** Create the target surface in-app using the design tool suite: Flat Pad, Slope, Crown, Dam, Best-Fit, Batter, Irrigation Bay, Profile, Align. Adjust v-offset.
4. **Grade.** Operator drives. GradeOS shows live blade guidance (3-bar LEDs, text ribbon, cut/fill bar, blade canvas, plan/long/cross-section views) against the design. Indicate-only: operator moves the blade.
5. **As-built capture.** Passive — every cell the blade crosses is recorded.
6. **Verify and report.** Tolerance map, coverage map, volumes, productivity, fuel, hours. Export as-built CSV. Optional job report.

### Supported workflow variants

- **Workflow A — Pre-designed grading** (load LandXML/DXF instead of designing in-app). Skip step 3's in-app design; load a file. **Deferred to post-v1.0** — design-file import is roadmap, not built.
- **Workflow C — Reference-only / no design** (set a target elevation or slope, grade by indicator only). Express as a degenerate case of step 3 (a flat-pad design at the chosen elevation). No new code path needed.

### Workflow → product surface mapping

This dictates what is product vs sim shell. **Each row is a product capability** that must run on real hardware:

| Workflow step | Product capability | Currently in repo |
|---|---|---|
| Site setup | RTK fix tracking, base/rover model, coordinate frame | Sim-only (fake fix) |
| Existing terrain | Survey ingest (live + CSV), terrain raster | Sim-only generators + CSV import |
| Design | The 9 design tools, design-surface data structure, v-offset | **Built — these are product** |
| Grade | Blade-target computation, blade-target output adapter (indicate) | **Built — this is product core** |
| As-built capture | Pass tracking, coverage mesh, tolerance check | **Built — product** |
| Report/export | Volumes, productivity, as-built CSV, job report | **Built — product** |

The **3D view, terrain generators, fake GPS noise, fake machine kinematics, camera modes, dozer silhouettes, Scout demo** are all **sim shell** — replaced or removed when real hardware arrives.

---

## v1.0 definition (locked 2026-05-03)

**v1.0 is achieved when GradeOS, running indicate-only on real hardware (Pi5 + u-blox F9P + 10" sunlight-readable touchscreen), completes a real grading job at Banksia Springs Farm — pushing actual dirt against an in-app design, with as-built capture, with the live operator display.**

This is a single binary acceptance test. The dozer pushed dirt with GradeOS guiding, or it didn't. No subjective UI quality bar.

### v1.0 in scope (the must-work set)

These features must work end-to-end on real hardware to call it v1.0:

- RTK fix ingest (real F9P NMEA stream, replacing the fake GPS).
- Coordinate frame (UTM zone for the site).
- Existing-terrain ingest from prior CSV survey.
- The 9 in-app design tools (Flat Pad, Slope, Crown, Dam, Best-Fit, Batter, Irrigation Bay, Profile, Align).
- V-offset (±500 mm) with preset memory.
- Blade-target computation — the canonical guidance output.
- Indicate output adapter — 3-bar LEDs, text ribbon, cut/fill bar, blade canvas, plan view, long-section, cross-section, grade HUD bar (i.e. the existing Field/Operator Mode is the v1.0 operator screen baseline).
- Blade-tip geometry calibration (configure where tips are relative to the GPS antenna on the real machine).
- As-built capture (pass-tracking, coverage mesh).
- Tolerance check (±25 mm default).
- Save/load site (existing JSON format is fine).
- Job report (basic — volumes, hours, tolerance summary).

### v1.0 explicitly out of scope (defer post-v1.0)

These are cool, but not on the critical path. They stay in the repo where they exist (they're not bugs), but they do not block v1.0:

- Pass heat map, drainage flow lines (D8), slope warning overlay, daylight line, contour labels, grade direction arrows.
- Replay system, screenshot tool.
- Fleet mode, multi-machine coordination, MQTT telemetry.
- Scout autonomous rover (separate firmware product).
- All 5 named demo scenarios — these are sim-shell only.
- D11T silhouettes, multiple machine-type silhouettes (D8 / motor grader / wheel loader) on real hardware (the operator already knows what they're driving).
- Pitch card / investor demo card.
- Productivity rate, fuel burn, cost estimation, ETA — display-only nice-to-haves.
- Design-file import (LandXML, DXF) — workflow A, post-v1.0.
- Auto-blade (CAN output adapter) — explicitly deferred per [ADR-0001](docs/adr/0001-indicate-only-with-pluggable-blade-output.md).
- Auto-steer.

---

## Architecture approach (locked 2026-05-03)

**Incremental extraction of vertical slices, using native ES modules. No build step.**

The existing 10,272-line `index.html` works and stays working. We do not big-bang restructure it, do not run two codebases side-by-side, and do not hack F9P in before establishing a seam.

### Vertical-slice rule

Every extraction is a **vertical slice** that cuts through *all* layers end-to-end for one small thing:

- Picks one product concept (e.g. blade-target computation).
- Defines the canonical data structure for that concept.
- Pulls the relevant math/logic into a new ES module under `src/product/`.
- Replaces *all* inline call sites in `index.html` with calls to/reads from the new module.
- Verifies the simulator still works identically end-to-end before merging.

Horizontal slicing — "extract all the math in one PR, all the rendering in the next, all the data structures in the next" — is forbidden. It produces a long stretch where nothing works and bugs hide between layers.

### Tooling: native ES modules, no build step

- `<script type="module" src="./src/product/...">` — browsers support this directly.
- No npm install, no webpack, no build pipeline. PWA service worker still caches everything correctly.
- Pi5 deployment will introduce a tiny bundler (esbuild) later. Not now.
- Tests come *after* the first 2–3 extractions, once the pattern is proven.

### Folder structure (target)

```
src/
  product/         everything that ships on real hardware
    terrain/         heightmap data structure, ingest
    design/          design surface + 9 design tools
    guidance/        blade-target computation
    output/          adapters that consume blade target
      indicator.js     v1.0 — drives operator display
      hydraulic.js     future — drives CAN valve controller
      sim.js           drives simulated machine kinematics
    as-built/        pass tracking, coverage, tolerance
    volumes/         cut/fill/net
  sim/             everything thrown away on real hardware
    render-3d/       THREE.js scene
    fake-gps/        RTK noise/jitter model
    physics/         machine kinematics
    terrain-gen/     procedural Hilly Farm, etc.
    camera/          camera modes
    scenarios/       demo scenarios
```

Folders are created lazily — each slice creates the directories it needs. We don't build empty scaffolding upfront.

### Polish work during extraction

- **Frozen** in any area being actively extracted (don't move the target).
- **Allowed** in unrelated areas of `index.html` until those areas come up for extraction.
- **Encouraged** *inside* a module once it's extracted (because it's now isolated and testable).

---

## Slice 1 — Blade pose (locked 2026-05-03)

**The first vertical slice extracts blade-pose computation only. NOT blade-target. NOT cut/fill. NOT design comparison.**

This is the foundation. Every other slice flows through it.

### Glossary distinction (canonical)

- **Blade pose** — where the blade physically is in space. Derived from GPS antenna position(s) and the blade's mounting geometry. No design. No terrain. No cut/fill. Just position.
- **Blade target** — where the blade *should* be, derived from blade pose + design surface. Includes cut/fill mm, tolerance, etc. **This is a later slice.**

The display, in Slice 1, shows raw blade-pose values only (tip A elevation, tip B elevation, centre, cross-slope, heading). Cut/fill, DES, tolerance band, on-grade colours come later when the design seam is extracted.

### Why this scope, not bigger

Past attempts to mash terrain + design + blade math into one place have produced "the simulator was going crazy" — too many moving parts interacting. By isolating blade pose (which only depends on GPS + mounting geometry) we have a slice with very few inputs and one clear output.

### Slice 1 deliverables

- New module: `src/product/guidance/blade-pose.js` exporting:
  - `BladePose` struct shape (JSDoc, no TypeScript yet).
  - `computeBladePose(gpsAntennas, mountingConfig) → BladePose`.
- `index.html` loads it via `<script type="module" src="./src/product/guidance/blade-pose.js">`.
- Every place currently computing blade tip positions / cross-slope / blade heading inline is replaced with `computeBladePose()` and reads from the struct.
- Every display consumer (3-bar LED bar values, blade canvas, plan view blade rectangle, long-section blade indicator, cross-section blade line, grade HUD readouts) reads from the struct.
- Sim still runs end-to-end with no behavioural change.

### Slice 1 explicitly out of scope

- **Design surface.** Not loaded. Not consulted. Not compared. The DES/ACT readout, on-grade colouring, cut/fill mm, tolerance band — all left untouched in `index.html` for this slice (still using their existing inline code paths). They get extracted in a later slice when we add the design seam.
- **Terrain heightmap.** Same. Untouched.
- **F9P / real hardware.** Not yet — the GPS source is still the simulated dual-GPS model.
- **Tests.** Added *after* the slice lands and the pattern is proven.

### Vocabulary lock

Use **blade pose** for "where the blade is" and **blade target** for "where the blade should be." These two terms must not be used interchangeably in code, comments, or docs. If something is currently called blade-target but only contains pose info (no design comparison), rename it.

---

## Decisions log

### 2026-05-03
- **Identity = real machine control product, simulator-first.**
- **End-user = owner-operator (farmer + small contractor).** C/D/E user types deferred indefinitely.
- **v1.0 ships indicate-only.** Auto-blade is on the long-term roadmap for factory-prep'd machines; architecture must keep a pluggable blade-target output seam so auto-blade is a future adapter swap, not a rewrite. (See [ADR-0001](docs/adr/0001-indicate-only-with-pluggable-blade-output.md).)
- **Auto-steer (machine path control) is out of scope for v1.0 product.** Sim-shell-only demo feature.
- **Workflow B (in-app design) is the canonical happy path.** Workflow A (design-file import) deferred post-v1.0. Workflow C (no design) is a degenerate case of B.
- **v1.0 = real grading job at Banksia Springs.** Indicate-only on Pi5 + F9P. Single binary acceptance test. Scope cuts above are explicit.
- **Architecture: incremental vertical-slice extraction, native ES modules, no build step.** Each slice cuts top-to-bottom for one small thing; sim must keep working at every commit.
- **Slice 1 = blade-pose seam only.** Pure GPS + mounting geometry → BladePose struct → display consumers. Design and terrain explicitly excluded. *Blade pose ≠ blade target* — the latter is a later slice. **LANDED 2026-05-03 (SW v110, commit `d58df3d`).**
- **Sensor topology = dual u-blox F9P on poles at blade corners, magnetic mount, Bluetooth to Pi5.** Cross-slope is geometric (tip-to-tip), not IMU-fused. Optional body IMU is post-v1.0 redundant input. (See [ADR-0002](docs/adr/0002-dual-gps-on-blade-corners.md).)
- **Slice 1 display rule = option (ii): cleanly disable cut/fill display until Slice 2.** Cut/fill mm bars, DES/ACT readouts, tolerance band, on-grade colours show "— No design —" placeholder during Slice 1. Pose-derived values (tip elevations, cross-slope, heading) shown live. Forces the architectural seam to be visible; stops the tangled inline code from running.
- **Slice 2 = design surface + blade-target seam.** `designSurface.elevAt(x,z)` interface wraps existing `dElev` global. Pure `computeBladeTarget(bladePose, designSurface, options) → BladeTarget` produces the canonical product output (cut/fill mm at each tip, tolerance state, design longGrade). All cut/fill displays restored through the seam. Verified: 1m-above design → 1000.0 mm CUT exact; design = pose.centre.y → ON GRADE green. **LANDED 2026-05-03 (SW v111).**
- **Slice 3 = NMEA bridge.** Three new modules: `nmea-parse.js` (pure $GNGGA parser), `local-frame.js` (lat/lon ↔ local x/z, flat-earth approx for sim, UTM-ready interface), `nmea-stream.js` (sim-shell NMEA byte generator). Update loop now routes through `machinePos → nmeaFromMachinePos → parseSentence → geodeticToLocal → computeBladePose`. Same data path real F9P bytes will take when hardware arrives — only `nmea-stream.js` gets replaced by an NMEA reader. Verified: round-trip lat/lon noise <0.5 mm, altitude exact, pose values match direct path to sub-mm. **LANDED 2026-05-03 (SW v112).**
- **Slice 4a = Dashboard + boot flow.** App boots to a Trimble-style Dashboard (yellow status bar + 3 tiles + Start button) instead of straight into the work screen. Tiles show live data (RTK status, mounting offset, design name). Tap Start → work screen; tap Back → dashboard. Floating back button on the work screen returns. Pure UI work — no module changes. **LANDED 2026-05-03 (SW v113).**
- **Slice 4b = Cab Screen shell rebuild.** New work-screen layout matching the Trimble cab archetype: yellow status bar across top, two top-centre offset numerics, top horizontal alignment LED bar, two vertical cut/fill LED bars (left tip A, right tip B), centre pane (the relocated 3D canvas), configurable bottom readout strip with 3 hardcoded defaults (centre cut/fill / cross-slope / long grade), right-side icon toolbar with 7 stubbed buttons. CSS grid layout. Body class `cab-mode` hides the old topbar/UI when active. The Three.js canvas relocates from `#viewport` into `#cab-centre-pane` on activation, and the renderer is resized accordingly. All readouts wire through the existing BladeTarget/BladePose pipeline — no module changes. **LANDED 2026-05-03 (SW v114).** Slice 4c will add Edit Text Ribbon + Edit Right Toolbar UIs.
- **Slice 4c = Multi-pane layouts + Change View overlay + Edit Text Ribbon + localStorage persistence.** Centre pane now hosts 1, 2, or 3 sub-panes via CSS grid layout presets. 5 presets: Single / Vertical Split / Horizontal Split / 1-Big + 2-Small / 3 Equal Columns. Each pane shows one view type from the 4-type catalog (3D / Plan / Cross-section / Long Section). Per-pane swap by tapping the pane header → view-type picker overlay. Change View overlay reachable from the right-toolbar Change View icon. Edit Text Ribbon modal lets the operator pick up to 5 readouts from the categorised catalog (Guidance / Position / System / Time, 13 items total) with reorder buttons. All choices (layout, panes, ribbon) persist to `localStorage` key `gradeos-cab-state-v1` and restore on reload. Existing canvases (plan, xsec, side-profile, three.js) relocate into the active panes; not-shown canvases return to their original parents. **LANDED 2026-05-03 (SW v115).** Edit Right Toolbar modal deferred to Slice 4d.
- **Slice 10 = Multi-viewport 3D rendering + offset reorder + offline-distance readout** (Steven's testing-blocker fix):
  - **Multi-viewport 3D rendering** — the cab centre area is now a single Three.js canvas. Per-frame, the renderer fires N times (one per visible pane) with `setViewport` + `setScissor` and a different camera each time.
    - **`three`** view = existing perspective orbit camera.
    - **`plan`** view = orthographic top-down at machine, North-up oriented to travel direction.
    - **`long`** view = orthographic side-on, looking from 25 m to the right of the machine (so you see elevation profile along travel = long section).
    - **`cross`** view = orthographic blade close-up, looking from 12 m behind the machine forward at the blade (so you see cross-section / blade tip elevations).
    - All cameras update per-frame to track machinePos/heading.
  - Replaces the old "relocate canvas into pane" approach. Canvas is now a single backdrop spanning the centre pane area; pane chrome (header + border) is transparent overlay.
  - Legacy 2D draws (drawPlanViewGuidance / drawXSection / drawSideProfileGuidance) still fire but to invisible legacy canvases — to be retired in the sim cleanup slice.
  - **H-Align Offset moved to centre cell** (was right). New order: Elevation | H-Align | Working Surface. Spatial mapping with the centre LED bar above.
  - **Two new text ribbon catalog items**: `offlineDist` (signed mm distance to selected line, "ON LINE" when within 50 mm) and `chainage` (distance along line / total length).
  - **LANDED 2026-05-03 (SW v126).** Note: this slice deliberately accepts higher GPU cost (rendering scene N times per frame instead of once) to give Steven the views he can actually test with. Lite Mode still applies (pixel ratio 1, no shadows). Sim demotion cleanup is the long-term answer to the per-frame cost.

- **Slice 11 = Sprite-based cab panes (multi-viewport rolled back)**. Steven's CPU couldn't keep up with rendering the scene N times per frame (Slice 10's tradeoff). The new approach: render the dozer ONCE at boot to four PNG sprites (`perspective`, `top`, `side`, `blade`), then each cab pane is a 2D canvas that draws the static sprite. Per-pane LIVE overlays (Slice 12) carry the dynamic information. New modules: `src/sim/render/dozer-model.js` (clean primitive dozer mesh — bodies, tracks, blade, ROPS) and `src/sim/render/dozer-sprites.js` (off-screen Three.js renderer + sprite cache). Pane content is now sprite + 2D overlay, not a 3D viewport. **LANDED 2026-05-03 (SW v127).**

- **Slice 11.5 = Sketchfab-quality dozer model (loaded GLTF)** — Steven preferred a high-detail downloaded bulldozer over the clean primitive shapes. `dozer-sprites.js` now loads `assets/dozer/scene.gltf` (1 MB GLTF + 8.5 MB textures, symlinked from outside the repo so no asset bloat in git). `_normaliseDozer()` detects which axis is the long axis (`'x'` or `'z'`) and stamps it as `userData.lengthAxis` so cameras can adapt. Removed an unwanted yellow label that the placeholder sprites had. Fixed a dead `_cabPositionThreeCanvas` reference left over from the multi-viewport rollback. **LANDED 2026-05-03 (SW v128).**

- **Slice 11.6 = Single shared sprite renderer + localStorage cache** — The naive sprite generator created a fresh `WebGLRenderer` per sprite, which on Safari triggered a context-flood cascade (browser tops out around 16 contexts). Refactored to a single off-screen renderer reused across all sprites, sequenced through a Promise chain. Rendered sprites also cached in `localStorage` under `gradeos-dozer-sprites-v2`, so subsequent loads skip Three.js entirely. **LANDED 2026-05-03 (SW v129).**

- **Slice 11.7 = Sprite orientation + lighting + tip marker fixes** — Cross-section and long-section sprites were swapped because the GLTF model was facing `+X` natively, not `+Z`. Fixed by detecting the model's actual long-axis (`lengthAxis === 'x'` vs `'z'`) and adapting the side / blade cameras accordingly. Brightened the off-screen scene's lighting (the model was rendering very dark). Added a small red blade-tip cut/fill marker on each sprite — the operator's reference point for cut/fill at the centre of the cutting edge. **LANDED 2026-05-03 (SW v130).**

- **Slice 12 = Live cut/fill + alignment overlays on cab panes**. Each pane's view type gets a tailored 2D overlay drawn on top of its static sprite, reading from cached `BladeTarget` / `BladePose` / `selectedGuidanceLine`:
  - **`cross`** — design line + tolerance band + cut/fill arrows at each blade tip.
  - **`long`** — design grade line + centre cut/fill arrow + grade label.
  - **`plan`** — alignment polyline + recorded points + (later) heading.
  - **`three`** — minimal cut/fill colour ring at the centre blade-tip marker.
  - Tolerance band from `cabSysState.defaultToleranceM`. Cut/fill colours: red CUT, green ON-GRADE, blue FILL. **LANDED 2026-05-03 (SW v131).**

- **Slice 13 = Designs toolbar button + plan-sprite-rotates-with-heading + overlay gating**. Three changes that landed together:
  - Plan-pane sprite rotates with `bladePose.heading` so the dozer image *is* the heading indicator (no separate yellow icon needed).
  - "Designs" button added to the cab right-toolbar (icon `📐`) — opens the existing legacy Designs panel.
  - Overlays were drawing fake guidance even when no design was active. Now gated on a real `bladeTarget` having design-derived data; otherwise the LEDs go blank and the overlays show nothing. **LANDED 2026-05-03 (SW v132).**

- **Slice 13.1 = Steering, plan-overlay revert, Designs button visibility**. Three fixes from Steven's first Safari test of Slice 13:
  - WASD steering was backwards (`A` turned right, `D` turned left). Pre-existing bug exposed by the rotating sprite. Swapped.
  - Plan overlay had been pinned to "world rotates with heading" + "sprite also rotates", double-counting heading and producing a confusing spinning effect. Reverted to NORTH-UP: world translates only; sprite carries the heading.
  - Static HTML toolbar didn't include a 'designs' button (only Slice 13's runtime path added it), so users with persisted toolbars saved before Slice 13 never saw it. Added to static HTML AND auto-inserted (after 'record') by `cabLoadState` for older persisted toolbars. **LANDED 2026-05-03 (SW v133).**

- **Slice 14 = Plan-pane N-up / Track-up toggle + 1 m grid** (Google-Maps-style orientation). The cab's plan pane gets two orientation modes selectable via a small SVG compass button in the top-right:
  - **N-up** (default): map fixed (north always at top); dozer sprite rotates with heading. Same as Slice 13.1.
  - **Track-up** ("heading-up"): dozer sprite stays pointed up; world translates AND rotates by `+heading` underneath, so the map turns as the machine turns. Matches Google Maps' driving mode.
  - **1 m reference grid** drawn on the plan pane: faint lines at every 1 m, medium at 5 m, bold at 10 m. Driving in a square is now visually obvious in both modes.
  - Compass button's N-marker triangle tracks geographic north — straight up in N-up; rotated by `-heading` (CSS) in Track-up to show where actual north is relative to the rotated map. Mode label underneath ("N-UP" / "TRACK") makes the current state obvious.
  - State persists via `cabSysState.planOrientationMode` through the existing sys-state path. New shared helper `_planW2p` builds the world→pixel transform; the grid, the overlay, and any future plan-view consumers share one definition.
  - **LANDED 2026-05-03 (SW v134).**

- **Slice 14.1 = Z-order fix + drop coordinate labels + sprite forward-up flip**. Three fixes from Steven's first Track-up test:
  - Dozer was painted UNDER the grid because `_drawPlanOverlay` (which included the grid) ran AFTER the sprite. Split the grid into a new `_drawPlanGridBackground` pass called BEFORE the sprite. Dozer body now occludes the grid where it sits; alignment line + recorded points + scale legend keep drawing after the sprite (above the dozer).
  - Removed the `x,z` coordinate labels at every 5 m intersection per Steven's feedback ("just the grid is fine").
  - Top-view sprite was rendered with forward at IMAGE BOTTOM. Cause: the sim uses a left-handed `+Z = forward, +X = right, +Y = up` convention; Three.js camera math is right-handed; looking straight down can have either forward-up + right-mirrored OR forward-down + right-correct, but not both, without flipping something. Cleanest fix at the canvas: `ctx.scale(1, -1)` when drawing the plan-view sprite. Forward now ends up at image top while +X stays on the right, in both N-up and Track-up modes.
  - **LANDED 2026-05-03 (SW v135).**

- **Slice 14.2 = Track-up rotation sign fix**. The track-up world rotation was `-heading` when it should have been `+heading`. Sim's machine-forward at heading h is `(sin h, cos h)` in `(X, Z)`; to rotate that vector to `(0, 1)` (which the existing pixel mapping `cy - dz*ppm` sends to screen-up) we need to apply rotation by `+h` (CCW), not `-h`. Symptom Steven reported: dozer always pointing up but the world turning the *wrong direction* under it. Forward-of-machine ended up behind on screen. Compass needle code unaffected — it correctly tracks where geographic +Z lands on screen, which is `(-sin h, cos h)` under the corrected math. **LANDED 2026-05-03 (SW v136).**

- **Slice 14.3 = Drop bottom-left plan-pane scale badge**. Removed the `±30 m · 1 m grid · TRACK-UP` text overlay. The compass-button label in the top-right already shows the mode, and the grid's spacing is self-evident from the line tiers. Dropping the redundant badge unclutters the small cab-pane canvas. **LANDED 2026-05-03 (SW v137).**

- **Slice 14.4 = Smooth heading for cab rendering rotations**. Track-up plan view wobbled visibly while standing still because simulated GPS noise on `bladePose.heading` flowed straight into the world-rotation transform every frame. Introduced `window._cabSmoothedHeading` — an exponential moving average (α = 0.15) applied via a wrap-aware shortest-angle-diff so it tracks raw heading without twitching. Used ONLY by the three rendering rotation sites: `_planW2p`, the plan-sprite's N-up branch, and `cabUpdateCompassIcons`. The raw `bladePose.heading` is left untouched so cut/fill / blade-target math stays precise. **LANDED 2026-05-03 (SW v138).**

- **Slices 15–20 = SIM DEMOLITION (Phase 1)**. First wave of retirement of confirmed sim-only / demo features per the "3D simulator demoted to 3D visualization" decision above. Each slice is one feature, isolated, no replacement work needed because nothing in the product layer depended on them. Total ~610 LOC removed; 3 inline JS blocks still parse cleanly throughout.
  - **Slice 15 = Pitch card** retired. Demo splash overlay (P key) showing live volumes, RTK status, machine hours, Trimble cost-comparison panel. Removed: button, DOM, two functions, P key handler. **LANDED 2026-05-03 (SW v139).**
  - **Slice 16 = Fleet mode** retired. Autonomous second machine grading parallel N-S strips. Removed: top-toolbar button, drawer button, state, build/update/toggle functions, render-loop call, machine-setup report row. **LANDED 2026-05-03 (SW v140).**
  - **Slice 17 = GradeOS Scout** retired. Passive DEM-mapping demo (tractor/harvester/quad/combine driving the site). Removed: side-drawer panel, "Scout Farm Mapping" scenario button, scoutMode flag + per-frame ground-update hook, runScoutSim, 'scout' branch in runScenario. Drone-terrain branch's #scout-stats reference rerouted to #st-hint. Shared survey machinery (surveyGrid / surveyMesh / clearSurvey / fillUnsurveyed) deliberately kept — drone import + manual survey still use it. **LANDED 2026-05-03 (SW v141).**
  - **Slice 18 = Demo scenarios** retired. The four "Quick Demo Scenario" presets — Irrigation Bay / House Pad / Road Cut / Dam — that one-click generated terrain + design + balance for instant graded-paddock demos. Removed: "Quick Scenarios" sections in the floating Design panel innerHTML, side drawer, and side panel; runScenario() and applyDesignRect() functions. The underlying scenario-specific terrain types (irrig_bay / house_pad / road_cut / dam_site) inside genTerrain are now dead code paths — Slice 20 tagged them; a later slice can prune. **LANDED 2026-05-03 (SW v142).**
  - **Slice 19 = Replay + Ghost overlay** retired. Replay was a time-lapse animation of ground snapshots taken every 3s while cutting; Ghost was a transparent original-terrain overlay showing what's been removed. Both pure visual demos. Removed: two toolbar buttons + drawer mirrors; showGhost / ghostMesh / terrainHistory / HIST_MAX / lastHistorySnap / isReplaying / replayFrame / replayTimer state; buildGhostMesh / toggleGhost / toggleReplay functions; per-frame snapshot in updateMachine; rebuilds in rebuildTerrMesh and genTerrain. **LANDED 2026-05-03 (SW v143).**
  - **Slice 20 = Sim-shell labeling pass**. Pure documentation pass — zero code removal. Tagged the major remaining sim-shell sections with a "SIM-SHELL —" header prefix so the next demolition phase has a visible seam: MACHINE SIMULATOR (WASD), TERRAIN GENERATORS, TERRAIN MODIFICATION TOOLS, AUTO-STEER, SCREENSHOT CAPTURE, TABLET DEMO MODE. **LANDED 2026-05-03 (SW v144).**

- **Slice 21+ = SIM DEMOLITION (Phase 2 — deferred)**. The remaining sim-shell features (terrain mesh, WASD driving, auto-steer, terrain edit tools, fake-GPS pipeline) are dev-loop critical: removing them without a replacement seam breaks cab UI testing. Phase 2 needs design work before code: either (a) keep them but isolate behind a `?dev=1` query-string toggle so production builds skip them, or (b) wait for the F9P NMEA bridge to provide a real data source and then retire WASD/fake-GPS together. Decision deferred to next session.

- **Slice 22 = Cross-section is rear view + Topo / mapping UI removed (SW v145)**. Two cleanups Steven asked for in the same overnight pass:
  - Cross-section pane now shows the REAR view of the dozer (camera at -forward looking at origin) instead of the front (blade-on). Cleaner cross-section reference: cab/engine in foreground, blade in distance. SPRITE_CACHE_KEY bumped v2 → v3.
  - Topo + mapping-related UI stripped from the work-screen toolbar and floating Design panel: 🏔 Topo top-tab toggle, 🏔 Topo button atop the floating panel, toolbar buttons 🚁 Drone DEM / 🏔 Terrain visibility / 📡 Survey / 🔥 Passes / 📋 Strips, side-drawer Drone DEM + Survey + Passes + Strips mirrors, and the `genTerrain('drone')` branch with its post-gen survey-fill hook. Backing functions (toggleTerrain, toggleSurvey, togglePassCount, toggleStripPlan, updateTopoLed) left in place — uncalled but harmless; a later sim-demolition pass can prune.
  - The bottom-left "±30 m · 1 m grid · TRACK-UP" plan-pane badge Steven mentioned was already gone (Slice 14.3) — verified in current code; he was seeing a Safari-cached SW.

- **Slice 23 = Ground grid baked into 3D + zoom for all cab panes (SW v146/147)**. Two related cab-pane improvements:
  - **Ground grid in the dozer sprite** for the perspective ('three'), side ('long'), and blade ('cross') views. 20 m × 20 m at 1 m divisions, semi-transparent. Skipped for the top ('plan') view because the cab plan pane already draws its own world grid in 2D. SPRITE_CACHE_KEY bumped v3 → v4.
  - **Zoom now wired for all four cab pane view types**, not just 3D. Was: per-pane zoom multiplier stored but only consumed by the legacy work-screen orbit camera (which the cab doesn't use post-Slice 11). Now: sprite letterbox scale × `cabPaneZoom[idx]`, and `_planW2p()` accepts a zoom param that scales `ppm` and shrinks the grid-search bound. `cabPaneZoomBy()` simplified to "bump multiplier, redraw"; orb.r poking removed. Wheel handler unblocked for non-3D panes; +/- buttons enabled on plan/cross/long; "future slice" tooltip removed.

- **Slices 24–27 = PROFILE DESIGNER WIZARD (Phase 1)** — Cat GRADE-style 3-step wizard rebuild of the existing single-modal Profile Designer. Plan + locked decisions in `docs/plans/profile-designer-wizard.md`. Math seam (`extrudeProfileAlongPolyline` in `src/product/design/profile-designer.js`) unchanged across all four slices.
  - **Slice 24 = wizard scaffold (SW v148).** Restructures the modal into 3 steps with step pills (numbered, amber-active / green-done), step subtitle ("Step N of 3 : title"), Cancel/Previous/Next/Apply footer. E1 strict gating forward — Next disabled until step is valid; Previous always works. A2 always-create-new — opens at Step 1 with auto-incrementing default name. Step 3 shows a summary (alignment point count + total length, section vertex count + width, what Apply does).
  - **Slice 25 = source-picker tiles (SW v149).** Cat-style tiles at the top of Steps 1 and 2: Step 1 = `Points / Focus / Templates`; Step 2 = `On-Screen / Focus / Templates`. Templates tiles disabled with "Coming in Slice 31" tooltip; Step 2 / Focus is a stub per B2 (deferred). Step 1 / Focus wires the explicit "Drop Vertex from Blade Focus" button per B1 — captures `bladePose.centre` (sim mode counts) and appends to the polyline. Source-of-truth controls (textarea, profile canvas) stay always visible; tile picker only swaps the input controls above them.
  - **Slice 26 = on-plan vertex drawing (SW v150).** 640×280 plan canvas added to Step 1 with full polyline-editing affordances per C1: tap empty space → append; drag a vertex → reposition (16 px hit, 4 px drag threshold); tap-and-hold ~600 ms → delete (with haptic vibrate); tap a segment → insert vertex at click. Hover state for mouse. Background per C2: 1m/5m/10m grid tiers, "N ↑" indicator, faint amber recorded points, dozer position + heading triangle (uses smoothed heading per Slice 14.4). Auto-fit view bounds polyline + recorded points + dozer with 40 px padding, capped at 40 ppm. Polyline textarea stays as canonical source of truth, moved into a collapsed `<details>` for advanced editing.
  - **Slice 27 = live segment-length + deflection-angle labels (SW v151).** Cyan rounded-pill "X.XX m" labels at each segment midpoint; amber rounded-pill "+12.4°" or "-12.4°" deflection labels at interior vertices (signed: + = right turn, − = left). Deflection threshold 0.1° to skip near-straight bends. C3 decision: deflection from previous segment, not absolute compass bearing. Drawn last so they sit on top of the polyline.

- **Slice 14.5 = Eco performance mode (SW v152).** Adds a third performance tier below Lite for low-end hardware (Pi5, older laptops). Eco uses `buildCleanDozer()` (the primitive box-mesh dozer in `src/sim/render/dozer-model.js`) at 300×225 sprites with antialiasing off — ~95 % cheaper than the GLTF path. Per-mode sprite cache (key suffixed with `-eco` / `-lite` / `-full`) so toggling between modes is instant after first generation. cabSysSetPerfMode now accepts 'eco' as a third option; System Settings shows three radio buttons. Numbered 14.5 because it's a perf-tier follow-up to Slice 8 (Performance Mode toggle) — landed during the wizard work, hence out-of-sequence in commit history but logically a perf slice not a wizard slice.

- **Slices 28–31 = PROFILE DESIGNER WIZARD (Phase 2 — landed)**. All four remaining slices from `docs/plans/profile-designer-wizard.md` shipped overnight 2026-05-04:
  - **Slice 28 = on-screen finger-draw section editor (SW v153).** Two modes selectable from a tile toggle inside the On-Screen body: "⊕ Click to add" (existing tap/drag/double-click) and "✏️ Finger-draw" (pointerdown + drag traces; on release runs Ramer-Douglas-Peucker at ε = 50 mm to simplify to ~5–15 vertices, sorts by u). Live stroke renders semi-transparent green over the saved profile.
  - **Slice 29 = asymmetric Width A / Width B (SW v154).** Math change in `src/product/design/profile-designer.js` — `extrudeProfileAlongPolyline` accepts optional `widthA` / `widthB` params with truncation/extension semantics per D1 (clip vertices outside the range, or extend with a flat segment at the outermost dy). Output gains a `clipped: boolean` flag. Wizard Step 3 has two number inputs auto-filled from the section's native u-range; live hint reflects whether widths are clipping or extending vs default. Reset button restores native widths. Backward compatible — callers without widthA/B keep legacy behaviour.
  - **Slice 30 = 3D preview tab on Step 3 (SW v155).** Plan / 3D tabs at the top of Step 3. 3D tab shows a 640×360 dedicated Three.js canvas with the proposed extruded surface meshed from a 64×64 sample grid (40×40 in Eco). Colour ramp: dark navy → amber by elevation. Lambert material, three lights. Orbit controls — drag = rotate (azimuth + elevation, capped to ±1.4 rad), wheel/pinch = zoom (radius 2–500 m), shift+drag = pan. Renderer built lazily on first 3D-tab click (no GPU cost if user never opens it). Terrain-underneath rendering deliberately deferred to a future enhancement — design-only preview is the MVP.
  - **Slice 31 = templates library (SW v156).** Save / load named alignment + section templates. localStorage key `gradeos-design-templates-v1` (B3: global scope until Project hierarchy lands; D5: localStorage now, IndexedDB at Project migration). "Save as template" buttons on Step 1 (alignment) and Step 2 (section) prompt for a name and persist. Templates tile on Step 1 lists saved alignments (was previously a "Coming soon" stub); Step 2 / Templates tile shows the 6 built-in presets followed by the user's saved sections. Each list item has Load + Delete actions.

**Wizard plan complete.** All 8 slices (24–31) shipped over two overnight sessions. Math seam (`extrudeProfileAlongPolyline`) preserved throughout — wizard is purely a UI wrapper around the same product-layer extrusion math.

- **Slice 32 = wizard wired to cab toolbar (SW v157).** The wizard was unreachable from the cab UI — the 📐 Designs toolbar button still routed to `openDesignPanel('designs')` (the legacy single-modal flow). Aliased the `'profile'` and `'designs'` toolbar keys onto `cabOpenProfileDesigner` in `cabToolTap` so default toolbar configs land on the wizard. The legacy Designs panel is still reachable from the Dashboard's Job Setup tile (kept for the design library / project chooser, which the wizard intentionally doesn't include per A2 "always create-new").

---

## Open follow-ups (post-Slice 32)

Captured before context-switch so they're not lost:

### GradeOS

- **Browser end-to-end test of the wizard never landed.** Chrome MCP extension disconnected during the planned test of Slice 32. Code paths verified (Node syntax check, all 3 inline JS blocks parse, wizard funcs exist). What's NOT verified: that clicking 📐 opens the wizard, that pointer events on the plan canvas fire correctly, that 3D preview renders, that templates list renders. Click-test in Chrome is the next concrete action.
- **Slice 21+ — Sim demolition Phase 2 deferred.** Removing terrain mesh / WASD / auto-steer / fake-GPS pipeline still needs a replacement seam (CONTEXT decision options: `?dev=1` query toggle, or wait for F9P NMEA bring-up). Don't touch without that decision.
- **Profile Designer follow-ups noted in plan:**
  - Step 2 / Focus tile is a stub (B2 decision: deferred). Captures section profile by driving to known offsets — math is involved (3+ focus points to fit a profile). A future slice.
  - 3D preview shows design surface only — no terrain underneath. Would be a value-add (cut/fill before-apply visualisation) but explicitly deferred at Slice 30.
  - Templates are global; per-project scope migrates when Project hierarchy lands.
  - Anonymous Firebase Auth-style ownership enforcement on member doc writes — deferred until templates → IndexedDB migration.

### Session ledger 2026-05-04 → 2026-05-06

- Overnight sessions 1-3: Slices 13.1, 14, 14.1, 14.2, 14.3, 14.4 (cab plan-pane wizardry leading up to wizard plan).
- Overnight sessions 3-4: Slices 15-20 (sim demolition Phase 1 — pitch card, fleet, scout, demo scenarios, replay/ghost, labelling).
- Overnight session 4: Slices 22, 23, 23.1 (cross-section rear view, ground grid in 3D, zoom for all panes, Topo/mapping cleanup).
- Overnight session 5: Slices 24, 25, 26, 27 (Profile Designer wizard scaffold + source pickers + on-plan canvas + live labels).
- Overnight session 6: Slices 14.5 (Eco Mode), 28, 29, 30, 31 (finger-draw, Width A/B, 3D preview, templates).
- This morning: Slice 32 (toolbar wire-up).
- **45+ commits total this session block.** All on `origin/claude/agitated-einstein-53b234`. Branch is currently 45+ commits ahead of `main`.

- **Slice 9 = Alignment line picker + horizontal alignment offset** (Steven's light-bar follow-up from Slice 7):
  - **`alignment-guidance.js` module**: pure math for perpendicular distance to a polyline + chainage + tangent heading. Returns signed offline distance (right = +, left = −) plus closest-point coords for visualisation. Already accepts a horizontal offset to the line for "grade parallel at offset" workflows.
  - **`selectedGuidanceLine` state** in cab: `{name, points, source}`. Persisted to localStorage. Survives reload.
  - **Select Guidance Line modal** with two source buttons:
    - "Use recorded points" — auto-pulls from `_cabRecordedPoints` (drive-your-design output). Need ≥2 captured points.
    - "Manual entry…" — textarea, format `x,z` per line.
  - **Top alignment LED bar wired** — was a placeholder showing "— NO ALIGNMENT LINE —". Now driven live by `computeAlignmentGuidance(focusXZ, selectedGuidanceLine, horizontalAlignmentOffset)`. Green when on the line within ±50mm tolerance, amber otherwise. Lights left/right by direction of error.
  - **Horizontal alignment offset** — third offset cell on the cab top-centre alongside elevation + working surface. Same +/- pattern (←/→ buttons), same configurable `bumpIncrementM` from System Settings, tap value to zero. Allows grading parallel to a line at a known offset.
  - **Status bar shows active line name** — `Design name ╱ Line name`.
  - **Toolbar catalog gains "Select Guidance Line" icon** (╱). Default toolbar now 8 items.
  - **LANDED 2026-05-03 (SW v124).**

- **Slice 8 (Perf) = Performance Mode toggle + skip render when 3D hidden** (Steven's CPU was struggling):
  - **Skip render gate** in the main loop: when in cab mode and the Three.js canvas is not inside any visible pane, skip `renderer.render()` entirely. Big win — most cab layouts won't include 3D, and we were rendering it anyway. Both Lite and Full modes benefit.
  - **Performance Mode toggle in System Settings**: Lite (default) vs Full quality.
    - **Lite**: pixel ratio = 1 (was 2 on retina = 4x pixel cost), shadow mapping off, System Status modal refresh = 2 s (was 500 ms).
    - **Full**: pixel ratio = devicePixelRatio (capped at 2), shadow mapping on, refresh = 500 ms.
  - Persisted via `cabSysState.perfMode`. Restored at boot. Pixel ratio + shadow are applied at renderer init from the persisted value (full effect requires reload after toggle).
  - **LANDED 2026-05-03 (SW v122).**

- **Slice 7 = Light bar visibility toggles** (Steven follow-up to Slice 6):
  - Three new System Settings toggles: Left tip cut/fill, Right tip cut/fill, Top alignment. Each can be hidden independently.
  - Body classes `cab-led-left-hidden` / `cab-led-right-hidden` / `cab-led-align-hidden` drive layout reflow — when a side bar is hidden the centre pane / status bar / offset bar / bottom strip expand into the freed column. Same for the top alignment bar with the centre row.
  - All combinations supported: hide one, two, or all three; combines with the existing Show Right Toolbar toggle for a fully clean centre when all four are off.
  - Persisted to `localStorage` as `cabSysState.showLEDLeft / showLEDRight / showLEDAlign`; restored on reload. Defaults all on.
  - **LANDED 2026-05-03 (SW v121).**
  - **Deferred to Slice 8**: alignment line picker + horizontal alignment offset (operator selects a polyline / design line as the centre-bar reference and offsets perpendicular to it). Steven's request from this session: "we can also have offsets from the line as well." Needs a `selectedGuidanceLine` entity that doesn't exist yet — bigger slice.

- **Slice 6 = Profile Designer (universal line-based design tool)** + **Working Surface +/- buttons** (Steven follow-up to Slice 5):
  - **Working surface inline +/- buttons** mirror the elevation offset pattern. Same +/- icons either side of the value, same `bumpIncrementM` from System Settings, tap value to zero. Steven asked for this immediately after testing Slice 5: "instead of tap to set, just put a plus and minus button so I can easily click between subgrade and finish level."
  - **Profile Designer module** at `src/product/design/profile-designer.js`. Pure math: `extrudeProfileAlongPolyline({profile, polyline, polylineElev, maxWidth}) → { elevAt(x,z) }`. Sweeps a 2D cross-section profile along an alignment polyline, returning a queryable design surface. Subsumes Crown / Dam / Batter / Channel / Profile / etc. — one tool, six+ legacy use cases.
  - **6 built-in profile presets** in `ProfilePresets`: flat, crown, V-drain, trapezoidal channel, batter, dam.
  - **Profile Designer modal** with three sections:
    1. Cross-section profile: 6 preset buttons + interactive canvas (click to add vertex, drag to move, double-click to delete, 100 mm snap). Centre line marks the alignment, horizontal line marks the polyline elevation. Each vertex shows its (u, dy) coords inline.
    2. Alignment polyline: pick "Use recorded points" (auto-fills from `_cabRecordedPoints`) or "Manual entry" (textarea, format `x,z` or `x,z,elev` per line).
    3. Save as: name field for the resulting design.
  - **Apply** button extrudes, writes to existing `design[]` heightmap, registers in `designLibrary`, refreshes the design mesh. Full integration with the existing system — no new design-storage layer needed for v1.0.
  - **Profile Designer added to toolbar catalog** (8 → 9 icons, default toolbar gets it as a replacement for the not-yet-wired Overlays slot). Icon: ⌒. Tap from the right toolbar to open.
  - **LANDED 2026-05-03 (SW v120).**

- **Slice 5 = Two-layer offset model wired** (the "I use this constantly" feature):
  - `computeBladeTarget` now accepts `elevationOffset` and `workingSurfaceOffset` separately. Combined: `target_z = designElev + workingSurfaceOffset + elevationOffset`. The old `vOffset` option name is kept as a backwards-compatible alias for elevationOffset (zero risk to old call sites).
  - New global `workingSurfaceOffset` in index.html alongside `vOffset`. Both update paths (regular + tablet) pass both values into `computeBladeTarget`.
  - Work Settings modal gains a Working Surface Offset field: ±50 mm and ±100 mm steppers + direct input + Zero. Sits below the existing Elevation Offset field with a hint explaining the subgrade workflow.
  - Cab screen top-centre WORKING SURFACE display is now live (was a `+0.000 m` placeholder) and **tappable to open Work Settings**. Hint text: "(tap to set)".
  - Both offsets persisted to `localStorage` (`gradeos-cab-state-v1.offsets`), restored on reload.
  - Workflow now realisable: WS = −300 mm subgrade target, then bump elevation offset memory through +50 / +100 / ... / +300 to walk back up to design over multiple passes.
  - **LANDED 2026-05-03 (SW v119).**

- **Slice 4f = Pinch-zoom + Dashboard tile actions + Record Point** (continued user-testing polish):
  - **Pinch-to-zoom** on each pane via Pointer Events API. Two fingers down → tracks distance, scales `cabPaneZoomBy(idx, factor)` continuously. Wheel events also handled (trackpad / mouse desktop fallback). 3D pane wired; Plan/Cross/Long still pending the per-view scale plumbing.
  - **Dashboard tiles now active**: Machine Setup → Cab Screen + System Settings modal. System Status → Cab Screen + new System Status modal showing live RTK per antenna, sat count, HDOP, NTRIP age, position, centre elevation, recorded-point count, warnings. Job Setup → Cab Screen + the legacy Designs panel (real Job Setup screen comes in a later slice when Project hierarchy lands).
  - **Record Point button** wired (was a stub). Tap captures the current focus position (per `bladeFocus` — defaults to centre) as a point with auto-suffix name (`PT 1`, `PT 2`, …). Persists to `localStorage` key `gradeos-recorded-points-v1`. Status bar flashes a green confirmation toast for 1.8 s. Recorded count shown in System Status modal.
  - **LANDED 2026-05-03 (SW v118).**

- **Slice 4e = Cab UX polish from user testing** (Steven driving v116):
  - **Inline +/− elevation-offset buttons** on the cab screen top-centre (replaces the buried steppers in Work Settings). Big blue minus, big red plus, value between. One tap = bump by current increment. Tap value to zero. Mirrors the physical inc/dec switches operators have on real dozers.
  - **Configurable increment** in System Settings → Elevation-Offset Bump Increment: ±5 / ±10 / ±20 / ±50 / ±100 mm. Default ±10 mm. Increment label shown next to the offset on the cab screen so operator sees the active step.
  - **Edit Text Ribbon + Edit Right Toolbar discoverability**: System Settings now has an "Edit Text Ribbon" and an "Edit Right Toolbar" button. Bottom-strip readouts are also tappable to open Edit Text Ribbon (Trimble pattern). Empty ribbon shows "≡ Tap to add readouts" so the entry point is never lost.
  - **Per-pane zoom controls** (+/− in bottom-right of each pane). 3D pane wired via `orb.r`. Plan / Cross / Long buttons present but disabled with tooltip "Zoom for this view type lands in a future slice."
  - **LANDED 2026-05-03 (SW v117).**

- **Slice 4d = Edit Right Toolbar + Work Settings + System Settings.** Three new modals:
  - **Edit Right Toolbar** — parallel to Edit Text Ribbon. 8-item catalog (Focus, Record Point, Change View, Overview, Overlays, Edit Text Ribbon, Work Settings, System Settings). Add/remove/reorder. Toolbar rebuilt from state on Apply.
  - **Work Settings** (per-task) — Elevation Offset (with ±5/±25 mm steppers + zero), Blade Focus (tipA/centre/tipB), Tolerance Preset (Rough ±100mm / Medium ±50mm / Fine ±20mm + custom), Vertical Guidance Mode (Centre and 2-Points wired; Right/Left/Linked stubbed for future).
  - **System Settings** (persistent calibration) — Units (Metric only for v1.0), Show Right Toolbar toggle (per GQ-5), Antenna Mounting pole heights A/B (live-updates `SIM_BLADE_MOUNTING.antennaA.dy`), Cutting Edge Lengths A/B (UI present, math wiring deferred), Default Tolerance (sets `guidanceTolerance`), RTK source descriptive (configured externally per ADR-0003).
  - Toolbar buttons now route to real screens (no more stubs for Change View / Work Settings / System Settings / Edit Text Ribbon). Record Point, Overview, Overlays still log to console for future slices.
  - localStorage state extended with `toolbar` array and full `cabSysState` (units, toolbar visibility, mounting offsets, default tolerance). All restored on reload.
  - **LANDED 2026-05-03 (SW v116).**

- **Cab screen topology adopted** (locked 2026-05-03 from Trimble screen-image grilling — 8 reference images analysed). The v1.0 work screen is a real cab-style operator display with this canonical layout:
  - **Yellow persistent status bar** across the top: project name, design name, RTK FIXED indicator, machine name, hamburger/profile.
  - **3-edge LED lightbar wrap**: vertical bar on the LEFT = tip-A cut/fill (red CUT / green ON-GRADE / blue FILL); horizontal bar across the TOP = horizontal alignment guidance ("offline" distance to selected line, per the earlier grilling decision); vertical bar on the RIGHT = tip-B cut/fill. Spatial mapping: bar position = direction of error.
  - **Two elevation-offset numerics** prominent top-centre: `+0.00 -+` (elevation offset memory cycler) and `+0.00 ++` (working surface offset). Both always visible per the two-layer offset model.
  - **Central view area** = up to 3 configurable simultaneous views (plan, cross-section, long-section, etc. — to be detailed in next grilling pass). Operator picks layout via a "Change View" overlay reachable from any screen.
  - **Configurable bottom readout strip** with leading-icon labels (cut/fill / alignment / cross-slope / grade / etc.). Readout count auto-adjusts to screen width (3 on small tablets, 4+ on large). Operator picks which readouts via the Edit Text Ribbon UI (Image 2 of references).
  - **Right-side icon toolbar** for frequent actions (focus toggle, record point, change view, settings, work settings). Always visible.
  - **Big AUTO/MANUAL toggle button** reserved at the bottom for the auto-blade case — visible/active only when auto-blade is enabled (irrelevant for v1.0 indicate-only, but the space and pattern are reserved so the future feature drops in cleanly).
  - **Reference images**: 8 Trimble Earthworks screenshots captured this session. The wrap-3-edges + big-bottom-numbers + yellow-status-bar archetype was consistent across all of them.

- **Dashboard vs Work-Screen split adopted** (locked 2026-05-03):
  - **Boot lands on the Dashboard** — not directly on the work screen. Operator must consciously confirm system readiness before grading.
  - **Three tiles on the Dashboard** (no Licenses tile — GradeOS is open-source so feature-tier gating is irrelevant):
    - **Machine Setup** — mounting calibration, blade-edge length A/B, antenna model, machine type.
    - **System Status** — RTK fix state per antenna, satellite counts, NTRIP base health, warnings.
    - **Job Setup** — Project / Design / Guidance Surface selectors per the project hierarchy.
  - **Single big "Start" button** at the bottom of the dashboard transitions into the work screen.
  - **"Back" / exit on the work screen returns to dashboard** — clean exit, no app restart required. Useful for switching designs mid-day.
  - Tile count can grow later if needed; three is the v1.0 baseline.

- **Multi-view layouts adopted** (locked 2026-05-03):
  - **4 view types in v1.0**: Plan, Cross-section, Long-section, 3D. (Cut/Fill bar view + Text Grid view deferred to v1.1 — they're poor-vision/sunlight accessibility features, important but not blocking.)
  - **5 layout presets**: Single, Vertical split (L+R), Horizontal split (T+B), 1-big + 2-small (one big pane + two small stacked), 3 equal columns.
  - **Default layout: "1-big + 2-small"** with **Plan dominant** (big), Cross-section and Long-section as the two small panes. Matches Steven's stated preference.
  - **"Change View" overlay** reached from a button in the right-side toolbar. Single tap → grid of layout previews → tap one → applied immediately, no confirm dialog.
  - **Per-pane view-type swap** by tapping the pane header → menu of available view types → tap to swap.
  - Switching is non-destructive — the operator can freely experiment without losing state.

- **Overview Screen adopted** (locked 2026-05-03 from Steven's addition):
  - Separate screen, distinct from the work screen — accessible from the work screen via a toolbar button (e.g. "🌐 Overview" or similar).
  - **Purpose**: bird's-eye 3D view of the entire site, showing the machine icon in context relative to the full design plan. Operator can pan/zoom freely.
  - **Why it's separate from the in-work-screen "3D" view-type**: the work-screen 3D view is *machine-following* and zoomed close (for tight grading). The Overview screen is *site-centric* and zoomed wide (for orientation — "where am I in the paddock?", "what does the whole job look like from above?").
  - Single tap returns to the work screen with the previous layout intact.
  - Implementation: builds on the existing `THREE.js` scene — the central 3D rendering survives the sim demotion and gets repurposed for this Overview Screen.

- **Configurable text ribbon adopted** (locked 2026-05-03):
  - **Default 3 readouts**, **maximum 5**. (Steven: "I don't think you'd ever really need more than that.")
  - **Default 3** (left to right): **Centre Cut/Fill mm** (the precise number — centre LED bar is now alignment per GQ-1, so centre cut/fill is text-only) / **Cross-slope %** / **Long Grade %**.
  - **Big catalog** — operator picks from a large grouped list. Categories:
    - **Guidance**: Cut/Fill L/C/R (mm), Cross-slope %, Long Grade %, DES Elevation, ACT Elevation, Tolerance state.
    - **Position**: Tip A Elevation (raw m), Tip B Elevation (raw m), Centre Elevation, Easting, Northing, Heading, Speed.
    - **Alignment** (when a guidance line is selected): Offline distance, Chainage / Station, Slope to next point.
    - **System**: RTK fix quality (overall + per-antenna A/B), Satellite count (per antenna), HDOP, Horizontal accuracy estimate, Vertical accuracy estimate, NTRIP age (seconds since last RTCM update).
    - **Time**: Local time, UTC time, Engine hours (from a hidden onboard timer).
    - **Volume / Productivity** (placeholder for v1.0 — most need machine bus integration that's out of scope; ship the items as "—" when no data, build out post-v1.0).
  - **Edit Text Ribbon UI** = modal screen matching Trimble's pattern (Image 2): selected items in a "Selected" section at the top with drag-to-reorder; available items grouped by category below; each item has a checkbox and a small `(i)` info button explaining what it shows; bottom buttons Cancel / Deselect All / Apply.
  - **Per-item leading icon** in the bottom strip tells the operator at-a-glance what the readout means (cut/fill arrow / alignment line / cross-slope angle / etc.).

- **Right-side icon toolbar adopted, configurable, tap-only** (locked 2026-05-03):
  - **Default 7 icons** (top to bottom): Focus / Record Point / Change View / Overview / Overlays / Work Settings / System Settings.
  - **Configurable like the text ribbon** — operator picks which icons appear, in what order, via an Edit Right Toolbar UI parallel to Edit Text Ribbon. Same pattern, same UX.
  - **Tap-only** — no touch-and-hold. Steven finds touch-and-hold annoying. Every icon has ONE behaviour:
    - **Action icons** (Focus, Record Point) → tap performs the action immediately (Focus = cycle to next, Record Point = capture with auto-suffix).
    - **Config icons** (Change View, Overview, Overlays, Work Settings, System Settings) → tap opens the corresponding screen / overlay.
  - **Toolbar is hideable** — System Settings has a "Show right toolbar" toggle for operators who don't want it. Default ON.
  - **No reserved slot for Auto Mode** — when auto-blade is engaged, the AUTO indicator appears as a contextual overlay (banner / corner badge / wherever it makes most sense visually). When disengaged, it's invisible. The toolbar layout doesn't shift to accommodate it.
- **Centre LED bar = horizontal alignment guidance, NOT centre cut/fill** (locked 2026-05-03 from Trimble grill). The centre bar shows the perpendicular "offline" distance from the blade focus to a selected guidance line. The line can be any of: a polyline drawn in-app, a design line (e.g. edge of a flat pad or slope), or an imported alignment centreline. Green = focus on the line (within tolerance), amber = off the line. The current behaviour (centre cut/fill in centre bar) is a divergence from industry convention and is wrong; centre cut/fill belongs in a text-item or DES/ACT readout instead. Implementation lives in a future slice (post-Slice 3 hardware bring-up). Concept: `selectedGuidanceLine` is a new product-layer entity; `computeBladeTarget` (or a sibling) computes `offlineDistance` from blade pose to that line.

- **Vertical guidance modes adopted in full** (locked 2026-05-03). The operator picks ONE per task from: Right / Centre / Left / Linked-to-Focus / 2-Points. The mode selects the *primary* cut/fill value driving the LED bar, on-grade colour, buzzer, and blade-focus animation. Other tip values stay computed and shown as smaller reference readouts. Mode lives in `BladeTargetOptions.verticalGuidanceMode`. `BladeTarget` gains a `primary: TipTarget` derived from the mode. Implementation in a future slice.

- **Tip inset default 0.2 m** (locked 2026-05-03). Cut/fill is measured at points inset from the absolute blade tips by 0.2 m. Protects against bad readings from worn / damaged tips. Configurable per machine via mounting calibration: `mounting.tipInsetA / tipInsetB`. The blade-pose math is unchanged (still produces the absolute tip positions); the inset is applied downstream in `computeBladeTarget` when sampling the design at the guidance points.

- **Overcut Protection adopted** (locked 2026-05-03). When enabled, `computeBladeTarget` samples the design at multiple points along the cutting edge (not just the guidance points) and reports the worst overcut. Cut/fill output adjusts to prevent overcut. With 2-Points mode: only tips are checked. With other modes: the entire cutting edge is checked. Lives as a `BladeTargetOptions.overcutProtection: bool` toggle. `BladeTarget` gains an `overcut: { detected, worstMm, locationXZ }` field.

- **Geoid + single-point site calibration adopted for v1.0** (locked 2026-05-03). Without these, RTK elevations are wrong by ~30 m at Banksia Springs latitude.
  - **Geoid**: ship with **AUSGEOID2020** (or equivalent regional file) bundled. RTK ellipsoidal Z → orthometric Z conversion happens in a `src/product/positioning/geoid.js` module between the F9P bridge and the BladePose computation. No user setup needed for AU users. International users add their geoid file later. Public-domain files are fine.
  - **Single-point benchmark site calibration**: operator drives to a known benchmark, types in the known absolute Z (e.g. `95.247 m AHD`), system computes one elevation offset constant. Lat/long offsets handled by trusting F9P's absolute position with UTM zone selected at site setup.
  - **Multi-point calibration (3+ benchmarks with rotation/scale fit) deferred** — adequate for one-paddock farms; not needed for the canonical user.

- **NTRIP architecture for v1.0** (locked 2026-05-03 — see ADR-0003):
  - **Base station**: 1× F9P + GNSS antenna at a fixed location near the farmhouse (Steven's existing setup).
  - **Base internet**: connected to internet (Starlink, LTE, or fixed broadband at the farmhouse). Runs NTRIP caster (RTKLIB `str2str` or equivalent) — open-source tooling Steven already has.
  - **Rover side (machine)**: Pi5 has Starlink Mini onboard. Pi5 acts as NTRIP CLIENT — subscribes to the base's RTCM stream, forwards corrections via Bluetooth to both blade-mounted F9P units.
  - **Total F9P count for v1.0**: 3 units (2 on blade + 1 base). +1 for pogo-stick rover when added.
  - **GradeOS does NOT bundle a caster** — Steven sets that up himself with existing open-source tools. We DO bundle a setup how-to.

- **Drive-your-design (blade-focus point capture) adopted** (locked 2026-05-03 — *the* canonical owner-operator workflow). Every design tool that takes click-points (Flat Pad, Slope, Crown, Dam, Irrigation Bay, Profile, Align) gains a "Capture from blade focus" mode. Each tap stores the current blade-focus position as a design point. The points feed the same downstream design generation as today's click-on-screen flow — the input source changes, the design tool maths don't.
  - Steven's example workflow: drive to corner → tap capture → drive to next corner → tap → repeat → tap "Make Flat Pad" → done. 5-minute workflow vs. office-survey-then-transfer-to-cab.
  - 1 point → flat pad.
  - 2 points → slope with a line; each side configurable angle (road / drain / batter — angled separately).
  - N points → polyline (irrigation bay boundary, drain alignment, dam crest).
  - Default capture source: **blade focus tip** (sub-mm precision when operator drives accurately). Selectable to centre for area-defining work.
  - Implementation: future slice. The capture-point button consumes the live `BladePose` from Slice 1 — no new architecture, just UI and a new design-input adapter.

- **3D simulator demoted to 3D visualization** (locked 2026-05-03 — major scope cut). The 3D *interactive simulator* (drive the machine with WASD, fake-GPS noise model, terrain generators, scenarios, auto-steer, fleet mode, camera modes, dozer silhouettes, pitch card, demo content) is **out of scope for v1.0 and will be retired**. What stays is a **3D visualization** showing only:
  - The machine position (from real GPS or stubbed numbers).
  - The design surfaces, captured points, and alignments.
  - **No terrain.** Operator never used the topo/map terrain — finds it confusing and annoying.
  - **No driving.** No keyboard controls, no fake GPS noise, no scenarios, no fleet, no auto-steer.
  - **Use case:** purely a visualization of "where is my machine relative to my design," useful when laying out an in-app design and wanting to see it in space.

  **Testing approach without the 3D sim:** product-layer modules tested via direct inputs — feed in `bladePose` and `designSurface` values, assert on `BladeTarget` outputs. This is exactly how Slices 1+2 were verified (via Preview MCP `eval`, never by visually driving the dozer). Cleaner, faster, deterministic.

  **Implications:**
  - Most of the polish work in `index.html` from Rounds A-D and v104-v109 (terrain generators, machine kinematics, camera modes, dozer photos, demo scenarios, fleet mode, auto-steer, pitch card) becomes **legacy code** — kept temporarily, retired progressively as new slices land.
  - `index.html` should split into `simulator.html` (the demoted demo) and a new `cab.html` (operator screen + product modules + minimal pose stub) — or the existing file shrinks dramatically as legacy is removed. Decision deferred to a cleanup slice.
  - Slice 3 (F9P NMEA bridge) becomes more important — it provides the *real* data source that replaces the fake-GPS generator, removing the last reason to keep the sim driving.

- **Rapid-fire decisions from the Trimble grilling** (locked 2026-05-03):
  - **(a) Audio buzzer on grade** — adopted, **default OFF**. Steven finds it annoying; some operators like it. Toggle in System Settings.
  - **(b) System Settings vs Work Settings split** — adopted. System Settings = persistent calibration (units, tolerance, mounting, RTK source) hidden behind icon. Work Settings = per-task (elevation offset, blade focus, vertical guidance mode, record-point) easy access from work screen.
  - **(c) Configurable text ribbon** — adopted. Operator picks/orders the ribbon items. Sensible defaults shipped; reorder/customise enabled v1.0.
  - **(d) Multiple guidance views (up to 3 simultaneous)** — adopted. v1.0 baseline: plan + cross-section + long-section. Operator picks layout (which view gets the half/third screen). 3D view stays as a sim-only option, not on the real cab screen.
  - **(e) Cutting edge length per side (A and B values)** — adopted. Two numbers in mounting calibration; handles asymmetric wear and rotated blade configurations.
  - **(f) Blade-wear periodic reminder** — adopted as a **time-based reminder** (every N hours, prompt "check and update blade-edge length"). NOT auto-detection. Configurable interval. Reason: operators forget to update wear length → GPS calibration drifts silently → grade is "way off" until someone notices.
  - **(g) RTK fix-quality coloured display + tolerance/accuracy gate** — adopted with critical safety addition. Tolerance presets per work type (rough ±100 mm / medium / fine ±20 mm, editable). When RTK accuracy from F9P exceeds the active tolerance, the cut/fill display **blanks out with a warning** ("RTK not accurate enough for this tolerance — change settings or wait for FIX") rather than showing false-precision. Loss of signal blanks display entirely. **The system must refuse to display cut/fill it can't actually back up with positioning.**
  - **(h) Single-antenna degraded mode + IMU-per-head redundancy** — adopted. Each F9P unit on the blade carries an onboard IMU. When both antennas are online and FIXED: use pure geometric cross-slope (per ADR-0002 — IMU ignored, no bouncy-IMU problem). When one antenna is lost: fall back to the surviving antenna's IMU for cross-slope, with a visible "DEGRADED MODE — bulking-grade accuracy only" banner. Updates the spec in ADR-0002 to allow IMUs in the F9P units; the IMU-bounce concern only applied to using IMU as the *primary* cross-slope source, which we still don't.

- **Line-based design generation modes adopted, with major v1.0 simplification** (locked + revised 2026-05-03):
  - **v1.0 ships THREE core design tools** that cover essentially all owner-operator work:
    1. **Flat Pad** — single elevation across an area.
    2. **Slope** — single cross-slope plane (start point + direction + grade + cross-slope).
    3. **Profile Designer** — the universal tool: draw a 2D cross-section profile on a grid + select/draw a polyline alignment + extrude the profile along the polyline = design surface.
  - **Profile Designer subsumes** Crown, Dam, Batter, Irrigation Bay, Profile, and existing line-based tools. The math is the same in all of them (2D profile extruded along a polyline); having separate dialogs for each is unnecessary fragmentation. ONE tool with a good profile editor + polyline picker covers all of them.
  - **Why this matters**: Steven's stated experience — "if we can make a really good Profile Designer, I think that's gonna pretty much do nearly everything we need to do." This collapses the existing 9-tool design library down to 3 well-built tools.
  - **Profile Designer concept**:
    - **Profile editor**: a grid where the operator draws/edits a 2D cross-section by placing and dragging vertices. Snaps to grid resolution scaling with zoom. Shows the profile as a closed/open polyline. Configurable max grade per segment.
    - **Polyline alignment**: selected from captured points (drive-your-design), drawn on the plan view, or imported. The polyline is the centreline along which the profile gets extruded.
    - **Extrude**: profile is swept along the polyline, perpendicular to the local heading. Output is the design surface.
    - **Constraints** (per the earlier grilling): operator sets maximum grade %, max cut depth, max fill depth. The system either flags violations or smooths the polyline to satisfy constraints (post-v1.0 — start with simple flagging).
  - **Defaults**: extrusion extends to infinity along the polyline by default; no surface-width or point-A/B extension parameters in the default UI. Available as advanced options for bounded designs.
  - **Trimble terminology adopted** for technical fields (Slope, Cross-slope, Mainfall) but the GradeOS tool catalog stays simpler.
  - **Implementation pattern**: each tool accepts input points either by clicking on screen OR by selecting from captured points (drive-your-design output). Same downstream maths.

- **Existing 9-tool catalog deprecation note**: Crown, Dam, Batter, Irrigation Bay, Profile, Best-Fit, Section, Align tools currently present in the codebase will be progressively retired or absorbed into Profile Designer. Best-Fit is a math optimiser (different concept — find flattest plane minimising cut/fill); it stays as a separate utility but may move into Slope as an "auto-fit grade" advanced option. Align stays as the alignment-creation tool that feeds Profile Designer's polyline picker.

- **Point capture & organisation adopted** (locked 2026-05-03):
  - **Auto-suffix tap capture**: tap once with name "Manhole" → next taps create "Manhole 1, Manhole 2, ..." with no further prompts. Fast-path workflow — no form-fill per point. "Always Prompt" toggle for when the operator wants to set name/code on each capture.
  - **Measured Data containers**: lightweight grouping of captured points. Auto-created per session by default (e.g. `2026-05-03 14:32 South Paddock`). Operator can rename later. Containers prevent the "500 unnamed points in one global pool by year 2" problem.
  - **Navigate To Point**: pick a saved point from the manager → system shows direction, horizontal distance, and vertical depth to drive there. Useful for finding marked features (yesterday's dam-wall corner). Work screen border turns blue while in nav mode; tap icon to exit.
  - **Skipped for v1.0**: Office vs Field point distinction (everything is the user's data, single storage), Code field (adds form complexity owner-operators don't need), `.deleted` audit-trail archive of removed points (Trimble does this for compliance — not relevant here).
  - Implementation: future slice. Builds on `BladePose` (capture source) and the new Project layer (point storage scoped to a Project).

- **Pogo-stick / handheld GPS survey rover adopted** (locked 2026-05-03). A **third F9P unit** mounted on a vertical handheld pole ("pogo stick"), Bluetooth-paired to the Pi5 alongside the two blade antennas. The operator can step out of the cab and walk the site, capturing design points on foot — saves diesel, reaches spots the dozer can't (paddock corners, fence-tight spots, around obstacles).
  - Same capture workflow as blade-focus but with the pogo stick as the GPS source instead of the blade.
  - Same BladePose-style geometry but for one antenna only (a "handheld pose" — single point with a known mounting offset = pole length to ground).
  - Hardware: extends ADR-0002's dual-GPS spec to N-antenna. Pi5 must support 3 simultaneous Bluetooth F9P streams. Approximate added hardware cost: $200 for the third F9P + $50 for the pole and magnetic-mount.
  - Calibration: the pogo stick has its own mounting offset (typically 1.8 m pole top → ground tip).
  - **Whether v1.0 or v1.1 depends on hardware availability** — if Steven has the third F9P at v1.0 build time, ship together; otherwise blade-focus capture goes in v1.0 and pogo-stick is v1.1.
  - Architectural seam: a `gpsSource` registry — multiple F9P units register; UI shows which one is "active for capture" at any time; `computeBladePose` consumes the two blade antennas, `computeHandheldPose` consumes the pogo stick.

- **Project / Design / Surface hierarchy adopted** (locked 2026-05-03). v1.0 grows the data model from a flat `designLibrary[]` to:
  ```
  Project (the site, e.g. "Banksia North Paddock")
    ├── Design (a saved target — flat pad, irrigation bay, dam, etc.)
    │     ├── Guidance Surface (the one being actively graded — exactly one at a time)
    │     └── Reference Surface(s) (up to 2 — shown on cross-section / profile views as
    │                               context, NOT graded to)
    └── (Avoidance zones deferred post-v1.0)
  ```
  - **Project selector** in UI (dropdown). Switching projects filters the design list to that project's designs. No cross-project leakage.
  - **Reference surfaces** are designs marked as "show on cross/profile only" via a toggle. They render as outlines on those views so the operator can see "where I started + where I'm going" at the same time. Pure display layer, no math change to `computeBladeTarget`.
  - **Avoidance zones** explicitly out of v1.0 (Steven uses them rarely). Post-v1.0 add-on; would be polygons stored on the Project that flag a warning when the blade enters them.
  - **Storage migration:** existing flat `designLibrary[]` content lands inside a single default Project on first load (back-compat).
  - Implementation: candidate for Slice 5 (after F9P + display redesign + offset rework).

- **Two-layer offset model adopted** (locked 2026-05-03). High importance — Steven uses this constantly. v1.0 ships:
  - **Elevation Offset** (per-pass shift) — what the current `vOffset` represents; renamed in code to `elevationOffset` for clarity. Has its own memory presets, cycled via inc/dec.
  - **Working Surface Offset** (bulk target shift) — separate setting for "I'm targeting a surface N mm offset from design until I say otherwise" (subgrade prep, base-build workflows). Has its own value, NOT the same memories as elevation offset.
  - Combined target: `target_z = designElev + workingSurfaceOffset + elevationOffset`.
  - Workflow example: working surface offset = −300 mm (subgrade); operator bulk-cuts down with elevation offset = 0 (at working surface); then builds back up by setting elevation offset memory to +50, +100, +150 ... +300 (back at design).
  - Default offset direction: **vertical**. Perpendicular is a post-v1.0 opt-in toggle (`offsetMode: 'vertical' | 'perpendicular'`) for sloped designs (dam batters, crowned shoulders, irrigation bay sidewalls).
  - Implementation lives in a future slice (Slice 4 candidate — directly extends `BladeTargetOptions` and `computeBladeTarget`, no new modules required).
  - **Updated v1.0 in-scope list:** the "v-offset (±500 mm)" entry above is now superseded by "elevation offset + working surface offset + memory presets, vertical mode."

---

---

## Sensor topology — Banksia Springs first machine (locked 2026-05-03)

**Two u-blox F9P RTK GPS antennas on vertical poles, one at each top corner of the blade. Magnetic mount onto the blade. Bluetooth back to the Pi5.**

This is the canonical sensor configuration v1.0 is built for. See [ADR-0002](docs/adr/0002-dual-gps-on-blade-corners.md).

### Geometry

- **Antenna spacing** ≈ blade width (slightly less, because antennas sit at the cutting edge corners of the blade with vertical poles upward — the horizontal positions are the same as the blade tip cutting edge corners, give or take phase-centre offsets).
- **Antenna height** = blade height (top of blade above ground) + pole height. Known fixed offset.
- **Mounting struct** in code:
  ```
  mounting = {
    antennaA: { dx: 0, dy: 0, dz: -<poleHeight> },  // antenna A → blade tip A
    antennaB: { dx: 0, dy: 0, dz: -<poleHeight> },  // antenna B → blade tip B
  }
  ```
  Calibration constant. Set at install time; rarely changes. The blade-pose module subtracts these offsets from the raw antenna positions to get the cutting-edge tip positions.

### Comms

- **Bluetooth** from each F9P to the Pi5. Wireless avoids cable runs along a vibrating blade.
- This is a *transport* concern — it lives in the F9P-bridge module, not in the blade-pose module. The blade-pose module sees `(gps1, gps2)` regardless of how the bytes arrive.

### Optional IMU on machine body

- Possible future input. Not part of v1.0 baseline.
- If added, would provide redundant pitch/roll for the *machine body* (not the blade itself). Useful as RTK fallback or for sanity-checking the pose.
- Lives in a separate sensor-input module; the blade-pose module never reads from it directly. Cross-slope is still computed geometrically from the two GPS readings — that's the authoritative number.

### Why dual GPS and not single GPS + IMU

Cross-slope is the most safety-critical number on the screen (a blade tilted wrong runs deep on one side). Geometric cross-slope from two GPS antennas is *direct measurement* — no fusion math, no IMU drift, no calibration to lose. Trimble's single-GPS-plus-IMU systems work but are harder to get right and harder to debug. Two F9P modules cost ~$400 vs Trimble's $20k+ rover head — the cost case favours dual GPS for our price point.

ADR-0002 has the full reasoning.

---

## Open questions (still being grilled)

- Hardware bring-up order: F9P NMEA bridge first? Display/UI on the Pi? Calibration tooling? (post-Slice 1)
