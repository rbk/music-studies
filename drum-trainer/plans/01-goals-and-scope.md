# 01 — Goals and Scope

## Problem statement

A drummer practicing with a metronome has no objective record of whether their timing
is actually improving. Commercial tools (eDrumTrainer) solve this for e-kits with MIDI;
we want the same feedback loop for **any** drum setup — acoustic kit, practice pad, or
desk-tapping — using only a laptop microphone.

## Primary goals

1. **Real-time timing feedback while practicing.** A live early/late meter showing,
   hit by hit, how far from the click each stroke landed (the standout feature of
   eDrumTrainer's interface).
2. **Evidence of improvement.** Every session produces stats that are saved locally
   and charted over time:
   - *mean offset* — systematic rushing (negative) or dragging (positive)
   - *standard deviation of offsets* — tightness / consistency
   - *hit rate* — % of expected beats matched within the accuracy window
3. **Configurable practice sessions.** BPM, subdivision (1/4, 1/8, 1/16, triplets),
   duration, and a free-text label (e.g. "singles", "paradiddles", "left-hand lead").
4. **Trustworthy measurements.** Built-in latency calibration so the numbers reflect
   the player, not the audio hardware.

## Secondary goals

- **Sustainable codebase.** Features can be added or removed without rewrites;
  components (metronome, detector, scorer) are individually reusable.
- **Minimal, stock UI.** Bare-minimum screens built from standard MUI components.
  No custom design work.
- **Local and private.** No server, no accounts, no analytics. Data lives in the
  browser and can be exported as JSON.

## Explicit non-goals (for the MVP)

These are consciously out of scope. Some appear in [08-roadmap.md](08-roadmap.md)
as future ideas; none may complicate the MVP design.

- **MIDI input.** The architecture reserves a slot for it (it's a drop-in alternative
  hit source), but the MVP is mic-only.
- **Per-drum / per-limb classification.** The mic can't reliably tell snare from kick
  in the MVP. All hits are one stream.
- **Groove/pattern checking.** We score "hit near an expected subdivision", not
  "played the correct pattern".
- **Tempo ramps, polyrhythms, swing feel.** The beat grid is a constant BPM with an
  even subdivision. (The scorer only sees a list of expected beat times, so ramps
  are a future metronome feature, not a redesign.)
- **Mobile support, deployment, offline PWA.** Local dev server on a laptop is the
  target environment for now.
- **Audio recording/playback of sessions.** We keep derived numbers, not audio.

## Success criteria for the MVP

- Metronome click audibly steady at 40–240 BPM with no drift over a 10-minute session.
- Tapping a practice pad next to the laptop registers ≥95% of medium-strength hits
  with no double-triggers at 1/8 notes, 120 BPM.
- Calibration completes in under 15 seconds and repeat runs agree within ±3 ms.
- After a session, the summary and history screens show the stats above, and the data
  survives a browser restart.
