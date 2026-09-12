/**
 * time.js — Timezone-safe Time & Range Engine
 * 
 * Handles:
 *  - Determining "today" in America/New_York
 *  - Generating D1..D60 minute-resolution timestamps
 *  - DST-correct UTC ↔ local conversions
 *  - No external dependencies
 */

'use strict';

const TimeEngine = (() => {

  /**
   * Get today's date string (YYYY-MM-DD) in a given IANA timezone.
   * @param {string} timeZone  e.g. "America/New_York"
   * @returns {string}         e.g. "2025-09-11"
   */
  function getTodayInTimeZone(timeZone) {
    const now = new Date();
    // Use Intl to extract local date parts
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year:  'numeric',
      month: '2-digit',
      day:   '2-digit'
    }).formatToParts(now);
    const get = (type) => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  /**
   * Parse a "YYYY-MM-DD" string into { year, month (1-based), day } parts.
   */
  function parseDateString(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  }

  /**
   * Add N calendar days to a YYYY-MM-DD string, returning a new YYYY-MM-DD string.
   * Works purely arithmetically — no timezone issues.
   */
  function addDays(dateStr, n) {
    const { year, month, day } = parseDateString(dateStr);
    // Use Date in UTC to avoid DST shifting the date
    const d = new Date(Date.UTC(year, month - 1, day + n));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  /**
   * Convert a local YYYY-MM-DD HH:mm timestamp in given timezone to a UTC Date object.
   * DST is handled by the browser's Intl/Date internals.
   * 
   * Strategy: construct an ISO string with no offset, then use the Intl offset to correct.
   * This is robust across DST transitions.
   * 
   * @param {string} dateStr  "YYYY-MM-DD"
   * @param {number} hour     0–23
   * @param {number} minute   0–59
   * @param {string} timeZone IANA timezone string
   * @returns {Date}          UTC Date object
   */
  function localToUtc(dateStr, hour, minute, timeZone) {
    const { year, month, day } = parseDateString(dateStr);

    // First attempt: treat the components as if they're UTC, then find offset
    const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    
    // Get what local time that UTC maps TO in our timezone
    const localParts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year:   'numeric', month:  '2-digit', day:    '2-digit',
      hour:   '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(naiveUtc);

    const gp = (type) => Number(localParts.find(p => p.type === type).value);
    const localH = gp('hour');
    const localM = gp('minute');
    const localDayNum = gp('day');

    // Offset in minutes: how far "behind" UTC is the naive interpretation
    // offset = (local time as minutes from midnight) - (hour/minute we asked for)
    // but we must account for day difference too
    const localYear  = gp('year');
    const localMonth = gp('month');
    const localDay   = localDayNum;

    const utcMins   = Date.UTC(year, month - 1, day, hour, minute) / 60000;
    const localMins = Date.UTC(localYear, localMonth - 1, localDay, localH, localM) / 60000;
    const offsetMins = localMins - utcMins;  // UTC offset of naiveUtc in minutes

    // Correct: subtract the offset to get real UTC
    const realUtc = new Date((naiveUtc.getTime()) - offsetMins * 60000);
    return realUtc;
  }

  /**
   * Format a UTC Date as local time string "YYYY-MM-DD HH:mm" in given timezone.
   * @param {Date}   date
   * @param {string} timeZone
   * @returns {string}
   */
  function formatLocalTimestamp(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year:   'numeric', month:  '2-digit', day:    '2-digit',
      hour:   '2-digit', minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const gp = (type) => parts.find(p => p.type === type).value;
    const h = gp('hour') === '24' ? '00' : gp('hour'); // midnight edge case
    return `${gp('year')}-${gp('month')}-${gp('day')} ${h}:${gp('minute')}`;
  }

  /**
   * Get UTC epoch seconds from a Date object.
   * @param {Date} date
   * @returns {number}
   */
  function toUtcEpochSeconds(date) {
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Get the weekday index (0=Sun..6=Sat) for a local date in given timezone.
   * @param {Date}   utcDate
   * @param {string} timeZone
   * @returns {number}
   */
  function getLocalWeekday(utcDate, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short'
    }).formatToParts(utcDate);
    const dayAbbr = parts.find(p => p.type === 'weekday').value;
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dayAbbr);
  }

  /**
   * Generate all minute timestamps for D1 to D(rangeDays) in the given timezone.
   * 
   * Each element: { localStr, utcDate, epochSeconds, dateStr, hour, minute, weekdayIndex }
   * 
   * DST days may have 23*60=1380 or 25*60=1500 minutes instead of 1440.
   * We generate all local HH:mm combos (00:00–23:59) and convert each correctly.
   * 
   * @param {object} options
   * @param {string} options.timeZone
   * @param {number} options.rangeDays
   * @param {number} options.stepMinutes
   * @param {string} options.startDateStr  "YYYY-MM-DD"
   * @returns {Array}
   */
  function generateMinuteRange({ timeZone, rangeDays, stepMinutes, startDateStr }) {
    const timestamps = [];
    
    for (let d = 0; d < rangeDays; d++) {
      const dateStr = addDays(startDateStr, d);
      
      // Generate all minutes 00:00 to 23:59 for this local date
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += stepMinutes) {
          const utcDate = localToUtc(dateStr, h, m, timeZone);
          
          // Verify: the resulting UTC should map back to this same local date
          // (skip if DST gap caused issues — those local times don't exist)
          const verifyLocal = formatLocalTimestamp(utcDate, timeZone);
          const expectedLocal = `${dateStr} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          
          if (verifyLocal !== expectedLocal) {
            // This local time falls in a DST gap (e.g. 02:30 on spring-forward day)
            // Skip it — it doesn't exist in this timezone
            continue;
          }

          const epochSeconds = toUtcEpochSeconds(utcDate);
          const weekdayIndex = getLocalWeekday(utcDate, timeZone);

          timestamps.push({
            localStr:     expectedLocal,
            utcDate,
            epochSeconds,
            dateStr,
            hour:         h,
            minute:       m,
            weekdayIndex
          });
        }
      }
    }
    
    return timestamps;
  }

  /**
   * Get local date string for a UTC epoch in a given timezone.
   * @param {number} epochSeconds
   * @param {string} timeZone
   * @returns {string} "YYYY-MM-DD"
   */
  function epochToLocalDateStr(epochSeconds, timeZone) {
    const d = new Date(epochSeconds * 1000);
    return formatLocalTimestamp(d, timeZone).substring(0, 10);
  }

  return {
    getTodayInTimeZone,
    generateMinuteRange,
    formatLocalTimestamp,
    toUtcEpochSeconds,
    getLocalWeekday,
    epochToLocalDateStr,
    addDays
  };

})();

// Make available globally
window.TimeEngine = TimeEngine;
