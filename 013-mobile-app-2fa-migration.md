# Mobile App — 2FA Login Migration Guide

## Overview

The backend now requires email OTP 2FA for all frontend logins. The new login flow is at `/api/auth/2fa/*` and supports a **trusted-device** feature: after one successful OTP verification, the device can skip OTP for 7 days.

---

## API Endpoints

### `POST /api/auth/2fa/login` — Step 1: Submit credentials

**Request:**
```json
{
  "username": "string",
  "password": "string",
  "trust_token": "string | null"   // optional — send stored trust token if you have one
}
```

**Response (OTP required):**
```json
{
  "requires_otp": true,
  "temp_token": "string (JWT, 15min expiry)",
  "email_hint": "j***n@example.com",
  "expires_in": 300
}
```

**Response (trust token accepted — skip OTP):**
```json
{
  "requires_otp": false,
  "token": "string (session JWT, 24h expiry)",
  "trust_token": "string (JWT, 7d expiry — save this for next login)",
  "user": { ... },
  "organization": { ... }
}
```

**Error responses:**
| Status | Meaning |
|---|---|
| 400 | Missing username/password, or user has no email on file |
| 401 | Invalid credentials |
| 403 | CEB API users cannot use this endpoint |
| 502 | Failed to send OTP email |

---

### `POST /api/auth/2fa/verify-otp` — Step 2: Verify OTP

**Request:**
```json
{
  "temp_token": "string (from step 1)",
  "otp": "string (6 digits)"
}
```

**Response (success):**
```json
{
  "token": "string (session JWT, 24h expiry)",
  "trust_token": "string (JWT, 7d expiry — save this!)",
  "user": { ... },
  "organization": { ... }
}
```

**Error responses:**
| Status | Meaning |
|---|---|
| 400 | Missing temp_token or otp |
| 401 | Invalid or expired temp_token |
| 410 | OTP expired or already used → user must restart from step 1 |
| 429 | Too many failed attempts → user must restart from step 1 |

---

### `POST /api/auth/2fa/resend-otp` — Resend OTP

**Request:**
```json
{
  "temp_token": "string (from step 1)"
}
```

**Response:**
```json
{
  "message": "OTP resent successfully",
  "email_hint": "j***n@example.com",
  "expires_in": 300
}
```

**Error responses:**
| Status | Meaning |
|---|---|
| 401 | Invalid or expired temp_token |
| 429 | Resend limit reached (max 3 per window) |

---

## Mobile Login Flow

### Initial login (no trust token)

```
   ┌─────────────────────────────────────────────────────┐
   │  1. POST /api/auth/2fa/login                        │
   │     { username, password }                          │
   │     → { requires_otp: true, temp_token, email_hint }│
   └──────────────┬──────────────────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────────────────┐
   │ 2. Show email hint to user                          │
   │    User enters 6-digit OTP from email                │
   └──────────────┬───────────────────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────────────────┐
   │ 3. POST /api/auth/2fa/verify-otp                    │
   │     { temp_token, otp }                              │
   │     → { token, trust_token, user, organization }      │
   └──────────────┬──────────────────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────────────────┐
   │ 4. Save trust_token to secure storage               │
   │    Save session JWT to secure storage               │
   │    Navigate to dashboard                            │
   └──────────────────────────────────────────────────────┘
```

### Subsequent login (trust token exists)

```
   ┌──────────────────────────────────────────────────────┐
   │ 1. Load trust_token from secure storage              │
   │    POST /api/auth/2fa/login                          │
   │     { username, password, trust_token }              │
   └──────────────┬───────────────────────────────────────┘
                  │
          ┌───────┴───────┐
          ▼                ▼
   ┌──────────────┐ ┌──────────────────────────────┐
   │ requires_otp │ │ requires_otp: true           │
   │ : false      │ │ → OTP flow as above          │
   │ Skip OTP! 🎉 │ │                              │
   │              │ │ (trust token expired or      │
   │ → Save new   │ │  invalid — treat as          │
   │   trust_token│ │  initial login)              │
   │ → Navigate   │ └──────────────────────────────┘
   │   to dashboard│
   └──────────────┘
```

### Key implementation notes

**1. Distinguish between OTP response and direct login response**

The same endpoint (`POST /api/auth/2fa/login`) can return two different shapes. Check `requires_otp`:

