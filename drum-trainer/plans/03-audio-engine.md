# 03 — Audio Engine: Clock and Metronome

## The clock (`audio/clock.ts`)

One `AudioContext` for the entire app, created lazily on the first user gesture
(browsers block audio before interaction). Everything — click scheduling, hit
timestamps, calibration — reads `ctx.currentTime`. `Date.now()` /
`performance.now()` are never used for measurement.

```ts
export function getAudioContext(): AudioContext;  // creates + resumes on first call
```

Also exposes `now()` as a convenience. If the context enters `suspended` state
(tab backgrounded on some platforms), the session runner pauses rather than
producing garbage timing.

## Why not `setInterval`

JS timers fire on the event loop: under load they jitter by tens of milliseconds —
larger than the timing errors we're trying to measure. The Web Audio clock is
sample-accurate, and `AudioBufferSourceNode.start(t)` / oscillator `start(t)`
schedule sound at exact clock times.

## The lookahead scheduler (`audio/metronome.ts`)

The standard pattern (Chris Wilson's "A Tale of Two Clocks"): a coarse JS timer
wakes frequently, and each wake schedules any clicks falling in the near future
on the audio clock. The JS timer's jitter doesn't matter because it only needs to
wake *sometime* before the next click is due.

```
every 25 ms (setInterval — jitter is fine here):
  while (nextBeatTime < ctx.currentTime + 0.10):   # 100 ms lookahead
    scheduleClick(nextBeatTime, isAccent)
    emit onBeat({ time: nextBeatTime, index, isAccent })
    nextBeatTime += secondsPerSubdivision
    index += 1
```

Parameters (25 ms interval, 100 ms lookahead) are constants in one place; the
tradeoff is responsiveness of tempo changes vs. safety margin under load.

### Beat times are computed, not accumulated blindly

`nextBeatTime` starts at an anchor (`startTime = ctx.currentTime + 0.2`) and each
beat is `startTime + index * secondsPerSubdivision` to avoid floating-point drift
over long sessions. The same formula lives in `core/beat-grid.ts` so the scorer
can regenerate the expected grid from `(startTime, bpm, subdivision, count)`
without storing every beat time.

### Click sound

Synthesized inline with an oscillator — no samples, no library:

- **Accent (downbeat):** ~1800 Hz, gain 1.0
- **Regular subdivision:** ~1200 Hz, gain 0.6
- Envelope: instant attack, exponential decay to silence in ~30 ms.

A `ClickVoice` function `(ctx, time, isAccent) => void` is the only sound-making
code. If richer sounds are ever wanted, this is the single seam where a sample
player (or Tone.js) plugs in — the scheduler doesn't change.

### Subdivisions

`SessionSettings.subdivision` ∈ {1, 2, 3, 4} = subdivisions per quarter note
(1/4, 1/8, triplets, 1/16). Accent lands on beat 1 of each bar (4/4 assumed for
MVP; time signature is a settings field with one supported value so adding more
later is additive).

## Count-in

One bar of clicks before `startTime` that is *excluded* from the beat grid, so
the first flailing hits don't pollute stats. The metronome emits
`onBeat` with `index < 0` for count-in beats; the scorer ignores them.

## Testing

- Unit: beat-grid formula (`core/beat-grid.ts`) — exact times for known settings.
- Manual: record 5 minutes of clicks at 120 BPM with an external recorder,
  measure first vs. last click spacing in an audio editor → no cumulative drift.
- The scheduler itself is thin enough that manual verification plus the recorded
  drift check is adequate for MVP.
