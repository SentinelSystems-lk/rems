# Mobile App Integration

This document is the source of truth for turning the current web app into a native mobile app.
It is written for the mobile agent so the implementation can stay aligned with the existing backend contracts, theme system, and data flow.

## 1. Goal

Build a native mobile app that mirrors the current insightsPV experience without relying on the web app UI.

The native app should:

- authenticate with the same backend services
- load plant and telemetry data from the existing APIs
- use dark mode only
- keep data handling predictable and typed
- use native navigation and native state management

This app should not recreate the web app as a WebView-only shell.
The WebView path can remain as a fallback during migration, but the native app should own the UI and data flow.

## 2. Existing API Configuration

The current web app centralizes API config in `src/app/config/apiConfig.ts`.

### Base URLs

- `baseUrl`: main SCADA API base
- `cmmsBaseUrl`: CMMS base used for work orders and technician flows
- `wsUrl`: WebSocket endpoint for live dashboard updates
- `performanceUrl`: performance analytics API
- `timeoutMs`: shared request timeout

### Current defaults

- `baseUrl` -> `https://rems.sentinel.lk/api`
- `cmmsBaseUrl` -> `http://localhost:8080`
- `wsUrl` -> inferred from `baseUrl`, ending in `/ws`
- `performanceUrl` -> `https://performance.sentinel.lk/api`

### Environment variables to support in mobile

- `VITE_API_BASE_URL`
- `VITE_CMMS_BASE_URL`
- `VITE_WS_BASE_URL`
- `VITE_API_TIMEOUT_MS`

### Native rule

The mobile app must not assume internal backend origins are reachable directly.
Use the public HTTPS endpoints only.

## 3. Auth and Session Handling

The app currently uses two token layers:

### SCADA auth token

Stored in the web app as `auth_token`.

Used for the main SCADA API:

- plant list
- telemetry
- inverters
- alarms
- events

### CMMS auth token

Stored in the web app as `cmms_auth_token`.

Used for CMMS features:

- work orders
- purchase request
- maintenance schedule
- O&M

### Additional persisted values in the current web app

- `trust_token`
- `scada_user_id`
- `auth_logo_url`
- `auth_org_id`
- `last_plant_id`
- `insightspv:theme`

### Native storage guidance

For mobile, use secure storage for tokens and user identity.
Do not rely on plain local storage for auth secrets.

Recommended persistence split:

- Secure storage: `auth_token`, `cmms_auth_token`, `trust_token`
- Persistent app state: theme, last selected plant, last visited tab, onboarding flags
- Volatile cache only: dashboard snapshot, realtime telemetry, screen-level query results

### Token expiry and logout

The web app treats expired tokens as session-expired and forces logout.
The native app should do the same:

- detect expiry before requests
- clear local session state on `401`
- return user to login
- clear cached screen data tied to the session

## 4. Theme System

The current theme system is defined in `src/app/theme/ThemeProvider.tsx`.

### Theme values

- `dark`

The native app should be dark-mode only.
Do not implement a light theme toggle in the native app UI.

### Theme persistence

Theme is stored under:

- `insightspv:theme`

Recommended stored value:

- `dark`

### Native theme sync contract

When theme is applied, the app should:

- add or remove the `.dark` class on the root HTML element in the web version
- emit a `theme-change` event
- notify native bridges when running inside a WebView

For the native app, the equivalent behavior is:

- store `dark` in persistent preferences
- apply the dark theme to the app shell immediately
- forward the theme to any embedded WebView if one remains in use

### Theme bridge payload

The current WebView bridge sends:

```json
{
  "type": "theme",
  "scheme": "dark"
}
```

Native should listen for this payload if the WebView is still used during migration.

### Dark mode color tokens

Use these values from `src/styles/colors.css` for the native theme.

