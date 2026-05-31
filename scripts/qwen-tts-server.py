#!/usr/bin/env python3
"""
Qwen3-TTS server for HörbuchKI (same API as Kokoro / edge-tts).

  pip install -r scripts/requirements-qwen.txt
  python scripts/qwen-tts-server.py

Uses CustomVoice model (preset speakers). Optional `instruct` for style hints.
First request downloads weights (~several GB) and loads the model.
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
log = logging.getLogger("qwen-tts")

app = FastAPI(title="HörbuchKI Qwen3-TTS")

DEFAULT_MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"

QWEN_SPEAKERS = [
    "Ryan",
    "Vivian",
    "Serena",
    "Aiden",
    "Dylan",
    "Eric",
    "Uncle_Fu",
    "Ono_Anna",
    "Sohee",
]

SPEAKER_ALIASES = {
    "default": "Ryan",
    "alloy": "Ryan",
    "echo": "Aiden",
    "fable": "Dylan",
    "onyx": "Eric",
    "nova": "Serena",
    "shimmer": "Vivian",
    "narrator": "Ryan",
    "af_bella": "Serena",
    "af_heart": "Vivian",
    "am_adam": "Ryan",
    "am_michael": "Aiden",
}

_model: Any = None
_device: str = "cpu"
_model_id: str = DEFAULT_MODEL


class SpeakBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    voice: str = "Ryan"
    language: str = "Auto"
    instruct: str | None = None
    speed: float = Field(1.0, ge=0.5, le=2.0)


def normalize_speaker(voice: str) -> str:
    v = voice.strip()
    if not v:
        return "Ryan"
    key = v.replace("-", "_").replace(" ", "_")
    for candidate in (v, key, key.title(), key.lower()):
        if candidate in QWEN_SPEAKERS:
            return candidate
        low = candidate.lower()
        if low in SPEAKER_ALIASES:
            mapped = SPEAKER_ALIASES[low]
            return mapped if mapped in QWEN_SPEAKERS else "Ryan"
        for sp in QWEN_SPEAKERS:
            if sp.lower() == low:
                return sp
    log.warning("Unknown voice %r, using Ryan", voice)
    return "Ryan"


def get_model():
    global _model
    if _model is not None:
        return _model
    try:
        from qwen_tts import Qwen3TTSModel
    except ImportError as e:
        raise RuntimeError(
            "qwen-tts not installed. Run: npm run tts:qwen:install"
        ) from e

    log.info("Loading Qwen3-TTS %s on %s …", _model_id, _device)
    dtype = torch.bfloat16 if _device.startswith("cuda") else torch.float32
    kwargs: dict[str, Any] = {
        "device_map": _device if _device.startswith("cuda") else "cpu",
        "dtype": dtype,
    }
    try:
        _model = Qwen3TTSModel.from_pretrained(_model_id, **kwargs)
    except TypeError:
        _model = Qwen3TTSModel.from_pretrained(_model_id, device_map=_device)

    log.info("Qwen3-TTS ready.")
    return _model


def synthesize(
    text: str,
    voice: str,
    language: str,
    instruct: str | None,
) -> bytes:
    model = get_model()
    speaker = normalize_speaker(voice)
    lang = language.strip() or "Auto"
    inst = instruct.strip() if instruct else None

    gen_kwargs: dict[str, Any] = {}
    if inst:
        gen_kwargs["instruct"] = inst

    wavs, sr = model.generate_custom_voice(
        text=text,
        speaker=speaker,
        language=lang,
        **gen_kwargs,
    )
    if not wavs:
        raise ValueError("Qwen3-TTS produced no audio")

    audio = np.asarray(wavs[0], dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


@app.get("/health")
async def health():
    cuda = torch.cuda.is_available()
    name = torch.cuda.get_device_name(0) if cuda else None
    return {
        "ok": True,
        "engine": "qwen3-tts-custom-voice",
        "model": _model_id,
        "cuda": cuda,
        "device": _device,
        "gpu": name,
        "model_loaded": _model is not None,
        "hf_token": hf_token_configured(),
        "speakers": QWEN_SPEAKERS,
    }


@app.get("/voices")
async def voices():
    return {"voices": QWEN_SPEAKERS, "default": "Ryan", "aliases": SPEAKER_ALIASES}


@app.post("/speak")
async def speak(body: SpeakBody):
    try:
        data = synthesize(body.text, body.voice, body.language, body.instruct)
    except Exception as e:
        log.exception("synthesis failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return Response(content=data, media_type="audio/wav")


def main():
    global _device, _model_id
    parser = argparse.ArgumentParser(description="HörbuchKI Qwen3-TTS server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5125)
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help="Hugging Face model id (CustomVoice recommended)",
    )
    parser.add_argument(
        "--device",
        choices=("auto", "cuda", "cpu"),
        default="auto",
    )
    parser.add_argument("--preload", action="store_true")
    args = parser.parse_args()

    _model_id = args.model
    if args.device == "auto":
        _device = "cuda:0" if torch.cuda.is_available() else "cpu"
    else:
        _device = "cuda:0" if args.device == "cuda" else "cpu"

    if apply_repo_env():
        log.info("Hugging Face token loaded (HF_TOKEN).")
    else:
        log.warning(
            "No HF_TOKEN — model download may rate-limit. Add HF_TOKEN to .env.local"
        )

    log.info("Qwen TTS on http://%s:%s (device=%s)", args.host, args.port, _device)
    if args.preload:
        get_model()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
