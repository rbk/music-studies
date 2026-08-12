"""
Chord template library.

Each chord is represented as a 12-dimensional binary Pitch Class Profile (PCP)
vector, one bin per semitone (C, C#, D, D#, E, F, F#, G, G#, A, A#, B).
A bin is 1 if that scale degree is present in the chord, 0 otherwise.

This is the "template matching" approach from Fujishima (1999) and
Lee (2006, "Enhanced PCP") -- the incoming audio's chroma vector is
correlated against every template below, and the highest-scoring
template is the detected chord.
"""

import numpy as np

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Interval patterns (semitones from root) for each chord quality we support.
# Kept deliberately small -- DigiTech's own manual recommends simple
# triads/7ths, one per bar, for a reason: a small, well-separated template
# set is what makes real-time matching reliable.
CHORD_QUALITIES = {
    "maj": [0, 4, 7],
    "min": [0, 3, 7],
    "7": [0, 4, 7, 10],      # dominant 7th
    "min7": [0, 3, 7, 10],
    "maj7": [0, 4, 7, 11],
}


def build_templates():
    """Return dict: chord_name (e.g. 'G:maj') -> normalized 12-dim np.array."""
    templates = {}
    for root_idx, root_name in enumerate(PITCH_CLASSES):
        for quality, intervals in CHORD_QUALITIES.items():
            vec = np.zeros(12)
            for interval in intervals:
                vec[(root_idx + interval) % 12] = 1.0
            vec = vec / np.linalg.norm(vec)
            templates[f"{root_name}:{quality}"] = vec
    return templates


CHORD_TEMPLATES = build_templates()
