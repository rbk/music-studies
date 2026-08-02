"""
Stage 3 of the pipeline: template matching + smoothing.

Raw frame-by-frame template matching flickers a lot (strum transients,
noise, pick attack). We smooth by voting over a short rolling window,
similar in spirit to (but much simpler than) the HMM/Viterbi smoothing
in Bello & Pickens 2005.
"""

from collections import deque, Counter
import numpy as np

from chord_templates import CHORD_TEMPLATES


class ChordRecognizer:
    def __init__(self, smoothing_window: int = 5, silence_threshold: float = 0.01):
        self.smoothing_window = smoothing_window
        self.silence_threshold = silence_threshold
        self.recent_detections = deque(maxlen=smoothing_window)

    def match_template(self, pcp: np.ndarray) -> tuple[str, float]:
        """Cosine similarity against every chord template. Returns (name, score)."""
        best_name, best_score = "N", -1.0  # "N" = no chord
        for name, template in CHORD_TEMPLATES.items():
            score = float(np.dot(pcp, template))  # both already unit-normalized
            if score > best_score:
                best_name, best_score = name, score
        return best_name, best_score

    def process_frame(self, pcp: np.ndarray, energy: float) -> str:
        """
        Feed one frame's PCP vector + energy in, get back the smoothed,
        voted chord label for this point in time.
        """
        if energy < self.silence_threshold:
            self.recent_detections.append("N")
            return "N"

        name, _score = self.match_template(pcp)
        self.recent_detections.append(name)

        # Majority vote over the smoothing window
        vote = Counter(self.recent_detections).most_common(1)[0][0]
        return vote
