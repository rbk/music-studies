# 02 — Architecture

## Directory layout

```
drum-trainer/
  index.html
  package.json
  vite.config.ts
  plans/                  # these documents
  src/
    audio/                # Web Audio only — NO React imports
      clock.ts            # shared AudioContext; single source of time
      metronome.ts        # lookahead scheduler; plays clicks, emits beat events
      onset-detector.ts   # mic capture + AudioWorklet; emits hit events
      onset-worklet.ts    # AudioWorkletProcessor (built as a separate entry)
      calibration.ts      # speaker→mic round-trip latency measurement
    core/                 # pure logic — NO React, NO Web Audio imports
      types.ts            # Session, Hit, SessionSettings, SessionStats
      scorer.ts           # pairs hits to beat grid; computes stats
      beat-grid.ts        # generates expected beat times from settings
    storage/
      sessions.ts         # localStorage CRUD + JSON export/import
    ui/                   # React + MUI; consumes audio/ and core/ via props/hooks
      App.tsx
      screens/
        SetupScreen.tsx
        LiveScreen.tsx
        SummaryScreen.tsx
        HistoryScreen.tsx
      components/
        TimingMeter.tsx   # the early/late bar
        StatCards.tsx
        HistoryChart.tsx
      hooks/
        useSessionRunner.ts  # wires metronome + detector + scorer into React state
```

## Dependency rules

The arrows below are the only allowed import directions. This is the load-bearing
rule that keeps components reusable — enforce it in review (an ESLint
`import/no-restricted-paths` rule can automate it later).

```
ui  ──►  core, audio, storage
storage  ──►  core (types only)
audio  ──►  core (types only)
core  ──►  (nothing)
```

- `core/` is pure functions over plain data. Trivially unit-testable.
- `audio/` talks to hardware and emits events; it knows nothing about scoring or UI.
- `ui/` is the only layer allowed to hold React state.

## How the pieces talk

`audio/` modules expose a minimal event-emitter interface (hand-rolled, ~15 lines —
not a dependency):

```ts
// metronome.ts
interface Metronome {
  start(settings: SessionSettings): void;
  stop(): void;
  onBeat(cb: (b: { time: number; index: number; isAccent: boolean }) => void): void;
}

// onset-detector.ts
interface HitSource {
  start(): Promise<void>;        // requests mic permission
  stop(): void;
  onHit(cb: (h: { time: number; velocity: number }) => void): void;
}
```

`HitSource` is deliberately the narrow waist of the design: a future MIDI input
implements the same interface and everything downstream (scorer, meter, storage)
works unchanged.

All `time` values are `AudioContext.currentTime` seconds. The calibration offset is
subtracted **inside the detector** before events are emitted, so downstream code
never thinks about latency.

## Session lifecycle (the one flow that matters)

```
SetupScreen ──(settings)──► useSessionRunner
  1. metronome.start(settings)        clicks begin; beat events accumulate
  2. hitSource.start()                hits stream in (latency-corrected)
  3. scorer.matchLive(hit, grid)      → offset ms → TimingMeter updates
  4. duration elapses → stop both
  5. scorer.score(hits, grid)         → SessionStats
  6. storage.save(session)
  7. navigate to SummaryScreen
```

Live feedback (step 3) and final scoring (step 5) share the same matching function
from `core/scorer.ts`, so the meter and the saved stats can never disagree.

## Dependencies (complete intended list)

| Package | Why | Guarded against |
| --- | --- | --- |
| `react`, `react-dom` | UI | — |
| `@mui/material` (+ `@emotion/*` peers) | Stock components, no custom design | Importing it outside `ui/` |
| `uPlot` (see 06) | History charts | Using it for the live meter (that's plain DOM/SVG) |
| `vite`, `typescript` (dev) | Build/serve | — |
| `vitest` (dev) | Unit tests for `core/` | — |

Nothing else without updating this table and the doc that justifies it.
