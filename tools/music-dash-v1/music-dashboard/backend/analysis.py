"""
Audio analysis engine for the music dashboard.

This module is the analysis half of the chord-detector prototype
(Stages 1-5: PCP extraction, chord template matching, tempo tracking,
key detection) plus two new prototype detectors layered on top:

  - timbre detection : brightness / texture from spectral centroid,
                      rolloff, and zero-crossing rate
  - style detection  : heuristic genre guess from tempo + chord-quality
                       mix + rhythmic regularity + spectral brightness

`analyze_audio(y, sr)` is the single entry point used by the Flask
endpoints: give it a mono float32 numpy buffer + sample rate and it
returns one dict with everything the dashboard needs.
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Any

import librosa
import numpy as np

# ----------------------------------------------------------------------
# Pitch classes + chord templates (ported from chord-detector)
# ----------------------------------------------------------------------

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

CHORD_QUALITIES: dict[str, list[int]] = {
    "maj": [0, 4, 7],
    "min": [0, 3, 7],
    "7": [0, 4, 7, 10],       # dominant 7th
    "min7": [0, 3, 7, 10],
    "maj7": [0, 4, 7, 11],
}

# Per-chord fingering (standard EADGBE tuning) for the frontend diagram.
# (fret, fret, fret, fret, fret, fret); -1 = muted, 0 = open.
# Covers all 12 roots via the barre-shape table below; simple triads + 7ths.
# This is enough for the MVP chord diagram display.
BARRE_SHAPES: dict[str, dict[str, list[int]]] = {
    # E-shape (root on low E string)
    "maj-E": [-1, 0, 2, 2, 2, 0],
    "min-E": [-1, 0, 2, 2, 1, 0],
    "7-E":   [-1, 0, 2, 0, 2, 0],
    "min7-E":[-1, 0, 2, 0, 1, 0],
    "maj7-E":[-1, 0, 1, 2, 2, 0],
    # A-shape (root on A string)
    "maj-A": [-1, -1, 0, 2, 2, 2],
    "min-A": [-1, -1, 0, 2, 1, 2],
    "7-A":   [-1, -1, 0, 2, 0, 2],
    "min7-A":[-1, -1, 0, 2, 1, 3],
    "maj7-A":[-1, -1, 0, 1, 2, 2],
}
# Which fret the open-shape root sits on, by string family.
E_ROOTS = {  # root pitch index -> (shape key family, base fret of open chord)
}
A_ROOTS = {}

# Precompute root -> open-chord fret for E-string and A-string shapes.
# E-string open: root note of fret 0 on the low E string is E (index 4).
# A-string open: root note of fret 0 on the A string is A (index 9).
_E_STRING_ROOT = 4   # low E
_A_STRING_ROOT = 9   # A


def _fingering_for(root_idx: int, quality: str) -> list[int]:
    """Pick a playable fingering for (root, quality), preferring A-shape
    then E-shape, transposed by the appropriate barre fret."""
    # A-shape: root at fret r on A string => r = (root_idx - 9) % 12
    r_a = (root_idx - _A_STRING_ROOT) % 12
    # E-shape: root at fret r on low E string => r = (root_idx - 4) % 12
    r_e = (root_idx - _E_STRING_ROOT) % 12

    # Prefer the lower-fret, more comfortable shape.
    candidates = []
    if r_a <= 11:
        shape = BARRE_SHAPES[f"{quality}-A"]
        candidates.append(_transpose_fingering(shape, r_a, root_string=5))
    if r_e <= 11:
        shape = BARRE_SHAPES[f"{quality}-E"]
        candidates.append(_transpose_fingering(shape, r_e, root_string=6))
    # Pick whichever has the lowest max fret (more comfortable).
    candidates.sort(key=lambda f: max(x for x in f if x >= 0))
    return candidates[0] if candidates else [-1] * 6


def _transpose_fingering(open_shape: list[int], fret: int, root_string: int) -> list[int]:
    """Shift an open chord shape up by `fret` semitones. Open strings (0)
    become barred at `fret`; muted strings (-1) stay muted."""
    if fret == 0:
        return list(open_shape)
    out = []
    for s in open_shape:
        if s < 0:
            out.append(-1)
        elif s == 0:
            out.append(fret)
        else:
            out.append(s + fret)
    return out


def build_templates() -> dict[str, np.ndarray]:
    templates: dict[str, np.ndarray] = {}
    for root_idx, root_name in enumerate(PITCH_CLASSES):
        for quality, intervals in CHORD_QUALITIES.items():
            vec = np.zeros(12)
            for interval in intervals:
                vec[(root_idx + interval) % 12] = 1.0
            vec = vec / np.linalg.norm(vec)
            templates[f"{root_name}:{quality}"] = vec
    return templates


CHORD_TEMPLATES = build_templates()

# Pretty display name + fingering for every template.
CHORD_INFO: dict[str, dict[str, Any]] = {}
for root_idx, root_name in enumerate(PITCH_CLASSES):
    for quality in CHORD_QUALITIES:
        key = f"{root_name}:{quality}"
        display = f"{root_name}{quality.replace('maj', '').replace('min', 'm')}"
        # nicer suffixes
        if quality == "maj":
            display = root_name
        elif quality == "min":
            display = f"{root_name}m"
        elif quality == "7":
            display = f"{root_name}7"
        elif quality == "min7":
            display = f"{root_name}m7"
        elif quality == "maj7":
            display = f"{root_name}maj7"
        CHORD_INFO[key] = {
            "name": display,
            "root": root_name,
            "quality": quality,
            "fingering": _fingering_for(root_idx, quality),
        }


# ----------------------------------------------------------------------
# Frame-level extraction
# ----------------------------------------------------------------------

def extract_pcp(audio: np.ndarray, sr: int) -> np.ndarray:
    """Return a normalized 12-dim chroma vector for a short buffer."""
    if len(audio) < 2048:
        audio = np.pad(audio, (0, 2048 - len(audio)))
    chroma = librosa.feature.chroma_cqt(y=audio.astype(np.float32), sr=sr, hop_length=512)
    pcp = chroma.mean(axis=1)
    norm = np.linalg.norm(pcp)
    return pcp / norm if norm > 0 else pcp


def frame_energy(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))


def match_chord(pcp: np.ndarray) -> tuple[str, float]:
    best_name, best_score = "N", -1.0
    for name, template in CHORD_TEMPLATES.items():
        score = float(np.dot(pcp, template))
        if score > best_score:
            best_name, best_score = name, score
    return best_name, best_score


# ----------------------------------------------------------------------
# Tempo / key
# ----------------------------------------------------------------------

def estimate_tempo(audio: np.ndarray, sr: int) -> tuple[float, int]:
    if len(audio) < sr:
        return 0.0, 0
    onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    tempo_val = float(tempo) if np.isscalar(tempo) else float(tempo[0])
    return tempo_val, len(beats)


# Krumhansl-Kessler profiles
MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


def chord_histogram(chord_sequence: list[str]) -> np.ndarray:
    hist = np.zeros(12)
    for name in chord_sequence:
        if name == "N" or name not in CHORD_TEMPLATES:
            continue
        hist += CHORD_TEMPLATES[name]
    if hist.sum() > 0:
        hist = hist / hist.sum()
    return hist


def detect_key(chord_sequence: list[str]) -> str:
    hist = chord_histogram(chord_sequence)
    best_key, best_score = "C major", -np.inf
    for shift in range(12):
        maj = np.corrcoef(hist, np.roll(MAJOR_PROFILE, shift))[0, 1]
        mn = np.corrcoef(hist, np.roll(MINOR_PROFILE, shift))[0, 1]
        if maj > best_score:
            best_score = maj
            best_key = f"{PITCH_CLASSES[shift]} major"
        if mn > best_score:
            best_score = mn
            best_key = f"{PITCH_CLASSES[shift]} minor"
    return best_key


# ----------------------------------------------------------------------
# Timbre detection (prototype)
# ----------------------------------------------------------------------

def detect_timbre(audio: np.ndarray, sr: int) -> dict[str, Any]:
    """Prototype timbre descriptor from short-time spectral features.

    Maps spectral centroid (brightness), rolloff, and zero-crossing rate
    to a human-readable texture label. This is a coarse heuristic, not a
    trained classifier -- enough for a dashboard readout.
    """
    if len(audio) < 2048:
        audio = np.pad(audio, (0, 2048 - len(audio)))
    y = audio.astype(np.float32)
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
    flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))

    # Centroid in Hz -> a brightness band
    if centroid < 1500:
        brightness = "warm"
    elif centroid < 3500:
        brightness = "balanced"
    elif centroid < 6000:
        brightness = "bright"
    else:
        brightness = "piercing"

    if flatness > 0.3:
        texture = "noisy / diffuse"
    elif zcr > 0.15:
        texture = "thin / plucked"
    else:
        texture = "rich / sustained"

    return {
        "brightness": brightness,
        "texture": texture,
        "centroid_hz": round(centroid, 1),
        "rolloff_hz": round(rolloff, 1),
        "zcr": round(zcr, 4),
        "flatness": round(flatness, 4),
        "label": f"{brightness}, {texture}",
    }


# ----------------------------------------------------------------------
# Style detection (prototype heuristic)
# ----------------------------------------------------------------------

def detect_style(tempo: float, chord_qualities: Counter, onset_density: float,
                 centroid: float, key_minor: bool) -> dict[str, Any]:
    """A naive genre guess from low-level features. Not a classifier --
    just a readable hint for the dashboard."""
    n = sum(chord_qualities.values()) or 1
    seven_ratio = (chord_qualities.get("7", 0) + chord_qualities.get("min7", 0)
                   + chord_qualities.get("maj7", 0)) / n
    minor_ratio = chord_qualities.get("min", 0) / n

    scores: dict[str, float] = {
        "ballad": 0.0,
        "pop": 0.0,
        "rock": 0.0,
        "blues": 0.0,
        "jazz": 0.0,
        "country": 0.0,
        "funk": 0.0,
        "metal": 0.0,
    }

    # Tempo bands
    if tempo < 70:
        scores["ballad"] += 2
    elif tempo < 95:
        scores["ballad"] += 1
        scores["blues"] += 1
    elif tempo < 115:
        scores["pop"] += 1
        scores["country"] += 1
    elif tempo < 135:
        scores["rock"] += 1
        scores["pop"] += 1
    elif tempo < 160:
        scores["rock"] += 2
        scores["funk"] += 1
    else:
        scores["metal"] += 2
        scores["punk" if False else "rock"] += 1  # keep to known keys

    # Chord quality mix
    if seven_ratio > 0.35:
        scores["jazz"] += 2
        scores["blues"] += 1
    if minor_ratio > 0.4:
        scores["metal"] += 1
        scores["blues"] += 1
    if chord_qualities.get("maj", 0) / n > 0.6:
        scores["country"] += 1
        scores["pop"] += 1

    # Brightness
    if centroid > 5000:
        scores["metal"] += 1
        scores["rock"] += 1
    elif centroid < 2000:
        scores["ballad"] += 1
        scores["blues"] += 1

    # Rhythmic density
    if onset_density > 4.0:
        scores["funk"] += 1
        scores["metal"] += 1
    elif onset_density < 1.5:
        scores["ballad"] += 1

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best, score = ranked[0]
    runner_up = ranked[1][0] if len(ranked) > 1 else None
    confidence = "low" if score < 2 else ("medium" if score < 4 else "high")
    return {
        "style": best,
        "runner_up": runner_up,
        "confidence": confidence,
        "tempo": round(tempo, 1),
        "onset_density": round(onset_density, 2),
    }


# ----------------------------------------------------------------------
# Top-level analysis
# ----------------------------------------------------------------------

@dataclass
class AnalysisResult:
    chord: str = "N"
    chord_name: str = "-"
    chord_info: dict[str, Any] | None = None
    chord_history: list[dict[str, Any]] = field(default_factory=list)
    key: str = ""
    tempo: float = 0.0
    beats: int = 0
    timbre: dict[str, Any] = field(default_factory=dict)
    style: dict[str, Any] = field(default_factory=dict)
    duration_s: float = 0.0
    energy: float = 0.0


def _smoothed_chord_sequence(y: np.ndarray, sr: int,
                             frame_len: int = 4096, hop: int = 2048,
                             smoothing_window: int = 5,
                             silence_threshold: float = 0.01) -> list[str]:
    """Frame the buffer, detect a chord per frame, majority-vote over a
    rolling window -> stable chord sequence (ported from chord_recognizer)."""
    if len(y) < frame_len:
        return []
    recent: deque[str] = deque(maxlen=smoothing_window)
    raw: list[str] = []
    for start in range(0, len(y) - frame_len + 1, hop):
        frame = y[start:start + frame_len]
        e = frame_energy(frame)
        if e < silence_threshold:
            recent.append("N")
            raw.append("N")
            continue
        pcp = extract_pcp(frame, sr)
        name, _ = match_chord(pcp)
        recent.append(name)
        vote = Counter(recent).most_common(1)[0][0]
        raw.append(vote)
    # collapse consecutive duplicates
    collapsed: list[str] = []
    for c in raw:
        if c == "N":
            continue
        if not collapsed or collapsed[-1] != c:
            collapsed.append(c)
    return collapsed


def analyze_audio(y: np.ndarray, sr: int, include_history: bool = True) -> AnalysisResult:
    """Run the full analysis on a mono float32 buffer."""
    y = np.asarray(y, dtype=np.float32).reshape(-1)
    if y.size == 0:
        return AnalysisResult()
    duration = float(len(y) / sr)
    energy = frame_energy(y)

    # Tempo + onsets
    tempo, beats = (0.0, 0)
    onset_density = 0.0
    if len(y) >= sr:
        try:
            tempo, beats = estimate_tempo(y, sr)
        except Exception:
            tempo, beats = 0.0, 0
        try:
            onsets = librosa.onset.onset_detect(y=y, sr=sr)
            onset_density = float(len(onsets) / max(duration, 0.001))
        except Exception:
            onset_density = 0.0

    # Chord sequence (smoothed, collapsed)
    chord_sequence = _smoothed_chord_sequence(y, sr)

    # Current chord = last non-N in the sequence, else template match on last frame
    current = chord_sequence[-1] if chord_sequence else "N"
    if current == "N":
        tail = y[-4096:] if len(y) >= 4096 else y
        current, _ = match_chord(extract_pcp(tail, sr))

    chord_info = CHORD_INFO.get(current)
    chord_name = chord_info["name"] if chord_info else "-"
    key = detect_key(chord_sequence) if chord_sequence else ""

    # Timbre
    timbre = detect_timbre(y, sr)

    # Style
    q_counter: Counter = Counter()
    for c in chord_sequence:
        if c in CHORD_INFO:
            q_counter[CHORD_INFO[c]["quality"]] += 1
    style = detect_style(tempo, q_counter, onset_density,
                         timbre["centroid_hz"], key.lower().endswith("minor"))

    history: list[dict[str, Any]] = []
    if include_history:
        for c in chord_sequence:
            info = CHORD_INFO.get(c)
            history.append({"chord": c, "name": info["name"] if info else c,
                            "fingering": info["fingering"] if info else None})

    return AnalysisResult(
        chord=current,
        chord_name=chord_name,
        chord_info=({"name": chord_info["name"], "root": chord_info["root"],
                     "quality": chord_info["quality"],
                     "fingering": chord_info["fingering"]}
                    if chord_info else None),
        chord_history=history,
        key=key,
        tempo=round(tempo, 1),
        beats=beats,
        timbre=timbre,
        style=style,
        duration_s=round(duration, 2),
        energy=round(energy, 4),
    )


def result_to_dict(res: AnalysisResult) -> dict[str, Any]:
    return {
        "chord": res.chord,
        "chord_name": res.chord_name,
        "chord_info": res.chord_info,
        "chord_history": res.chord_history,
        "key": res.key,
        "tempo": res.tempo,
        "beats": res.beats,
        "timbre": res.timbre,
        "style": res.style,
        "duration_s": res.duration_s,
        "energy": res.energy,
    }