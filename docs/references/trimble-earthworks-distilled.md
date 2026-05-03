# Trimble Earthworks Dozer Operator's Manual — distilled for GradeOS

Source: 111-page curated PDF derived from Trimble's Operator Manual.
Purpose: extract concepts and decisions that apply to **GradeOS v1.0** per [CONTEXT.md](../../CONTEXT.md), discard Trimble-specific or out-of-scope material.

This is a *learning reference*, not a copy. We're using Trimble as the established competitor whose product shape teaches us where the well-trodden user paths are. Every section below ends with a **GradeOS take** — what we adopt, adapt, or reject.

---

## 1. Lightbar / cut-fill display model

### What Trimble does

Three on-screen lightbars positioned along the **left, top, and right** edges of the operator display:

- **Left lightbar** = cut/fill at the left blade tip. Red = cut, green = on-grade tolerance, blue = fill.
- **Right lightbar** = cut/fill at the right blade tip. Same colour convention.
- **Centre lightbar** = horizontal alignment guidance (distance to a selected line). Green = focus is on the line, amber = off the line. **Not** a cut/fill display.

A "live location arrow" moves along each cut-fill bar showing where the cutting edge is relative to the design surface.

The on-grade tolerance band is a fixed, always-bright-green zone. Tolerance value configurable in System Settings → Grade Tolerance.

System buzzer fires when **both** tips are within tolerance (uses the worst tip — i.e. the one farthest from design — for trigger).

When no guidance is available (e.g. elevation not benched), lightbars grey out, arrow hidden, text items don't show values.

### GradeOS take

