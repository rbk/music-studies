#!/usr/bin/env bash
# Lists audio input devices as seen from inside the container.
# Run this FIRST to find the --device index for your audio interface.
set -e
docker compose run --rm chord-detector --list-devices
