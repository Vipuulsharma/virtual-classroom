/**
 * Unified API & Socket Server Configuration
 * Automatically switches between local development and production (Render/Netlify)
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
  : "http://localhost:5000";

export const SOCKET_SERVER_URL = API_BASE_URL;
