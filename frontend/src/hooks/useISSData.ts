import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../config';
import type { ISSPosition } from '../types';

const TRAIL_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function useISSData() {
  const [position, setPosition] = useState<ISSPosition | null>(null);
  const [trail, setTrail] = useState<ISSPosition[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Seed the current position immediately so there's no empty-map flash
    // while waiting for the first WebSocket event.
    fetch(`${API_URL}/api/position`)
      .then(r => r.json())
      .then(({ position: pos }: { position: ISSPosition }) => {
        if (pos) setPosition(pos);
      })
      .catch(() => { /* non-fatal — WebSocket will provide updates */ });

    // Seed the orbit trail with the last 30 minutes of history.
    const since = new Date(Date.now() - TRAIL_DURATION_MS).toISOString();
    fetch(`${API_URL}/api/position-history?since=${encodeURIComponent(since)}`)
      .then(r => r.json())
      .then(({ positions }: { positions: ISSPosition[] }) => {
        if (Array.isArray(positions)) setTrail(positions);
      })
      .catch(() => {});

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('iss:position', (pos: ISSPosition) => {
      setPosition(pos);
      setTrail(prev => {
        // Prune positions older than 30 minutes, then append the new one.
        const cutoff = new Date(Date.now() - TRAIL_DURATION_MS).toISOString();
        return [...prev.filter(p => p.recorded_at >= cutoff), pos];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { position, trail, connected };
}
