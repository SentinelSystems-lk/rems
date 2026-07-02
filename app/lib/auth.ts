import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { API_TIMEOUT_MS, BACKEND_BASE_URL } from "../config";

export const SESSION_KEYS = {
  authToken: "auth_token",
  cmmsAuthToken: "cmms_auth_token",
  trustToken: "trust_token",
  scadaUserId: "scada_user_id",
  authOrgId: "auth_org_id",
  authLogoUrl: "auth_logo_url",
  lastPlantId: "last_plant_id",
  theme: "insightspv:theme",
} as const;

export type LoginPayload = {
  username: string;
  password: string;
  trustToken?: string | null;
};

export type OtpPayload = {
  otp: string;
  verificationToken?: string | null;
  trustToken?: string | null;
  username?: string | null;
};

export type AuthSession = {
  authToken: string;
  cmmsAuthToken?: string;
  trustToken?: string;
  scadaUserId?: string;
  authOrgId?: string;
  authLogoUrl?: string;
};

export type LoginResult =
  | {
      kind: "success";
      session: AuthSession;
      raw: unknown;
    }
  | {
      kind: "challenge";
      tempToken: string;
      emailHint?: string;
      expiresIn?: number;
      message?: string;
      trustToken?: string;
      raw: unknown;
    };

type ResponsePayload = Record<string, unknown> | string | null;

async function readResponsePayload(response: Response): Promise<ResponsePayload> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => null)) as ResponsePayload;
  }

  const text = (await response.text().catch(() => "")).trim();
  if (!text) return null;

  try {
    return JSON.parse(text) as ResponsePayload;
  } catch {
    return text;
  }
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirstString(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const candidate = record[key];
    const direct = asTrimmedString(candidate);
    if (direct) return direct;
  }

  for (const value of Object.values(record)) {
    const nested = pickFirstString(value, keys);
    if (nested) return nested;
  }

  return "";
}

function pickBoolean(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    if (record[key] === true) return true;
  }

  for (const value of Object.values(record)) {
    if (pickBoolean(value, keys)) return true;
  }

  return false;
}

function normalizeLoginMessage(payload: unknown) {
  const message =
    pickFirstString(payload, ["message", "detail", "error", "description"]) ||
    "Please check your credentials and try again.";
  return message;
}

function extractSession(payload: unknown): AuthSession | null {
  const authToken =
    pickFirstString(payload, ["token", "auth_token", "authToken", "access_token", "accessToken", "jwt"]) ||
    "";

  if (!authToken) return null;

  return {
    authToken,
    cmmsAuthToken: pickFirstString(payload, ["cmms_auth_token", "cmmsAuthToken"]) || undefined,
    trustToken: pickFirstString(payload, ["trust_token", "trustToken"]) || undefined,
    scadaUserId: pickFirstString(payload, ["scada_user_id", "scadaUserId", "user_id", "userId"]) || undefined,
    authOrgId: pickFirstString(payload, ["auth_org_id", "authOrgId", "org_id", "orgId"]) || undefined,
    authLogoUrl: pickFirstString(payload, ["auth_logo_url", "authLogoUrl", "logo_url", "logoUrl"]) || undefined,
  };
}

function isChallenge(payload: unknown, status: number) {
  if (status === 202 || status === 409) return true;
  if (pickBoolean(payload, ["requires_otp", "otp_required", "two_factor_required", "challenge_required"])) return true;
  if (pickFirstString(payload, ["temp_token", "tempToken", "verification_token", "verificationToken", "challenge_token", "challengeToken"])) return true;
  return false;
}

