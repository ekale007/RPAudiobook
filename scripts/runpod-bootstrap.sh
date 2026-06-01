#!/usr/bin/env bash
# Run inside a RunPod GPU pod (PyTorch template). Expose TCP port 8000 in pod settings.
set -euo pipefail

: "${HF_TOKEN:?Set HF_TOKEN in RunPod pod env (Hugging Face read token)}"
: "${QWEN_API_KEY:?Set QWEN_API_KEY in RunPod pod env (shared secret with Vercel)}"

WORKDIR="${WORKDIR:-/workspace}"
REPO="${REPO:-RPAudiobook}"
BRANCH="${BRANCH:-master}"
PORT="${QWEN_PORT:-8000}"

cd "$WORKDIR"
if [[ ! -d "$REPO/.git" ]]; then
  git clone --depth 1 -b "$BRANCH" "https://github.com/ekale007/${REPO}.git" "$REPO"
fi
cd "$REPO"
git pull --ff-only origin "$BRANCH" || true

apt-get update -qq && apt-get install -y -qq libsndfile1 git || true
pip install -q -r scripts/requirements-qwen.txt

export QWEN_HOST=0.0.0.0
export QWEN_PORT="$PORT"
export QWEN_DEVICE="${QWEN_DEVICE:-cuda}"

echo "Starting Qwen3-TTS on 0.0.0.0:${PORT} …"
exec python scripts/qwen-tts-server.py \
  --host 0.0.0.0 \
  --port "$PORT" \
  --device cuda \
  --preload
