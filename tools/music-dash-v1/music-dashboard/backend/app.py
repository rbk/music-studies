"""
Flask backend for the music dashboard prototype.

Endpoints
---------
GET  /api/health                     -> {"status": "ok"}
GET  /api/chords                     -> list of all known chords + fingerings
POST /api/analyze                     -> multipart audio file -> full analysis
                                        (chord, key, tempo, timbre, style, history)
GET  /api/sessions                    -> list drum-practice sessions
POST /api/sessions                    -> create a drum session record
DELETE /api/sessions/<id>             -> delete a session

The frontend serves itself from ../frontend (static files), so the
whole prototype runs from one origin -- no CORS, no build step.

Audio intake
------------
The browser records the mic with MediaRecorder and POSTs the resulting
blob (webm/opus). We decode it to PCM with ffmpeg (libsndfile can't read
webm/opus directly), then hand the numpy buffer to analysis.analyze_audio.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import time
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

import analysis
import db

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)

app = Flask(__name__, static_folder=None)


# ----------------------------------------------------------------------
# Static frontend (single-origin so the PWA can use mic + fetch freely)
# ----------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    # Disallow path traversal.
    safe = os.path.normpath(path)
    if safe.startswith("..") or os.path.isabs(safe):
        return ("Not found", 404)
    full = os.path.join(FRONTEND_DIR, safe)
    if not os.path.isfile(full):
        return ("Not found", 404)
    return send_from_directory(FRONTEND_DIR, safe)


# ----------------------------------------------------------------------
# API
# ----------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "time": time.time()})


@app.route("/api/chords")
def chords():
    return jsonify(analysis.CHORD_INFO)


def _decode_to_wav(src_path: str) -> tuple[Any, int]:
    """Decode any ffmpeg-readable audio file to 22050 Hz mono float32 numpy."""
    import soundfile as sf
    import numpy as np
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-ar", "22050", "-ac", "1",
             "-f", "wav", wav_path],
            check=True, capture_output=True,
        )
        y, sr = sf.read(wav_path, dtype="float32")
        if y.ndim > 1:
            y = y[:, 0]
        return y, int(sr)
    finally:
        try:
            os.unlink(wav_path)
        except OSError:
            pass


@app.route("/api/analyze", methods=["POST"])
def analyze_endpoint():
    if "audio" not in request.files:
        return jsonify({"error": "no audio file uploaded"}), 400
    f = request.files["audio"]
    suffix = os.path.splitext(f.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        f.save(tmp.name)
        src_path = tmp.name
    try:
        try:
            y, sr = _decode_to_wav(src_path)
        except subprocess.CalledProcessError as e:
            return jsonify({"error": "ffmpeg decode failed",
                             "detail": e.stderr.decode("utf-8", "ignore")[:500]}), 400
        res = analysis.analyze_audio(y, sr)
        return jsonify(analysis.result_to_dict(res))
    finally:
        try:
            os.unlink(src_path)
        except OSError:
            pass


@app.route("/api/sessions", methods=["GET"])
def sessions_list():
    return jsonify(db.list_sessions())


@app.route("/api/sessions", methods=["POST"])
def sessions_create():
    data = request.get_json(force=True, silent=True) or {}
    required = ("tempo", "duration_s", "accuracy", "total_beats",
                "hits", "early", "late", "missed")
    if not all(k in data for k in required):
        return jsonify({"error": "missing fields",
                        "required": list(required)}), 400
    rec = db.create_session(data)
    return jsonify(rec), 201


@app.route("/api/sessions/<int:sid>", methods=["DELETE"])
def sessions_delete(sid):
    if db.delete_session(sid):
        return jsonify({"deleted": sid})
    return jsonify({"error": "not found"}), 404


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------

def main():
    db.init_db()
    port = int(os.environ.get("PORT", "5050"))
    app.run(host="127.0.0.1", port=port, debug=False)


if __name__ == "__main__":
    main()