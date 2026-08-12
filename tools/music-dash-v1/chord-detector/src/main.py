"""
Chord Detector -- a prototype of the DigiTech Trio+'s "Band Creator"
analysis pipeline (chord recognition + key + tempo detection).

This does NOT include pattern playback/synthesis -- it's the analysis
half only (Stages 1-5 from the pipeline). Stage 6 (mapping detected
chords onto genre pattern templates) is a separate, much simpler
sequencing project once you have clean chord+timestamp data.

Usage:
    python main.py --list-devices
    python main.py --mode listen --device 1
    python main.py --mode learn --device 1 --seconds 8
"""

import argparse
import sys
import time

import numpy as np

from audio_capture import AudioCapture
from pcp_extractor import extract_pcp, frame_energy
from chord_recognizer import ChordRecognizer
from tempo_tracker import estimate_tempo
from key_detector import detect_key


def run_listen_mode(capture: AudioCapture, recognizer: ChordRecognizer):
    """Continuously print the currently detected chord, like a tuner."""
    print("Listening... play some chords. Ctrl+C to stop.\n")
    last_printed = None
    try:
        while True:
            block = capture.get_block()
            if block is None:
                continue
            pcp = extract_pcp(block, capture.sample_rate)
            energy = frame_energy(block)
            chord = recognizer.process_frame(pcp, energy)
            if chord != last_printed:
                label = "( silence )" if chord == "N" else chord
                print(f"  -> {label}")
                last_printed = chord
    except KeyboardInterrupt:
        print("\nStopped.")


def run_learn_mode(capture: AudioCapture, recognizer: ChordRecognizer, seconds: float):
    """
    Emulates the pedal's 'Learn' pass: record for a fixed window,
    detect the chord sequence, then report key + tempo, same as the
    Trio+ does the instant you tap out of Learn mode.
    """
    print(f"Learn mode: recording {seconds:.1f}s. Play your progression now...")
    all_audio = []
    chord_sequence = []
    start = time.time()

    while time.time() - start < seconds:
        block = capture.get_block()
        if block is None:
            continue
        all_audio.append(block)
        pcp = extract_pcp(block, capture.sample_rate)
        energy = frame_energy(block)
        chord = recognizer.process_frame(pcp, energy)
        if chord != "N":
            chord_sequence.append(chord)

    full_audio = np.concatenate(all_audio) if all_audio else np.array([])
    tempo, n_beats = estimate_tempo(full_audio, capture.sample_rate)

    # Collapse consecutive duplicate detections into a clean progression
    collapsed = []
    for c in chord_sequence:
        if not collapsed or collapsed[-1] != c:
            collapsed.append(c)

    key = detect_key(collapsed)

    print("\n--- Learn pass results ---")
    print(f"Detected chord sequence: {collapsed if collapsed else '(none detected)'}")
    print(f"Estimated key:           {key}")
    print(f"Estimated tempo:         {tempo:.1f} BPM  ({n_beats} beats detected)")
    print("--------------------------\n")


def main():
    parser = argparse.ArgumentParser(description="Real-time chord/key/tempo detector")
    parser.add_argument("--list-devices", action="store_true",
                         help="List available audio input devices and exit")
    parser.add_argument("--mode", choices=["listen", "learn"], default="listen")
    parser.add_argument("--device", type=int, default=None,
                         help="Input device index (see --list-devices)")
    parser.add_argument("--sample-rate", type=int, default=22050)
    parser.add_argument("--block-size", type=int, default=4096)
    parser.add_argument("--seconds", type=float, default=8.0,
                         help="Recording length for --mode learn")
    parser.add_argument("--smoothing-window", type=int, default=5)
    args = parser.parse_args()

    if args.list_devices:
        AudioCapture.list_devices()
        sys.exit(0)

    capture = AudioCapture(
        sample_rate=args.sample_rate,
        block_size=args.block_size,
        device=args.device,
    )
    recognizer = ChordRecognizer(smoothing_window=args.smoothing_window)

    capture.start()
    try:
        if args.mode == "listen":
            run_listen_mode(capture, recognizer)
        else:
            run_learn_mode(capture, recognizer, args.seconds)
    finally:
        capture.stop()


if __name__ == "__main__":
    main()
