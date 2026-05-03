# GradeOS Simulator

**Open-source RTK GPS machine control simulator for dozers, graders, and earthmoving equipment.**

[**▶ Launch Simulator**](https://banksiasprings.github.io/gradeos-simulator/) · [**📄 Instruction Manual (PDF)**](./GradeOS_Simulator_Manual.pdf)

---

## What is GradeOS?

GradeOS is an open-source GPS machine control platform for agricultural and construction earthmoving. Where commercial systems like Trimble Earthworks cost $50,000+ per machine, GradeOS targets the same real-time blade guidance capability at a fraction of the price — using off-the-shelf RTK hardware, Raspberry Pi-class compute, and open data formats.

This repository contains the **GradeOS Simulator** — a fully interactive, browser-based 3D terrain grading simulator built on THREE.js. It runs entirely in your browser with no installation required.

---

## Live Demo

👉 **[https://banksiasprings.github.io/gradeos-simulator/](https://banksiasprings.github.io/gradeos-simulator/)**

No login. No install. Works on desktop Chrome, Firefox, or Edge.

---

## Feature Overview

### 3D Terrain & Design

- **160 m × 160 m site** on an 80×80 grid at 2 m cell spacing
- **6 procedural terrain types** — Hilly Farm, Mountain, Valley, Flat Plains, Rolling Hills, Coastal Dunes
- Real-time cut/fill colour overlay with 7-band legend (blue = cut, green = on grade, red/orange = fill)
- **Contour lines** with adjustable interval
- **Ghost overlay** — original terrain shown as transparent surface to visualise what has been moved
- **Drainage flow lines** (D8 algorithm) — see where water flows after grading
- **Slope warning** overlay — flags cells exceeding your set grade limit
- **Daylight line** — where cut/fill transitions to natural ground
- **Pass heat map** — shows how many times the blade has crossed each cell

### Design Tools

| Tool | What it does |
|------|-------------|
| ⬛ Flat Pad | Click 3+ points to create a flat platform at a set elevation |
| ◥ Slope | Define a graded plane between two elevation points |
| 🛤 Crown | Road crown with configurable cross-fall and subgrade |
| 🌊 Dam | Raised embankment with upstream and downstream batters |
| 📐 Best-Fit | Mathematically optimise a flat grade to minimise cut/fill volume |
| ⛰ Batter | Batter/catch drain with configurable slope and bench |
| 💧 Irrigation Bay | Precision-graded bay with head ditch and tail drain |
| ✂ Profile | Extrude a cross-section profile along a survey alignment |
| Align | Set a survey centreline with chainage and offset staking |

### RTK GPS Machine Control

- Simulated **RTK FIXED / RTK FLOAT / DGPS** fix types with realistic accuracy and jitter
- HDOP, satellite count, base station distance, horizontal accuracy
- **Three-bar blade guidance** — left tip, centre, right tip height error in millimetres
- **Text ribbon** — full-width blade guidance strip with cut/fill arrows
- **Blade diagram canvas** — visual tilt and grade indicator
- Real-time **longitudinal grade** and **cross-slope** readout

### Machine Simulation

- **D8 Dozer** — 6 m blade, 3.0 km/h cut speed, 25 L/hr fuel
- **Motor Grader** — 4.5 m blade, 5.5 km/h, finer passes
- **Wheel Loader** — 3.0 m bucket, 7.0 km/h
- **Fleet mode** — 3 AI machines running simultaneously on auto-steer
- **Auto-steer** — boustrophedon (alternating N–S strip) passes
- **Cab view** — first-person operator perspective
- **Follow cam** — tracking camera behind the machine

### Field / Operator Mode

Press **F** (or click 🖥 Field in the toolbar) to enter a clean, full-screen operator display — the way a real machine cab screen works.

- **Long Section** — 40 m ahead / 10 m behind terrain and design profile along the machine heading
- **Cross Section** — 12 m either side perpendicular slice at the blade
- **Plan View** — 60 m top-down cut/fill map with machine heading arrow
- **Grade HUD bar** — Centre mm, Tip A mm, Tip B mm, Long Grade, X-Slope, Elevation, Speed, GPS status
- All editing panels hidden — full terrain viewport, live profile windows only

### Volume & Productivity

- Real-time cut / fill / net volume in m³
- Job completion percentage with ±25 mm tolerance tracking
- Productivity rate (m³/hr), ETA to completion
- Engine hours, fuel burn (L and $)
- Cost estimation with configurable diesel price

### Survey & As-Built

- **GPS Import** — drag-and-drop CSV (Easting, Northing, Elevation) from Trimble, AgLeader, Leica, John Deere or custom format
- **Survey coverage mesh** — tracks which cells have been measured by the rover
- **As-Built export** — download a CSV of measured ground truth after grading
- **Job Report** — PDF-style HTML summary of volumes, productivity and tolerance stats

### Demo Scenarios

| Scenario | Description |
|----------|------------|
| 🏗 Site Setup | Machine arrives, RTK locks on, flat pad design placed |
| 🚜 Farm Levelling | Full irrigation bay grading run on Hilly Farm terrain |
| 🛤 Road Crown | Grader cutting a crowned road with proper cross-fall |
| 🌊 Dam Build | Earthen dam construction with compaction passes |
| 📡 GradeOS Scout | Autonomous survey rover mapping the site before the dozer arrives |

### Additional Tools

- **Elevation probe** (double-click) — shows ground elevation, design depth, cut/fill and slope at any point
- **Measure tool** — click two points for distance, bearing and elevation difference
- **Profile tool** — draw a cut line, see an accurate cross-section profile graph
- **Stake markers** — click to place survey stakes with chainage labels
- **Grade direction arrows** — flow arrows showing which way the grade falls
- **Contour labels** — elevation labels on contour lines
- **V-Offset** — raise or lower the design surface ±500 mm with preset memory slots
- **Replay** — replay the machine's grading run from the start
- **Screenshot** — save a PNG of the 3D view
- **Save / Load** — persist your site design to a JSON file
- **Pitch Card** (P key) — investor-facing summary card with site stats and cost comparison

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle machine on/off |
| W / A / S / D | Drive (forward / left / back / right) |
| ↑ ↓ | Blade up / down |
| C | Cycle camera mode (3D → Plan → Follow → Cab) |
| G | Toggle ghost overlay |
| F | Toggle Field / Operator Mode |
| H | Show keyboard shortcut help |
| P | Toggle Pitch / investor demo card |
| Scroll | Zoom |
| Right-drag | Orbit camera |
| Double-click | Elevation probe |

---

## Technology

- **THREE.js r128** — 3D terrain rendering, vertex-coloured BufferGeometry
- **Vanilla JavaScript** — no framework, no build step, single HTML file
- **Canvas 2D API** — profile graphs, blade guidance diagrams, field mode panels
- **CSS Grid / Flexbox** — responsive layout

The entire simulator is a single self-contained HTML file (`index.html`). Open it locally or serve it from any static host.

---

## GradeOS Hardware Platform

The simulator represents the software layer of the full GradeOS stack. The target hardware configuration is:

| Component | Spec |
|-----------|------|
| GNSS Receiver | u-blox F9P RTK module (9 mm H accuracy) |
| Base Station | Starlink Mini + NTRIP broadcaster or AUSCORS network |
| Compute | Raspberry Pi 5 or Jetson Nano |
| Display | 10" sunlight-readable IPS touchscreen |
| Power | 12 V machine supply with solar backup |
| Connectivity | Starlink Mini for remote NTRIP and telemetry |

Total hardware cost target: **under $2,000 AUD per machine** vs. $50,000+ for Trimble Earthworks.

---

## Project Status

| Version | Date | Highlights |
|---------|------|-----------|
| v0.9 | May 2026 | Architecture rewrite (product/sim seam, NMEA bridge, Project hierarchy), Trimble-style cab screen with multi-pane layouts + configurable text ribbon + right toolbar, two-layer offset model (elevation + working surface), Profile Designer (universal line-based design tool), Performance Mode toggle |
| v0.8 | Apr 2026 | Field/Operator Mode with 3 live profile windows |
| v0.7 | Apr 2026 | Scout scenario, survey coverage mesh, ghost overlay |
| v0.6 | Apr 2026 | Replay system, pass heat map, daylight line, grade strips |
| v0.5 | Apr 2026 | Fleet mode, as-built export, job report |
| v0.4 | Apr 2026 | RTK simulation, cab view, blade diagram |
| v0.3 | Apr 2026 | Volume calculator, productivity tracking, D8 drainage |
| v0.1 | Apr 2026 | Initial 3D terrain simulator |

---

## Documentation

📄 **[GradeOS Simulator — Instruction Manual (PDF)](./GradeOS_Simulator_Manual.pdf)**

The manual covers all 21 sections including Quick Start, every design tool, machine control, RTK GPS, Field Mode, export formats, keyboard shortcuts, and troubleshooting. Download it for offline reference or to share with operators.

---

## Roadmap

- [ ] Real u-blox F9P NMEA data integration (USB/UART)
- [ ] NTRIP client for AUSCORS / custom base station
- [ ] Blade tilt sensor (IMU) integration
- [ ] Android / iOS companion app (Capacitor)
- [ ] Multi-machine coordination (MQTT telemetry)
- [ ] Offline tile maps (OpenStreetMap / Mapbox)
- [ ] GradeOS Scout — autonomous survey rover firmware
- [ ] Design file import (LandXML, DXF)

---

## About

Built by **Banksia Springs Farm** — a working farm in regional Australia using GradeOS technology for precision irrigation bay grading and dam construction.

Commercial machine control is priced out of reach for small-to-medium operators. GradeOS is the open alternative.

**Contact:** [smcnichol@outlook.com](mailto:smcnichol@outlook.com)

---

*GradeOS is open-source software. The simulator runs entirely in your browser — no data leaves your device.*
