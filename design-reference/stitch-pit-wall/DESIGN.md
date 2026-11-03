---
name: Pitlane Telemetry
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2d'
  surface-container-highest: '#333538'
  on-surface: '#e2e2e6'
  on-surface-variant: '#e7bdb2'
  inverse-surface: '#e2e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#ad887e'
  outline-variant: '#5d4038'
  surface-tint: '#ffb5a0'
  primary: '#ffb5a0'
  on-primary: '#601400'
  primary-container: '#ff5625'
  on-primary-container: '#541100'
  inverse-primary: '#b12d00'
  secondary: '#ffffff'
  on-secondary: '#373100'
  secondary-container: '#fee400'
  on-secondary-container: '#716500'
  tertiary: '#00daf3'
  on-tertiary: '#00363d'
  tertiary-container: '#009fb2'
  on-tertiary-container: '#002f35'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a0'
  on-primary-fixed: '#3b0900'
  on-primary-fixed-variant: '#872000'
  secondary-fixed: '#fee400'
  secondary-fixed-dim: '#dec800'
  on-secondary-fixed: '#201c00'
  on-secondary-fixed-variant: '#504700'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#111317'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  body-lg:
    fontFamily: Chivo
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Chivo
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Chivo
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-telemetry-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.06em
  label-telemetry-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-telemetry-xs:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.1em
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels the uncompromising intensity, technical precision, and split-second operational clarity of a Formula 1 pit wall. Built for complex human-AI multi-agent developer workflows, the visual language fuses technical brutalism with dark aerodynamic glassmorphism, delivering an ultra-crisp heads-up display.

The aesthetic evokes mission-critical telemetry consoles: high-contrast dark tarmac panels, carbon-weave matte surfaces, micro-gridded tactical overlays, and vivid incandescent signals that command instant peripheral attention. Information density is calibrated to prevent cognitive overload during high-velocity collaborative sessions, ensuring critical agent states, pipeline execution steps, and system anomalies are parsed in milliseconds.

## Colors

The palette is engineered around high-contrast luminescence over light-absorbing deep asphalt tones:

- **Apex Orange (`#FF4500`)**: The primary signal driver. Used for active executions, primary actions, critical alerts, and focused states.
- **Racing Yellow (`#FFE500`)**: Secondary telemetry accent. Reserved for sector benchmarks, intermediate agent states, caution flags, and metric callouts.
- **Electric Blue (`#00E5FF`)**: Tertiary telemetry color. Designates AI agent streams, active I/O pipelines, and live data synchronization links.
- **Tarmac Neutral Scale**:
  - `Surface Canvas`: `#0B0D10` (deep tarmac void)
  - `Surface Panel`: `#13161C` (structural chassis tier)
  - `Surface Raised / Hover`: `#1A1E26` (elevated cockpit module)
  - `Surface Overlay / Glass`: `rgba(19, 22, 28, 0.72)`
  - `Technical Border`: `#262C38` with an active highlight state of `rgba(255, 69, 0, 0.45)`
- **Functional Semantics**:
  - `Purple S1/Fastest Sector`: `#B026FF` (record state, performance peak)
  - `Green Flag`: `#00E676` (healthy pipeline, agent idle ready)
  - `Text High-Contrast`: `#F4F6F9`
  - `Text Muted Telemetry`: `#828C9E`

## Typography

Typography functions as a precision instrument:

- **Space Grotesk**: Drives primary structural navigation, modular HUD titles, and impact statistics. Its technical, low-contrast brutalist strokes reflect modern aerodynamics.
- **Chivo**: Provides neutral, friction-free legibility across complex AI prompt threads, logs, and human-in-the-loop collaborative editing panels.
- **JetBrains Mono**: Deployed for time-delta displays (`+0.042s`), telemetry metrics, agent process identifiers, model parameters, and raw shell output. All monospaced labels use uppercase treatment and expanded tracking (`letter-spacing`) to mirror racing timing sheets.

## Layout & Spacing

The layout is built on a 12-column rigid fluid HUD grid, optimized for multi-pane telemetry consoles and widescreen developer workstations.

- **Breakpoints**:
  - `Mobile` (< 768px): 4-column layout with vertical drawer stacking for secondary telemetry feeds.
  - `Tablet` (768px - 1199px): 8-column layout with a dockable telemetry strip.
  - `Desktop` (≥ 1200px): 12-column or 16-column layout with pinned agent orchestration panels, persistent lap timer pipelines, and code execution consoles.
