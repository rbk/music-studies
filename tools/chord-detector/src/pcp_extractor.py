"""
Stage 1-2 of the pipeline: turn a raw audio buffer into a 12-dim
Pitch Class Profile (chroma) vector.

We use librosa's Constant-Q based chroma (chroma_cqt), which gives
logarithmically-spaced frequency resolution -- matching how musical
pitch is perceived -- rather than the linear bins of a plain FFT.
"""

import numpy as np
import librosa


def extract_pcp(audio_buffer: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    audio_buffer: 1D float32 numpy array of mono audio samples
    sample_rate: sample rate of audio_buffer

    Returns a normalized 12-dim chroma/PCP vector averaged over the buffer.
    """
    if len(audio_buffer) < 2048:
        # Not enough samples for a stable CQT estimate; pad.
        audio_buffer = np.pad(audio_buffer, (0, 2048 - len(audio_buffer)))

    chroma = librosa.feature.chroma_cqt(
        y=audio_buffer.astype(np.float32),
        sr=sample_rate,
        hop_length=512,
    )
    # Average across time frames in this buffer -> single 12-dim vector
    pcp = chroma.mean(axis=1)
    norm = np.linalg.norm(pcp)
    if norm > 0:
        pcp = pcp / norm
    return pcp


def frame_energy(audio_buffer: np.ndarray) -> float:
    """Simple RMS energy, used to gate detection during silence."""
    return float(np.sqrt(np.mean(audio_buffer.astype(np.float64) ** 2)))
