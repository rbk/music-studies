FROM python:3.11-slim

# System deps:
#  - portaudio19-dev: needed to build/run sounddevice (PortAudio bindings)
#  - libsndfile1: needed by soundfile/librosa for audio I/O
#  - alsa-utils, pulseaudio-utils: for debugging audio device passthrough
#  - build-essential: for compiling any native extensions in the deps above
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    portaudio19-dev \
    libsndfile1 \
    alsa-utils \
    pulseaudio-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

WORKDIR /app/src

ENTRYPOINT ["python", "main.py"]
CMD ["--mode", "listen"]
