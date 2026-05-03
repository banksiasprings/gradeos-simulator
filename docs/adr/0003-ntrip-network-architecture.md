# ADR-0003 — NTRIP-over-Starlink network architecture for v1.0 (own base, machine as NTRIP client)

- **Status:** Accepted
- **Date:** 2026-05-03
- **Supersedes:** —
- **Superseded by:** —

## Context

RTK GNSS requires real-time correction data from a known reference station ("base") to deliver centimetre-level positioning at the rover (the machine). The network architecture for delivering that correction stream has several plausible shapes, with very different cost, dependency, and reliability profiles.

GradeOS targets owner-operator users (per CONTEXT.md) on remote farms in regional Australia. Mains broadband at the work site is rarely available. AUSCORS (Australia's free national CORS network) does not cover much of the agricultural land where GradeOS is meant to operate. Cell tower coverage is patchy. The user typically owns the farm and already has Starlink for general internet.

Three plausible network architectures:

### Option A — Subscribed third-party RTK network

- The machine subscribes to a commercial NTRIP service (e.g. Position Partners, AllDayRTK, AUSCORS commercial tier).
- No own base station required.
- Recurring cost ($1–3k AUD/year per machine).
- Coverage is the network's coverage — patchy in remote AU farmland.
- Dependency: business viability of the network operator.

### Option B — Own base station, NTRIP-over-internet to the machine

- 1× F9P + antenna at a fixed location at the farm (typically near the farmhouse where mains power and internet exist).
- Base runs NTRIP caster (open-source: RTKLIB `str2str`).
- Machine has its own internet connection (Starlink Mini onboard).
- Machine acts as NTRIP client — subscribes to its own base's caster.
- One-off hardware cost (~$200 for the base F9P + antenna).
- Zero recurring cost.
- Coverage: anywhere the machine's Starlink can reach the base's caster — i.e. anywhere with a working Starlink.

### Option C — Direct radio link from base to machine

- Base broadcasts RTCM corrections over a local radio (typically 410–470 MHz).
- Machine has a corresponding radio receiver.
- No internet required at the machine.
- Range limited (typically 5–20 km line-of-sight, less in hilly terrain).
- Hardware: extra radio modems on both sides ($300–500 per side).
- Licensing: in AU, transmitting on the typical bands requires an ACMA radio licence.

## Decision

**v1.0 uses Option B — own base station + NTRIP-over-Starlink.**

Concrete architecture:

```
                   FARMHOUSE                                 PADDOCK
┌──────────────────────────┐                ┌──────────────────────────────────┐
│  Base F9P + antenna       │                │   Machine (dozer / grader)        │
│  (fixed survey position) ──> RTCM           │                                  │
│         │                 │   over          │   Starlink Mini  ─────────────┐  │
│         ▼                 │   internet      │         │                      │  │
│  RTKLIB str2str caster ──>┼────────────────>┼──>  Pi5 (NTRIP client)        │  │
│         │                 │   via NTRIP     │         │                      │  │
│  Starlink / LTE / fixed   │                 │         ├──> Bluetooth ──> F9P A│
│  broadband (whatever the  │                 │         └──> Bluetooth ──> F9P B│
│  farmhouse has)           │                 │                                  │
└──────────────────────────┘                └──────────────────────────────────┘
```

**Hardware components owned by the user, total v1.0:**

- 2× F9P + GNSS antennas on poles at the blade corners (per ADR-0002).
- 1× F9P + GNSS antenna at the base station.
- (Optional, future) 1× F9P + antenna on a handheld pogo-stick survey rover.
- Total F9P units: **3 for v1.0**, 4 with pogo-stick option.

**Software components GradeOS provides:**

- NTRIP **client** in the Pi5 software stack (Slice 3 candidate — F9P NMEA bridge + NTRIP client are companion features).
- A **setup how-to document** for configuring the base station with RTKLIB `str2str` (one-time, per-farm).
- Geoid model bundling (per CONTEXT.md "Geoid + site calibration").

**Software GradeOS does NOT provide:**

- The NTRIP caster itself. Steven (or any user) runs RTKLIB `str2str` or equivalent open-source tooling on a small computer at the base location. We do not maintain a caster as a GradeOS deliverable.

## Consequences

### Positive

- **Zero recurring cost.** No NTRIP subscription. The user owns the entire correction pipeline.
- **Coverage = anywhere Starlink works.** Which is anywhere on Earth — solving the "no commercial RTK network coverage in remote AU farmland" problem cleanly.
- **Sovereignty.** No third-party can disable corrections. No subscription auto-renew. No credential expiry to chase. The base belongs to the user.
- **Hardware cost stays in budget.** ~$200 for the base F9P + antenna keeps total system cost under the $2k AUD/machine target. Even with Starlink Mini ($600 unit + ~$80/month service) the per-machine cost is bounded.
- **Open-source tooling.** RTKLIB `str2str` is mature, free, well-documented. No proprietary lock-in.
- **The user already has the prerequisites.** Starlink Mini was already in the README hardware target. Farmhouse internet is universal.

### Negative / accepted trade-offs

- **User must run a base station.** Setup requires understanding RTKLIB, NTRIP caster config, and either self-survey or known coordinates for the base position. Non-trivial first-time. Mitigation: ship a setup how-to + per-region pre-configured templates.
- **Latency: Starlink RTT.** RTCM corrections delivered via Starlink have ~25–50 ms latency vs ~5 ms over a direct radio link. For dozer-blade work this is acceptable (machine speed << correction update rate); for survey-grade applications this might matter; for our use case it's fine.
- **Single point of failure.** If the base station goes down (power loss, internet drop, hardware fault) the entire RTK fleet drops to FLOAT or autonomous. Mitigation: monitor base health from the machine UI; consider AUSCORS or commercial NTRIP as a backup source.
- **Self-survey for base position takes time.** Initial base position via a long static survey (typically 2–24 hours of recording for centimetre-grade absolute position) is the right way to start. Alternative: use a known surveyed point (one-time professional survey at install).

### Things that must not happen

- ❌ GradeOS must not auto-fall-back to autonomous GNSS (single-point uncorrected) without making this *very* visible to the operator. Autonomous accuracy is ~3 m horizontal, ~5 m vertical — entirely unsuitable for grading and silently degraded would cause real damage.
- ❌ GradeOS must not embed a hardcoded NTRIP credential or default caster URL. Each user configures their own base + caster.
- ❌ GradeOS must not depend on any commercial RTK network being available for v1.0 (ie no commercial tier as the v1.0 default).

## Alternatives considered

1. **Option A — subscribed third-party RTK network.** Rejected: recurring cost violates the cost-leadership story; coverage is patchy in remote AU farmland; introduces a vendor dependency that GradeOS's open-source story is meant to escape.

2. **Option C — direct radio link.** Rejected for v1.0: range limits constrain operations to within ~10 km of the base on flat ground (less in hills); ACMA licensing adds a regulatory burden the user must navigate; extra hardware cost on both ends. Could be revisited as a future option for users who specifically need offline-from-internet operation (e.g. mining contractors).

3. **Hybrid (own base + commercial backup).** Considered but deferred: adds complexity to the NTRIP client (failover logic, source selection UI) without clear v1.0 benefit. Could be added post-v1.0 as a reliability upgrade.

4. **Use AUSCORS (free national CORS) as the primary correction source.** Rejected for primary use: coverage gaps in agricultural areas; 50+ km baselines reduce achievable accuracy; the network is run for survey/research and may not have 24/7 reliability guarantees. Could be a fallback or a "no own base yet" starter option.

## Open follow-ups

- **Decide caster authentication scheme** in the setup how-to. Anonymous casters work but expose the RTCM stream; basic-auth casters are more typical. Steven's call when he sets it up.
- **Decide on per-base config storage** in GradeOS (UI for "add base station" with mountpoint, host, credentials).
- **Decide on RTK fix-quality reporting** in the operator UI: FIXED / FLOAT / DGPS / Autonomous / No Fix — what colour, what audio, what blocks operation.
