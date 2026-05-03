# ADR-0001 — v1.0 ships indicate-only, with a pluggable blade-target output seam for future auto-blade

- **Status:** Accepted
- **Date:** 2026-05-03
- **Supersedes:** —
- **Superseded by:** —

## Context

GradeOS targets under-$2,000 AUD per machine vs $50,000+ for Trimble Earthworks. Machine-control systems support two operational modes:

- **Indicate.** System tells the operator where the blade should be; operator moves the hydraulics manually. No physical control of the machine.
- **Auto-blade.** System drives the blade hydraulics directly via valve solenoids and a CAN interface. Operator steers; system manages blade height/tilt.

Auto-blade adds significant cost and complexity:
- Aftermarket hydraulic valve manifolds: $5–15k per machine.
- CAN bus interface or proportional valve drivers.
- Safety architecture: E-stop, fail-safe, watchdog.
- Regulatory exposure: in AU, machine-control auto systems engage with MDG-15 / ISO 13849 territory.
- Liability when the system pushes wrong.

That cost profile blows the under-$2k hardware target on its own. Auto-blade is therefore out of scope for v1.0.

However, modern dozers shipped from factory with auto-blade-ready hydraulics and CAN interfaces (Cat XE, Komatsu iMC, John Deere SmartGrade-ready) make auto-blade a *software* problem rather than a hardware one. Auto-blade is a real long-term goal for those machines, not something we can permanently abandon.

## Decision

**v1.0 ships indicate-only.** The product computes a blade target ("blade tip A should be at +X mm; tip B at +Y mm; longitudinal grade Z%") and renders it on the operator display. The operator moves the hydraulics by hand. No physical control of the machine.

**The architecture must keep a pluggable blade-target output seam** so that future auto-blade support is a downstream adapter swap, not a rewrite. Concretely:

- The product's blade-guidance core produces a **canonical blade target** as its primary output: a structured value containing tip A target, tip B target, longitudinal grade, cross-slope, design elevation reference, current measured elevation, and tolerance band.
- Multiple **output adapters** consume the blade target:
  - **Indicate adapter** (v1.0): renders to operator display — 3-bar LEDs, text ribbon, cut/fill bar, blade canvas, plan/long/cross-section views.
  - **Hydraulic adapter** (future): translates blade target into CAN command frames for a factory valve controller.
  - **Sim adapter** (used in dev): drives the simulated machine kinematics, so the operator-display logic can be exercised against a live blade-target stream.
- The blade-guidance math is **identical** across all three adapters. Only the output side differs.

## Consequences

### Positive

- v1.0 is shippable on the under-$2k hardware target. No actuator hardware. No safety certification. No regulatory exposure.
- Works on *any* dozer/grader/loader, not just factory-prep'd machines. Massively expands the deployable fleet.
- Auto-blade becomes an additive future feature — adding a hydraulic adapter — not a rewrite.
- The seam forces clean separation between *guidance math* (product, deeply tested) and *output rendering* (adapter, swappable). This pays back in code clarity beyond just the auto-blade case.

### Negative / accepted trade-offs

- We do not match Trimble's auto-blade feature for v1.0. Some prospects will discount us for that. We accept this — owner-operator users (per CONTEXT.md) are not the buyers comparing us to Trimble auto-blade in the first place.
- The "auto-steer" feature in the current simulator is a different thing (machine *path* control, not blade control) and remains out of scope. It stays a sim-shell-only demo. Keep it cleanly out of the product layer.
- The seam adds a small amount of indirection vs. wiring guidance math directly into the LED renderer. Worth it.

### Things that must not happen

- ❌ The LED bar / text ribbon / blade canvas must not read directly from machine state. They consume the blade target, only.
- ❌ The blade-guidance math must not call into rendering, sim physics, or hardware adapters directly. It computes a blade target and returns it.
- ❌ Auto-steer (path control) must not creep into the product layer. It is sim-shell or, eventually, a separate product line.

## Alternatives considered

1. **Ship auto-blade in v1.0.** Rejected: hardware cost alone ($5–15k aftermarket per machine) violates the under-$2k target, before any safety or regulatory cost.
2. **Permanently abandon auto-blade.** Rejected: factory-prep'd machines make it cheap-to-add later, and the long-term feature parity with Trimble matters for the product's ceiling.
3. **Build auto-blade-only and target factory-prep'd machines exclusively.** Rejected: massively shrinks the addressable fleet, and most owner-operator machines (older D6, D7, motor graders) are not factory-prep'd.
4. **Treat indicate and auto-blade as two separate codebases.** Rejected: the guidance math is genuinely identical; duplicating it doubles bugs and divergence risk.
