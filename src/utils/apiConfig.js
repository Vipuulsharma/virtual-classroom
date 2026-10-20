/**
 * Unified API & Socket Server Configuration
 * Automatically switches between configured backend URL, custom stored URL, and local/resilient fallback.
 */

// Default Render backend fallback when deployed
export const DEFAULT_RENDER_BACKEND = "https://virtual-classroom-rdq2.onrender.com";

export const getApiBaseUrl = () => {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0");

  // 1. Check custom user-defined backend URL (from Settings/Storage)
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("vc_custom_backend_url");
    if (custom && custom.trim().startsWith("http")) {
      const cleanCustom = custom.trim().replace(/\/+$/, "");
      // If running on localhost and stored custom URL is the un-deployed default Render placeholder, ignore it
      if (!(isLocalhost && cleanCustom === DEFAULT_RENDER_BACKEND)) {
        return cleanCustom;
      }
    }
  }

  // 2. If running locally in browser (localhost / 127.0.0.1), default to local server port 5000
  if (isLocalhost) {
    return "http://localhost:5000";
  }

  // 3. Check build-time Vite environment variable  
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim().startsWith("http")) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, "");
  }

  // 4. In remote/production (e.g. Netlify), fallback to default Render backend URL
  return DEFAULT_RENDER_BACKEND;
};

export const API_BASE_URL = getApiBaseUrl();

export const getSocketServerUrl = () => {
  const url = getApiBaseUrl();
  if (url) return url;

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0")
  ) {
    return "http://localhost:5000";
  }

  // Never return Netlify origin as it does not host WebSockets
  return DEFAULT_RENDER_BACKEND;
};

export const SOCKET_SERVER_URL = getSocketServerUrl();

export const setCustomBackendUrl = (url) => {
  if (typeof window !== "undefined") {
    if (!url || !url.trim()) {
      localStorage.removeItem("vc_custom_backend_url");
    } else {
      localStorage.setItem("vc_custom_backend_url", url.trim().replace(/\/+$/, ""));
    }
    window.dispatchEvent(new Event("vc_backend_url_changed"));
  }
};

export const getCustomBackendUrl = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("vc_custom_backend_url") || "";
  }
  return "";
};

/**
 * Checks if a backend server is alive and responding
 */
export const checkBackendHealth = async (urlToCheck) => {
  const target = (urlToCheck || getApiBaseUrl() || "").replace(/\/+$/, "");
  if (!target) return { online: false, error: "No backend URL configured" };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const start = Date.now();

    const response = await fetch(`${target}/`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - start;
    if (response.ok) {
      return { online: true, latency, url: target };
    }
    return { online: false, error: `HTTP ${response.status}`, latency, url: target };
  } catch (err) {
    let errorMsg = err.name === "AbortError" ? "Timed out (Server may be sleeping)" : err.message;
    if (target.includes("localhost") || target.includes("127.0.0.1")) {
      errorMsg += " — Please ensure the local backend server is running ('npm run server') on port 5000";
    } else if (target.includes("onrender.com")) {
      errorMsg += " — If hosted on Render, ensure the Web Service is deployed and active (Render cold start takes ~50s)";
    }
    return { online: false, error: errorMsg, url: target };
  }
};
