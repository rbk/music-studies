# Music Dashboard

A prototype web dashboard to help a person get better at guitar and
timing. Single-origin app: a Flask + SQLite backend serves the React
frontend and an audio-analysis API.

## What it does

A dashboard of live-updating components:

| Component       | What it does                                                        |
|-----------------|---------------------------------------------------------------------|
| Chords          | Live chord detection from the mic, with a horizontal history slider |
|                 | (current detection highlighted in the middle, scroll back) and an  |
|                 | inline-SVG chord diagram for the current chord.                     |
| Drum Sessions   | Set tempo, enable metronome, detect drum hits from the mic, match    |
|                 | each hit to the nearest beat, compute accuracy %, start/end session,|
|                 | persist sessions, list previous sessions.                          |
| Metronome       | Set tempo, play/pause, visual beat pulse (Web Audio).               |
| Tempo           | Detect tempo from a short mic clip, or set it manually.            |
| Timbre          | Detect brightness/texture (spectral centroid/rolloff/ZCR).         |
| Key Detector    | Detect the musical key from a longer clip (Krumhansl-Schmuckler).   |
| Music Style     | Heuristic genre guess from tempo + chord-quality mix + rhythm.      |

## Architecture

```
music-dashboard/
├── backend/
│   ├── app.py          Flask app: serves frontend + REST API
│   ├── analysis.py     Audio analysis (chord/key/tempo/timbre/style)
│   ├── db.py           SQLite session store
│   └── requirements.txt
└── frontend/
    ├── index.html      single inline-babel bootstrap loads modules in order
    ├── index.js        (legacy; replaced by inline bootstrap — kept empty-ish)
    ├── js/audio.js     shared mic + Web Audio + API helpers
    ├── js/core/        React, ReactDOM, Babel (in-browser JSX)
    ├── js/utils/       axios, lodash, moment
    ├── css/            basscss + style
    ├── manifest.webmanifest
    └── components/     Card, ChordDiagram, Metronome, Tempo, Timbre,
                        Chords, KeyDetector, StyleDetector, DrumSessions,
                        Dashboard
```

### Audio analysis

The analysis engine (`backend/analysis.py`) ports the chord-detector
prototype's pipeline (PCP extraction via librosa `chroma_cqt`, template
matching, majority-vote smoothing, librosa beat tracking, Krumhansl-
Schmuckler key detection) and adds:

- **Timbre** — spectral centroid → brightness band, flatness/ZCR → texture.
- **Style** — heuristic genre scoring from tempo, chord-quality ratios,
  onset density, and brightness. A readable hint, not a classifier.

Audio intake: the browser records the mic with `MediaRecorder` (webm/opus)
and POSTs the blob to `POST /api/analyze`. The backend decodes it to PCM
with `ffmpeg`, runs `analysis.analyze_audio`, and returns JSON.

### Why a custom chord diagram instead of chordy-svg

The original idea listed `chordy-svg`, but it requires `svg.js` + `Tonal`
as browser globals, and the current `@tonaljs/tonal` npm build is CommonJS-
only (uses `require()` for subpackages) and won't run as a plain browser
script. To keep the prototype robust and dependency-light, chord diagrams
are rendered with a small inline-SVG component (`ChordDiagram.js`) driven
by the fingering array the analysis engine computes.

### Why an inline babel bootstrap

`babel-standalone`'s auto-processing of external `<script type="text/babel"
src=...>` tags fetches them out of document order, so `index.js` can run
`ReactDOM.render` before components are defined and leave the page blank.
`index.html` instead uses one inline `text/babel` bootstrap that fetches,
transforms, and evals each module in deterministic order before mounting.

## Run it

Requirements: `python3` (3.9+; tested with the macOS system Python 3.9.6 —
Python 3.14 lacks librosa wheels), `ffmpeg` on `PATH`, a Chromium browser
for the frontend.

```bash
cd music-dashboard/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
# -> http://127.0.0.1:5050/
```

Open http://127.0.0.1:5050/ , click **Enable mic**, grant permission, then
use the dashboard. The metronome works without a mic.

## API

| Method | Path                  | Body / params                          |
|--------|-----------------------|----------------------------------------|
| GET    | /api/health           | —                                      |
| GET    | /api/chords           | all known chords + fingerings          |
| POST   | /api/analyze          | multipart `audio` file -> full analysis|
| GET    | /api/sessions         | list drum sessions                     |
| POST   | /api/sessions         | JSON session record -> created         |
| DELETE | /api/sessions/:id     | delete a session                        |

## Notes / limitations

- Prototype-grade detection: simple triads/7ths only (maj, min, 7, min7,
  maj7) across 12 roots; majority-vote smoothing, no HMM/Viterbi.
- Style/timbre are coarse heuristics, not trained classifiers.
- Drum-session accuracy is computed client-side: an energy-onset detector
  on the mic stream matches hits to the nearest scheduled beat within
  ±160ms; "on time" is ±30ms.
- Headless browsers have no mic, so detection buttons need a real browser
  with a microphone. The metronome and session UI work headless.