| Token | Value |
|---|---|
| `background` | `oklch(0.145 0 0)` |
| `foreground` | `oklch(0.985 0 0)` |
| `card` | `oklch(0.145 0 0)` |
| `card-foreground` | `oklch(0.985 0 0)` |
| `popover` | `oklch(0.145 0 0)` |
| `popover-foreground` | `oklch(0.985 0 0)` |
| `primary` | `oklch(0.985 0 0)` |
| `primary-foreground` | `oklch(0.205 0 0)` |
| `secondary` | `oklch(0.269 0 0)` |
| `secondary-foreground` | `oklch(0.985 0 0)` |
| `muted` | `oklch(0.269 0 0)` |
| `muted-foreground` | `oklch(0.708 0 0)` |
| `accent` | `oklch(0.269 0 0)` |
| `accent-foreground` | `oklch(0.985 0 0)` |
| `destructive` | `oklch(0.396 0.141 25.723)` |
| `destructive-foreground` | `oklch(0.637 0.237 25.331)` |
| `border` | `oklch(0.269 0 0)` |
| `input` | `oklch(0.269 0 0)` |
| `ring` | `oklch(0.439 0 0)` |
| `sidebar` | `oklch(0.205 0 0)` |
| `sidebar-foreground` | `oklch(0.985 0 0)` |
| `sidebar-primary` | `oklch(0.488 0.243 264.376)` |
| `sidebar-primary-foreground` | `oklch(0.985 0 0)` |
| `sidebar-accent` | `oklch(0.269 0 0)` |
| `sidebar-accent-foreground` | `oklch(0.985 0 0)` |
| `sidebar-border` | `oklch(0.269 0 0)` |
| `sidebar-ring` | `oklch(0.439 0 0)` |
| `sidebar-destructive` | `#F87171` |

## 4.1 Dark Mode Hex References

For native implementations that prefer hex values in code, these are the closest practical references for key surfaces and text:

| Token | Hex reference |
|---|---|
| `background` | `#252525` |
| `foreground` | `#FCFCFC` |
| `card` | `#252525` |
| `secondary` | `#444444` |
| `muted` | `#444444` |
| `muted-foreground` | `#B5B5B5` |
| `border` | `#444444` |
| `sidebar` | `#333333` |
| `sidebar-destructive` | `#F87171` |

## 5. App Sections and Screen Names

These are the current user-facing sections from the app router and layout:

### Authentication

- Login

### Main plant flow

- Map / Plant list
- Dashboard
- Inverters
- Inverter detail
- Curtailment
- Alarms
- Events

### Operations flow

- Work Orders
- Purchase Request
- Maintenance Schedule
- O&M

### Utility screens

- Settings

### Route map from the current web app

- `/login`
- `/map`
- `/dashboard/:plantId`
- `/inverters/:plantId`
- `/inverter/:plantId/:inverterId`
- `/curtailment/:plantId`
- `/alarms/:plantId`
- `/events/:plantId`
- `/work-orders`
- `/purchase-request`
- `/maintenance-schedule`
- `/om`
- `/settings`

### Navigation labels from the current UI

Primary navigation:

- Plant view
- Work Orders
- Purchase Request
- Maintenance Schedule
- O&M

Plant-context bottom tabs:

- home
- Curtailment
- Alarms
- O&M

## 6. Screen Data Contracts

This section tells the mobile agent what data each screen should load and how to interpret it.

### 6.1 Login

Use the existing auth endpoints used by the web app.

Requirements:

- authenticate the user
- store the SCADA token
- obtain the CMMS token if the user needs operations features
- fetch the current user profile if the backend provides it

### 6.2 Plant list / map

Primary endpoint:

`GET /api/plants`

Preferred for map and plant cards:

`GET /api/plants?stats=true`

Important fields:

- `id`
- `name`
- `latitude`
- `longitude`
- `capacity`
- `capacity_kw`
- `is_active`
- `device_count`
- `online_devices`
- `active_alarms`
- `last_event`
- `account_number`

Native behavior:

- render a plant list and/or map markers
- derive status from `is_active`
- keep coordinates in numeric form
- default missing metrics to zero or null instead of crashing

### 6.3 Dashboard

Primary endpoint:

`GET /api/telemetry/snapshot?plant_id=<plantId>`

Important totals:

- `total_active_power_kw`
- `total_reactive_power_kvar`
- `total_daily_active_energy_kwh`
- `avg_grid_frequency_hz`
- `avg_power_factor`
- `avg_ccu_temperature_c`

Also used:

