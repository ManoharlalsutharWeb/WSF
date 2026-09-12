# Panchang Offline NYSE — D1–D60, 1-Minute CSV (Hindi + English)

> 100% offline · Android Chrome · No API · No backend · Swiss Ephemeris WASM

---

## What This App Does

Generates a single **CSV file** containing **60 days** of **1-minute resolution** Vedic Panchang and Vedic astrology data for the **NYSE / Wall Street** location (New York City).

**Each row contains:**
- Local and UTC timestamp
- Tithi, Nakshatra, Yoga, Karana, Paksha — with **Hindi + English** names
- Sidereal Lahiri graha longitudes: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu
- Sunrise & Sunset (local time)
- Rahu Kaal, Gulika Kaal, Yamaganda flags (1/0)

**Total output:** ~86,400 rows (60 days × 1440 minutes), CSV with UTF-8 BOM.

---

## Default Settings (v1 — Fixed)

| Setting | Value |
|---|---|
| Location | NYSE / Wall Street |
| Latitude | 40.7069 |
| Longitude | −74.0113 |
| Timezone | America/New_York (DST-aware) |
| Range | D1 → D60 (today to +59 days) |
| Step | 1 minute |
| Ayanamsa | Lahiri / Chitrapaksha |
| Rahu/Ketu | True Node |
| Language | Hindi + English |

---

## How to Run Offline

### Option A: GitHub Pages (recommended)

1. Fork this repo or upload all files to your GitHub account.
2. Go to **Settings → Pages → Source → main branch / root**.
3. Visit `https://yourusername.github.io/panchang-offline-nyse/`.
4. On Android Chrome: **Menu → Add to Home Screen** for offline shortcut.

### Option B: Local ZIP

1. Download the ZIP, extract it.
2. Open `index.html` in Android Chrome.
3. Note: `fetch()` calls for JSON files may fail with `file://` protocol.
   Use a local HTTP server: `python3 -m http.server 8080` then visit `localhost:8080`.

---

## Why No API Is Needed

All astronomy computation happens **inside the browser** using:

- **Swiss Ephemeris** compiled to **WebAssembly (WASM)** — same engine used by professional astrology software.
- **Bundled ephemeris data files** (`.se1` format) in `/ephe/` directory.
- **Pure JavaScript Panchang rules** — Tithi, Nakshatra, Yoga, Karana derived from planet longitudes.

No data leaves your device. No internet connection is used during calculation.

---

## Swiss Ephemeris WASM Setup

The astronomy engine requires two compiled files:

```
wasm/
  swe.js      ← Emscripten JS glue/loader
  swe.wasm    ← Compiled WebAssembly binary
```

### How to Compile

```bash
# Install Emscripten: https://emscripten.org/docs/getting_started/downloads.html
source /path/to/emsdk/emsdk_env.sh

# Download Swiss Ephemeris source
wget https://www.astro.com/ftp/swisseph/src/sweph-2.10.03.tar.gz
tar xzf sweph-2.10.03.tar.gz && cd sweph-2.10.03

# Compile to WASM
emcc sweph.c swedate.c swejpl.c swemmoon.c swemplan.c swepcalc.c swepdate.c swephlib.c \
  -O2 -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME="SwissEph" \
  -s EXPORTED_FUNCTIONS='["_swe_calc_ut","_swe_get_ayanamsa_ut","_swe_rise_trans","_swe_set_ephe_path","_swe_set_sid_mode","_swe_julday","_swe_close"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","getValue","UTF8ToString","_malloc","_free"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -o ../wasm/swe.js
```

### Alternative

Check `wasm/README.md` for pre-compiled options.

---

## Ephemeris Data Files

Place Swiss Ephemeris `.se1` data files in `/ephe/`:

```bash
cd ephe/
wget https://www.astro.com/ftp/swisseph/ephe/semo_18.se1   # Moon
wget https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1   # Planets
```

Total size: ~50 MB. Required for high-accuracy results.

Without these files, Swiss Ephemeris falls back to lower-accuracy internal Moshier tables.

---

## CSV Column Reference

### Time & Location
| Column | Description |
|---|---|
| `ts_local` | Local timestamp `YYYY-MM-DD HH:mm` (America/New_York) |
| `ts_utc` | UTC epoch seconds |
| `timezone` | `America/New_York` |
| `latitude` | 40.7069 |
| `longitude` | −74.0113 |
| `weekday_en` | Weekday in English |
| `weekday_hi` | Weekday in Hindi (Devanagari) |

### Panchang (Bilingual)
| Column | Description |
|---|---|
| `tithi_id` | Tithi number 1–30 |
| `tithi_en` | Tithi name (English) |
| `tithi_hi` | Tithi name (Hindi) |
| `paksha_en` | Shukla / Krishna |
| `paksha_hi` | शुक्ल / कृष्ण |
| `nakshatra_id` | Nakshatra number 1–27 |
| `nakshatra_en` | Nakshatra name (English) |
| `nakshatra_hi` | Nakshatra name (Hindi) |
| `yoga_id` | Yoga number 1–27 |
| `yoga_en` | Yoga name (English) |
| `yoga_hi` | Yoga name (Hindi) |
| `karana_id` | Karana half-tithi index 1–60 |
| `karana_en` | Karana name (English) |
| `karana_hi` | Karana name (Hindi) |

