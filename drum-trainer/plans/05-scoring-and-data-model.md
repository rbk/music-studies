# 05 — Scoring and Data Model

## Core types (`core/types.ts`)

Everything is plain JSON-able data — no classes, no methods — so the same shapes
flow through scoring, storage, export, and charts.

```ts
interface SessionSettings {
  bpm: number;                 // 40–240
  subdivision: 1 | 2 | 3 | 4;  // per quarter note: 1/4, 1/8, triplet, 1/16
  durationSec: number;         // practice length, excluding count-in
  label: string;               // "singles", "paradiddles", ...
  accuracyWindowMs: number;    // default 50; a hit within ±window is "matched"
}

interface Hit {
  time: number;                // audio-clock seconds, calibration-corrected
  velocity: number;            // 0..1, informational for MVP
}

interface ScoredHit extends Hit {
  beatIndex: number | null;    // matched grid index, or null = stray hit
  offsetMs: number | null;     // signed; negative = early, positive = late
}

interface SessionStats {
  meanOffsetMs: number;        // rush/drag tendency
  stdDevMs: number;            // tightness — the headline improvement metric
  hitRate: number;             // matched beats / expected beats, 0..1
  strayHits: number;           // hits matched to no beat
  missedBeats: number;         // beats with no matched hit
  histogram: number[];         // offset counts in 5 ms bins over ±window, for charts
}

interface Session {
  id: string;                  // crypto.randomUUID()
  startedAt: string;           // ISO date — labeling only, never measurement
  settings: SessionSettings;
  hits: ScoredHit[];           // full detail kept; sessions are small (~KBs)
  stats: SessionStats;         // denormalized for cheap history charts
}
```

## Beat grid (`core/beat-grid.ts`)

Pure function: `gridTimes(startTime, settings): number[]` using the same
`startTime + index * secondsPerSubdivision` formula as the metronome (see 03).
Count-in beats have negative indices and are never in the grid.

## Matching policy (`core/scorer.ts`)

The decision recorded here (discussed and chosen over alternatives):
**snap to nearest expected beat, bounded by the accuracy window.**

For each hit, the candidate beat is the nearest grid time.

- `|offset| ≤ accuracyWindowMs` → matched: `beatIndex` set, offset recorded.
- `|offset| > accuracyWindowMs` → **stray hit**: kept in the session with
  `beatIndex: null`, counted in `strayHits`, excluded from offset stats.
  (Excluding them keeps stdDev meaningful; a wild hit is a different mistake
  than a loose hit, and gets its own counter.)
- Two hits nearest to the same beat (e.g. flam/double-trigger leak-through):
  the closer one matches, the other becomes a stray. Implemented greedily over
  hits sorted by |offset| — with a refractory period upstream this is rare.
- Expected beats with no matched hit → `missedBeats`.

Default `accuracyWindowMs = 50`, editable in Setup. At high subdivisions the
window is additionally capped at 45% of the subdivision interval so adjacent
windows can't overlap.

### Live vs. final scoring share one function

`matchHit(hit, grid, windowMs): ScoredHit` is used both per-hit during the live
session (driving the meter) and in the final pass (`scoreSession`). The summary
can therefore never disagree with what the meter showed.

## Stats definitions

Over matched hits only:

- `meanOffsetMs` — signed mean. Interpretation shown in UI: "you tend to rush /
  drag by X ms".
- `stdDevMs` — population std dev of offsets. **This is the improvement metric**:
  it should trend down over weeks of practice.
- `hitRate` — matched / expected.

Edge case: a session with < 8 matched hits gets stats computed but flagged
(`tooFewHits`) so the history chart can exclude or dim it — a 10-second test run
shouldn't pollute the trend line.

## Testing

`core/` is pure, so this is the best-tested layer:

- Grid generation for each subdivision at boundary BPMs.
- Matching: exact hit, early/late within window, outside window, two hits one
  beat, hit equidistant between beats, empty session.
- Stats against hand-computed fixtures.