- `GET /api/plants/{plantId}`
- `GET /api/plants/{plantId}/kpi`
- `GET /api/plants/{plantId}/curt-losses`
- performance API `GET /api/pr/latest`
- performance API `GET /api/pr/losses`

Native behavior:

- show cached snapshot immediately when available
- refresh from API in the background
- merge live WebSocket deltas into the current screen state
- treat API values as the source of truth and WebSocket updates as patches

### 6.4 Inverters

Endpoints:

- `GET /api/devices?plant_id=<plantId>`
- `GET /api/telemetry/snapshot?plant_id=<plantId>`
- `GET /api/telemetry/snapshot?plant_id=<plantId>&device_id=<inverterId>`
- `GET /api/data-points?device_id=<inverterId>&plant_id=<plantId>`
- `GET /api/telemetry/query?...`

Data model expectations:

- inverter status can be `online`, `offline`, or `fault`
- energy, power, frequency, and temperature values may come from either precomputed summary data or realtime values
- field names may vary, so normalization is required

Native behavior:

- normalize device names and IDs to strings
- treat missing telemetry as `0` or `null` based on the metric
- use one reusable transformer layer for inverter summary and detail screens

### 6.5 Curtailment

Endpoints:

- `GET /api/curtailments?plant_id=<plantId>`
- `GET /api/curtailments/daily-duration?plant_id=<plantId>`

Native behavior:

- load history with paging support
- show reason, requested-by party, setpoint percentage, active power, and irradiance
- preserve timestamps as ISO strings internally

### 6.6 Alarms

Endpoint:

`GET /api/alarms/active?plant_id=<plantId>`

Native behavior:

- display severity, category, message, device, and occurred time
- map raw severities into UI severity buckets
- keep acknowledged and resolved flags available for future actions

### 6.7 Events

Endpoint:

`GET /api/events?include_alarms=true&plant_id=<plantId>&limit=<n>&offset=<n>`

Native behavior:

- show event title, description, category, severity, source, status, tags, and timestamps
- keep alarm linkage available
- support pagination

### 6.8 Work Orders

CMMS endpoint surface is documented separately, but the mobile app should use the same token and patterns.

Primary endpoints:

- `POST /work-orders/search`
- `GET /work-orders/{id}`
- `GET /tasks/work-order/{id}`
- `GET /labors/work-order/{id}`
- `GET /part-quantities/work-order/{id}`
- `GET /additional-costs/work-order/{id}`
- `GET /relations/work-order/{id}`
- `GET /work-order-histories/work-order/{id}`
- `POST /comments/search/{workOrderId}`
- `GET /comments/count/{workOrderId}`

Action endpoints:

- `PATCH /work-orders/{id}/change-status`
- `POST /labors/work-order/{id}?start=true`
- `POST /labors/work-order/{id}?start=false`
- `PATCH /tasks/{taskId}`
- `PATCH /part-quantities/{id}`
- `POST /comments`
- `PATCH /comments/{id}`
- `DELETE /comments/{id}`

Native behavior:

- use the CMMS token only after it is available
- do not block the app shell while waiting for token bootstrap
- let the backend determine technician visibility
- treat labor timer state as a labor-entry state, not a separate timer endpoint

### 6.9 Purchase Request, Maintenance Schedule, O&M

These screens exist in the current navigation but need their own backend contracts verified before implementation if they are not already documented elsewhere.

Until those contracts are confirmed:

- keep the navigation placeholders
- do not invent payloads
- ask for or derive the exact backend endpoints before implementation

### 6.10 Settings

Current web settings are mostly static UI placeholders.

Native settings should eventually manage:

- theme
- language / region
- notifications
- help / support
- account and security

If no backend endpoint exists yet, keep these as local preferences or UI placeholders.

## 7. Data Handling Rules

These are the important implementation rules for the native agent.

### Normalize at the edge

The backend returns a mix of:

- camelCase
- snake_case
- nested `data` wrappers
- array or object variants

Normalize this in a dedicated data layer before passing values to UI components.

### Use typed view models

Do not render raw API payloads directly.

Create native equivalents of these models:

- Plant
- Inverter
- Inverter detail
- Curtailment entry
- Alarm
- Event
- Dashboard totals
- Work order summary/detail

### Preserve raw IDs and timestamps

Keep the original backend IDs and ISO timestamps in state.

