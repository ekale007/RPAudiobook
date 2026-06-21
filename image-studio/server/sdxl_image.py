"""SDXL-Turbo text-to-image helpers."""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_MODEL = "stabilityai/sdxl-turbo"
DEFAULT_STEPS = 4
DEFAULT_QUALITY = 88

_pipe: Any | None = None
_pipe_config: tuple[str, str] | None = None


def load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
        load_dotenv(ROOT / ".env.local")
    except ImportError:
        pass


def pick_device(requested: str = "auto"):
    import torch

    if requested == "cpu":
        return torch.device("cpu"), torch.float32
    if requested == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA not available — use SDXL_DEVICE=cpu")
        return torch.device("cuda"), torch.float16
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        print(f"GPU: {name}", flush=True)
        return torch.device("cuda"), torch.float16
    print("No GPU — running on CPU (very slow)", flush=True)
    return torch.device("cpu"), torch.float32


def get_pipeline(*, model: str = DEFAULT_MODEL, device: str = "auto"):
    global _pipe, _pipe_config

    load_env()
    dev, dtype = pick_device(device)
    key = (model, dev.type)
    if _pipe is not None and _pipe_config == key:
        return _pipe

    import torch
    from diffusers import AutoPipelineForText2Image

    print(f"Loading {model} … (first run downloads ~6–7 GB)", flush=True)
    pipe = AutoPipelineForText2Image.from_pretrained(
        model,
        torch_dtype=dtype,
        variant="fp16" if dtype == torch.float16 else None,
    )
    pipe = pipe.to(dev)
    if dev.type == "cuda":
        pipe.enable_attention_slicing()

    _pipe = pipe
    _pipe_config = key
    return pipe


def generate_pil(
    prompt: str,
    *,
    width: int,
    height: int,
    steps: int = DEFAULT_STEPS,
    seed: int | None = None,
    model: str = DEFAULT_MODEL,
    device: str = "auto",
):
    import torch

    pipe = get_pipeline(model=model, device=device)
    generator = None
    if seed is not None:
        generator = torch.Generator(device=pipe.device.type).manual_seed(seed)

    kwargs: dict[str, Any] = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
        "guidance_scale": 0.0,
    }
    if generator is not None:
        kwargs["generator"] = generator

    result = pipe(**kwargs)
    return result.images[0]


def generate_webp_bytes(
    prompt: str,
    *,
    width: int,
    height: int,
    steps: int = DEFAULT_STEPS,
    seed: int | None = None,
    quality: int = DEFAULT_QUALITY,
    model: str = DEFAULT_MODEL,
    device: str = "auto",
) -> bytes:
    image = generate_pil(
        prompt,
        width=width,
        height=height,
        steps=steps,
        seed=seed,
        model=model,
        device=device,
    )
    buf = io.BytesIO()
    image.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()


def default_device_from_env() -> str:
    return os.environ.get("SDXL_DEVICE", "auto")
