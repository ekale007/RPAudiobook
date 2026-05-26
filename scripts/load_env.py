"""Load HF_TOKEN (and related) from repo .env.local for Kokoro TTS scripts."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_KEYS = ("HF_TOKEN", "HUGGINGFACE_HUB_TOKEN", "HUGGING_FACE_HUB_TOKEN")


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            out[key] = value
    return out


def apply_repo_env() -> str | None:
    """Apply HF token from environment or .env.local. Returns token if set."""
    for key in ENV_KEYS:
        token = os.environ.get(key, "").strip()
        if token:
            os.environ["HF_TOKEN"] = token
            os.environ["HUGGINGFACE_HUB_TOKEN"] = token
            return token

    for name in (".env.local", ".env"):
        path = ROOT / name
        for key, value in _parse_env_file(path).items():
            if key in ENV_KEYS and value.strip():
                token = value.strip()
                os.environ["HF_TOKEN"] = token
                os.environ["HUGGINGFACE_HUB_TOKEN"] = token
                return token

    return None


def hf_token_configured() -> bool:
    return bool(os.environ.get("HF_TOKEN", "").strip())
