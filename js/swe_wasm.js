/**
 * swe_wasm.js — Swiss Ephemeris WASM Wrapper
 *
 * This file wraps the Swiss Ephemeris compiled WASM module.
 * It expects:
 *   - /wasm/swe.js   (Emscripten glue code)
 *   - /wasm/swe.wasm (compiled binary)
 *   - /ephe/*.se1    (ephemeris data files)
 *
 * If WASM files are absent, init() rejects with a clear error.
 * No fake/mock data is silently used in production mode.
 *
 * Swiss Ephemeris Planet IDs (SE_* constants):
 *   0 = Sun, 1 = Moon, 2 = Mercury, 3 = Venus, 4 = Mars
 *   5 = Jupiter, 6 = Saturn, 11 = True Node (Rahu)
 *
 * Ayanamsa mode for Lahiri/Chitrapaksha = 1 (SE_SIDM_LAHIRI)
 */

'use strict';

class SwissEphemerisEngine {
  constructor() {
    this._module   = null;   // Emscripten module instance
    this._ready    = false;
    this._mockMode = false;  // NEVER enable in production
    this._ayanamsaMode = 1;  // SE_SIDM_LAHIRI = 1

    // Emscripten wrapped C functions (set after init)
    this._swe_julday       = null;
    this._swe_calc_ut      = null;
    this._swe_get_ayanamsa_ut = null;
    this._swe_rise_trans   = null;
    this._swe_set_ephe_path = null;
    this._swe_set_sid_mode  = null;
    this._swe_close        = null;
  }

  /**
   * Initialize the WASM module.
   * @param {object} options
   * @param {string} options.ephePath  path to ephemeris files, e.g. './ephe/'
   * @returns {Promise<void>}
   */
  async init({ ephePath = './ephe/' } = {}) {
    // Check if swe.js loader script is already in the DOM
    if (typeof SwissEph === 'undefined') {
      // Try to dynamically load the WASM glue script
      await this._loadScript('./wasm/swe.js').catch(() => {
        throw new Error(
          '❌ Swiss Ephemeris WASM files missing.\n' +
          'High-accuracy calculation cannot run.\n' +
          'Please add wasm/swe.js and wasm/swe.wasm files.\n' +
          'See wasm/README.md for compilation instructions.'
        );
      });
    }

    if (typeof SwissEph === 'undefined') {
      throw new Error(
        '❌ Swiss Ephemeris WASM failed to load.\n' +
        'wasm/swe.js did not export a SwissEph factory function.'
      );
    }

    // Instantiate the Emscripten module
    this._module = await SwissEph({
      locateFile: (filename) => `./wasm/${filename}`
    });

    // Bind C functions via cwrap
    this._swe_julday = this._module.cwrap('swe_julday', 'number',
      ['number','number','number','number','number']);
    this._swe_calc_ut = this._module.cwrap('swe_calc_ut', 'number',
      ['number','number','number','number','number']);
    this._swe_get_ayanamsa_ut = this._module.cwrap('swe_get_ayanamsa_ut', 'number',
      ['number']);
    this._swe_rise_trans = this._module.cwrap('swe_rise_trans', 'number',
      ['number','number','number','number','number','number','number','number','number','number']);
    this._swe_set_ephe_path = this._module.cwrap('swe_set_ephe_path', null, ['string']);
    this._swe_set_sid_mode  = this._module.cwrap('swe_set_sid_mode',  null, ['number','number','number']);
    this._swe_close         = this._module.cwrap('swe_close',         null, []);

    // Set ephemeris path and ayanamsa mode
    this._swe_set_ephe_path(ephePath);
    this._swe_set_sid_mode(this._ayanamsaMode, 0, 0);

    this._ready = true;
    console.log('[SwissEph] Engine ready. Ephemeris path:', ephePath);
  }

