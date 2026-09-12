/**
 * panchang.js — Vedic Panchang Rule Engine
 *
 * Computes Tithi, Nakshatra, Yoga, Karana, Paksha from sidereal longitudes.
 * Also computes Rahu Kaal, Gulika Kaal, Yamaganda Kaal flags.
 *
 * All formulas use Lahiri sidereal positions (as returned by SwissEphemerisEngine).
 */

'use strict';

const PanchangEngine = (() => {

  /**
   * Normalize degrees to [0, 360).
   * @param {number} deg
   * @returns {number}
   */
  function normalize360(deg) {
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
  }

  /**
   * Parse a "HH:mm" time string to fractional hours.
   * @param {string} timeStr  e.g. "06:23"
   * @returns {number}        e.g. 6.3833...
   */
  function timeStrToHours(timeStr) {
    if (!timeStr || timeStr === 'N/A') return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  }

  /**
   * Parse "YYYY-MM-DD HH:mm" to fractional hours (HH + mm/60).
   * @param {string} localStr
   * @returns {number}
   */
  function localStrToHours(localStr) {
    // e.g. "2025-09-11 14:30"
    const timePart = localStr.substring(11);
    return timeStrToHours(timePart);
  }

  // ==========================================================================
  // TITHI
  // ==========================================================================

  /**
   * Compute Tithi from sidereal Sun and Moon longitudes.
   *
   * Formula:
   *   angle   = normalize360(moon_lon - sun_lon)
   *   tithi_id = floor(angle / 12) + 1   → range 1..30
   *
   * Paksha:
   *   1–15  = Shukla Paksha (waxing moon)
   *   16–30 = Krishna Paksha (waning moon)
   *
   * @param {number} sun_lon   sidereal Sun longitude (degrees)
   * @param {number} moon_lon  sidereal Moon longitude (degrees)
   * @returns {{ tithi_id, paksha }}
   */
  function computeTithi(sun_lon, moon_lon) {
    const angle    = normalize360(moon_lon - sun_lon);
    const tithi_id = Math.floor(angle / 12) + 1;           // 1..30
    const paksha   = tithi_id <= 15 ? 'shukla' : 'krishna';
    return { tithi_id: Math.min(tithi_id, 30), paksha };
  }

  // ==========================================================================
  // NAKSHATRA
  // ==========================================================================

  /**
   * Compute Nakshatra from sidereal Moon longitude.
   *
   * Formula:
   *   Each nakshatra spans 360/27 = 13.3333... degrees
   *   nakshatra_id = floor(moon_lon / (360/27)) + 1   → range 1..27
   *
   * @param {number} moon_lon  sidereal Moon longitude (degrees)
   * @returns {number}  1..27
   */
  function computeNakshatra(moon_lon) {
    const span = 360 / 27;  // ~13.3333°
    const id   = Math.floor(normalize360(moon_lon) / span) + 1;
    return Math.min(id, 27);
  }

  // ==========================================================================
  // YOGA
  // ==========================================================================

  /**
   * Compute Yoga from sidereal Sun + Moon longitudes.
   *
   * Formula:
   *   yoga_angle = normalize360(sun_lon + moon_lon)
   *   yoga_id    = floor(yoga_angle / (360/27)) + 1   → range 1..27
   *
   * @param {number} sun_lon
   * @param {number} moon_lon
   * @returns {number}  1..27
   */
  function computeYoga(sun_lon, moon_lon) {
    const span      = 360 / 27;
    const yogaAngle = normalize360(sun_lon + moon_lon);
    const id        = Math.floor(yogaAngle / span) + 1;
    return Math.min(id, 27);
  }

  // ==========================================================================
  // KARANA
  // ==========================================================================

  /**
   * Traditional Karana mapping.
   *
   * There are 60 Karanas in a lunar month (2 per Tithi × 30 Tithis).
   * Half-Tithi index = floor(angle / 6) → 0..59
   *
   * Fixed Karanas (appear only once, at start and end of lunar month):
   *   Index 0            → Kimstughna  (Shukla 1, first half)
   *   Index 57           → Shakuni
   *   Index 58           → Chatushpada
   *   Index 59           → Naga
   *
   * Repeating Karanas (cycle of 7, appear 8 times each):
   *   Bava, Balava, Kaulava, Taitila, Garaja, Vanija, Vishti
   *   These fill indices 1..56 in sequence:
   *     index 1  → Bava
   *     index 2  → Balava
   *     index 3  → Kaulava
   *     index 4  → Taitila
   *     index 5  → Garaja
   *     index 6  → Vanija
   *     index 7  → Vishti
   *     index 8  → Bava  (cycle repeats)
   *     ...
   *     index 56 → Vishti  (8th cycle, 7th position = index 56)
   *
   * @param {number} sun_lon
   * @param {number} moon_lon
   * @returns {{ karana_id, karana_key }}
   *   karana_id  = half-tithi index 0..59
   *   karana_key = string key for i18n lookup
   */
  function computeKarana(sun_lon, moon_lon) {
    const angle    = normalize360(moon_lon - sun_lon);
    const halfIdx  = Math.floor(angle / 6);  // 0..59
    
    let karana_key;
    
    if (halfIdx === 0) {
      karana_key = 'Kimstughna';
    } else if (halfIdx >= 1 && halfIdx <= 56) {
      // Repeating cycle of 7
      const REPEATING = ['Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti'];
      karana_key = REPEATING[(halfIdx - 1) % 7];
    } else if (halfIdx === 57) {
      karana_key = 'Shakuni';
    } else if (halfIdx === 58) {
      karana_key = 'Chatushpada';
    } else {
      karana_key = 'Naga';
    }

    return { karana_id: halfIdx + 1, karana_key };
  }

  // ==========================================================================
  // MAIN PANCHANG COMPUTATION
  // ==========================================================================

  /**
   * Compute all Panchang elements from sidereal longitudes.
   * @param {{ sun_lon, moon_lon }} lons
   * @returns {{ tithi_id, paksha, nakshatra_id, yoga_id, karana_id, karana_key }}
   */
  function computePanchang({ sun_lon, moon_lon }) {
    const { tithi_id, paksha }       = computeTithi(sun_lon, moon_lon);
    const nakshatra_id               = computeNakshatra(moon_lon);
    const yoga_id                    = computeYoga(sun_lon, moon_lon);
    const { karana_id, karana_key }  = computeKarana(sun_lon, moon_lon);

    return { tithi_id, paksha, nakshatra_id, yoga_id, karana_id, karana_key };
  }

  // ==========================================================================
  // KAAL FLAGS (Rahu Kaal, Gulika, Yamaganda)
  // ==========================================================================

  /**
   * Traditional weekday order of Rahu Kaal segments (1-indexed daylight segment).
   * Each day's Rahu Kaal is the Nth 1/8th segment of the day.
   * Indexed by weekday: 0=Sun, 1=Mon, ..., 6=Sat
   *
   * Traditional sequence (segment number):
   *   Sun=8, Mon=2, Tue=7, Wed=5, Thu=6, Fri=3, Sat=4
   */
  const RAHU_KAAL_SEGMENT = [8, 2, 7, 5, 6, 3, 4];

  /**
   * Gulika Kaal segment by weekday (traditional values):
   *   Sun=6, Mon=5, Tue=4, Wed=3, Thu=2, Fri=1, Sat=7
   *
   * Note: Various traditions differ. This uses one common assignment.
   */
  const GULIKA_SEGMENT = [6, 5, 4, 3, 2, 1, 7];

  /**
   * Yamaganda Kaal segment by weekday:
   *   Sun=4, Mon=3, Tue=2, Wed=1, Thu=7, Fri=6, Sat=5
   */
  const YAMAGANDA_SEGMENT = [4, 3, 2, 1, 7, 6, 5];

  /**
   * Compute the start and end fractional hours of a kaal window.
   *
   * The day is divided into 8 equal parts from sunrise to sunset.
   * Segment N (1-based) starts at: sunrise + (N-1) * segmentSize
   * Segment N ends at:             sunrise + N * segmentSize
   *
   * @param {number} sunriseHours   fractional hours (e.g. 6.5 for 06:30)
   * @param {number} sunsetHours    fractional hours
   * @param {number} segment        1-based segment number
   * @returns {{ start, end }}      fractional hours
   */
  function kaalWindow(sunriseHours, sunsetHours, segment) {
    const dayDuration   = sunsetHours - sunriseHours;
    const segmentSize   = dayDuration / 8;
    const start         = sunriseHours + (segment - 1) * segmentSize;
    const end           = sunriseHours + segment * segmentSize;
    return { start, end };
  }

  /**
   * Check if a given hour falls within a kaal window.
   * @param {number} currentHours
   * @param {{ start, end }} window
   * @returns {boolean}
   */
  function inKaalWindow(currentHours, window) {
    return currentHours >= window.start && currentHours < window.end;
  }

  /**
   * Compute Kaal flags for a given local timestamp.
   *
   * @param {object} params
   * @param {string} params.localStr     "YYYY-MM-DD HH:mm"
   * @param {string} params.sunrise      "HH:mm" string in local time
   * @param {string} params.sunset       "HH:mm" string in local time
   * @param {number} params.weekdayIndex 0=Sun..6=Sat
   * @returns {{ is_rahu_kaal, is_gulika_kaal, is_yamaganda }} — each 1 or 0
   */
  function computeKaalFlags({ localStr, sunrise, sunset, weekdayIndex }) {
    const sunriseHrs = timeStrToHours(sunrise);
    const sunsetHrs  = timeStrToHours(sunset);
    const currentHrs = localStrToHours(localStr);

    // If sunrise/sunset are unavailable, default to 0
    if (sunriseHrs === null || sunsetHrs === null || currentHrs === null) {
      return { is_rahu_kaal: 0, is_gulika_kaal: 0, is_yamaganda: 0 };
    }

    // Outside daylight hours — no kaal
    if (currentHrs < sunriseHrs || currentHrs >= sunsetHrs) {
      return { is_rahu_kaal: 0, is_gulika_kaal: 0, is_yamaganda: 0 };
    }

    const rahuWindow     = kaalWindow(sunriseHrs, sunsetHrs, RAHU_KAAL_SEGMENT[weekdayIndex]);
    const gulikaWindow   = kaalWindow(sunriseHrs, sunsetHrs, GULIKA_SEGMENT[weekdayIndex]);
    const yamagandaWindow = kaalWindow(sunriseHrs, sunsetHrs, YAMAGANDA_SEGMENT[weekdayIndex]);

    return {
      is_rahu_kaal:   inKaalWindow(currentHrs, rahuWindow)     ? 1 : 0,
      is_gulika_kaal: inKaalWindow(currentHrs, gulikaWindow)   ? 1 : 0,
      is_yamaganda:   inKaalWindow(currentHrs, yamagandaWindow) ? 1 : 0
    };
  }

  // ==========================================================================
  // I18N LOOKUP HELPERS
  // ==========================================================================

  /**
   * Get Tithi name from i18n data.
   * @param {number} id   1..30
   * @param {object} i18n loaded i18n object (en or hi)
   * @returns {string}
   */
  function getTithiName(id, i18n) {
    return (i18n.tithis && i18n.tithis[id]) || `Tithi ${id}`;
  }

  /**
   * Get Nakshatra name from i18n data.
   * @param {number} id   1..27
   * @param {object} i18n
   * @returns {string}
   */
  function getNakshatraName(id, i18n) {
    return (i18n.nakshatras && i18n.nakshatras[id]) || `Nakshatra ${id}`;
  }

  /**
   * Get Yoga name from i18n data.
   * @param {number} id   1..27
   * @param {object} i18n
   * @returns {string}
   */
  function getYogaName(id, i18n) {
    return (i18n.yogas && i18n.yogas[id]) || `Yoga ${id}`;
  }

  /**
   * Get Karana name from i18n data.
   * @param {string} key   e.g. "Bava", "Vishti"
   * @param {object} i18n
   * @returns {string}
   */
  function getKaranaName(key, i18n) {
    return (i18n.karanas && i18n.karanas[key]) || key;
  }

  /**
   * Get Paksha name from i18n data.
   * @param {string} paksha  "shukla" | "krishna"
   * @param {object} i18n
   * @returns {string}
   */
  function getPakshaName(paksha, i18n) {
    return (i18n.paksha && i18n.paksha[paksha]) || paksha;
  }

  /**
   * Get weekday name from i18n data.
   * @param {number} idx  0..6 (Sun=0)
   * @param {object} i18n
   * @returns {string}
   */
  function getWeekdayName(idx, i18n) {
    return (i18n.weekdays && i18n.weekdays[idx]) || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][idx];
  }

  return {
    normalize360,
    computePanchang,
    computeKaalFlags,
    getTithiName,
    getNakshatraName,
    getYogaName,
    getKaranaName,
    getPakshaName,
    getWeekdayName
  };

})();

window.PanchangEngine = PanchangEngine;
