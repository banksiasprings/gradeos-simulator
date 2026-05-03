# Profile Designer Wizard — Plan

**Status:** **COMPLETE 2026-05-04.** All 8 slices (24–31) shipped over two overnight sessions. Decisions log at the bottom remains the canonical reference for "why" calls were made the way they were.

**Reference:** Cat GRADE 3-step "Create Design" wizard (screenshots reviewed in session). 16+ screens captured covering alignment placement, section drawing, combine-and-apply, plus job setup / file transfer / live cab examples. The wizard pattern is the canonical inspiration.

---

## Goal

Replace our current single-modal Profile Designer (Slice 6) with a Cat GRADE–style **3-step wizard** that scales from "drop two corners and apply" all the way through "design a complex road profile with asymmetric widths and save a reusable template."

Wizard lives in the cab. Work-screen modal eventually retires (or stays as a sim-shell debug aid until Slice 21 demolition).

The math (`extrudeProfileAlongPolyline` in `src/product/design/profile-designer.js`) does NOT change — we're rebuilding the wrapper UI around it. That keeps the v1.0 product math seam intact.

---

## Where we are vs where we're going

| | Current (Slice 6) | Target (post-Slice 31) |
|---|---|---|
| **Structure** | Single modal, 3 sections stacked | 3-step wizard with Next/Previous |
| **Alignment source** | Recorded points OR manual textarea | Picker: **Points / Focus / Templates / On-Screen** |
| **Section source** | 6 presets + click-to-add-vertex | Picker: **On-Screen finger-draw / Focus / Templates** (presets become templates) |
| **Width** | Symmetric (whatever the profile's u-range is) | Asymmetric A (left) / B (right) |
| **Preview** | None — Apply commits immediately | 3D preview tab on Step 3 |
| **Naming** | Auto-name `Profile-1` etc. | User name field on Step 3 |
| **Live feedback** | Vertex coords inline | Segment length + bearing angle as you draw |
| **Persistence** | One-shot (writes to design[]) | + Saveable as Template for reuse |

---

## Wireframe (each step)

```
┌─ CREATE DESIGN ──────────────────── ⓘ ─┐
│ Step 2 of 3 : Create Section            │
│                                         │
│ ┌───────────┬───────────┬───────────┐   │   ← source-picker tiles
│ │ ON-SCREEN │   FOCUS   │ TEMPLATES │   │     (clickable, one selected)
│ └───────────┴───────────┴───────────┘   │
│                                         │
│  width: 20.00 m   slope: -2.0 %         │   ← contextual inputs for current step
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │      [profile/plan/preview canvas]  │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [↶ undo] [⊕ add] [⊖ del] [↔ measure]   │   ← canvas tools
│                                         │
│         Profile          [3D]           │   ← view-tab toggle (step 3 only)
├─────────────────────────────────────────┤
│ [✕ Cancel]    [◀ Previous]    [Next ▶] │
└─────────────────────────────────────────┘
```

---

## Slice plan (24 → 31)

Each slice is a tracer bullet — independently shippable, cab still works at every commit. Total est ~1,800 LOC across 8 slices.

### Slice 24 — Wizard scaffold (no behaviour change)

Restructure the existing modal into a 3-step container. Same content, distributed:
- Step 1 contains the existing alignment picker (recorded-points / manual textarea)
- Step 2 contains the existing profile editor (6 presets + click-to-add-vertex canvas)
- Step 3 contains the existing Apply (now with Name field)

Add: step indicator header (`Step N of 3 : <title>`), Cancel/Previous/Next/Apply footer, body fade transition. Math + extrusion unchanged.

- **Files:** `index.html` (cab Profile Designer modal HTML + state machine).
- **LOC:** ~250.
- **Acceptance:** open Profile Designer → see Step 1 → set alignment → Next → see Step 2 → set profile → Next → see Step 3 → Apply. Functionally identical to today's single-modal flow.
- **Risk:** very low — pure UI restructure.

### Slice 25 — Source picker tiles on Step 1 + Step 2

Add Cat-style picker tiles at the top of Steps 1 and 2. Step 1 tiles: `Points / Focus / Templates`. Step 2 tiles: `On-Screen / Focus / Templates`. The body below the picker switches based on the active tile.

Behaviour wired in this slice:
- **Step 1 / Points** = existing "Use recorded points" flow.
- **Step 1 / Focus** = new "Drop Vertex from Blade Focus" button. Each tap appends `bladePose.centre` as a vertex.
- **Step 1 / Templates** = stub for Slice 31 — currently shows "Coming soon."
- **Step 2 / On-Screen** = existing click-to-add-vertex canvas.
- **Step 2 / Focus** = stub for later — using blade height to define the section is a separate workflow. Deferred.
- **Step 2 / Templates** = existing 6 presets, relabeled.

- **Files:** `index.html`.
- **LOC:** ~250.
- **Acceptance:** Each tile is selectable; only the selected tile's body is shown; Step 1 / Focus actually drops vertices live.

### Slice 26 — On-plan vertex drawing for Step 1

Replace/augment the manual-entry textarea with an interactive plan canvas. Tap to add vertex, drag to move, tap-and-hold to delete. Manual textarea hides by default (advanced toggle keeps it).

- **Files:** `index.html` (canvas + pointer handlers; reuses `_planW2p` for world-pixel math).
- **LOC:** ~250.
- **Acceptance:** Place 3+ vertices on the canvas → green polyline appears → drag a vertex to move it → polyline updates → Next picks up the new alignment.

### Slice 27 — Live segment-length + angle labels

As the user draws an alignment, show segment-length (m) and bearing angle (deg) on the canvas. Cat shows `36.02 FT` on the segment and `0.1°` at the latest vertex.

- **Files:** `index.html` (canvas overlay rendering).
- **LOC:** ~120.
- **Acceptance:** segment labels render correctly, angles relative to north (or to previous segment — pick one, document it).

### Slice 28 — On-screen finger-draw for Step 2

Add finger-draw mode to the section editor. Pointer-down + drag traces a polyline; on pointer-up, simplify (Ramer–Douglas–Peucker, ε ≈ 50 mm) to a clean ~5–15 vertex profile. Click-to-add still works for fine-tune.

- **Files:** `index.html` (canvas pointer handlers, simplification helper).
- **LOC:** ~200.
- **Acceptance:** drag a curvy line freehand on the canvas → on release, see a cleaned polyline with ~10 vertices that follows the gesture.

### Slice 29 — Asymmetric Width A / Width B on Step 3

Add `Width A` (left of alignment) and `Width B` (right of alignment) inputs on Step 3. Default values come from the profile's u-range. Editing either rescales the profile non-uniformly so the extrusion fits the new widths. Useful for one-sided road shoulders, irrigation banks.

Math change: `extrudeProfileAlongPolyline` gains optional `widthA` / `widthB` params. Profile u-coords get mapped: `u_left ∈ [-widthA, 0]`, `u_right ∈ [0, widthB]`.

- **Files:** `src/product/design/profile-designer.js` (math), `index.html` (inputs + plumbing).
- **LOC:** ~180.
- **Acceptance:** set Width A = 5m, Width B = 2m → extruded surface is wider on the left of the alignment than the right.

### Slice 30 — 3D preview tab on Step 3

Render the proposed extruded surface in a temporary 3D scene before commit. Plan / 3D tab toggle. Plan view shows the alignment over the existing terrain; 3D view renders the extruded mesh in a small Three.js viewport. "Apply" commits, "Previous" returns to edit.

- **Files:** `index.html` (preview canvas + temporary mesh build that reuses the same extrusion path).
- **LOC:** ~250.
- **Acceptance:** preview matches the actual applied result pixel-for-pixel; rotating the preview works; Apply commits the same mesh.

### Slice 31 — Templates library (Steps 1 and 2)

Save / load alignment templates and section templates in `localStorage` (key: `gradeos-design-templates-v1`). New "Save as Template" button at the bottom of each step. Templates picker tile lists user templates + the 6 built-in section presets.

- **Files:** `index.html` (template store + picker UI), maybe `src/product/design/templates.js` (a thin module).
- **LOC:** ~280.
- **Acceptance:** Build an alignment, save as "South Drain"; rebuild later from Templates → "South Drain" loads. Same for sections.

---

## Decisions (locked 2026-05-04)

All 16 questions answered by Steven; design is now locked. Slice 24 cleared to start.

### A — Scope and shape

- **A1. Frequency / context of use: live, daily, in the cab.** Implies touch-first ergonomics, glove-friendly hit targets (≥44 px primary, larger for the main actions), high contrast for outdoor / sunlight viewing, modal sized to fit the 10" cab screen without scrolling. This is THE governing constraint — every UX call below biases toward "easy to do live with one hand on the controls."
- **A2. Always create-new; templates are the persistence layer.** Wizard does not edit an existing design. To "tweak" a previous design, the user reloads it as a template (Slice 31) and re-applies. Simpler state model, no in-place mutate path.
- **A3. Cab-only.** Work-screen Profile Designer modal stays as a debug aid until Slice 21 demolition retires the work-screen entirely.

### B — Source pickers and capture

- **B1. Step 1 / Focus capture: explicit "Drop Vertex" button inside the wizard.** Each tap captures `bladePose.centre` and appends to the alignment polyline. Sim mode counts (simulated focus point works the same as a real F9P focus). The existing toolbar Record Point button stays a separate workflow — those points are picked up via the **Step 1 / Points** tile.
- **B2. Step 2 / Focus: deferred** to a post-wizard slice (call it Slice 32). Slice 25 ships it as a stub tile labelled "Coming soon."
- **B3. Templates: global, important.** Steven called out templates as a primary feature. Stored globally (cross-project) until Project hierarchy lands, at which point we migrate to per-project + global library options.

### C — Alignment editing UX

- **C1. All polyline-editing affordances enabled:** drag any vertex to reshape, tap-and-hold (~600 ms) to delete, click on a segment to insert a new vertex there.
- **C2. Step 1 plan canvas background:** empty grid + already-recorded points (faint dots) + the dozer's current position and heading marker. Skip terrain contours and existing designs (assume create-new — busy backgrounds slow down picking).
- **C3. Bearing convention: deflection from previous segment** (interior angle, smaller numbers, 0° = straight). Easier to reason about live ("is this a sharp turn?") than compass bearings.
- **C4. Variable-width corridor: not yet.** v1.0 wizard is constant width (with asymmetric A/B per Slice 29). Variable corridor is post-v1.0.

### D — Width / Apply / Persistence

- **D1. Width A/B semantics: truncation/extension** (matches Cat). Profile keeps native u-coords; A/B clip or extend the final flat edge to those bounds. If profile data falls outside `[-A, +B]`, clip with a small "Section will be clipped to width A/B" warning.
- **D2. Apply behaviour: replace + ask for confirmation** when there's an active design. ("This will replace 'South Drain V01'. Apply?" → Apply / Cancel.) Once Project / Designs hierarchy lands properly, default shifts to "add alongside."
- **D3. Naming: auto-generate, user can override.** Default suggestion `Design 1`, `Design 2`, ... incrementing. User can rename in the field on Step 3.
- **D4. Pause / resume mid-wizard: no — Cancel always discards.** Drafts are too much engineering cost for marginal value. If the user needs to step out, they re-do the wizard with a template recall.
- **D5. Templates storage: localStorage now, IndexedDB at Project hierarchy migration.** Key: `gradeos-design-templates-v1`.

### E — Polish

- **E1. Step navigation gating: strict.** Next button disabled until current step has valid input (≥2 vertices for alignment, ≥2 vertices for section). Previous always works (no gating backward).
- **E2. 3D preview (Slice 30): rotate + zoom + pan, with existing terrain rendered underneath in a faint colour.** Cut/fill preview is a value-add over Cat's design-only preview — operator sees where the proposed design will cut/fill before applying.
- **E3. In-place modification of the existing modal, slice by slice** (no parallel feature flag). Cab works at every commit. Math seam unchanged.

---

## Status / Decisions log

- **2026-05-04 (early):** Plan drafted from Cat GRADE reference screenshots. 16 open questions raised.
- **2026-05-04 (later):** Steven answered all 16. Decisions locked above. Slice 24 cleared.
