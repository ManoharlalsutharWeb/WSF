# Swiss Ephemeris Data Files

## Purpose
This directory must contain Swiss Ephemeris `.se1` data files for high-accuracy planet position computation.

## Required Files (Minimum for D1–D60 near present dates)

Download from: https://www.astro.com/ftp/swisseph/ephe/

For current dates (~2024–2026), you need:
- `seas_18.se1`   — asteroids (optional)
- `semo_18.se1`   — Moon (required)
- `sepl_18.se1`   — Planets (required)

The `_18` suffix refers to the file covering years 1800–2400 CE.

## Download Commands

```bash
cd ephe/
wget https://www.astro.com/ftp/swisseph/ephe/semo_18.se1
wget https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1
```

Total size: approximately 30–60 MB for planet + moon files.

## File Registration

After placing files here, the app automatically sets the ephemeris path to `/ephe/` via:
```javascript
engine.setEphemerisPath('./ephe/');
```

## Without Data Files

Swiss Ephemeris falls back to internal Moshier analytic ephemeris which has lower accuracy (~1 arcsecond error for major planets, higher for Moon). This is still usable for Panchang purposes but is not the highest precision.

The app will warn you if full ephemeris data files are missing.