### Graha Longitudes (Sidereal Lahiri, degrees 0–360)
| Column | Description |
|---|---|
| `ayanamsa_name` | `Lahiri` |
| `ayanamsa_deg` | Lahiri ayanamsa at that UTC moment |
| `sun_lon` | Sun longitude |
| `moon_lon` | Moon longitude |
| `mars_lon` | Mars longitude |
| `mercury_lon` | Mercury longitude |
| `jupiter_lon` | Jupiter longitude |
| `venus_lon` | Venus longitude |
| `saturn_lon` | Saturn longitude |
| `rahu_lon` | Rahu (True Node) longitude |
| `ketu_lon` | Ketu = Rahu + 180° (normalized) |

### Daily Reference & Flags
| Column | Description |
|---|---|
| `sunrise_local` | Sunrise time `HH:mm` (local) |
| `sunset_local` | Sunset time `HH:mm` (local) |
| `is_rahu_kaal` | 1 if current minute is in Rahu Kaal, else 0 |
| `is_gulika_kaal` | 1 if in Gulika Kaal, else 0 |
| `is_yamaganda` | 1 if in Yamaganda, else 0 |

---

## Panchang Formulas Used

```
Tithi:     floor(normalize360(moon_lon - sun_lon) / 12) + 1   → 1..30
Nakshatra: floor(normalize360(moon_lon) / (360/27)) + 1       → 1..27
Yoga:      floor(normalize360(sun_lon + moon_lon) / (360/27)) + 1 → 1..27
Karana:    half-tithi index → traditional 11-karana mapping
Paksha:    Shukla if tithi 1–15, Krishna if 16–30
```

**Kaal Windows** (day = sunrise to sunset, divided into 8 equal parts):

| Weekday | Rahu Kaal | Gulika | Yamaganda |
|---|---|---|---|
| Sunday    | 8th | 6th | 4th |
| Monday    | 2nd | 5th | 3rd |
| Tuesday   | 7th | 4th | 2nd |
| Wednesday | 5th | 3rd | 1st |
| Thursday  | 6th | 2nd | 7th |
| Friday    | 3rd | 1st | 6th |
| Saturday  | 4th | 7th | 5th |

---

## Validation Checklist

- [ ] Check Tithi at 00:00, 06:00, 12:00, 18:00 for 3+ sample days
- [ ] Verify Tithi transitions (angle crossing 12° multiples)
- [ ] Check Nakshatra matches reference source for same UTC time
- [ ] Verify DST boundary day has 1380 or 1500 minutes (not 1440)
- [ ] Confirm Rahu Kaal windows match known published times for NYC
- [ ] Open CSV in Excel — Hindi characters should render correctly (UTF-8 BOM)
- [ ] Total row count ≈ 86,400 (may vary slightly due to DST)

---

## Limitations

- Exact match with DrikPanchang or similar sites depends on their internal conventions (sunrise definition, node type, ayanamsa precision).
- This app uses **fixed Lahiri ayanamsa + True Node** — non-configurable in v1.
- Swiss Ephemeris WASM files must be compiled and bundled separately (not included in repo due to size/licensing).
- Without `swe.wasm`, the app **refuses to generate fake data** and shows a clear error.
- Performance: ~86,400 API calls to the WASM engine; expect 2–10 minutes on mobile depending on device speed.

---

## Project Structure

```
panchang-offline-nyse/
  index.html              ← Main app UI
  README.md               ← This file
  css/
    style.css             ← Dark astronomy theme, mobile-first
  js/
    app.js                ← Main controller, batch processing
    time.js               ← DST-safe timezone/timestamp engine
    swe_wasm.js           ← Swiss Ephemeris WASM wrapper
    panchang.js           ← Tithi/Nakshatra/Yoga/Karana/Kaal engine
    export_csv.js         ← CSV builder + Blob download
    i18n.js               ← Language file loader
  config/
    location.json         ← NYSE lat/lon/timezone
    profile.json          ← Ayanamsa, range, step settings
    sessions.json         ← NYSE trading session windows
  wasm/
    README.md             ← WASM compilation guide
    swe.js                ← [YOU MUST ADD] Emscripten glue
    swe.wasm              ← [YOU MUST ADD] Compiled binary
  ephe/
    README.md             ← Ephemeris data file guide
    *.se1                 ← [YOU MUST ADD] Swiss Ephemeris data
  i18n/
    en.json               ← English names
    hi.json               ← Hindi names (Devanagari)
```

---

## Milestones Completed (v1)

- [x] Full project structure
- [x] DST-correct timezone engine (`time.js`)
- [x] Swiss Ephemeris WASM wrapper with clear error if missing (`swe_wasm.js`)
- [x] Complete Panchang rule engine — Tithi, Nakshatra, Yoga, Karana, Kaal flags (`panchang.js`)
- [x] CSV export with UTF-8 BOM + Blob download (`export_csv.js`)
- [x] Hindi + English i18n with full Devanagari names (`i18n.js`, `en.json`, `hi.json`)
- [x] Batch processing with live progress bar (`app.js`)
- [x] Mobile-first dark UI (`index.html`, `style.css`)
- [ ] Integrate compiled `wasm/swe.js` + `wasm/swe.wasm` ← **Your step**
- [ ] Add `ephe/*.se1` data files ← **Your step**

---

*No runtime API calls. No backend. No external dependencies.*