**Adopt:**
- Red/green/blue convention exactly. We already do this — confirms ours matches industry.
- "Worst-tip" buzzer logic — useful and intuitive (don't celebrate on-grade until BOTH sides are).
- Greyed-out / arrow-hidden when no guidance — we already do this via "OFFLINE" / "— NO DESIGN —" placeholders (Slice 1).

**Reconsider:**
- **Centre lightbar = horizontal alignment, not cut/fill.** GradeOS currently uses centre for centre cut/fill. That's actually **wrong by industry convention**. An operator coming from Trimble would expect the centre bar to show "am I on/off my chainage line?" not "what's the cut/fill at my centre tip?"
  - **DECIDED 2026-05-03: change centre to horizontal-align (Trimble convention).** The line can be any of: a polyline drawn in-app, a design line (e.g. edge of a flat pad or slope), or an imported alignment centreline. Centre cut/fill moves to a text-item or DES/ACT readout. See CONTEXT.md → "Centre LED bar = horizontal alignment guidance".

**Adapt:**
- "Vertical guidance is not a single number" — Trimble's centre bar is *steering*, the side bars are *cut/fill*. They've split the channels by purpose. Worth thinking about where steering guidance lives in our UI (currently nowhere — we have no chainage concept yet).

---

## 2. Vertical guidance modes (the cut/fill calculation choice)

### What Trimble does

The **Blade Manager** screen lets the operator pick *one* of these vertical guidance modes. The mode determines **where on the blade the cut/fill is measured from**:

| Mode | Where guidance is measured | Use case |
|---|---|---|
| **Right** | Single point inset 0.2 m from right tip | Building ditches narrower than half the blade width, using the right side |
| **Centre** | Single point at blade centre | Grading over a change of grade — crown, shoulder, transition |
| **Left** | Single point inset 0.2 m from left tip | Mirror of Right |
| **Linked to focus** | Single point inset 0.2 m from the *focus* tip — toggles when focus toggles | Grading narrow ditches from both directions |
| **2 Points** | Two points, each inset 0.2 m from the tips | Average grade over the full blade width — smooth curves, golf, finish work |

**Custom inset** — operator can change the 0.2 m default per side (Linked-to-focus or 2-Points mode only).

**Overcut Protection** — when ON, the system also checks the *rest of the blade* (not just the guidance points) against design. Adjusts cut/fill to prevent overcut. With 2 Points: only the tips are checked. With other modes: the entire cutting edge is checked.

### GradeOS take

**Adopt:**
- The **inset concept** — guidance points should not be at absolute blade tips. The very tip wears, hits obstacles, gives bad readings on damaged blades. ~0.2 m inset matches industry default.
- **Overcut Protection**: very high value safety feature. Easy to forget in operator mode that the *middle* of the blade can dig deep when only tips are tracked.

**Reconsider:**
- GradeOS currently always computes 3 points (tipA, tipB, centre) and shows all three on the display. Trimble's model is *one selectable mode* per task. Their UI is simpler at any moment. Ours is information-rich.
- Decision needed: do we keep the "always show all three" model, or move toward Trimble's "pick one focus, show one number" model?
  - Argument for ours: more info on screen, no setup ceremony per task.
  - Argument for theirs: one-job-at-a-time matches operator mental model; less to misread; explicit choice forces the right measurement for the work.
  - Compromise: keep computing all three internally; let the operator *pick* which is the "primary" via blade focus, with the others shown smaller / desaturated as reference.

**Adapt:**
- Add "vertical guidance mode" as a per-task setting, not just a focus-display preference.
- `BladeTarget` struct already returns `tipA / tipB / centre` independently. Selecting a guidance mode is a downstream display concern, not a math change.

---

## 3. Elevation offsets (vOffset and beyond)

### What Trimble does

Two distinct offset concepts that operate together:

1. **Elevation Offset** — what we call vOffset. Temporary shift of the design surface, often per-pass. Saved as memories the operator cycles through with inc/dec switches.
2. **Working Surface Offset** — bulk shift to a *target intermediate surface*. Example: design is at 0.000 m. Operator sets working surface offset to −0.300 m (30 cm below design — aiming for subgrade). Then works incrementally back UP via elevation-offset memories: −300, −250, −200, −150, −100, −50, 0. Each pass adds material to a new intermediate target.

Two offset directions:
- **Vertical** — elevation in world Z. Use when target is "300 mm below design measured straight down".
- **Perpendicular** — perpendicular to the design surface. Use when target is "100 mm of compacted gravel measured perpendicular to the slope".

The difference matters on sloped surfaces. Vertical offset on a 3% slope leaves a slightly different gap than perpendicular.

Offset has a **focus** — which tip is the reference point for applying the offset.

### GradeOS take

**Adopt:**
- **Working Surface Offset as a separate concept from Elevation Offset.** Today GradeOS conflates them under `vOffset`. Subgrade workflow ("dig down 300 mm, then build back up by 50 mm passes") is a real, common need we don't model cleanly.
- **Vertical vs Perpendicular offset distinction.** On sloped designs (irrigation bays, dam batters) this matters. Worth implementing.
- **Offset memories (saved presets)** — already partially in GradeOS (vOffset memory slots from README). Confirm parity.

**Adapt:**
- The `BladeTargetOptions` struct currently only takes `vOffset`. Should evolve to `{ elevationOffset, workingSurfaceOffset, offsetMode: 'vertical' | 'perpendicular' }`.
- Store offsets per-design (so switching back to a design recovers its offset memories).

---

## 4. Design hierarchy: Project → Design → Surface

### What Trimble does

```
Project (the site you're working on, e.g. "Banksia Springs South Paddock")
  ├── Design (a file with one or more surfaces, e.g. "irrigation bay v3")
  │     ├── Guidance Surface (the one you're grading to — exactly one)
  │     └── Reference Surface(s) (up to 2, shown on cross/profile only — not graded to)
  │
  └── Avoidance Zones (no-go areas, area-based)
```

Surfaces split into two origins:
- **Office surfaces** — built externally (CAD/Trimble Business Center), loaded as files
- **Infield surfaces** — built in the cab on the dozer (workflow B in our terms)

Multiple "guidance modes" available per Project, depending on positioning source:
- Design mode (guidance to a 3D surface)
- Depth and Slope mode (relative — like our workflow C)
- Line mode (guidance to a line, including 2D and 3D)
- Lane Guidance (ride a single design lane)

### GradeOS take

**Adopt:**
- **Project / Design / Surface hierarchy.** GradeOS today has `designLibrary[]` (a flat list). A project layer above gives natural grouping (one farm = one project; multiple paddocks/dams within).
- **Reference surfaces** for visualisation only. Useful for "show me original survey AND target as I grade between them."
- **Avoidance zones** — relevant for real farms (don't grade the dam wall, don't dig where the irrigation pipe is). v1.0 nice-to-have, post-v1.0 must.

**Reconsider:**
- "Multiple guidance modes per Project" is good UX but adds setup. For owner-operator scope (per CONTEXT.md), default to Design mode and treat Depth/Slope/Line as advanced.

**Reject:**
- WorksManager / cloud sync. Out of scope (local-first per CONTEXT.md).

---

## 5. Infield (in-app) surface creation — workflow B

### What Trimble does

Infield surface wizard has three creation paths:

1. **Level pad** — pick a focus, set an elevation. Done. Ours: `Flat Pad` ✓ matches.
2. **Slope** — Either *Point and Direction* (initial point + heading + grade) or *2-Point* (two points define direction & grade), plus cross-slope angle (single value or dual L/R for asymmetric).
3. **Alignment & Section** — full 3-step wizard:
   - Create alignment (plan view points, then elevation view to set vertical grade).
   - Create cross-section template.
   - Combine alignment + section → 3D model.

Two ways to define points:
- From **previously recorded points** (survey points captured during prior work).
- From the **blade focus** — drive the dozer to a location, tap "Add Point", the blade-focus position becomes the point. *Drive your design.*

Editing modes: edit by Coordinate (N/E/Elevation) or by Segment (distance / internal angle / elevation).

"Lock to grid" snaps points to grid intersections. Resolution scales with zoom.

**Origin point is special** — once placed, can't be edited (everything else is relative). To change origin, restart.

### GradeOS take

**Adopt:**
- "**Drive your design**" — the blade-focus point creation is killer for owner-operators who don't have an external surveyor. Walk the boundary, mark points by driving, then design from those. GradeOS has a `Stake markers` feature (per README) but it's not wired into design creation. Should be.
- **Edit by Segment** (distance + angle + elevation) is more natural than coordinates for hand-shaping.
- **Lock to grid** snapping.
- **Cross-section template + alignment combined** is the right model for repeating profiles (irrigation channels, road cross-sections).

**Reconsider:**
- Origin-point-immutable is a UX gotcha. We can do better — recompute relatives if origin moves.

**Confirm parity:**
- Our `Flat Pad`, `Slope`, `Crown`, `Dam`, `Best-Fit`, `Batter`, `Irrigation Bay`, `Profile`, `Align` cover most of Trimble's infield wizard. Map the gaps.

---

## 6. Design file formats (workflow A — post-v1.0)

### What Trimble does

Three import formats supported:
- **LandXML** (industry standard, multi-vendor — this is what to support first if we ever do file import).
- **.dsz** (Trimble proprietary, single surface — irrelevant to us).
- **.vcl** (Trimble proprietary, multi-surface — irrelevant to us).

LandXML data model: surfaces are **TIN** (triangulated irregular network — points + triangles), not regular grids. Lines have horizontal geometry (straight + circular arcs + spirals: clothoid, parabola) and vertical geometry (points + circular arcs + parabolic). Roadways/railways/waterways supported as triangulated meshes + alignments.

**Not supported:**
- Parametric surface definitions (stringlines, cross-sections as the source — must be pre-tessellated to TIN).
- Breaklines as source data.
- Non-linear stationing.
- Pipe networks.

Each design needs a `.cal` site calibration file for GNSS coordinate-frame setup.

### GradeOS take

**Adopt (post-v1.0):**
- LandXML as the import format. Industry standard, surveyors already produce it.
- TIN-as-stored model OR sample-TIN-into-our-grid at import (simpler — matches existing storage).
- **Site calibration file (`.cal`)** — required to map LandXML's coordinate space onto the local UTM zone. Without this, designs are "somewhere in the wrong country." This is a *real* operational concern even today.

**Reject (for v1.0):**
- Spirals, parabolic vertical curves — these only matter for road construction. Owner-operator (farm) workflows don't need them.
- WorksManager cloud sync.

---

## 7. Operator UI primitives

### What Trimble does

- **Up to 3 simultaneous guidance views** chosen from: 3D, Cross-section, Profile (long-section), Plan, Cut/Fill Left, Cut/Fill Right, Cut/Fill Centre, Text Grid.
- **Text ribbon** along the bottom, drag-drop reorderable text items chosen by the operator. Defaults sensible per machine type. Each item has an icon (red-up for cut, blue-down for fill, green for on-grade).
- **Shortcut bar** for frequent actions (Record Point, Blade Focus).
- **System Settings** menu = persistent config (lightbars, units, file transfer, increments).
- **Work Settings** menu = per-task config (auto mode, elevation offset, record point).

Distinction: **System Settings change rarely, Work Settings change every task.** Different physical UI access patterns.

### GradeOS take

**Adopt:**
- **System vs Work settings split.** GradeOS doesn't distinguish today — everything's one giant menu. The operator-frequent stuff (vOffset, focus, current task) needs to be different from the calibrate-once-per-install stuff (mounting, units, RTK source).
- **Text ribbon as configurable** — operator picks which 3-5 readouts they want. Some operators want fuel/hours; others want blade tip elevation; others want chainage. Rigid display = wrong fit.
- **Plan + cross-section + long-section** as the three *real* operator views (not the 3D view, which is a sim luxury). Field/Operator Mode in GradeOS already does this — confirms it's the right baseline.

---

## 8. Operational wisdom (independent of architecture)

These are operator-side practices Trimble documents that affect the *design* of the system, even though they're behavioural, not feature decisions. They tell us what operators are actually doing on the dozer.

### Cutting edge wear
- Replace at >3 mm deviation (bow up, bow down, or end-wear).
- Cutting edge length (separate A and B values) **must be updated** as wear changes.
- Frequency depends on material. Rocky / abrasive = check often.
- **GradeOS implication:** cutting-edge length must be calibration-tunable. Stale calibration = systematic cut/fill error proportional to wear.

### Speed and harmonics
- Every dozer has an "optimal speed" that comes from undercarriage harmonics. Operator finds it by trial.
- Cutting too fast on rough terrain = rippled or wavy final surface.
- Final passes should be at this optimal speed.
- **GradeOS implication:** could surface a "speed quality" indicator — flag "you're cutting too fast for the surface roughness."

### Blade load
- Empty blade = chatters / oscillates (no material damping the hydraulics).
- Overloaded = slow response, material spills sides.
- Sweet spot: **¼ to ½ full**.
- **GradeOS implication:** even an indicate-only system could warn "blade load looks low/high" if we model it (post-v1.0).

### Pad start
- The starting platform for a grading run is one of the most important things to get right.
- Crawl back-and-forth slowly to build a smooth pad. Use back-blading.
- **GradeOS implication:** maybe a "pad start mode" with super-tight tolerance + slow-speed expected.

### Dozer cycle phases
1. **Cut** — load the blade.
2. **Carry** — transport material with full blade.
3. **Breakthrough point** — where the blade transitions from cut to fill (nominally at design level).
4. **Fill** — deposit material.
5. **Return** — back to start.
- Trimble Autos turns on/off based on phase.
- **GradeOS implication:** even in indicate-only, recognising the phase could change what we display (e.g. tighter tolerance during fine-grading vs loose during bulk move).

### Material conditions
- Type, density, moisture content — all affect autos performance.
- **GradeOS implication:** post-v1.0 calibration profile per material type.

### Hydraulics health
- Cylinder connection wear → blade movement noise → bad readings.
- Pivot bearing wear → same.
- Track tension out of spec → degrades performance.
- Hydraulic oil temperature affects valve response.
- **GradeOS implication:** for auto-blade future, machine condition matters; for indicate-only, mostly informational.

---

## 9. Concepts Trimble has that GradeOS doesn't (yet)

These are **gap-list candidates** — every one of them is a potential post-v1.0 feature. Each row should be triaged: do we want it?

| Concept | What it does | Gap-list rating |
|---|---|---|
| Working Surface Offset | Bulk shift to a target intermediate surface (subgrade workflow) | **Yes** — common need |
| Vertical vs Perpendicular offset | Different offset semantics on sloped designs | **Yes** — irrigation bays need this |
| Vertical guidance modes (Right/Centre/Left/Linked/2-Points) | Pick the cut/fill measurement strategy | **Yes** — replaces our always-3-points |
| Custom inset | Move the guidance point in from the tip | **Yes** — small, easy |
| Overcut Protection | Check whole blade against design, not just guidance points | **Yes** — safety |
| Reference surfaces | Show original + target at once | **Yes** — visualisation only, low effort |
| Avoidance zones | No-go areas | **Yes** post-v1.0 — farm safety |
| Project layer | Group designs by site | **Yes** post-v1.0 |
| Drive-your-design (blade-focus point capture) | Use machine to define design points | **Yes** — owner-operator killer feature |
| Edit-by-segment | Distance + angle + elevation editing | **Yes** — natural for hand shaping |
| Lock to grid | Snap points to grid | **Yes** — easy |
| Site calibration file | Define local UTM/grid for the site | **Yes** post-v1.0 |
| LandXML import | Workflow A | **Yes** post-v1.0 |
| TIN data model | Triangulated surfaces (vs grids) | **Maybe** — sampling to grid may be enough |
| Master alignment + chainage | Centreline-based work | **Maybe** — road-construction-flavoured |
| Lane guidance | Ride one lane of a design | **Maybe** — irrigation-bay-flavoured |
| Text grid view | Big text-only display for low-vis | **Maybe** — accessibility |
| External lightbars (hardware) | Physical LED bars in the cab | **Maybe** post-v1.0 |
| Buzzer | Audio on-grade signal | **Maybe** — easy, useful |
| Record points / Measured Data | In-cab survey capability | **Maybe** post-v1.0 |
| Worker manager cloud sync | Push designs from office | **No** — out of scope |
| Multi-surface designs | Multiple guidance options in one file | **No** for v1.0 |
| UTS positioning | Total-station guidance instead of GPS | **No** — F9P GPS only |
| Autos engagement / tuning | Auto-blade hydraulic control | **No** for v1.0 (post per ADR-0001) |
| AutoCarry | Auto material-load management | **No** — Cat-specific |

---

## 10. Things GradeOS does that Trimble doesn't (interesting differentiators)

Worth being explicit about — these are reasons GradeOS exists vs being a Trimble clone.

- **Open-source** — entire system inspectable, modifiable.
- **Single under-$2k hardware target** — Pi5 + dual F9P + magnetic-mount poles. Trimble's equivalent rover head alone is $20k+.
- **Browser-based simulator that's the dev environment** — Trimble's sim is a closed tool for training only.
- **Direct dual-GPS cross-slope** — Trimble's lower tiers use single GPS + IMU; we go straight to dual GPS for better readings (per ADR-0002 + Steven's field experience).
- **Drag-drop CSV survey import** from any vendor (already in repo) — Trimble locks you into TBC + their format chain.
