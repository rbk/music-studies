# 04 — Onset Detection and Calibration

## Onset detection (`audio/onset-detector.ts` + `onset-worklet.ts`)

Drum hits are the easy case for onset detection: sharp, high-energy transients.
A simple energy-based detector in an `AudioWorklet` is sufficient — no FFT, no ML,
no DSP library.

### Capture

```ts
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,   // these three "help" speech and destroy drums:
    noiseSuppression: false,   // they'd eat transients and add latency
    autoGainControl: false,
  }
})
```

The stream feeds a `MediaStreamAudioSourceNode` → `AudioWorkletNode`. The worklet
runs on the audio thread in 128-sample quanta, so detection timing is tied to the
audio clock, not the (jittery) main thread.

### Detection algorithm (in the worklet)

Per 128-sample block:

1. Compute block RMS energy.
2. Maintain a slow-moving average `noiseFloor` (exponential smoothing).
3. **Trigger** when `rms > max(threshold, noiseFloor * ratio)` **and** the detector
   is armed.
4. On trigger: post `{ time, velocity }` to the main thread, where `time` is the
   audio-clock time of the block (refined to the peak sample within the block) and
   `velocity` is normalized RMS.
5. **Disarm** for a refractory period (default **50 ms**): a real drum hit rings
   and would otherwise double-trigger. 50 ms re-arms fast enough for 1/16 notes at
   240 BPM (62.5 ms apart) while suppressing ring. Refractory period is a tunable
   constant; flams closer than it are out of scope for mic input.

### Tunables, exposed as a `DetectorSettings` object

| Setting | Default | Notes |
| --- | --- | --- |
| `threshold` | 0.02 RMS | absolute floor; slider in UI ("sensitivity") |
| `ratio` | 4× noise floor | adaptive part |
| `refractoryMs` | 50 | double-trigger suppression |

A small **input meter + hit flash** in the UI (see 07) lets the user tune
sensitivity by tapping and watching, which beats any auto-tuning we could build.

### Emitted event

```ts
{ time: number /* audio-clock seconds, calibration-corrected */, velocity: number }
```

The calibration offset is subtracted here, inside the detector, so every consumer
downstream sees honest times (single point of correction).

## Latency calibration (`audio/calibration.ts`)

### Why

The mic path adds a roughly constant delay: acoustic travel + ADC + input buffer +
worklet quantum. Typically 10–40 ms — same order of magnitude as the timing errors
we measure. Uncalibrated, every player looks "late" by a constant amount and the
mean-offset stat (rush/drag) is meaningless.

### How

Loopback measurement, fully automatic:

1. Play N = 8 clicks through the speakers at known audio-clock times `t_out[i]`
   (reusing the metronome's `ClickVoice`), spaced ~500 ms.
2. The onset detector (calibration-uncorrected mode) reports detected times
   `t_in[i]`.
3. Pair them 1:1 in order; `latency = median(t_in[i] − t_out[i])`. Median discards
   spurious detections/echoes.
4. Sanity checks: at least 6 of 8 clicks detected; spread (IQR) < 10 ms.
   Otherwise report failure with a hint (raise volume, quiet the room, adjust
   sensitivity) and keep the previous value.

Result is stored with the user's settings (localStorage) and shown in Setup
("Calibrated: 23 ms"). Recalibration is one click away — needed when the
speaker/mic/interface setup changes.

### Requirement

Calibration needs speakers audible to the mic (not headphones). Practice itself
can then use headphones — mic latency doesn't depend on how the click is
monitored. The UI says this explicitly during calibration.

### Limitation to document in-app

Speaker→mic acoustic travel is part of the measured latency, but so is
drum→mic travel during practice (~1 ms per 34 cm). If the mic sits a similar
distance from the drum as from the speakers, these roughly cancel. Not worth
more sophistication for MVP; noted in the calibration screen's help text.

## Testing

- Unit-test the trigger/refractory logic by running the worklet's process function
  (it's a pure function of samples + state) against synthetic buffers: impulse,
  impulse train at 1/16@240 BPM, white noise, silence.
- Manual: pad taps at several dynamics; verify hit rate and no double-triggers.
- Calibration: run 5× back-to-back, assert spread ≤ 3 ms (success criterion in 01).
