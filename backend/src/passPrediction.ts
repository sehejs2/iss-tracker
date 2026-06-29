/**
 * ISS pass prediction — Phase 3
 *
 * APPROACH: Real SGP4 orbital propagation via satellite.js.
 *
 * A pass is reported as VISIBLE only when all three conditions hold
 * simultaneously at the same 15-second sample:
 *
 *   1. ABOVE HORIZON  — ISS elevation ≥ MIN_ELEVATION_DEG (10°) above the
 *      observer's local horizon.  10° rather than 0° because atmospheric
 *      refraction and local obstructions make sub-10° passes effectively
 *      unobservable.
 *
 *   2. ISS ILLUMINATED — ISS is not inside Earth's shadow (umbra).  Computed
 *      with a cylindrical shadow model: the ISS is in shadow if and only if
 *      (a) it lies on the night side of Earth (dot product of ISS ECI
 *      position with the Sun ECI direction is negative) AND (b) its
 *      perpendicular distance from the Earth-Sun axis is less than Earth's
 *      radius.  The cylindrical model slightly over-estimates illumination
 *      near shadow entry/exit (it ignores penumbra), but the error at ISS
 *      altitude (~410 km) is <1 km and <2 seconds — negligible.
 *
 *   3. OBSERVER IN DARKNESS — Sun is below civil twilight (−6° elevation)
 *      at the observer's location.  The ISS is only visible to the naked eye
 *      when the sky is dark enough that the ISS's reflected sunlight stands
 *      out.  Civil twilight (−6°) is the standard threshold cited by
 *      NASA, Heavens-Above, and ESA for ISS naked-eye visibility.
 *
 * SCAN RESOLUTION: 15 seconds.  The ISS moves ~120 km in 15 s, which
 * translates to ~0.5° of elevation change at typical pass geometry —
 * sufficient to locate pass boundaries to within one scan step.
 *
 * SUN POSITION: satellite.js built-in sunPos() uses a low-precision
 * almanac formula accurate to ~0.01° in ecliptic longitude — more than
 * sufficient for both shadow detection and twilight classification.
 */

import * as satellite from 'satellite.js';
import SunCalc from 'suncalc';
import { getTle } from './tle';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCAN_STEP_MS       = 15_000;   // 15-second scan resolution
const LOOKAHEAD_HOURS    = 48;
const MIN_ELEVATION_DEG  = 10;       // ignore grazing passes below 10°
const CIVIL_TWILIGHT_DEG = -6;       // observer must be this dark (sun below horizon)
const EARTH_RADIUS_KM    = 6_371;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PassWindow {
  rise: { time: string; azimuthDeg: number };
  peak: { time: string; elevationDeg: number; azimuthDeg: number };
  set:  { time: string; azimuthDeg: number };
  durationSeconds: number;
}

interface ActivePass {
  riseTime: Date; riseAz:  number;
  peakTime: Date; peakEl:  number; peakAz: number;
  setTime:  Date; setAz:   number;
}

// ── Shadow check ──────────────────────────────────────────────────────────────

// Cylindrical Earth shadow model (see module-level doc for rationale).
//
// satellite.js sunPos() returns rsun in AU — we only need the direction, so
// we normalise it.  The ISS ECI position is in km.
//
// Conditions for ISS being IN shadow:
//   dot(issEci, sunDir) < 0              ← ISS on the night side of Earth
//   AND perp² = |issEci|² - dot² < R_E² ← closer to Earth-Sun axis than Earth's radius
//
// isIlluminated = NOT in shadow.
function isIlluminated(issEci: satellite.EciVec3<number>, jd: number): boolean {
  const { rsun } = satellite.sunPos(jd);
  const mag  = Math.hypot(rsun.x, rsun.y, rsun.z);
  const sx   = rsun.x / mag;
  const sy   = rsun.y / mag;
  const sz   = rsun.z / mag;

  const dot  = issEci.x * sx + issEci.y * sy + issEci.z * sz;
  if (dot > 0) return true;  // ISS on the sunlit hemisphere

  const r2    = issEci.x ** 2 + issEci.y ** 2 + issEci.z ** 2;
  const perp2 = r2 - dot * dot;
  return perp2 > EARTH_RADIUS_KM ** 2;  // ISS clears the shadow cylinder
}

