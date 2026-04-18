/**
 * Central API URL configuration.
 * In production (Vercel), set VITE_API_URL to the Render backend URL, e.g.:
 *   VITE_API_URL=https://trading-academy-backend.onrender.com
 * In local dev, VITE_API_URL is unset → falls back to localhost:8000.
 */
const API_BASE = import.meta.env.VITE_API_URL
  || `http://${window.location.hostname}:8000`

const WS_BASE = API_BASE
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://')

export { API_BASE, WS_BASE }
