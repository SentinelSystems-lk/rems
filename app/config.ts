import Constants from "expo-constants";

function getEnvValue(value: string | undefined) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeBackendBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

export const BACKEND_BASE_URL =
  normalizeBackendBaseUrl(getEnvValue(process.env.EXPO_PUBLIC_BACKEND_URL)) ||
  normalizeBackendBaseUrl(getEnvValue(process.env.VITE_API_BASE_URL)) ||
  normalizeBackendBaseUrl(getEnvValue(Constants.expoConfig?.extra?.backendUrl));

export const CMMS_BASE_URL =
  normalizeBackendBaseUrl(getEnvValue(process.env.EXPO_PUBLIC_CMMS_BASE_URL)) ||
  normalizeBackendBaseUrl(getEnvValue(process.env.VITE_CMMS_BASE_URL)) ||
  "";

export const WS_BASE_URL =
  normalizeBackendBaseUrl(getEnvValue(process.env.EXPO_PUBLIC_WS_BASE_URL)) ||
  normalizeBackendBaseUrl(getEnvValue(process.env.VITE_WS_BASE_URL)) ||
  "";

export const API_TIMEOUT_MS = (() => {
  const raw =
    getEnvValue(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) ||
    getEnvValue(process.env.VITE_API_TIMEOUT_MS) ||
    getEnvValue(Constants.expoConfig?.extra?.apiTimeoutMs ? String(Constants.expoConfig.extra.apiTimeoutMs) : "");

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
})();

export const FORCE_PUSH_SYNC = (() => {
  const v = getEnvValue(process.env.EXPO_PUBLIC_FORCE_PUSH_SYNC) || getEnvValue(Constants.expoConfig?.extra?.forcePushSync);
  if (!v) return false;
  return v === '1' || v.toLowerCase() === 'true';
})();

export function getBackendUrl(path: string) {
  if (!BACKEND_BASE_URL) {
    throw new Error("Missing backend URL. Set EXPO_PUBLIC_BACKEND_URL or expo.extra.backendUrl.");
  }

  // If `path` is already an absolute URL, return it as-is.
  if (/^https?:\/\//i.test(path)) return path;

  // Ensure base has no trailing slash and path has no leading slash, then join.
  const base = BACKEND_BASE_URL.replace(/\/+$/, "");
  let rel = path.startsWith("/") ? path.replace(/^\/+/, "") : path;

  // If the base already contains a path prefix (e.g. '/api') and the requested
  // path begins with the same prefix, strip the duplicate to avoid '/api/api/...'.
  try {
    const baseUrlObj = new URL(base);
    const basePath = (baseUrlObj.pathname || "").replace(/^\/+|\/+$/g, "");
    if (basePath) {
      if (rel === basePath) {
        rel = "";
      } else if (rel.startsWith(basePath + "/")) {
        rel = rel.slice(basePath.length + 1);
      }
    }
  } catch {
    // ignore and join normally
  }

  return rel ? `${base}/${rel}` : base;
}
