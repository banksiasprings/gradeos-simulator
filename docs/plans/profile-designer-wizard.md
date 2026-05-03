# Profile Designer Wizard — Plan

**Status:** Drafted 2026-05-04. Grilling in progress — see "Open questions" at the bottom. Slice 24 not yet started; do NOT begin implementing until the open questions are resolved.

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

## Open questions (grilling — resolve before Slice 24)

These are the calls we need to make before any code lands. Answers will be folded back into this doc and referenced by the slice commits.

1. **Cab-only or cab + work-screen?** Recommend cab-only.
2. **Replace existing modal in-place, or feature-flag new wizard?** Recommend in-place.
3. **Width A/B semantics:** scale-to-fit OR truncation/extension? Recommend truncation/extension (matches Cat).
4. **Bearing convention for Slice 27 angles:** deflection angle OR absolute compass bearing? Recommend deflection.
5. **Step 2 / Focus:** include in Slice 25 OR defer to a later slice? Recommend defer.
6. **Templates storage:** localStorage OR IndexedDB? Recommend localStorage now, migrate later.
7. **Frequency / context of use** — once per job, daily, multiple times? Pre-design at home or live in cab?
8. **Edit-existing flow** — does the wizard handle editing an existing design, or is it always create-new?
9. **Background of the Step 1 plan canvas** — empty grid only, or terrain / recorded points / existing alignments shown faded?
10. **Step navigation gating** — must complete each step before Next, or allow skip / freeform navigation?
11. **Apply behaviour** — replace current design or add new alongside? What happens to the previously-active design? Project hierarchy implications?
12. **Pause / resume mid-wizard** — possible, or Cancel always discards?
13. **Default vertex tools** — tap-and-hold to delete OK on touchscreen? Insert-vertex-on-segment-click — yes/no?
14. **3D preview interactivity in Slice 30** — just rotate, or rotate + zoom + pan? Show terrain underneath?
15. **Template scope** — global across projects, or scoped per-project?
16. **Variable-width corridor** — constant width along alignment OR width can vary per-vertex? (Cat's wizard suggests constant; variable corridor is a much bigger feature.)

---

## Status / Decisions log

- **2026-05-04:** Plan drafted from Cat GRADE reference screenshots. Open questions raised. Awaiting Steven's answers before Slice 24 begins.
