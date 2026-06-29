import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';

// Vite rewrites asset URLs; Leaflet's default icon uses _getIconUrl internally
// which bypasses Vite and produces 404s.  Merge explicit URLs to fix this.
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'];
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

import type { ISSPosition } from '../types';

const issIcon = L.divIcon({
  html: '<span style="font-size:22px;line-height:1;display:block;">🛸</span>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

// Split the trail at antimeridian crossings (longitude jumps > 180°) so
// Leaflet doesn't draw a horizontal line across the entire map.
function splitAtAntimeridian(positions: ISSPosition[]): [number, number][][] {
  if (positions.length === 0) return [];
  const segments: [number, number][][] = [];
  let seg: [number, number][] = [[positions[0].latitude, positions[0].longitude]];
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs(positions[i].longitude - positions[i - 1].longitude) > 180) {
      segments.push(seg);
      seg = [];
    }
    seg.push([positions[i].latitude, positions[i].longitude]);
  }
  if (seg.length) segments.push(seg);
  return segments;
}

interface Props {
  position: ISSPosition | null;
  trail: ISSPosition[];
  connected: boolean;
}

export function ISSMap({ position, trail, connected }: Props) {
  const segments = splitAtAntimeridian(trail);

  return (
    <div className="map-wrapper">
      <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● live' : '○ connecting…'}
      </div>
      <MapContainer
        center={[0, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={2}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          noWrap
        />
        {segments.map((seg, i) => (
          <Polyline
            key={i}
            positions={seg}
            color="#4fc3f7"
            weight={2}
            opacity={0.65}
          />
        ))}
        {position && (
          <Marker position={[position.latitude, position.longitude]} icon={issIcon}>
            <Popup>
              <strong>ISS</strong><br />
              {position.latitude.toFixed(3)}°, {position.longitude.toFixed(3)}°<br />
              <small>{new Date(position.recorded_at).toLocaleTimeString()}</small>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
