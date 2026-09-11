/**
 * swe_wasm.js — Swiss Ephemeris Wrapper (prolaxu/swisseph-wasm compatible)
 *
 * Compatible with: https://github.com/prolaxu/swisseph-wasm
 * Files needed in /wasm/:
 *   swisseph.js   → rename to swe.js
 *   swisseph.wasm → rename to swe.wasm
 *
 * API used:
 *   new SwissEph() → swe.initSwissEph() → swe.julday() → swe.calc_ut()
 *   swe.set_sid_mode() → swe.get_ayanamsa_ut() → swe.rise_trans()
 */

'use strict';

class SwissEphemerisEngine {
  constructor() {
    this._swe   = null;   // SwissEph instance from prolaxu library
    this._ready = false;
  }

  /**
   * Initialize the WASM engine.
   * Loads wasm/swe.js (renamed from swisseph.js).
   */
  async init() {
    // Load the JS wrapper script if not already loaded
    if (typeof SwissEph === 'undefined') {
      await this._loadScript('./wasm/swe.js').catch(() => {
        throw new Error(
          '❌ Swiss Ephemeris WASM files missing.\n' +
          'Please add these files to your /wasm/ folder:\n' +
          '  swisseph.js  → rename to → swe.js\n' +
          '  swisseph.wasm → rename to → swe.wasm\n' +
          'Download from: https://github.com/prolaxu/swisseph-wasm/tree/main/wasm\n' +
          'See wasm/README.md for full instructions.'
        );
      });
    }

    if (typeof SwissEph === 'undefined') {
      throw new Error('❌ SwissEph class not found after loading wasm/swe.js');
    }

    // Create instance and initialize
    this._swe = new SwissEph();
    await this._swe.initSwissEph();

    // Set Lahiri ayanamsa (SE_SIDM_LAHIRI = 1)
    this._swe.set_sid_mode(this._swe.SE_SIDM_LAHIRI, 0, 0);

    this._ready = true;
    console.log('[SwissEph] Engine ready. Lahiri ayanamsa set.');
  }

