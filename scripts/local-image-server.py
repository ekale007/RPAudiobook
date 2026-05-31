#!/usr/bin/env python3
"""Local SDXL-Turbo image server for dev/testing (covers + character portraits).

  npm run images:server
  # or after covers:install:
  .venv-covers\\Scripts\\python.exe scripts/local-image-server.py

Endpoints:
  GET  /health
  POST /generate  -> image/webp
"""
from __future__ import annotations

import argparse
import asyncio

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from sdxl_image import DEFAULT_MODEL, DEFAULT_STEPS, default_device_from_env, generate_webp_bytes

app = FastAPI(title="HörbuchKI Local Image Gen")


class GenerateBody(BaseModel):
    prompt: str = Field(..., min_length=8, max_length=4000)
    width: int = Field(default=768, ge=256, le=1536)
    height: int = Field(default=1152, ge=256, le=1536)
    steps: int = Field(default=DEFAULT_STEPS, ge=1, le=12)
    seed: int | None = None
    quality: int = Field(default=88, ge=50, le=100)
    model: str = DEFAULT_MODEL


@app.get("/health")
async def health():
    return {"ok": True, "engine": "sdxl-turbo", "model": DEFAULT_MODEL}


@app.post("/generate")
async def generate(body: GenerateBody):
    device = default_device_from_env()
    try:
        data = await asyncio.to_thread(
            generate_webp_bytes,
            body.prompt.strip(),
            width=body.width,
            height=body.height,
            steps=body.steps,
            seed=body.seed,
            quality=body.quality,
            model=body.model,
            device=device,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    if not data:
        raise HTTPException(status_code=500, detail="No image generated")
    return Response(content=data, media_type="image/webp")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5125)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
