# Chord Detector

A prototype of the analysis pipeline behind pedals like the DigiTech Trio+'s
"Band Creator" feature: real-time chord recognition, key detection, and
tempo estimation from a live guitar signal.

**Scope note:** this project implements the *analysis* half of the pipeline
only — Stages 1-5 below. It does not include Stage 6 (mapping a detected
chord progression onto genre drum/bass pattern templates for playback). That
part is a much simpler, separate sequencing project once you have clean
chord + timestamp data coming out of this pipeline.

## Pipeline architecture

| Stage | What it does                                  | Technique                                    | Source file                                         |
|-------|-----------------------------------------------|----------------------------------------------|-----------------------------------------------------|
| 1     | Frame the incoming audio                      | Windowed buffers via sounddevice             | `src/audio_capture.py`                              |
| 2     | Extract a 12-dim Pitch Class Profile (chroma) | Constant-Q Transform (librosa)               | `src/pcp_extractor.py`                              |
| 3     | Match PCP against chord templates             | Cosine similarity + majority-vote smoothing  | `src/chord_templates.py`, `src/chord_recognizer.py` |
| 4     | Estimate tempo / beat grid                    | Onset strength + DP beat tracking (librosa)  | `src/tempo_tracker.py`                              |
| 5     | Infer the song's key                          | Krumhansl-Schmuckler key-profile correlation | `src/key_detector.py`                               |

This mirrors the classic MIR (Music Information Retrieval) approach to
chord recognition:

- Fujishima, T. (1999). *Realtime Chord Recognition of Musical Sound: A
  System Using Common Lisp Music.* ICMC.
- Bello, J. P. & Pickens, J. (2005). *A Robust Mid-Level Representation for
  Harmonic Content in Music Signals.* ISMIR. (HMM/Viterbi smoothing —
  not implemented here, but a natural next step over the simple
  majority-vote smoothing this project uses.)
- Lee, K. (2006). *Automatic Chord Recognition from Audio Using Enhanced
  Pitch Class Profile.* ICMC.
- Krumhansl, C. & Schmuckler, M. (1990 / based on 1982 Krumhansl-Kessler
  profiles). Key-finding algorithm.

## Requirements

- Docker + Docker Compose v2 (`docker compose`, not the old `docker-compose`)
- A Linux host (see **Audio on macOS/Windows** below if you're not on Linux)
- A guitar interface or USB mic feeding into your system's audio input

## Quick start (Linux host)

```bash
# 1. Build the image
docker compose build

# 2. Find your audio input device index
./scripts/list_devices.sh

# 3. Real-time chord tuner: prints the current chord as you play
./scripts/run_listen.sh <device_index>

# 4. "Learn mode": records N seconds, then reports the detected chord
#    sequence, key, and tempo -- analogous to the pedal's Learn pass
./scripts/run_learn.sh <device_index> 8
```

If you omit `<device_index>`, sounddevice/PortAudio will use its default
input device.

## Audio device passthrough (why this is the tricky part)

Real-time audio in Docker isn't as simple as `docker run` with your code —
containers don't have direct access to host hardware by default. This
project wires up two routes, both Linux-native:

1. **Raw ALSA device passthrough** — `docker-compose.yml` maps
   `/dev/snd:/dev/snd` into the container and adds it to the `audio` group,
   giving PortAudio inside the container direct access to your sound
   hardware.
2. **PulseAudio socket passthrough** — mounts your host's Pulse runtime
   socket directory and sets `PULSE_SERVER` so the container can route
   through your host's existing Pulse server instead of raw ALSA. This is
   often more reliable if your interface is already managed by PulseAudio
   (or PipeWire's Pulse-compatible layer) on the host.

Both are configured in `docker-compose.yml`; you likely only need one, but
having both wired up covers most desktop Linux audio setups.

### Audio on macOS / Windows

Docker Desktop on macOS and Windows runs containers inside a lightweight VM,
which does **not** expose host audio input devices to containers — there is
no `/dev/snd` equivalent, and PulseAudio socket forwarding doesn't apply the
same way. Practical options if you're on macOS/Windows:

- Run this project natively (create a Python virtualenv, `pip install -r
  requirements.txt`, run `python src/main.py` directly) instead of in Docker.
- Or run a PulseAudio server on the host that listens over TCP/network
  rather than a Unix socket, and point `PULSE_SERVER` at `host.docker.internal`
  — this works but is a nontrivial amount of extra host configuration and is
  outside the scope of what's wired up here.

## Modes

- **`--mode listen`** — continuous real-time chord detection, prints the
  currently held chord whenever it changes. Good for checking recognition
  accuracy against a real progression.
- **`--mode learn --seconds N`** — records for a fixed window (default 8s),
  then reports:
    - the collapsed chord sequence detected
    - the estimated key (Krumhansl-Schmuckler)
    - the estimated tempo in BPM

## Tuning recognition accuracy

- `--smoothing-window` (default 5): number of recent frames majority-voted
  to produce the displayed chord. Higher = more stable but slower to react
  to genuine chord changes.
- Recognition is currently limited to `maj`, `min`, dominant `7`, `min7`,
  and `maj7` qualities across all 12 roots (see `chord_templates.py`).
  This mirrors the pedal's own guidance: simple triads/7ths, one chord per
  bar, will track far more reliably than fast passing tones or extended
  jazz voicings, because the template set doesn't disambiguate those well.

## Extending this

- **Better smoothing:** swap the majority-vote in `chord_recognizer.py` for
  an HMM + Viterbi decode (Bello & Pickens 2005) for more robust handling
  of strum transients and noise.
- **More chord qualities:** add interval patterns to `CHORD_QUALITIES` in
  `chord_templates.py` (e.g. sus2, sus4, add9, dim, aug).
- **Stage 6 (playback):** take the collapsed chord sequence + tempo out of
  Learn mode and drive a MIDI drum/bass pattern sequencer, substituting
  each chord's root/quality into pre-authored genre pattern templates —
  this is the part that turns "detection" into an actual backing-band
  feature.

## Project layout

```
chord-detector/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── README.md
├── scripts/
│   ├── list_devices.sh
│   ├── run_listen.sh
│   └── run_learn.sh
└── src/
    ├── main.py              # CLI entrypoint, listen/learn modes
    ├── audio_capture.py     # Stage 1: real-time audio capture
    ├── pcp_extractor.py     # Stage 2: chroma/PCP extraction
    ├── chord_templates.py   # Chord template library
    ├── chord_recognizer.py  # Stage 3: template matching + smoothing
    ├── tempo_tracker.py     # Stage 4: onset/beat/tempo tracking
    └── key_detector.py      # Stage 5: key detection
```
