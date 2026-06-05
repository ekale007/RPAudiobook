#!/usr/bin/env bash
set -euo pipefail

# RunPod Serverless load balancer defaults PORT=80; GPU pods often use 8000.
HOST="${QWEN_HOST:-0.0.0.0}"
PORT="${PORT:-${QWEN_PORT:-80}}"
export PORT
export QWEN_HOST="${HOST}"
export QWEN_PORT="${PORT}"
MODEL="${QWEN_MODEL:-Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice}"
DEVICE="${QWEN_DEVICE:-cuda}"
# Background preload after HTTP starts (/ping → 204 until model ready).
export QWEN_PRELOAD="${QWEN_PRELOAD:-1}"

echo "Starting Qwen3-TTS on ${HOST}:${PORT} model=${MODEL} device=${DEVICE} preload=${QWEN_PRELOAD}"

exec python /app/scripts/qwen-tts-server.py \
  --host "${HOST}" \
  --port "${PORT}" \
  --model "${MODEL}" \
  --device "${DEVICE}"