- **Rhythm & Safe Areas**: Layout uses a strict 4px/8px incremental cadence. Multi-agent timeline streams utilize dense 8px gutters to maximize terminal real estate while high-priority cockpit metrics leverage 16px to 24px margins to avoid click collisions under rapid input cycles.

## Elevation & Depth

Visual hierarchy uses physical chassis layering rather than traditional soft shadow elevation:

1. **Base Tarmac Canvas (`#0B0D10`)**: The grounded chassis background. Layered with subtle technical gridlines (`1px` lines in `rgba(255, 255, 255, 0.03)` at 32px intervals) or micro-checkered edge accents.
2. **Telemetry Surface Panels (`#13161C`)**: 1px sharp structural borders using `#262C38`. Zero ambient shadow to maintain terminal sharpness.
3. **Cockpit Floating Modals & Overlays (`rgba(19, 22, 28, 0.85)`)**: Enhanced with `backdrop-filter: blur(12px)` and a directional top-lit border (`border-top: 1px solid rgba(255, 69, 0, 0.6)`).
4. **Active Luminescence & Glow**: High-urgency alerts, active agents, and RPM ceiling indicators generate targeted chromatic neon blooms:
   - Orange focus state: `box-shadow: 0 0 12px rgba(255, 69, 0, 0.35)`
   - Electric Blue data pulse: `box-shadow: 0 0 12px rgba(0, 229, 255, 0.3)`

## Shapes

This design system adopts a strict **Sharp (`0`)** shape language, reflecting precision-machined carbon fiber monocoques, telemetry flight recorders, and aerodynamic edge channels.

- **Chassis Edges**: Rectilinear 0px border radius across all primary structural panels, dialogs, buttons, and telemetry cells.
- **Chamfered Micro-Cuts**: High-priority interactive elements (e.g., primary deployment triggers, active agent cards) may feature diagonal chamfered corners (`clip-path: polygon(...)` 6px corner cuts) on top-right and bottom-left bounds to mimic aerodynamic racing components.
- **Separators & Rulers**: 1px crisp horizontal and vertical rules with checkered raster accents at terminal joints.

## Components

### Buttons
- **Primary (Box Box / Deploy)**: Background in solid `#FF4500`, high-contrast `#0B0D10` heavy monospaced typography, sharp 0px corners with a 6px top-right chamfer cut. Hover state shifts to `#FF5722` with an ambient orange glow (`0 0 16px rgba(255, 69, 0, 0.45)`).
- **Secondary (Telemetry Action)**: Background `#13161C`, 1px border in `#262C38`, text in `#F4F6F9`. Hover state activates an Electric Blue border (`#00E5FF`) and blue text highlight.
- **Ghost / Utility**: Monospaced uppercase with bracket enclosures (`[ ABORT RUN ]`), shifting to high-contrast red upon hover.

### Telemetry Badges & Chips
- Ultra-dense rectangular tags with a 2px left-side accent strip.
- Status values follow racing conventions: `P1` / `PURPLE` (`#B026FF`), `DELTA GREEN` (`#00E676`), `PIT LIMITER` (`#FFE500`), and `CRITICAL DNF` (`#FF1744`).
- Content is formatted strictly in uppercase `JetBrains Mono` with minimal internal padding (`2px 6px`).

### Lists & Activity Feeds
- Styled as racing event logs and timing tower rows.
- Alternating subtle tarmac striping (`#13161C` / `#161A22`).
- Each entry is prepended with a monospaced session timestamp or lap-cycle delta indicator (`T+00:14.218`).
- Hovering a feed item triggers a 2px `Apex Orange` left marker.

### Form Inputs & Telemetry Fields
- Dark recessed background (`#0B0D10`), encased in a rigid 1px `#262C38` border.
- Floating monospaced micro-labels in uppercase (`PARAM_TEMP_THRESHOLD`).
- Focus state eliminates standard browser outlines, engaging a crisp 1px `#FF4500` perimeter border with an internal glow.
- Checkboxes and toggles operate as mechanical digital switches: rectangular boxes with high-contrast inverted fill when engaged.

### Cards & Modular Pods
- Modular cockpit panels with a dedicated top header bar containing system health status LEDs (green/yellow/red dots) and panel diagnostic IDs (`PANEL // 04 - AGENT_SWARM`).
- Optional micro-checkered accent border along the top or bottom right corner to signify ready state.

### Specialty Components
- **RPM Sector Gauge**: A progressive horizontal strip of segmented LEDs (Green -> Racing Yellow -> Red -> Apex Violet) displaying AI token throughput, compute load, or model context window saturation.
- **Timing Delta Bar**: Comparison widgets displaying execution differences between autonomous agent iterations (`-0.342s faster`).