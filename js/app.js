/**
 * app.js — Main Application Controller
 *
 * Compatible with prolaxu/swisseph-wasm library.
 * Dependencies: time.js, swe_wasm.js, panchang.js, export_csv.js, i18n.js
 */

'use strict';

const DEFAULT_LOCATION = {
  name:      'NYSE / Wall Street',
  latitude:  40.7069,
  longitude: -74.0113,
  timezone:  'America/New_York'
};

const DEFAULT_PROFILE = {
  rangeDays:              60,
  stepMinutes:            1,
  ayanamsa:               'lahiri',
  nodeType:               'true',
  includeGrahaLongitudes: true,
  includeKaalFlags:       true
};

const CSV_FILENAME = 'NYSE_D1-D60_1min_panchang_vedic_hi-en.csv';
const BATCH_SIZE   = 300;

let location  = { ...DEFAULT_LOCATION };
let profile   = { ...DEFAULT_PROFILE };
let engine    = null;
let isRunning = false;

// Per-day sunrise/sunset cache (avoid recalculating every minute)
const sunriseSunsetCache = {};

// ── UI Helpers ──────────────────────────────────────────────

function setStatus(msg, isError = false) {
  const el = document.getElementById('status-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'status error' : 'status';
  console.log('[App]', msg);
}

function setProgress(current, total) {
  const pct     = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar     = document.getElementById('progress-bar');
  const label   = document.getElementById('progress-label');
  const counter = document.getElementById('progress-counter');
  const track   = document.querySelector('.progress-track');

  if (bar)     bar.style.width = pct + '%';
  if (label)   label.textContent = pct + '%';
  if (counter) counter.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} rows`;
  if (track)   track.setAttribute('aria-valuenow', pct);
}

function setCurrentTs(localStr) {
  const el = document.getElementById('current-ts');
  if (el) el.textContent = localStr;
}

function setButtonState(generating) {
  const btn = document.getElementById('generate-btn');
  if (!btn) return;
  btn.disabled    = generating;
  btn.textContent = generating ? 'Generating… please wait' : 'Generate D1–D60 CSV';
}

// ── Config Loaders ──────────────────────────────────────────

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[App] Using default for ${path}:`, e.message);
    return fallback;
  }
}

async function loadConfigs() {
  [location, profile] = await Promise.all([
    loadJson('./config/location.json', DEFAULT_LOCATION),
    loadJson('./config/profile.json',  DEFAULT_PROFILE)
  ]);
}

// ── Sunrise/Sunset Cache ────────────────────────────────────

function getSunriseSunset(dateStr) {
  if (sunriseSunsetCache[dateStr]) return sunriseSunsetCache[dateStr];
  try {
    const result = engine.calculateSunriseSunset(
      dateStr, location.latitude, location.longitude, location.timezone
    );
    sunriseSunsetCache[dateStr] = result;
    return result;
  } catch (e) {
    console.warn('[App] Sunrise/sunset failed for', dateStr, e.message);
    const fallback = { sunrise: 'N/A', sunset: 'N/A' };
    sunriseSunsetCache[dateStr] = fallback;
    return fallback;
  }
}

// ── Row Builder ─────────────────────────────────────────────

