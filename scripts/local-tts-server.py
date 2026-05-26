#!/usr/bin/env python3
"""
Free local TTS for HörbuchKI testing (uses Microsoft Edge voices via edge-tts).
Requires internet. No API key. Fully offline: use Piper (see docs/LOCAL-TTS.md).

  pip install -r scripts/requirements-tts.txt
  python scripts/local-tts-server.py
"""
from __future__ import annotations

import argparse
import io

import edge_tts
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="HörbuchKI Local TTS")


class SpeakBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    voice: str = "en-US-AndrewNeural"


@app.get("/health")
async def health():
    return {"ok": True, "engine": "edge-tts"}


@app.post("/speak")
async def speak(body: SpeakBody):
    try:
        communicate = edge_tts.Communicate(body.text, body.voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        data = buf.getvalue()
        if not data:
            raise HTTPException(status_code=500, detail="No audio generated")
        return Response(content=data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5123)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
