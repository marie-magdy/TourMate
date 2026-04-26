// constants/api.ts — single source of truth for API URL
// In development: set EXPO_PUBLIC_API_URL=192.168.x.x (your local IP)
// In production:  set EXPO_PUBLIC_API_URL=https://tourmate-backend-production.up.railway.app

const raw = process.env.EXPO_PUBLIC_API_URL ?? '';

// If it starts with http, use as-is. Otherwise assume local IP with port 3000.
export const API_BASE = raw.startsWith('http')
  ? `${raw}/api`
  : `http://${raw}:3000/api`;