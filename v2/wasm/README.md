# Swiss Ephemeris WASM Files

## Required Files

Place these two files in this `/wasm/` directory:

- `swe.wasm` — compiled Swiss Ephemeris WebAssembly binary
- `swe.js`   — Emscripten JS glue/loader for the WASM module

## How to Compile Swiss Ephemeris to WASM

### Prerequisites
- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) installed
- Swiss Ephemeris C source code from https://www.astro.com/swisseph/

### Steps

```bash
# 1. Download Swiss Ephemeris source
wget https://www.astro.com/ftp/swisseph/src/sweph-2.10.03.tar.gz
tar xzf sweph-2.10.03.tar.gz
cd sweph-2.10.03

# 2. Activate Emscripten
source /path/to/emsdk/emsdk_env.sh

# 3. Compile to WASM
emcc sweph.c swedate.c swehel.c swejpl.c swemmoon.c swemplan.c swepcalc.c swepdate.c swephlib.c \
  -O2 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="SwissEph" \
  -s EXPORTED_FUNCTIONS='["_swe_calc_ut","_swe_get_ayanamsa_ut","_swe_rise_trans","_swe_set_ephe_path","_swe_set_sid_mode","_swe_julday","_swe_close"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","allocate","ALLOC_NORMAL"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s SINGLE_FILE=0 \
  -o ../wasm/swe.js

# swe.wasm is automatically generated alongside swe.js
```

### After Compilation
- Copy `swe.js` and `swe.wasm` to this `/wasm/` directory.
- Also copy Swiss Ephemeris data files (`.se1` format) to `/ephe/` directory.

## Alternative: Pre-compiled WASM

A community-compiled version may be available at:
https://github.com/astro-js/swisseph-wasm

Check license compatibility before using.

## App Behavior Without WASM

If `swe.wasm` or `swe.js` are missing, the app will display:

> ❌ Swiss Ephemeris WASM/ephemeris files missing.
> High-accuracy calculation cannot run.
> Please add wasm/swe.js and wasm/swe.wasm files.

No fake or approximate data will be silently used in CSV output.
