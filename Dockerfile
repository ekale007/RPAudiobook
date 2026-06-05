# HörbuchKI Qwen3-TTS for RunPod Serverless (Load Balancer).
# Build context: repository root (docker build -f Dockerfile .)
# Keep in sync with runpod/Dockerfile
# syntax=docker/dockerfile:1
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/requirements-qwen.txt /app/scripts/requirements-qwen.txt
COPY scripts/load_env.py /app/scripts/load_env.py
COPY scripts/qwen-tts-server.py /app/scripts/qwen-tts-server.py
COPY runpod/start.sh /app/runpod/start.sh

RUN pip install --no-cache-dir -r /app/scripts/requirements-qwen.txt

ENV QWEN_HOST=0.0.0.0
ENV PORT=80
ENV QWEN_PORT=80
ENV QWEN_DEVICE=cuda
ENV QWEN_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ENV QWEN_PRELOAD=1

EXPOSE 80

CMD ["bash", "/app/runpod/start.sh"]
