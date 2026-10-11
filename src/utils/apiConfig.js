/**
 * Unified API & Socket Server Configuration
 * Automatically switches between configured backend URL, custom stored URL, and local/resilient fallback.
 */

const getInitialApiUrl = () => {
  // 1. Check custom user-defined backend URL (from Settings/Storage)
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("vc_custom_backend_url");
    if (custom && custom.trim().startsWith("http")) {
      return custom.trim().replace(/\/+$/, "");
    }
  }

  // 2. Check build-time Vite environment variable
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim().startsWith("http")) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, "");
  }

  // 3. If running on localhost in browser, default to local server port 5000
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:5000";
  }

  // 4. In remote/production (e.g. Netlify), if no VITE_API_URL is set, return empty string so it doesn't force a broken localhost call
  return "";
};

export const API_BASE_URL = getInitialApiUrl();

export const setCustomBackendUrl = (url) => {
  if (typeof window !== "undefined") {
    if (!url) {
      localStorage.removeItem("vc_custom_backend_url");
    } else {
      localStorage.setItem("vc_custom_backend_url", url.trim().replace(/\/+$/, ""));
    }
    window.location.reload();
  }
};

export const getCustomBackendUrl = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("vc_custom_backend_url") || "";
  }
  return "";
};

export const SOCKET_SERVER_URL =
  API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:5000");
