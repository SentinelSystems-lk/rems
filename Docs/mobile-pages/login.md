# Login Page

## What it does

This is the authentication entry point.
It handles username/password login, optional 2FA, trust-token reuse, and post-login bootstrap.

## How it works

1. User enters username and password.
2. App calls the 2FA login endpoint.
3. If the backend returns a 2FA challenge, the page switches to OTP entry.
4. If login succeeds immediately, the app stores the tokens and routes to `/map`.
5. After login, the app starts CMMS token bootstrap in the background.

## Core logic

- Uses a trust token when present to reduce repeated 2FA prompts.
- Stores SCADA auth data after login.
- Decodes the login JWT payload only to extract a stable user id fallback.
- Resets OTP state on invalid or expired challenge responses.
- Supports paste, auto-advance, and resend cooldown for OTP entry.

## APIs used

- `POST /auth/2fa/login`
- `POST /auth/2fa/verify-otp`
- `POST /auth/2fa/resend-otp`
- Post-login storage via `completeLogin(...)`

## Data handled

- `auth_token`
- `trust_token`
- `scada_user_id`
- `auth_org_id`
- `auth_logo_url`
- CMMS token bootstrap trigger

