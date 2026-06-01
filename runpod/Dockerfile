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
ENV QWEN_PORT=8000
ENV QWEN_DEVICE=cuda
ENV QWEN_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice

EXPOSE 8000

CMD ["bash", "/app/runpod/start.sh"]
