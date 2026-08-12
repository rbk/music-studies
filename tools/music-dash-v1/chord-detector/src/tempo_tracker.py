"""
Stage 4 of the pipeline: tempo/beat tracking over an accumulated
Learn-pass buffer, using librosa's onset-strength + beat tracker
(a standard dynamic-programming beat tracker, Ellis 2007).
"""

import numpy as np
import librosa


def estimate_tempo(audio_buffer: np.ndarray, sample_rate: int) -> tuple[float, int]:
    """
    Returns (tempo_bpm, num_beats_detected) for a full recorded pass.
    """
    if len(audio_buffer) < sample_rate:  # need at least ~1s of audio
        return 0.0, 0

    onset_env = librosa.onset.onset_strength(y=audio_buffer, sr=sample_rate)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sample_rate)
    tempo_val = float(tempo) if np.isscalar(tempo) else float(tempo[0])
    return tempo_val, len(beats)
