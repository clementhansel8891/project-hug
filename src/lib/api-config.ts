/**
 * Centralized API Configuration
 *
 * In development, we use the Vite proxy (/api) to avoid CORS issues.
 * In production (Render), we use the VITE_API_URL environment variable.
 */

const getApiBaseUrl = () => {
  // Check for the environment variable defined in Render/Vite/Railway
  // Standardizing on VITE_API_URL, but keeping VITE_API_BASE_URL for compatibility
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL) as string;

  if (envUrl && envUrl !== "") {
    // 🛡️ LEGACY CIRCUIT BREAKER
    // If the URL contains the legacy railway string, it's likely a misconfiguration in the hosting control panel
    if (envUrl.includes("estelagea.up.railway.app")) {
      console.warn(
        "%c[api-config] ⚠️ LEGACY URL DETECTED",
        "background: #ef4444; color: white; padding: 2px 4px; border-radius: 4px;",
        "'estelagea.up.railway.app' is no longer in use. Please update your Vercel Project Environment Variables (VITE_API_URL) to point to your new backend or leave it empty for relative pathing."
      );
      
      // Force fallback to relative path in production to avoid CORS errors with the dead railway backend
      if (import.meta.env.PROD) {
        return "/api";
      }
    }

    const sanitizedUrl = envUrl.replace(/\/$/, "");
    console.log(
      "%c[api-config] 🚀 API ROUTING ACTIVE",
      "background: #10b981; color: white; padding: 2px 4px; border-radius: 4px;",
      sanitizedUrl,
    );
    return sanitizedUrl;
  }

  // fallback to local proxy path
  if (import.meta.env.PROD) {
    console.log(
      "%c[api-config] 🚀 API ROUTING ACTIVE (RELATIVE)",
      "background: #10b981; color: white; padding: 2px 4px; border-radius: 4px;",
      "/api"
    );
  }
  return "/api";
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Helper to build full API URLs
 * @param path The endpoint path (e.g., "/auth/login")
 */
export const apiUrl = (path: string) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};
