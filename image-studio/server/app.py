#!/usr/bin/env python3
"""Image Studio — SDXL-Turbo GPU server + API (+ optional static UI)."""
from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from sdxl_image import (
    DEFAULT_MODEL,
    DEFAULT_STEPS,
    default_device_from_env,
    generate_webp_bytes,
    load_env,
)

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "web" / "dist"

app = FastAPI(title="Image Studio")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateBody(BaseModel):
    prompt: str = Field(..., min_length=8, max_length=4000)
    width: int = Field(default=768, ge=256, le=1536)
    height: int = Field(default=1152, ge=256, le=1536)
    steps: int = Field(default=DEFAULT_STEPS, ge=1, le=12)
    seed: int | None = None
    quality: int = Field(default=88, ge=50, le=100)
    model: str = DEFAULT_MODEL


class OptimizeBody(BaseModel):
    brief: str = Field(..., min_length=4, max_length=2000)
    format_label: str = "Buchcover 2:3"
    format_hint: str = "vertical audiobook cover"
    width: int = 768
    height: int = 1152
    current_prompt: str | None = None
    locale: str = "de"
    api_key: str | None = None
    model: str | None = None


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health():
    return {"ok": True, "engine": "sdxl-turbo", "model": DEFAULT_MODEL}


@app.post("/api/generate")
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


@app.post("/api/optimize-prompt")
async def optimize_prompt(body: OptimizeBody):
    load_env()
    api_key = (body.api_key or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key fehlt (UI oder OPENROUTER_API_KEY in .env).",
        )
    model = (
        body.model
        or os.environ.get("OPENROUTER_MODEL")
        or "google/gemini-2.5-flash-lite"
    ).strip()

    brief = body.brief.strip() or (body.current_prompt or "").strip()
    if not brief:
        raise HTTPException(status_code=400, detail="Kurzbeschreibung fehlt.")

    system = f"""You write prompts for SDXL-Turbo image generation (local GPU).
Output ONE English prompt only — no markdown, no quotes, no explanation.
Rules:
- Painterly cinematic digital art, rich lighting
- NEVER include text, titles, logos, watermarks, UI, speech bubbles
- Concrete subjects, setting, mood, palette (2–4 color words)
- 40–90 words, comma-separated phrases
- Format goal: {body.format_label} ({body.width}×{body.height}) — {body.format_hint}
- Do not repeat the style boilerplate about "no text" more than once"""

    draft = (
        f"\nExisting draft (may improve or replace):\n{body.current_prompt.strip()}\n"
        if body.current_prompt and body.current_prompt.strip()
        else ""
    )
    if body.locale == "de":
        user = f"""The user writes in German. Turn this into an optimized SDXL prompt in English.

Brief:
{brief}
{draft}
Return only the final English image prompt."""
    else:
        user = f"""Turn this into an optimized SDXL prompt in English.

Brief:
{brief}
{draft}
Return only the final English image prompt."""

    import httpx

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "Image Studio",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "max_tokens": 400,
                    "temperature": 0.55,
                },
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    if res.status_code >= 400:
        raise HTTPException(status_code=res.status_code, detail=res.text[:500])

    data = res.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    for prefix in ("```", "prompt:", "image prompt:"):
        if content.lower().startswith(prefix):
            content = content.split("\n", 1)[-1].strip()
    content = content.strip("`\"'")
    if len(content) < 24:
        raise HTTPException(status_code=502, detail="KI-Antwort zu kurz.")
    return {"prompt": content}


def mount_ui() -> None:
    if not DIST.is_dir():
        return

    @app.get("/")
    async def index():
        index_file = DIST / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="UI not built — run npm run build")

    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


mount_ui()


def main():
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("IMAGE_STUDIO_PORT", "5125")))
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
