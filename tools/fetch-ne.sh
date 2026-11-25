#!/bin/sh
# Descarga los datos de Natural Earth 10m que usa tools/build-features.py (dominio público, sin clave).
cd "$(dirname "$0")/../data/raw/ne" || exit 1
for f in 10m_physical/ne_10m_rivers_lake_centerlines 10m_cultural/ne_10m_populated_places; do
  curl -fsSLO "https://naturalearth.s3.amazonaws.com/$f.zip"
done
ls -la
