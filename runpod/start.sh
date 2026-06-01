#!/usr/bin/env bash
set -euo pipefail

HOST="${QWEN_HOST:-0.0.0.0}"
PORT="${QWEN_PORT:-8000}"
MODEL="${QWEN_MODEL:-Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice}"
DEVICE="${QWEN_DEVICE:-cuda}"

echo "Starting Qwen3-TTS on ${HOST}:${PORT} model=${MODEL} device=${DEVICE}"

exec python /app/scripts/qwen-tts-server.py \
  --host "${HOST}" \
  --port "${PORT}" \
  --model "${MODEL}" \
  --device "${DEVICE}" \
  --preload