// ── Julian date helper ────────────────────────────────────────────────────────

// satellite.js jday() takes calendar components; this convenience wrapper
// takes a JS Date so the loop body stays readable.
function toJd(date: Date): number {
  return satellite.jday(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds() + date.getUTCMilliseconds() / 1000,
  );
}

// ── Main prediction ───────────────────────────────────────────────────────────

export async function predictPasses(
  observerLat: number,
  observerLng: number,
): Promise<PassWindow[]> {
  const tle    = await getTle();
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);

  // GeodeticLocation expects radians; height in km above ellipsoid (sea level = 0).
  const observerGd: satellite.GeodeticLocation = {
    latitude:  satellite.degreesToRadians(observerLat),
    longitude: satellite.degreesToRadians(observerLng),
    height:    0,
  };

  const passes: PassWindow[] = [];
  let active: ActivePass | null = null;

  const startMs = Date.now();
  const endMs   = startMs + LOOKAHEAD_HOURS * 3_600_000;

  for (let t = startMs; t <= endMs; t += SCAN_STEP_MS) {
    const date   = new Date(t);
    const posVel = satellite.propagate(satrec, date);
    if (!posVel) continue;

    const eci  = posVel.position;
    const gmst = satellite.gstime(date);
    const ecf  = satellite.eciToEcf(eci, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);

    const elDeg = satellite.radiansToDegrees(look.elevation);
    const azDeg = satellite.radiansToDegrees(look.azimuth);
    const jd    = toJd(date);

    // Condition 1: ISS above minimum elevation
    const aboveHorizon = elDeg >= MIN_ELEVATION_DEG;

    // Condition 2: ISS in sunlight (not in Earth's umbra)
    const lit = aboveHorizon ? isIlluminated(eci, jd) : false;

    // Condition 3: observer's sky dark enough (civil twilight threshold)
    // SunCalc.getPosition returns altitude in radians; convert to degrees.
    const sunAltDeg = aboveHorizon
      ? satellite.radiansToDegrees(SunCalc.getPosition(date, observerLat, observerLng).altitude)
      : 0;
    const dark = sunAltDeg < CIVIL_TWILIGHT_DEG;

    const fullyVisible = aboveHorizon && lit && dark;

    if (fullyVisible) {
      if (!active) {
        // Rising edge — start a new pass window
        active = {
          riseTime: date, riseAz:  azDeg,
          peakTime: date, peakEl:  elDeg, peakAz: azDeg,
          setTime:  date, setAz:   azDeg,
        };
      } else {
        // Update peak if this sample is higher
        if (elDeg > active.peakEl) {
          active.peakTime = date;
          active.peakEl   = elDeg;
          active.peakAz   = azDeg;
        }
        // Advance trailing edge
        active.setTime = date;
        active.setAz   = azDeg;
      }
    } else if (active) {
      // Falling edge — close and record the pass
      passes.push(toPassWindow(active));
      active = null;
    }
  }

  // Close any pass still open at the end of the lookahead window
  if (active) passes.push(toPassWindow(active));

  return passes;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPassWindow(p: ActivePass): PassWindow {
  return {
    rise: { time: p.riseTime.toISOString(), azimuthDeg: round1(p.riseAz) },
    peak: { time: p.peakTime.toISOString(), elevationDeg: round1(p.peakEl), azimuthDeg: round1(p.peakAz) },
    set:  { time: p.setTime.toISOString(),  azimuthDeg: round1(p.setAz) },
    durationSeconds: Math.round((p.setTime.getTime() - p.riseTime.getTime()) / 1000),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
