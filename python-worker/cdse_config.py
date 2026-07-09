"""Configure GDAL/rasterio for Copernicus Data Space public S3 access."""
from __future__ import annotations

import os

from geospatial_env import configure_geospatial_env


def configure_cdse_s3() -> None:
    configure_geospatial_env()
    os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
    os.environ.setdefault("AWS_S3_ENDPOINT", "https://eodata.dataspace.copernicus.eu")
    os.environ.setdefault("AWS_HTTPS", "YES")
    os.environ.setdefault("AWS_VIRTUAL_HOSTING", "FALSE")
