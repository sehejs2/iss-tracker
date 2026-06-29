export interface ISSPosition {
  latitude: number;
  longitude: number;
  recorded_at: string;
}

export interface PassWindow {
  rise: { time: string; azimuthDeg: number };
  peak: { time: string; elevationDeg: number; azimuthDeg: number };
  set:  { time: string; azimuthDeg: number };
  durationSeconds: number;
}