async function requestJson(path: string, body: Record<string, unknown>, timeoutMs = API_TIMEOUT_MS) {
  if (!BACKEND_BASE_URL) {
    throw new Error("Missing API base URL. Set EXPO_PUBLIC_BACKEND_URL or VITE_API_BASE_URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await readResponsePayload(response);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

export async function loginWithPassword(payload: LoginPayload): Promise<LoginResult> {
  const body: Record<string, unknown> = {
    username: payload.username,
    password: payload.password,
  };

  if (payload.trustToken) {
    body.trust_token = payload.trustToken;
  }

  const { response, payload: responsePayload } = await requestJson("/auth/2fa/login", body);

  const session = extractSession(responsePayload);
  if (session) {
    return { kind: "success", session, raw: responsePayload };
  }

  if (isChallenge(responsePayload, response.status)) {
    const tempToken =
      pickFirstString(responsePayload, ["temp_token", "tempToken", "verification_token", "verificationToken", "challenge_token", "challengeToken"]) ||
      "";

    return {
      kind: "challenge",
      tempToken,
      emailHint: pickFirstString(responsePayload, ["email_hint", "emailHint"]) || undefined,
      expiresIn: Number(pickFirstString(responsePayload, ["expires_in", "expiresIn"])) || undefined,
      trustToken: pickFirstString(responsePayload, ["trust_token", "trustToken"]) || undefined,
      message: normalizeLoginMessage(responsePayload),
      raw: responsePayload,
    };
  }

  const message = normalizeLoginMessage(responsePayload);
  throw new Error(message);
}

export async function verifyOtp(payload: OtpPayload): Promise<LoginResult> {
  const body: Record<string, unknown> = {
    otp: payload.otp,
  };

  if (payload.verificationToken) body.temp_token = payload.verificationToken;
  if (payload.trustToken) body.trust_token = payload.trustToken;

  const { response, payload: responsePayload } = await requestJson("/auth/2fa/verify-otp", body);
  const session = extractSession(responsePayload);

  if (session) {
    return { kind: "success", session, raw: responsePayload };
  }

  if (isChallenge(responsePayload, response.status)) {
    const tempToken =
      pickFirstString(responsePayload, ["temp_token", "tempToken", "verification_token", "verificationToken", "challenge_token", "challengeToken"]) ||
      payload.verificationToken ||
      "";

    return {
      kind: "challenge",
      tempToken,
      emailHint: pickFirstString(responsePayload, ["email_hint", "emailHint"]) || undefined,
      expiresIn: Number(pickFirstString(responsePayload, ["expires_in", "expiresIn"])) || undefined,
      trustToken: pickFirstString(responsePayload, ["trust_token", "trustToken"]) || payload.trustToken || undefined,
      message: normalizeLoginMessage(responsePayload),
      raw: responsePayload,
    };
  }

  throw new Error(normalizeLoginMessage(responsePayload));
}

export async function resendOtp(payload: { verificationToken?: string | null; username?: string | null }) {
  const body: Record<string, unknown> = {};
  if (payload.verificationToken) body.temp_token = payload.verificationToken;

  const { response, payload: responsePayload } = await requestJson("/auth/2fa/resend-otp", body);
  if (!response.ok) {
    throw new Error(normalizeLoginMessage(responsePayload));
  }

  return responsePayload;
}

export async function saveSession(session: AuthSession) {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEYS.authToken),
    SecureStore.deleteItemAsync(SESSION_KEYS.cmmsAuthToken),
    SecureStore.deleteItemAsync(SESSION_KEYS.trustToken),
    SecureStore.deleteItemAsync(SESSION_KEYS.scadaUserId),
    SecureStore.deleteItemAsync(SESSION_KEYS.authOrgId),
    SecureStore.deleteItemAsync(SESSION_KEYS.authLogoUrl),
  ]);

  await SecureStore.setItemAsync(SESSION_KEYS.authToken, session.authToken);
  await AsyncStorage.setItem(SESSION_KEYS.theme, "dark");

  if (session.cmmsAuthToken) {
    await SecureStore.setItemAsync(SESSION_KEYS.cmmsAuthToken, session.cmmsAuthToken);
  }

  if (session.trustToken) {
    await SecureStore.setItemAsync(SESSION_KEYS.trustToken, session.trustToken);
  }

  if (session.scadaUserId) {
    await SecureStore.setItemAsync(SESSION_KEYS.scadaUserId, session.scadaUserId);
  }

  if (session.authOrgId) {
    await SecureStore.setItemAsync(SESSION_KEYS.authOrgId, session.authOrgId);
  }

  if (session.authLogoUrl) {
    await SecureStore.setItemAsync(SESSION_KEYS.authLogoUrl, session.authLogoUrl);
  }
}

export async function loadSession(): Promise<AuthSession | null> {
  const [authToken, cmmsAuthToken, trustToken, scadaUserId, authOrgId, authLogoUrl] = await Promise.all([
    SecureStore.getItemAsync(SESSION_KEYS.authToken),
    SecureStore.getItemAsync(SESSION_KEYS.cmmsAuthToken),
    SecureStore.getItemAsync(SESSION_KEYS.trustToken),
    SecureStore.getItemAsync(SESSION_KEYS.scadaUserId),
    SecureStore.getItemAsync(SESSION_KEYS.authOrgId),
    SecureStore.getItemAsync(SESSION_KEYS.authLogoUrl),
  ]);

  if (!authToken) return null;

  return {
    authToken,
    cmmsAuthToken: cmmsAuthToken || undefined,
    trustToken: trustToken || undefined,
    scadaUserId: scadaUserId || undefined,
    authOrgId: authOrgId || undefined,
    authLogoUrl: authLogoUrl || undefined,
  };
}

export async function getStoredTrustToken() {
  return SecureStore.getItemAsync(SESSION_KEYS.trustToken);
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEYS.authToken),
    SecureStore.deleteItemAsync(SESSION_KEYS.cmmsAuthToken),
    SecureStore.deleteItemAsync(SESSION_KEYS.trustToken),
    SecureStore.deleteItemAsync(SESSION_KEYS.scadaUserId),
    SecureStore.deleteItemAsync(SESSION_KEYS.authOrgId),
    SecureStore.deleteItemAsync(SESSION_KEYS.authLogoUrl),
    AsyncStorage.removeItem(SESSION_KEYS.lastPlantId),
  ]);
}
