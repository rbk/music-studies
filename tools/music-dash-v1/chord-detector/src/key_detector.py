"""
Stage 5 of the pipeline: key detection from an accumulated set of
detected chords, using the Krumhansl-Schmuckler key-profile method.

Each of the 24 possible keys (12 major + 12 minor) has a canonical
"how strongly does each scale degree feel like home in this key"
profile. We build a pitch-class histogram from the chords seen during
a Learn pass, then correlate it against all 24 rotated profiles and
pick the best match.
"""

import numpy as np
from chord_templates import PITCH_CLASSES, CHORD_TEMPLATES

# Krumhansl-Kessler major/minor key profiles (classic 1982 values)
MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


def chord_histogram(chord_sequence: list[str]) -> np.ndarray:
    """Build a 12-dim pitch-class weight histogram from a list of chord labels."""
    hist = np.zeros(12)
    for chord_name in chord_sequence:
        if chord_name == "N" or chord_name not in CHORD_TEMPLATES:
            continue
        hist += CHORD_TEMPLATES[chord_name]
    if hist.sum() > 0:
        hist = hist / hist.sum()
    return hist


def detect_key(chord_sequence: list[str]) -> str:
    """Returns a string like 'G major' or 'E minor'."""
    hist = chord_histogram(chord_sequence)
    best_key, best_score = "C major", -np.inf

    for shift in range(12):
        maj_profile_rot = np.roll(MAJOR_PROFILE, shift)
        min_profile_rot = np.roll(MINOR_PROFILE, shift)

        maj_score = np.corrcoef(hist, maj_profile_rot)[0, 1]
        min_score = np.corrcoef(hist, min_profile_rot)[0, 1]

        if maj_score > best_score:
            best_score = maj_score
            best_key = f"{PITCH_CLASSES[shift]} major"
        if min_score > best_score:
            best_score = min_score
            best_key = f"{PITCH_CLASSES[shift]} minor"

    return best_key
