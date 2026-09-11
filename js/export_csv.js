/**
 * export_csv.js — CSV Export Engine
 *
 * Builds and downloads the Panchang CSV file.
 * - UTF-8 BOM for correct Hindi display in Excel
 * - Comma-delimited
 * - Proper CSV escaping
 * - Blob-based download (works on Android Chrome)
 */

'use strict';

const CsvExporter = (() => {

  /** UTF-8 BOM prefix so Excel opens Hindi text correctly */
  const UTF8_BOM = '\uFEFF';

  /**
   * Escape a single CSV value.
   * - Wrap in quotes if contains comma, quote, or newline
   * - Double any internal quotes
   * @param {any} value
   * @returns {string}
   */
  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Build the CSV header row string.
   * Columns in exact required order.
   * @returns {string}
   */
  function buildCsvHeader() {
    const columns = [
      'ts_local',
      'ts_utc',
      'timezone',
      'latitude',
      'longitude',
      'weekday_en',
      'weekday_hi',

      'tithi_id',
      'tithi_en',
      'tithi_hi',
      'paksha_en',
      'paksha_hi',

      'nakshatra_id',
      'nakshatra_en',
      'nakshatra_hi',

      'yoga_id',
      'yoga_en',
      'yoga_hi',

      'karana_id',
      'karana_en',
      'karana_hi',

      'ayanamsa_name',
      'ayanamsa_deg',

      'sun_lon',
      'moon_lon',
      'mars_lon',
      'mercury_lon',
      'jupiter_lon',
      'venus_lon',
      'saturn_lon',
      'rahu_lon',
      'ketu_lon',

      'sunrise_local',
      'sunset_local',
      'is_rahu_kaal',
      'is_gulika_kaal',
      'is_yamaganda'
    ];

    return columns.map(csvEscape).join(',');
  }

  /**
   * Convert a data row object to a CSV line string.
   * @param {object} row  — keys matching column names
   * @returns {string}
   */
  function rowToCsvLine(row) {
    const values = [
      row.ts_local,
      row.ts_utc,
      row.timezone,
      row.latitude,
      row.longitude,
      row.weekday_en,
      row.weekday_hi,

      row.tithi_id,
      row.tithi_en,
      row.tithi_hi,
      row.paksha_en,
      row.paksha_hi,

      row.nakshatra_id,
      row.nakshatra_en,
      row.nakshatra_hi,

      row.yoga_id,
      row.yoga_en,
      row.yoga_hi,

      row.karana_id,
      row.karana_en,
      row.karana_hi,

      row.ayanamsa_name,
      row.ayanamsa_deg,

      row.sun_lon,
      row.moon_lon,
      row.mars_lon,
      row.mercury_lon,
      row.jupiter_lon,
      row.venus_lon,
      row.saturn_lon,
      row.rahu_lon,
      row.ketu_lon,

      row.sunrise_local,
      row.sunset_local,
      row.is_rahu_kaal,
      row.is_gulika_kaal,
      row.is_yamaganda
    ];

    return values.map(csvEscape).join(',');
  }

  /**
   * Trigger a CSV file download in the browser using a Blob.
   * Works on Android Chrome (uses URL.createObjectURL).
   *
   * @param {string} filename    e.g. "NYSE_D1-D60_1min_panchang_vedic_hi-en.csv"
   * @param {string[]} lines     Array of CSV line strings (header + rows)
   */
  function downloadCsv(filename, lines) {
    // Join all lines with CRLF for maximum Excel compatibility
    const csvContent = UTF8_BOM + lines.join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return {
    csvEscape,
    buildCsvHeader,
    rowToCsvLine,
    downloadCsv
  };

})();

window.CsvExporter = CsvExporter;
