import Constants from "expo-constants";

function getEnvValue(value: string | undefined) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeBackendBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

export const BACKEND_BASE_URL =
  normalizeBackendBaseUrl(getEnvValue(process.env.EXPO_PUBLIC_BACKEND_URL)) ||
  normalizeBackendBaseUrl(getEnvValue(Constants.expoConfig?.extra?.backendUrl));

export const FORCE_PUSH_SYNC = (() => {
  const v = getEnvValue(process.env.EXPO_PUBLIC_FORCE_PUSH_SYNC) || getEnvValue(Constants.expoConfig?.extra?.forcePushSync);
  if (!v) return false;
  return v === '1' || v.toLowerCase() === 'true';
})();

export function getBackendUrl(path: string) {
  if (!BACKEND_BASE_URL) {
    throw new Error("Missing backend URL. Set EXPO_PUBLIC_BACKEND_URL or expo.extra.backendUrl.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, BACKEND_BASE_URL).toString();
}
