# 08 — Roadmap

## Build order

Milestones are ordered so each produces something independently verifiable, and
the riskiest unknowns (mic behavior on real hardware) surface early. Don't start
a milestone until the previous one's check passes.

### M0 — Scaffold
Vite + React + TS + MUI app boots; `plans/` docs land alongside. ESLint +
vitest wired. **Check:** `npm run dev` shows an empty dark-mode shell;
`npm test` runs.

### M1 — Metronome
`clock.ts`, `metronome.ts`, `beat-grid.ts` + a bare temporary UI (BPM input,
start/stop). **Check:** steady clicks 40–240 BPM, subdivisions + accents right,
recorded 5-minute drift test passes (see 03).

### M2 — Hit detection
`onset-detector.ts` + worklet + MicCheck panel. **Check:** pad taps flash
reliably at several dynamics, no double-triggers, worklet unit tests pass
(see 04). *Highest-risk milestone — if desk/pad/kit each need different
sensitivity, that's fine (it's a setting); if the approach fundamentally
misses hits, revisit here before building anything on top.*

### M3 — Calibration
`calibration.ts` + guided flow. **Check:** 5 back-to-back runs agree within
±3 ms.

### M4 — Live session
`scorer.ts`, `useSessionRunner`, LiveScreen with TimingMeter. The eDrumTrainer
moment. **Check:** deliberately early/late/on-top hits move the meter the right
way by plausible amounts; scorer unit tests pass.

### M5 — Sessions + summary
Final scoring, `storage/sessions.ts`, SummaryScreen. **Check:** stats survive
browser restart; hand-verified against a fixture session.

### M6 — History
HistoryScreen, uPlot charts, filters, export/import. **Check:** trend chart over
several real sessions; export → clear storage → import round-trips losslessly.

### M7 — Polish pass
Error states (mic denied, quota, suspended context), wake-lock, count-in UX,
settings screen, README with screenshots.

**MVP = M0–M7.** Estimated shape: M1/M3/M5 are small; M2/M4/M6 are the real work.

## Future ideas (explicitly not MVP)

Parked, roughly ordered by value/effort. Each notes what it touches — the point
of the architecture is that none of them require a rewrite.

1. **MIDI input (e-kit).** Second `HitSource` implementation via Web MIDI —
   near-zero latency, per-pad identity, velocity for free. Touches: new
   `audio/midi-source.ts`, an input picker in Settings. *Highest value: turns
   the tool from "good evidence" into "precise instrument".*
2. **Tempo ramps.** "Start 60 BPM, +5 every minute." Touches: metronome
   scheduling + beat-grid generation (grid becomes piecewise), settings UI.
3. **Practice routine presets.** Named sequences of session settings run
   back-to-back. Touches: a `routines` storage key + a queue in the runner.
4. **Per-limb / per-drum tracking.** Requires MIDI (per-pad) or is out of reach
   for a single mic. Touches: `Hit` gains a `source` field; filters in charts.
5. **Gap click / dropout mode.** Metronome silent every other bar; timing keeps
   being scored — the classic internal-clock exercise. Touches: metronome
   (silent-but-gridded beats flag).
6. **Swing / odd meters.** Beat grid with uneven spacing. Touches: beat-grid +
   settings; scorer already doesn't care about spacing.
7. **Richer click sounds.** Sample player or Tone.js behind `ClickVoice`
   (see 03). Touches: one function.
8. **Deploy to GitHub Pages.** Static build; mic needs HTTPS, which Pages
   provides. Touches: CI workflow only.
9. **Session notes.** Free-text notes on the summary screen. Touches: `Session`
   type + two screens.

## Revisit triggers

Assumptions worth re-checking, and when:

- **localStorage over IndexedDB** — revisit if sessions regularly exceed ~10
  minutes at 1/16 notes or quota warnings appear in practice.
- **Energy-based detection** — revisit (spectral flux, or lean harder on MIDI)
  if M2 shows unacceptable miss rates on real kits.
- **No router** — revisit if screens grow beyond the current five.
