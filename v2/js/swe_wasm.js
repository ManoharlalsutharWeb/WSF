/**
 * swe_wasm.js — Swiss Ephemeris Wrapper
 * Compatible with prolaxu/swisseph-wasm (ES Module, loaded via dynamic import)
 *
 * wasm/swe.js      = renamed swisseph.js  (ES module, exports default SwissEph class)
 * wasm/swe.wasm    = renamed swisseph.wasm
 * ephe/sepl_18.se1 = planets
 * ephe/semo_18.se1 = moon
 */

'use strict';

class SwissEphemerisEngine {
  constructor() {
    this._swe   = null;
    this._ready = false;
  }

  async init() {
    let SwissEphClass;

    try {
      // Dynamic import — works with ES module exports
      const mod = await import('./wasm/swe.js');
      SwissEphClass = mod.default || mod.SwissEph || mod;
    } catch (e) {
      throw new Error(
        '❌ wasm/swe.js load failed: ' + e.message + '\n' +
        'Make sure wasm/swe.js and wasm/swe.wasm are uploaded to your repo.\n' +
        'Download from: https://github.com/prolaxu/swisseph-wasm/tree/main/wasm\n' +
        'Rename swisseph.js → swe.js and swisseph.wasm → swe.wasm'
      );
    }

    if (typeof SwissEphClass !== 'function') {
      throw new Error(
        '❌ wasm/swe.js does not export a SwissEph class.\n' +
        'Expected: export default class SwissEph\n' +
        'Got: ' + typeof SwissEphClass
      );
    }

    this._swe = new SwissEphClass();
    await this._swe.initSwissEph();

    // Set Lahiri ayanamsa
    this._swe.set_sid_mode(this._swe.SE_SIDM_LAHIRI, 0, 0);

    this._ready = true;
    console.log('[SwissEph] Ready. Lahiri set.');
  }

  calculateJulianDayFromUnix(epochSeconds) {
    return epochSeconds / 86400.0 + 2440587.5;
  }

  calculatePlanetLongitudes(epochSeconds) {
    if (!this._ready) throw new Error('Engine not initialized.');
    const swe = this._swe;
    const jd  = this.calculateJulianDayFromUnix(epochSeconds);

    const sidFlag = swe.SEFLG_SWIEPH | swe.SEFLG_SIDEREAL;

    // SE_TRUE_NODE = 11 for Rahu (true node)
    const SE_TRUE_NODE = swe.SE_TRUE_NODE !== undefined ? swe.SE_TRUE_NODE : 11;

    const planets = [
      [swe.SE_SUN,     'sun_lon'],
      [swe.SE_MOON,    'moon_lon'],
      [swe.SE_MARS,    'mars_lon'],
      [swe.SE_MERCURY, 'mercury_lon'],
      [swe.SE_JUPITER, 'jupiter_lon'],
      [swe.SE_VENUS,   'venus_lon'],
      [swe.SE_SATURN,  'saturn_lon'],
      [SE_TRUE_NODE,   'rahu_lon'],
    ];

    const result = {};
    for (const [id, key] of planets) {
      const pos = swe.calc_ut(jd, id, sidFlag);
      result[key] = this._norm(Array.isArray(pos) ? pos[0] : pos);
    }

    result.ketu_lon = this._norm(result.rahu_lon + 180);
    return result;
  }

  calculateAyanamsa(epochSeconds) {
    if (!this._ready) throw new Error('Engine not initialized.');
    const jd = this.calculateJulianDayFromUnix(epochSeconds);
    return this._swe.get_ayanamsa_ut(jd);
  }

  calculateSunriseSunset(dateStr, latitude, longitude, timeZone) {
    if (!this._ready) throw new Error('Engine not initialized.');
    const swe = this._swe;
    const [year, month, day] = dateStr.split('-').map(Number);
    const jdNoon = swe.julday(year, month, day, 12.0);

    let sunrise = 'N/A', sunset = 'N/A';

    try {
      const r = swe.rise_trans(
        jdNoon - 0.5, swe.SE_SUN, '', swe.SEFLG_SWIEPH,
        1, [longitude, latitude, 0], 1013.25, 15
      );
      if (r && r.tret && r.tret[0]) sunrise = this._jdToTime(r.tret[0], timeZone);
    } catch(e) { console.warn('Sunrise error:', e.message); }

    try {
      const s = swe.rise_trans(
        jdNoon - 0.5, swe.SE_SUN, '', swe.SEFLG_SWIEPH,
        2, [longitude, latitude, 0], 1013.25, 15
      );
      if (s && s.tret && s.tret[0]) sunset = this._jdToTime(s.tret[0], timeZone);
    } catch(e) { console.warn('Sunset error:', e.message); }

    return { sunrise, sunset };
  }

  _jdToTime(jd, tz) {
    const d = new Date((jd - 2440587.5) * 86400000);
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    return p.find(x=>x.type==='hour').value + ':' + p.find(x=>x.type==='minute').value;
  }

  _norm(deg) {
    deg = deg % 360;
    return deg < 0 ? deg + 360 : deg;
  }

  close() {
    try { if (this._swe) this._swe.close(); } catch(e) {}
    this._ready = false;
    this._swe = null;
  }
}

window.SwissEphemerisEngine = SwissEphemerisEngine;