  /** Dynamically load a script tag */
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload  = resolve;
      script.onerror = () => reject(new Error(`Cannot load: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Convert Unix epoch seconds → Julian Day Number (UT).
   * Formula: JD = epoch/86400 + 2440587.5
   */
  calculateJulianDayFromUnix(epochSeconds) {
    return epochSeconds / 86400.0 + 2440587.5;
  }

  /**
   * Calculate sidereal Lahiri planet longitudes for a given UTC epoch.
   *
   * Planet IDs (from SwissEph constants):
   *   SE_SUN=0, SE_MOON=1, SE_MERCURY=2, SE_VENUS=3, SE_MARS=4
   *   SE_JUPITER=5, SE_SATURN=6, SE_TRUE_NODE=11
   *
   * Flags:
   *   SEFLG_SWIEPH=2   → use bundled WASM ephemeris
   *   SEFLG_SIDEREAL=64 → sidereal mode (uses set ayanamsa = Lahiri)
   *
   * @param {number} epochSeconds  UTC epoch seconds
   * @returns {{ sun_lon, moon_lon, mars_lon, mercury_lon, jupiter_lon, venus_lon, saturn_lon, rahu_lon, ketu_lon }}
   */
  calculatePlanetLongitudes(epochSeconds) {
    if (!this._ready) throw new Error('Engine not initialized. Call init() first.');

    const swe = this._swe;
    const jd  = this.calculateJulianDayFromUnix(epochSeconds);

    // Sidereal flag = SEFLG_SWIEPH | SEFLG_SIDEREAL
    const sidFlag = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL;

    // Planet list: [id, result_key]
    const planets = [
      [swe.SE_SUN,       'sun_lon'],
      [swe.SE_MOON,      'moon_lon'],
      [swe.SE_MARS,      'mars_lon'],
      [swe.SE_MERCURY,   'mercury_lon'],
      [swe.SE_JUPITER,   'jupiter_lon'],
      [swe.SE_VENUS,     'venus_lon'],
      [swe.SE_SATURN,    'saturn_lon'],
      [swe.SE_TRUE_NODE, 'rahu_lon'],  // True Node = Rahu
    ];

    const result = {};

    for (const [id, key] of planets) {
      const pos = swe.calc_ut(jd, id, sidFlag);
      // pos[0] = longitude, pos[1] = latitude, pos[2] = distance
      result[key] = this._normalize360(pos[0]);
    }

    // Ketu = exactly opposite Rahu
    result.ketu_lon = this._normalize360(result.rahu_lon + 180);

    return result;
  }

  /**
   * Calculate Lahiri ayanamsa for a given UTC epoch.
   * @param {number} epochSeconds
   * @returns {number} ayanamsa in degrees
   */
  calculateAyanamsa(epochSeconds) {
    if (!this._ready) throw new Error('Engine not initialized.');
    const jd = this.calculateJulianDayFromUnix(epochSeconds);
    return this._swe.get_ayanamsa_ut(jd);
  }

  /**
   * Calculate sunrise and sunset for a local date.
   * Returns "HH:mm" strings in the given timezone.
   *
   * Uses swe.rise_trans() with:
   *   rsmi=1 (SE_CALC_RISE), rsmi=2 (SE_CALC_SET)
   *
   * @param {string} dateStr   "YYYY-MM-DD"
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} timeZone  IANA timezone
   * @returns {{ sunrise: string, sunset: string }}
   */
  calculateSunriseSunset(dateStr, latitude, longitude, timeZone) {
    if (!this._ready) throw new Error('Engine not initialized.');

    const swe = this._swe;
    const [year, month, day] = dateStr.split('-').map(Number);

    // JD for noon UTC on that date (safe starting point for rise/set search)
    const jdNoon = swe.julday(year, month, day, 12.0);

    // geopos array: [longitude, latitude, altitude]
    const geopos = [longitude, latitude, 0];

    const atpress = 1013.25;  // standard atmosphere
    const attemp  = 15.0;     // standard temperature °C

    let sunrise = 'N/A';
    let sunset  = 'N/A';

    try {
      // SE_CALC_RISE = 1
      const riseResult = swe.rise_trans(
        jdNoon - 0.5,   // start from midnight
        swe.SE_SUN,
        '',             // no star name
        swe.SEFLG_SWIEPH,
        1,              // SE_CALC_RISE
        geopos,
        atpress,
        attemp
      );
      if (riseResult && riseResult.tret && riseResult.tret[0]) {
        sunrise = this._jdToLocalTime(riseResult.tret[0], timeZone);
      }
    } catch (e) {
      console.warn('[SwissEph] Sunrise calc failed:', e.message);
    }

    try {
      // SE_CALC_SET = 2
      const setResult = swe.rise_trans(
        jdNoon - 0.5,
        swe.SE_SUN,
        '',
        swe.SEFLG_SWIEPH,
        2,              // SE_CALC_SET
        geopos,
        atpress,
        attemp
      );
      if (setResult && setResult.tret && setResult.tret[0]) {
        sunset = this._jdToLocalTime(setResult.tret[0], timeZone);
      }
    } catch (e) {
      console.warn('[SwissEph] Sunset calc failed:', e.message);
    }

    return { sunrise, sunset };
  }

  /**
   * Convert Julian Day → local "HH:mm" string in given timezone.
   */
  _jdToLocalTime(jd, timeZone) {
    const epochMs = (jd - 2440587.5) * 86400000;
    const d = new Date(epochMs);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);
    const h = parts.find(p => p.type === 'hour').value;
    const m = parts.find(p => p.type === 'minute').value;
    return `${h}:${m}`;
  }

  /** Normalize degrees to [0, 360) */
  _normalize360(deg) {
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
  }

  /** Clean up */
  close() {
    if (this._swe) {
      try { this._swe.close(); } catch(e) {}
    }
    this._ready = false;
    this._swe   = null;
  }
}

window.SwissEphemerisEngine = SwissEphemerisEngine;