  /**
   * Dynamically load a JS script and wait for it.
   * @param {string} src
   * @returns {Promise<void>}
   */
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload  = resolve;
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  }

  /** Set ephemeris data file path */
  setEphemerisPath(path) {
    if (this._swe_set_ephe_path) this._swe_set_ephe_path(path);
  }

  /** Set ayanamsa mode (1 = Lahiri) */
  setAyanamsa(mode = 1) {
    this._ayanamsaMode = mode;
    if (this._swe_set_sid_mode) this._swe_set_sid_mode(mode, 0, 0);
  }

  /**
   * Convert Unix epoch seconds to Julian Day Number (UT).
   * JD = epoch/86400 + 2440587.5
   * @param {number} epochSeconds
   * @returns {number} Julian Day Number
   */
  calculateJulianDayFromUnix(epochSeconds) {
    return epochSeconds / 86400.0 + 2440587.5;
  }

  /**
   * Calculate sidereal planet longitudes for a given epoch.
   *
   * Swiss Ephemeris flag values:
   *   SEFLG_SWIEPH    = 2      (use Swiss Ephemeris files)
   *   SEFLG_SIDEREAL  = 64     (sidereal mode, uses set ayanamsa)
   *   SEFLG_TRUENODE  = 256    (true node for Rahu, not mean node)
   *
   * Planet IDs:
   *   SE_SUN=0, SE_MOON=1, SE_MERCURY=2, SE_VENUS=3, SE_MARS=4
   *   SE_JUPITER=5, SE_SATURN=6, SE_TRUE_NODE=11
   *
   * @param {number} epochSeconds  UTC epoch seconds
   * @returns {{ sun_lon, moon_lon, mars_lon, mercury_lon, jupiter_lon, venus_lon, saturn_lon, rahu_lon, ketu_lon }}
   */
  calculatePlanetLongitudes(epochSeconds) {
    if (!this._ready) throw new Error('Engine not initialized. Call init() first.');

    const jd = this.calculateJulianDayFromUnix(epochSeconds);

    // Flags: sidereal + Swiss Ephemeris files + true node
    const SEFLG_SWIEPH   = 2;
    const SEFLG_SIDEREAL = 64;
    const SEFLG_TRUENODE = 256;  // used for Rahu (true node vs mean node)
    const sidFlag  = SEFLG_SWIEPH | SEFLG_SIDEREAL;
    const nodeFlag = sidFlag | SEFLG_TRUENODE;

    const planets = [
      { id: 0,  key: 'sun_lon',     flag: sidFlag  },
      { id: 1,  key: 'moon_lon',    flag: sidFlag  },
      { id: 4,  key: 'mars_lon',    flag: sidFlag  },
      { id: 2,  key: 'mercury_lon', flag: sidFlag  },
      { id: 5,  key: 'jupiter_lon', flag: sidFlag  },
      { id: 3,  key: 'venus_lon',   flag: sidFlag  },
      { id: 6,  key: 'saturn_lon',  flag: sidFlag  },
      { id: 11, key: 'rahu_lon',    flag: nodeFlag },
    ];

    // Allocate output buffer (6 doubles = 48 bytes for xx array)
    const xxPtr = this._module._malloc(6 * 8);
    const errPtr = this._module._malloc(256);

    const result = {};

    try {
      for (const { id, key, flag } of planets) {
        const ret = this._swe_calc_ut(jd, id, flag, xxPtr, errPtr);
        if (ret < 0) {
          const errMsg = this._module.UTF8ToString(errPtr);
          console.warn(`[SwissEph] Planet ${id} calc warning: ${errMsg}`);
        }
        // xx[0] = longitude (degrees)
        const lon = this._module.getValue(xxPtr, 'double');
        result[key] = this._normalize360(lon);
      }
    } finally {
      this._module._free(xxPtr);
      this._module._free(errPtr);
    }

    // Ketu is exactly opposite Rahu (180° apart)
    result.ketu_lon = this._normalize360(result.rahu_lon + 180);

    return result;
  }

  /**
   * Calculate Lahiri ayanamsa for a given epoch.
   * @param {number} epochSeconds
   * @returns {number} ayanamsa in degrees
   */
  calculateAyanamsa(epochSeconds) {
    if (!this._ready) throw new Error('Engine not initialized.');
    const jd = this.calculateJulianDayFromUnix(epochSeconds);
    return this._swe_get_ayanamsa_ut(jd);
  }

  /**
   * Calculate sunrise and sunset for a local date at a given location.
   *
   * Uses swe_rise_trans with SE_CALC_RISE and SE_CALC_SET.
   * Returns times as "HH:mm" strings in local timezone.
   *
   * @param {string} dateStr   "YYYY-MM-DD" (local date)
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} timeZone  IANA timezone
   * @returns {{ sunrise: string, sunset: string }}
   */
  calculateSunriseSunset(dateStr, latitude, longitude, timeZone) {
    if (!this._ready) throw new Error('Engine not initialized.');

    const [year, month, day] = dateStr.split('-').map(Number);
    // JD for noon UTC on that calendar date (safe starting point for rise/set search)
    const jdNoon = this._swe_julday(year, month, day, 12.0, 1); // 1 = SE_GREG_CAL

    const SE_CALC_RISE = 1;
    const SE_CALC_SET  = 2;
    const SE_SUN       = 0;
    const SEFLG_SWIEPH = 2;
    const SEFLG_TOPOCTR = 32768; // topocentric (for surface sunrise)
    const atmo  = 1013.25;  // standard atmospheric pressure (mbar)
    const temp  = 15.0;     // standard temperature (°C)

    const tRetPtr = this._module._malloc(8);  // double for result time
    const errPtr  = this._module._malloc(256);

    let sunrise = 'N/A';
    let sunset  = 'N/A';

    try {
      // Sunrise
      let ret = this._swe_rise_trans(
        jdNoon - 0.5,   // start search from previous midnight
        SE_SUN, 0,
        SEFLG_SWIEPH,
        SE_CALC_RISE,
        longitude, latitude, 0,  // lon, lat, altitude
        atmo, temp,
        tRetPtr, errPtr
      );

      if (ret >= 0) {
        const jdRise = this._module.getValue(tRetPtr, 'double');
        sunrise = this._jdToLocalTime(jdRise, timeZone);
      }

      // Sunset
      ret = this._swe_rise_trans(
        jdNoon - 0.5,
        SE_SUN, 0,
        SEFLG_SWIEPH,
        SE_CALC_SET,
        longitude, latitude, 0,
        atmo, temp,
        tRetPtr, errPtr
      );

      if (ret >= 0) {
        const jdSet = this._module.getValue(tRetPtr, 'double');
        sunset = this._jdToLocalTime(jdSet, timeZone);
      }
    } finally {
      this._module._free(tRetPtr);
      this._module._free(errPtr);
    }

    return { sunrise, sunset };
  }

  /**
   * Convert a Julian Day number to local time string "HH:mm" in given timezone.
   * @param {number} jd
   * @param {string} timeZone
   * @returns {string}
   */
  _jdToLocalTime(jd, timeZone) {
    const epochMs = (jd - 2440587.5) * 86400000;
    const d = new Date(epochMs);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    const h = parts.find(p => p.type === 'hour').value;
    const m = parts.find(p => p.type === 'minute').value;
    return `${h}:${m}`;
  }

  /**
   * Normalize a longitude value to [0, 360).
   * @param {number} deg
   * @returns {number}
   */
  _normalize360(deg) {
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
  }

  /** Clean up WASM resources */
  close() {
    if (this._swe_close) this._swe_close();
    this._ready = false;
  }
}

window.SwissEphemerisEngine = SwissEphemerisEngine;
