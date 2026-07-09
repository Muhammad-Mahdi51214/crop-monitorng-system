"""Copernicus Data Space Sentinel Hub Process API (optional fast path)."""
from __future__ import annotations

import time
from typing import Any

import requests


_token_cache: dict[str, Any] = {"token": None, "expires": 0}


def get_access_token(client_id: str, client_secret: str) -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["expires"] > now + 60:
        return _token_cache["token"]

    resp = requests.post(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires"] = now + int(data.get("expires_in", 3600))
    return _token_cache["token"]
