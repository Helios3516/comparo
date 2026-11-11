"""Lit les clés des connecteurs depuis l'environnement ou ePYcerie-main/.env."""

from __future__ import annotations

import os
from pathlib import Path

_LOADED = False


def _load_dotenv() -> None:
    global _LOADED
    if _LOADED:
        return
    _LOADED = True
    path = Path(__file__).resolve().parents[1] / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require(name: str) -> str:
    _load_dotenv()
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"{name} est absente. Copiez ePYcerie-main/.env.example vers .env et remplissez la valeur."
        )
    return value
