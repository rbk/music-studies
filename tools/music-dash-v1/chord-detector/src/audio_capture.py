"""
Real-time microphone/instrument input capture.

Uses sounddevice (PortAudio bindings) to pull audio blocks off the
input device into a thread-safe queue that main.py's processing loop
reads from. Keeping capture and processing decoupled avoids audio
callback overruns if a processing frame takes slightly too long.
"""

import queue
import numpy as np
import sounddevice as sd


class AudioCapture:
    def __init__(self, sample_rate: int = 22050, block_size: int = 4096,
                 channels: int = 1, device: int | None = None):
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.channels = channels
        self.device = device
        self.q: "queue.Queue[np.ndarray]" = queue.Queue()
        self._stream = None

    def _callback(self, indata, frames, time_info, status):
        if status:
            print(f"[audio_capture] stream status: {status}")
        # Downmix to mono if needed
        mono = indata[:, 0] if indata.ndim > 1 else indata
        self.q.put(mono.copy())

    def start(self):
        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            blocksize=self.block_size,
            channels=self.channels,
            device=self.device,
            dtype="float32",
            callback=self._callback,
        )
        self._stream.start()

    def stop(self):
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()

    def get_block(self, timeout: float = 1.0) -> np.ndarray | None:
        try:
            return self.q.get(timeout=timeout)
        except queue.Empty:
            return None

    @staticmethod
    def list_devices():
        print(sd.query_devices())
