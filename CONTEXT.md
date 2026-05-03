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

## Decisions log

### 2026-05-03
- **Identity = real machine control product, simulator-first.**
- **End-user = owner-operator (farmer + small contractor).** C/D/E user types deferred indefinitely.
- **v1.0 ships indicate-only.** Auto-blade is on the long-term roadmap for factory-prep'd machines; architecture must keep a pluggable blade-target output seam so auto-blade is a future adapter swap, not a rewrite. (See [ADR-0001](docs/adr/0001-indicate-only-with-pluggable-blade-output.md).)
- **Auto-steer (machine path control) is out of scope for v1.0 product.** Sim-shell-only demo feature.
- **Workflow B (in-app design) is the canonical happy path.** Workflow A (design-file import) deferred post-v1.0. Workflow C (no design) is a degenerate case of B.
- **v1.0 = real grading job at Banksia Springs.** Indicate-only on Pi5 + F9P. Single binary acceptance test. Scope cuts above are explicit.
- **Architecture: incremental vertical-slice extraction, native ES modules, no build step.** Each slice cuts top-to-bottom for one small thing; sim must keep working at every commit.

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
