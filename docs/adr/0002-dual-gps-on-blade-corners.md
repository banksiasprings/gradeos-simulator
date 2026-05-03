# ADR-0002 — Dual GPS antennas on the blade corners (not single GPS + IMU on the body)

- **Status:** Accepted
- **Date:** 2026-05-03
- **Supersedes:** —
- **Superseded by:** —

## Context

A machine-control system needs to know, in real time, where the blade is in 3D space — specifically, the elevation of each blade tip and the cross-slope angle between them. There are two common ways to instrument a machine for this:

### Option A — Single GPS antenna on the cab roof + IMU on the machine body

- One GPS receiver (one antenna, one F9P-class module) gives X, Y, Z of the cab roof.
- A body-mounted IMU gives pitch, roll, yaw.
- Cross-slope is derived by fusing IMU roll with assumed-fixed blade-to-body geometry.
- Used by most lower-end Trimble, Topcon, Leica systems.

### Option B — Dual GPS antennas on the blade itself

- Two GPS receivers, one near each end of the blade (typically on poles to clear obstructions).
- Cross-slope is the geometric difference between the two antenna elevations divided by horizontal antenna spacing — direct measurement, no fusion.
- Used by higher-end Trimble Earthworks dual-GPS systems.

## Decision

**GradeOS uses Option B — dual GPS antennas mounted on poles at the top corners of the blade, magnetically attached.** The Banksia Springs reference machine for v1.0 is built this way.

### Concrete mounting design

- Two vertical poles, one welded to each top corner of the blade.
- Magnetic mounts at the top of each pole, holding a u-blox F9P antenna.
- Antenna horizontal spacing ≈ blade width (the antennas sit at the cutting-edge corners of the blade).
- Antenna height above ground = blade height + pole height. Known fixed offset.
- Bluetooth back to the Pi5 compute box. Wireless to avoid cable runs along a vibrating blade.

### Calibration constants in code

```
mounting = {
  antennaA: { dx, dy, dz },   // antenna A → blade tip A cutting edge
  antennaB: { dx, dy, dz },   // antenna B → blade tip B cutting edge
}
```

`dz` is the dominant value (= -(poleHeight + bladeTopAboveCuttingEdge)). `dx` and `dy` are small corrections for non-perfectly-vertical poles and antenna phase-centre offsets, set at install-time calibration.

### Optional IMU on machine body (future)

A body-mounted IMU may be added as a *redundant* sensor for sanity-checking the pose or as an RTK-loss fallback. It is **not** the primary cross-slope source. The two GPS antennas are.

### IMU-per-blade-antenna for single-antenna degraded mode (added 2026-05-03)

Each F9P unit on the blade may carry an onboard IMU (most F9P-class boards include one). The IMU is **only used in degraded mode**, when its partner antenna has been lost (FLOAT, disconnected, or no fix). When both antennas are FIXED, geometric cross-slope from the two GPS positions remains the authoritative source — IMU is ignored.

This dodges the bouncy-IMU concern in this ADR's Positive section: that concern was about using IMU as the *primary* cross-slope source on a vibrating blade. As a fallback only used when geometric cross-slope is already unavailable, IMU's accuracy is sufficient for the bulking-grade work that's all that's reasonable in degraded mode anyway.

Operator UI must show a clear "DEGRADED MODE — bulking-grade accuracy only" banner whenever IMU-fallback cross-slope is in use.

## Consequences

### Positive

- **Cross-slope is direct measurement, not fusion.** A blade tilted wrong runs deep on one side — this is the most safety-critical number on the operator screen. Geometric cross-slope from two RTK-fixed antennas is the most trustworthy way to compute it. No IMU drift. No fusion algorithm to debug. No calibration that silently degrades.
- **Field-observed: IMUs bounce on the blade.** Steven's direct observation comparing Trimble dual-GPS rover heads to IMU-based systems: dual GPS produces a noticeably more consistent, less jittery cross-slope display when the machine hits bumps and rough ground. IMU readings bounce because the sensor is rigidly mounted to a vibrating, impacting blade; the fusion smoothing required to make them readable introduces lag. Two GPS antennas do not have this problem — they read absolute position, not acceleration.
- **Cost favours us, not Trimble.** Two u-blox F9P modules cost ~$400 AUD (DigiKey, 2026). Trimble's dual-GPS rover head is $20k+. The cost gap that drives the entire GradeOS thesis is widest exactly where we make this choice.
- **Survives RTK drama on one antenna.** If antenna A drops to FLOAT briefly while antenna B holds FIXED, we can still produce a degraded but useful pose (warn the operator, keep one tip authoritative). With single GPS + IMU, an RTK drop blinds the system entirely.
- **Calibration is a tape measure, not software ceremony.** Pole height + blade dimensions = mounting struct. No multi-step IMU calibration dance, no "drive a figure-8" alignment routine.

### Negative / accepted trade-offs

- **Two F9P modules instead of one.** ~$200 extra hardware cost. Acceptable given the cross-slope quality argument.
- **Two RTK fix streams to monitor.** UI must display both antennas' fix quality; operator needs to understand "one antenna lost FIX" as a partial-degradation state. Adds operator-display complexity. Worth it.
- **Magnetic mounts can detach.** Operational risk — a pole that falls off mid-grade ruins the job and possibly an antenna. Mitigation: tether each pole to the blade frame as a backup; show alarm if antenna position changes abruptly.
- **Two Bluetooth links to maintain.** Dropouts must be handled gracefully (last-known position, then clear FAULT state).

### Things that must not happen

- ❌ The blade-pose module must not read from an IMU. Cross-slope comes from the two GPS antenna positions, period. (An IMU module, if added later, computes its own pose estimate that can be cross-checked against the GPS pose downstream.)
- ❌ The operator display must not silently smooth across an antenna FIX→FLOAT transition. A degraded fix on one antenna is an operator-visible state change.
- ❌ The mounting struct must not be inferred from observed data ("self-calibration"). It is measured at install and stored in config. Inference invites drift.

## Alternatives considered

1. **Single GPS + IMU (Option A above).** Rejected: gives up direct cross-slope measurement at the price point where direct measurement is most affordable; introduces fusion debt; harder to debug; harder to fail safely.
2. **Three GPS antennas (two on blade + one on cab) for full machine pose.** Rejected for v1.0: adds cost and complexity for a pose component (machine body pitch, longitudinal grade) we can derive other ways. May be revisited post-v1.0.
3. **GPS antennas on the machine body, blade tip positions inferred from blade hydraulic sensor + body pose.** Rejected: depends on blade hydraulic sensors that aren't present on most machines; reintroduces fusion debt.
