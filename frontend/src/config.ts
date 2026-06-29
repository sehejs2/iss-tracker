// Set VITE_API_URL in .env for local dev; Railway/Vercel inject it at build time.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
