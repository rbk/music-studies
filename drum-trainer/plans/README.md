# Drum Trainer — Implementation Plans

A small, local-first web tool for tracking drum practice sessions, with a focus on
**measuring timing accuracy** and producing **evidence of improvement over time**.
Inspired by [eDrumTrainer](https://edrumtrainer.com/), but browser-based, using the
microphone for hit detection.

This directory contains the implementation plan, split by aspect. Read them in order
the first time; after that each doc stands alone as the reference for its area.

| Doc | Aspect |
| --- | --- |
| [01-goals-and-scope.md](01-goals-and-scope.md) | What we're building, what we're explicitly not building |
| [02-architecture.md](02-architecture.md) | Module layout, dependency rules, how pieces talk |
| [03-audio-engine.md](03-audio-engine.md) | Shared clock and lookahead metronome scheduler |
| [04-onset-detection-and-calibration.md](04-onset-detection-and-calibration.md) | Mic hit detection and latency calibration |
| [05-scoring-and-data-model.md](05-scoring-and-data-model.md) | Pairing hits to beats, stats, core data types |
| [06-storage-and-history.md](06-storage-and-history.md) | localStorage persistence, export/import, history charts |
| [07-ui.md](07-ui.md) | Screens, components, and MUI usage |
| [08-roadmap.md](08-roadmap.md) | Build order, milestones, and future ideas |

## Decisions already made

These were settled in discussion and are treated as fixed unless revisited deliberately:

- **UI stack:** React + Vite + MUI. Stock components, no custom design system.
- **Audio:** raw Web Audio API. No audio framework; Tone.js may be added later
  *for sound generation only*, never for timing.
- **Storage:** browser `localStorage` with JSON export/import. No server, no accounts.
- **Charts:** one small chart library (see 06).
- **Deployment:** local-only for now (`npm run dev`). No build/deploy wiring yet;
  mic access works on `localhost` (secure context), so nothing blocks this.
- **Location:** lives in this repo under `drum-trainer/`, independent of everything
  else in the repo.

## Guiding principles

1. **One clock.** All timing — clicks and detected hits — is measured on a single
   `AudioContext` clock. Wall-clock time (`Date.now`) is only used for labeling
   sessions, never for measurement.
2. **The core is framework-free.** `audio/` and `core/` never import React or MUI.
   The UI consumes plain events and JSON-able data objects.
3. **Honest numbers or no numbers.** Latency calibration is part of the MVP.
   Uncalibrated timing data would quietly lie about rush/drag tendency.
4. **Few dependencies, boring dependencies.** Every dependency must be justified in
   the plan doc that introduces it.