Do not convert them into display strings until the render layer.

### Prefer partial updates

For live dashboard data:

- load a full snapshot first
- apply websocket patches next
- keep the latest known good values if a partial patch omits a field

### Handle missing data safely

Many endpoints can return partial content.

Recommended defaults:

- numbers -> `0` only when the UI expects a numeric total
- optional metrics -> `null`
- strings -> `''` only in view models, not in raw state
- arrays -> `[]`

## 8. Realtime Strategy

The current app uses a WebSocket stream for dashboard updates.

### WebSocket contract

The stream URL is derived from `wsUrl` and uses `plant_id` as a query parameter.

Subscribed channel message:

```json
{
  "type": "subscribe",
  "channel": "dashboard",
  "plantId": "<plantId>"
}
```

Unsubscribe message:

```json
{
  "type": "unsubscribe",
  "channel": "dashboard",
  "plantId": "<plantId>"
}
```

Supported event types:

- `dashboard.snapshot`
- `dashboard.delta`
- `inverter.update`
- `telemetry.totals.update`

Native behavior:

- reconnect with backoff
- treat socket updates as incremental patches
- fall back to polling if WebSocket is unavailable

## 9. WebView Bridge Contract

If the native app still embeds the web app during migration, support these messages.

### Theme message

```json
{
  "type": "theme",
  "scheme": "dark"
}
```

### CMMS token ready

```json
{
  "type": "CMMS_TOKEN_READY",
  "token": "<cmms-token>"
}
```

### Logout / reset

```json
{
  "type": "LOGOUT",
  "reason": "logout",
  "clearTrustToken": false,
  "clearLastVisitUrl": true,
  "loadInitialUrl": true
}
```

Native should handle these messages even if the native UI becomes the primary app.

## 10. Caching and Offline Rules

The current web app uses an in-memory dashboard cache.

Native should use a similar approach:

- cache current screen data in memory for fast back navigation
- persist only stable user preferences and auth tokens
- avoid long-lived stale telemetry caches
- clear session-scoped cache on logout

Recommended cache TTLs:

- plant list: short, refresh on app foreground
- dashboard snapshot: very short, seconds not minutes
- inverter detail: short, refresh on screen focus
- alarms and events: short, with pagination cache per plant

## 11. Implementation Order

To keep the mobile build manageable, implement in this order:

1. Auth and secure storage
2. Theme handling
3. Plant list / map
4. Dashboard snapshot and realtime updates
5. Inverter list and detail
6. Alarms and events
7. Curtailment
8. CMMS features
9. Settings and polish

## 12. Acceptance Criteria

The native app is ready for handoff when:

- the user can log in and stay logged in across app restarts
- theme is applied consistently in all screens
- plant list and plant dashboard load from real APIs
- dashboard updates respond to WebSocket patches
- inverter list and inverter detail use the normalized telemetry payloads
- alarms and events are readable and paginated
- CMMS token bootstrap works for work orders and technician flows
- logout clears tokens, caches, and navigation state

## 13. Source Files

These current web app files define the behavior this document is based on:

- [`src/app/config/apiConfig.ts`](../src/app/config/apiConfig.ts)
- [`src/app/services/apiClient.ts`](../src/app/services/apiClient.ts)
- [`src/app/services/pvApi.ts`](../src/app/services/pvApi.ts)
- [`src/app/theme/ThemeProvider.tsx`](../src/app/theme/ThemeProvider.tsx)
- [`src/app/routes.tsx`](../src/app/routes.tsx)
- [`src/app/types.ts`](../src/app/types.ts)
- [`src/app/services/auth.ts`](../src/app/services/auth.ts)
- [`src/app/services/cmmsAuth.ts`](../src/app/services/cmmsAuth.ts)
- [`src/app/hooks/usePlantDashboardStream.ts`](../src/app/hooks/usePlantDashboardStream.ts)

## 14. Notes For The Mobile Agent

- Treat this document as the contract, not the web UI implementation.
- If a screen or endpoint is not listed here, verify it before building against it.
- Do not copy web-only implementation details such as DOM class toggles unless they are part of the bridge contract.
- Prefer a clean native architecture with a separate API layer, theme store, and screen state store.