```typescript
// TypeScript types
interface TwoFAInitiateResponse {
  requires_otp: true;
  temp_token: string;
  email_hint: string;
  expires_in: number;
}

interface TwoFALoginResponse {
  requires_otp: false;
  token: string;
  trust_token: string;
  user: User;
  organization?: Organization;
}
```

**2. Save trust_token securely**

After a successful OTP verify OR a successful trust-token login, the response will include a `trust_token`. Store it in secure persistent storage (e.g., `expo-secure-store`, `react-native-keychain`, or `flutter_secure_storage`). Do NOT use plain AsyncSharedPreferences.

**3. Rolling window**

Each successful login (even via trust token) returns a **fresh** `trust_token` with a new 7-day expiry. Always replace the stored token with the new one.

**4. Trust token expiry**

If the user has not logged in for 7+ days, the stored trust token will be rejected by the server (the backend uses `jwt.verify` which will throw). In this case, the backend falls through to the OTP flow. The app should handle `requires_otp: true` gracefully — show the OTP input UI.

---

## Error handling

| Scenario | How to handle |
|---|---|
| Wrong OTP (401) | Show remaining attempts error. Clear OTP input, let user retry. Do NOT clear trust token. |
| OTP expired (410) | Clear OTP input, restart from step 1. Clear trust token (user needs full re-login). |
| Too many attempts (429) | Clear trust token. Restart from step 1. |
| Network error | Show retry button. Do not clear trust token. |
| Invalid credentials (401) | Show "Invalid credentials" message. Do not clear trust token. |
| User has no email (400) | "No email on file" — user must contact admin. |

---

## TypeScript types (copy into your Vite project)

```typescript
// auth.types.ts

export interface User {
  id: number;
  organization_id: number;
  username: string;
  full_name?: string;
  email?: string;
  role_id: number;
  role_name?: string;
  is_active: boolean;
}

export interface Organization {
  id: number;
  name: string;
  subdomain: string;
  logo_url?: string;
  subscription_tier: string;
  features: Record<string, any>;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  organization?: Organization;
  trust_token?: string;
  requires_otp?: boolean;
}

export interface TwoFAInitiateResponse {
  requires_otp: true;
  temp_token: string;
  email_hint: string;
  expires_in: number;
}

export interface TwoFAResendResponse {
  message: string;
  email_hint: string;
  expires_in: number;
}
```

---

## Example: login function pseudocode

```typescript
async function login(
  username: string,
  password: string,
): Promise<void> {
  const trustToken = await loadTrustToken(); // from secure storage

  // Step 1: attempt login with optional trust token
  const res = await fetch(`${API_URL}/auth/2fa/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      ...(trustToken && { trust_token: trustToken }),
    }),
  });

  const data = await res.json();

  if (data.requires_otp === false) {
    // ✅ Direct login — trust token accepted
    await saveTrustToken(data.trust_token); // fresh token
    await saveSessionToken(data.token);
    navigateToDashboard();
    return;
  }

  // OTP required — show OTP input UI
  // data = { requires_otp: true, temp_token, email_hint, expires_in }
  showOtpScreen(data.email_hint);

  // When user enters OTP:
  const otpRes = await fetch(`${API_URL}/auth/2fa/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      temp_token: data.temp_token,
      otp: userEnteredOtp,
    }),
  });

  const otpData = await otpRes.json();

  if (otpRes.ok) {
    await saveTrustToken(otpData.trust_token);
    await saveSessionToken(otpData.token);
    navigateToDashboard();
  } else {
    // Handle specific error cases
    handleOtpError(otpRes.status, otpData);
  }
}
```

---

## Migration checklist for the mobile developer

- [ ] Replace all calls to `POST /api/auth/login` with the new `POST /api/auth/2fa/login` flow
- [ ] Implement the 2-step OTP UI (step 1: credentials, step 2: OTP input)
- [ ] Store `trust_token` in secure storage (not plain SharedPreferences)
- [ ] Send stored `trust_token` with every login attempt
- [ ] Replace stored `trust_token` with the fresh one from every successful response
- [ ] On OTP-expired (410) or rate-limited (429) errors, clear the stored `trust_token`
- [ ] On logout, clear both the session JWT and the `trust_token` (clearing the trust token forces OTP on next login — this matches web behavior)
- [ ] Test: login with OTP → close app → reopen → login with password only (no OTP)
- [ ] Test: login with OTP → wait 7+ days → login should require OTP again
- [ ] Test: wrong OTP 3 times → remaining attempts shown correctly
- [ ] Test: resend OTP → new OTP received, previous one invalidated
