import { useState } from 'react';
import { API_URL } from '../config';
import type { PassWindow } from '../types';

// Format an ISO timestamp in the user's local timezone using the browser's
// built-in Intl API — no library needed, and it automatically uses the
// correct timezone name for their location.
function fmtLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month:      'short',
    day:        'numeric',
    hour:       '2-digit',
    minute:     '2-digit',
    second:     '2-digit',
    timeZoneName: 'short',
  });
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function PassPrediction() {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passes, setPasses] = useState<PassWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
        setGeoLoading(false);
      },
      () => {
        setError('Could not get your location. Enter coordinates manually.');
        setGeoLoading(false);
      },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      setError('Enter valid decimal coordinates.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pass-prediction`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ latitude, longitude }),
      });
      const data = await res.json() as { passes?: PassWindow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPasses(data.passes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pass-prediction">
      <h2>Next Visible Passes</h2>
      <p className="pass-hint">
        All three must hold simultaneously: ISS ≥10° above horizon, ISS in sunlight,
        your sky past civil twilight (sun &lt;−6°).
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <label>
            Latitude
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              placeholder="40.7128"
              value={lat}
              onChange={e => setLat(e.target.value)}
              required
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="-74.0060"
              value={lng}
              onChange={e => setLng(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="button-row">
          <button type="button" onClick={useMyLocation} disabled={geoLoading}>
            {geoLoading ? 'Getting location…' : '📍 Use my location'}
          </button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Predicting…' : 'Find passes'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      {passes !== null && (
        passes.length === 0
          ? <p className="no-passes">No visible passes in the next 48 hours.</p>
          : (
            <ul className="pass-list">
              {passes.map((p, i) => (
                <li key={i} className="pass-card">
                  <div className="pass-header">
                    <span className="pass-number">Pass {i + 1}</span>
                    <span className="peak-el">{p.peak.elevationDeg}° max</span>
                    <span className="duration">{fmtDuration(p.durationSeconds)}</span>
                  </div>
                  <table className="pass-table">
                    <tbody>
                      <tr>
                        <td>Rise</td>
                        <td>{fmtLocal(p.rise.time)}</td>
                        <td>{p.rise.azimuthDeg}° az</td>
                      </tr>
                      <tr>
                        <td>Peak</td>
                        <td>{fmtLocal(p.peak.time)}</td>
                        <td>{p.peak.azimuthDeg}° az</td>
                      </tr>
                      <tr>
                        <td>Set</td>
                        <td>{fmtLocal(p.set.time)}</td>
                        <td>{p.set.azimuthDeg}° az</td>
                      </tr>
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          )
      )}
    </div>
  );
}
