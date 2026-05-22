# Push Token Registration Endpoint

## Overview

Registers a mobile device's Expo push token with the backend so the server can send push notifications to that device. Subsequent calls with the same token update the record (idempotent).

---

## Endpoint

```
POST /api/push-tokens
```

---

## Authentication

Requires a valid JWT in the `Authorization` header.

```http
Authorization: Bearer <jwt>
```

The user identity is resolved from the token — no `user_id` is needed in the request body.

---

## Request

### Headers

| Header          | Value                |
|-----------------|----------------------|
| `Content-Type`  | `application/json`   |
| `Authorization` | `Bearer <jwt>`       |

### Body

```json
{
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "android",
  "mode": "monitoring"
}
```

### Fields

| Field           | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `expoPushToken` | string | Yes      | Expo push token from `expo-notifications`. Must match the pattern `ExponentPushToken[...]`. |
| `platform`      | string | No       | Mobile platform: `ios` or `android`. |
| `mode`          | string | No       | Current app mode, e.g. `monitoring` or `maintainance`. |

### Validation

- `expoPushToken` must be present and match `/^ExponentPushToken\[.+\]$/`. Any other value returns `400`.

---

## Response

### 201 Created — first-time registration

```json
{
  "ok": true,
  "message": "Push token saved"
}
```

### 200 OK — token already exists, record updated

```json
{
  "ok": true,
  "message": "Push token saved"
}
```

### 400 Bad Request — invalid token format

```json
{
  "ok": false,
  "message": "Invalid expoPushToken format. Expected ExponentPushToken[...]"
}
```

### 401 Unauthorized — missing or invalid JWT

```json
{
  "ok": false,
  "message": "Unauthorized"
}
```

### 500 Internal Server Error

```json
{
  "ok": false,
  "message": "Failed to save push token"
}
```

---

## Behaviour

1. JWT is verified by `authMiddleware` before the handler runs.
2. `user_id` is extracted from `req.user.sub` (the JWT subject).
3. The record is upserted in `push_tokens` using `ON CONFLICT (expo_push_token) DO UPDATE`. This means:
   - If the token is new → `201 Created`.
   - If the token already exists (same device re-registering) → `200 OK`, `user_id`, `platform`, and `mode` are updated.
4. One user can have multiple tokens (multiple devices).
5. One token can only belong to one user at a time. If the same physical device logs in as a different user, the token's `user_id` is updated on the next registration call.

---

## Database

Stored in the `push_tokens` table:

```sql
CREATE TABLE push_tokens (
  id              bigserial    PRIMARY KEY,
  user_id         bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token text         NOT NULL,
  platform        text,
  mode            text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_expo_token_unique UNIQUE (expo_push_token)
);
```

Tokens are automatically deleted when the associated user is deleted (`ON DELETE CASCADE`).

---

## Example

```bash
curl -X POST https://your-domain.com/api/push-tokens \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -d '{
    "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "platform": "android",
    "mode": "monitoring"
  }'
```

---

## Related Endpoints

| Method   | Path               | Description                          |
|----------|--------------------|--------------------------------------|
| `POST`   | `/api/push-tokens` | Register or update a push token      |
| `DELETE` | `/api/push-tokens` | Remove a push token (logout cleanup) |
