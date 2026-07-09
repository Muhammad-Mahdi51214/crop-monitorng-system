"""Point PROJ at Python package data (avoids PostGIS PROJ conflict on Windows)."""
from __future__ import annotations

import os

_configured = False


def configure_geospatial_env() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    try:
        import pyproj

        proj_data = pyproj.datadir.get_data_dir()
        os.environ["PROJ_LIB"] = proj_data
        os.environ["PROJ_DATA"] = proj_data
    except Exception:
        pass
