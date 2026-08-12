#!/usr/bin/env bash
# Continuously prints the currently detected chord, like a tuner.
# Usage: ./scripts/run_listen.sh [device_index]
set -e
DEVICE_ARG=""
if [ -n "$1" ]; then
  DEVICE_ARG="--device $1"
fi
docker compose run --rm chord-detector --mode listen $DEVICE_ARG
