/**
 * i18n.js — Internationalization Loader
 *
 * Loads en.json and hi.json from /i18n/ directory.
 * Provides lookup helpers used by app.js and panchang.js.
 * No CDN. No external network calls. Purely local files.
 */

'use strict';

const I18n = (() => {

  let _en = null;
  let _hi = null;

  /**
   * Load a JSON file via fetch (works for local files served via HTTP/HTTPS).
   * @param {string} path
   * @returns {Promise<object>}
   */
  async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Initialize: load both language files.
   * Must be called before any lookup functions.
   * @returns {Promise<void>}
   */
  async function init() {
    [_en, _hi] = await Promise.all([
      loadJson('./i18n/en.json'),
      loadJson('./i18n/hi.json')
    ]);
  }

  /** @returns {object} English i18n data */
  function en() {
    if (!_en) throw new Error('I18n not initialized. Call I18n.init() first.');
    return _en;
  }

  /** @returns {object} Hindi i18n data */
  function hi() {
    if (!_hi) throw new Error('I18n not initialized. Call I18n.init() first.');
    return _hi;
  }

  /**
   * Get weekday name in both languages.
   * @param {number} idx  0=Sun..6=Sat
   * @returns {{ en: string, hi: string }}
   */
  function weekday(idx) {
    return {
      en: _en.weekdays[idx] || '',
      hi: _hi.weekdays[idx] || ''
    };
  }

  /**
   * Get Tithi name in both languages.
   * @param {number} id  1..30
   * @returns {{ en: string, hi: string }}
   */
  function tithi(id) {
    return {
      en: _en.tithis[id] || `Tithi ${id}`,
      hi: _hi.tithis[id] || `तिथि ${id}`
    };
  }

  /**
   * Get Paksha name in both languages.
   * @param {string} key  "shukla" | "krishna"
   * @returns {{ en: string, hi: string }}
   */
  function paksha(key) {
    return {
      en: (_en.paksha && _en.paksha[key]) || key,
      hi: (_hi.paksha && _hi.paksha[key]) || key
    };
  }

  /**
   * Get Nakshatra name in both languages.
   * @param {number} id  1..27
   * @returns {{ en: string, hi: string }}
   */
  function nakshatra(id) {
    return {
      en: _en.nakshatras[id] || `Nakshatra ${id}`,
      hi: _hi.nakshatras[id] || `नक्षत्र ${id}`
    };
  }

  /**
   * Get Yoga name in both languages.
   * @param {number} id  1..27
   * @returns {{ en: string, hi: string }}
   */
  function yoga(id) {
    return {
      en: _en.yogas[id] || `Yoga ${id}`,
      hi: _hi.yogas[id] || `योग ${id}`
    };
  }

  /**
   * Get Karana name in both languages.
   * @param {string} key  e.g. "Bava", "Vishti"
   * @returns {{ en: string, hi: string }}
   */
  function karana(key) {
    return {
      en: (_en.karanas && _en.karanas[key]) || key,
      hi: (_hi.karanas && _hi.karanas[key]) || key
    };
  }

  return {
    init,
    en,
    hi,
    weekday,
    tithi,
    paksha,
    nakshatra,
    yoga,
    karana
  };

})();

window.I18n = I18n;
