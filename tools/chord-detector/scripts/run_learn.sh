#!/usr/bin/env bash
# Emulates the pedal's "Learn" pass: records for N seconds, then prints
# the detected chord sequence, estimated key, and estimated tempo.
# Usage: ./scripts/run_learn.sh [device_index] [seconds]
set -e
DEVICE_ARG=""
if [ -n "$1" ]; then
  DEVICE_ARG="--device $1"
fi
SECONDS_ARG="--seconds ${2:-8}"
docker compose run --rm chord-detector --mode learn $DEVICE_ARG $SECONDS_ARG
