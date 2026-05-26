#!/usr/bin/env python3
"""
Kokoro-82M TTS server for HörbuchKI (same API as edge-tts server).

  pip install -r scripts/requirements-kokoro.txt
  python scripts/kokoro-tts-server.py

Uses GPU if CUDA is available (GTX 1080 Ti etc.). First request loads the model (~30s).
"""
from __future__ import annotations

import argparse
import io
import logging
import sys
from pathlib import Path
from typing import Any

_scripts_dir = Path(__file__).resolve().parent
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))
from load_env import apply_repo_env, hf_token_configured

import numpy as np
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("kokoro-tts")

app = FastAPI(title="HörbuchKI Kokoro TTS")

KOKORO_VOICES = [
    "af_heart",
    "af_bella",
    "af_nicole",
    "af_sarah",
    "af_sky",
    "am_adam",
    "am_michael",
    "bf_emma",
    "bf_isabella",
    "bm_george",
    "bm_lewis",
]

# edge-tts voice id -> kokoro fallback for mixed settings
EDGE_TO_KOKORO = {
    "en-us-andrewneural": "am_adam",
    "en-us-guyneural": "am_michael",
    "en-us-jennyneural": "af_bella",
    "en-us-arianeural": "af_sky",
}

_pipeline: Any = None
_device: str = "cpu"


class SpeakBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=12000)
    voice: str = "af_bella"
    speed: float = Field(1.0, ge=0.5, le=2.0)


def normalize_voice(voice: str) -> str:
    v = voice.strip()
    if v in KOKORO_VOICES:
        return v
    key = v.lower().replace("_", "-")
    if key in EDGE_TO_KOKORO:
        return EDGE_TO_KOKORO[key]
    if v.startswith("af_") or v.startswith("am_") or v.startswith("bf_") or v.startswith("bm_"):
        return v
    log.warning("Unknown voice %r, using af_bella", voice)
    return "af_bella"


def get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from kokoro import KPipeline
    except ImportError as e:
        raise RuntimeError(
            "kokoro not installed. Run: pip install -r scripts/requirements-kokoro.txt"
        ) from e

    log.info("Loading Kokoro pipeline (lang=a, device=%s)…", _device)
    try:
        _pipeline = KPipeline(lang_code="a", device=_device)
    except TypeError:
        _pipeline = KPipeline(lang_code="a")
    log.info("Kokoro ready.")
    return _pipeline


def audio_to_numpy(audio: Any) -> np.ndarray:
    if hasattr(audio, "numpy"):
        return np.asarray(audio.numpy(), dtype=np.float32)
    return np.asarray(audio, dtype=np.float32)


def synthesize(text: str, voice: str, speed: float) -> bytes:
    pipeline = get_pipeline()
    voice = normalize_voice(voice)
    parts: list[np.ndarray] = []

    for result in pipeline(text, voice=voice, speed=speed):
        if result.audio is None:
            continue
        parts.append(audio_to_numpy(result.audio))

    if not parts:
        raise ValueError("Kokoro produced no audio chunks")

    merged = np.concatenate(parts)
    buf = io.BytesIO()
    sf.write(buf, merged, 24000, format="WAV", subtype="PCM_16")
    return buf.getvalue()


@app.get("/health")
async def health():
    cuda = torch.cuda.is_available()
    name = torch.cuda.get_device_name(0) if cuda else None
    return {
        "ok": True,
        "engine": "kokoro-82m",
        "cuda": cuda,
        "device": _device,
        "gpu": name,
        "pipeline_loaded": _pipeline is not None,
        "hf_token": hf_token_configured(),
    }


@app.get("/voices")
async def voices():
    return {"voices": KOKORO_VOICES, "default": "af_bella"}


@app.post("/speak")
async def speak(body: SpeakBody):
    try:
        data = synthesize(body.text, body.voice, body.speed)
    except Exception as e:
        log.exception("synthesis failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return Response(content=data, media_type="audio/wav")


def check_espeak() -> None:
    import shutil

    if shutil.which("espeak-ng") or shutil.which("espeak"):
        return
    log.warning(
        "espeak-ng not found on PATH. Kokoro needs it.\n"
        "  Windows: choco install espeak-ng   OR   see scripts/install-kokoro.ps1"
    )


def main():
    global _device
    parser = argparse.ArgumentParser(description="HörbuchKI Kokoro TTS server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5124)
    parser.add_argument(
        "--device",
        choices=("auto", "cuda", "cpu"),
        default="auto",
        help="Inference device (auto = cuda if available)",
    )
    parser.add_argument(
        "--preload",
        action="store_true",
        help="Load model at startup instead of first /speak",
    )
    args = parser.parse_args()

    if args.device == "auto":
        _device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        _device = args.device

    check_espeak()
    if apply_repo_env():
        log.info("Hugging Face token loaded (HF_TOKEN).")
    else:
        log.warning(
            "No HF_TOKEN — downloads may rate-limit or fail. "
            "Add HF_TOKEN=hf_... to .env.local (repo root) or run: hf auth login"
        )
    log.info("Kokoro server on http://%s:%s (device=%s)", args.host, args.port, _device)

    if args.preload:
        get_pipeline()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