function buildRow(ts) {
  const { epochSeconds, localStr, dateStr, weekdayIndex } = ts;

  // Planet longitudes (sidereal Lahiri)
  const lons = engine.calculatePlanetLongitudes(epochSeconds);

  // Ayanamsa
  const ayanamsaDeg = engine.calculateAyanamsa(epochSeconds);

  // Panchang
  const panchang = PanchangEngine.computePanchang({
    sun_lon:  lons.sun_lon,
    moon_lon: lons.moon_lon
  });

  // Sunrise/sunset (cached per day)
  const { sunrise, sunset } = getSunriseSunset(dateStr);

  // Kaal flags
  const kaalFlags = PanchangEngine.computeKaalFlags({
    localStr, sunrise, sunset, weekdayIndex
  });

  // i18n names
  const weekdayNames   = I18n.weekday(weekdayIndex);
  const tithiNames     = I18n.tithi(panchang.tithi_id);
  const pakshaNames    = I18n.paksha(panchang.paksha);
  const nakshatraNames = I18n.nakshatra(panchang.nakshatra_id);
  const yogaNames      = I18n.yoga(panchang.yoga_id);
  const karanaNames    = I18n.karana(panchang.karana_key);

  return {
    ts_local:       localStr,
    ts_utc:         epochSeconds,
    timezone:       location.timezone,
    latitude:       location.latitude,
    longitude:      location.longitude,
    weekday_en:     weekdayNames.en,
    weekday_hi:     weekdayNames.hi,

    tithi_id:       panchang.tithi_id,
    tithi_en:       tithiNames.en,
    tithi_hi:       tithiNames.hi,
    paksha_en:      pakshaNames.en,
    paksha_hi:      pakshaNames.hi,

    nakshatra_id:   panchang.nakshatra_id,
    nakshatra_en:   nakshatraNames.en,
    nakshatra_hi:   nakshatraNames.hi,

    yoga_id:        panchang.yoga_id,
    yoga_en:        yogaNames.en,
    yoga_hi:        yogaNames.hi,

    karana_id:      panchang.karana_id,
    karana_en:      karanaNames.en,
    karana_hi:      karanaNames.hi,

    ayanamsa_name:  'Lahiri',
    ayanamsa_deg:   ayanamsaDeg.toFixed(6),

    sun_lon:        lons.sun_lon.toFixed(6),
    moon_lon:       lons.moon_lon.toFixed(6),
    mars_lon:       lons.mars_lon.toFixed(6),
    mercury_lon:    lons.mercury_lon.toFixed(6),
    jupiter_lon:    lons.jupiter_lon.toFixed(6),
    venus_lon:      lons.venus_lon.toFixed(6),
    saturn_lon:     lons.saturn_lon.toFixed(6),
    rahu_lon:       lons.rahu_lon.toFixed(6),
    ketu_lon:       lons.ketu_lon.toFixed(6),

    sunrise_local:  sunrise,
    sunset_local:   sunset,
    is_rahu_kaal:   kaalFlags.is_rahu_kaal,
    is_gulika_kaal: kaalFlags.is_gulika_kaal,
    is_yamaganda:   kaalFlags.is_yamaganda
  };
}

// ── Main Generation ─────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateCsv() {
  if (isRunning) return;
  isRunning = true;
  setButtonState(true);
  Object.keys(sunriseSunsetCache).forEach(k => delete sunriseSunsetCache[k]);

  try {
    // Step 1: Configs
    setStatus('Loading configuration…');
    await loadConfigs();

    // Step 2: i18n
    setStatus('Loading language files…');
    await I18n.init();

    // Step 3: WASM Engine
    setStatus('Loading Swiss Ephemeris engine…');
    engine = new SwissEphemerisEngine();
    await engine.init();
    setStatus('Engine ready. Generating timestamps…');

    // Step 4: Timestamps
    const today = TimeEngine.getTodayInTimeZone(location.timezone);
    const timestamps = TimeEngine.generateMinuteRange({
      timeZone:     location.timezone,
      rangeDays:    profile.rangeDays,
      stepMinutes:  profile.stepMinutes,
      startDateStr: today
    });

    const totalRows = timestamps.length;
    setStatus(`Processing ${totalRows.toLocaleString()} rows… (this may take several minutes)`);
    setProgress(0, totalRows);

    // Step 5: Build CSV in batches
    const csvLines = [CsvExporter.buildCsvHeader()];
    let processed  = 0;

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = timestamps.slice(i, i + BATCH_SIZE);

      for (const ts of batch) {
        setCurrentTs(ts.localStr);
        const row = buildRow(ts);
        csvLines.push(CsvExporter.rowToCsvLine(row));
        processed++;
      }

      setProgress(processed, totalRows);
      await sleep(0);  // yield to browser for UI update
    }

    // Step 6: Download
    setStatus('CSV ready! Starting download…');
    CsvExporter.downloadCsv(CSV_FILENAME, csvLines);
    setProgress(totalRows, totalRows);
    setStatus(`✅ Done! ${totalRows.toLocaleString()} rows → ${CSV_FILENAME}`);

  } catch (err) {
    console.error('[App] Error:', err);
    setStatus('❌ ' + (err.message || String(err)), true);
    setProgress(0, 0);
  } finally {
    isRunning = false;
    setButtonState(false);
    if (engine) { engine.close(); engine = null; }
  }
}

// ── DOM Ready ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('generate-btn');
  if (btn) btn.addEventListener('click', generateCsv);

  const locEl = document.getElementById('info-location');
  if (locEl) locEl.textContent =
    `${DEFAULT_LOCATION.name} (${DEFAULT_LOCATION.latitude}, ${DEFAULT_LOCATION.longitude})`;

  const tzEl = document.getElementById('info-timezone');
  if (tzEl) tzEl.textContent = DEFAULT_LOCATION.timezone;
});
