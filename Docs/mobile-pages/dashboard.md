# Dashboard Page

## What it does

This is the main plant telemetry page.
It combines plant metadata, live totals, KPI metrics, curtailment context, PR data, losses, and realtime stream updates.

## How it works

1. Load plant metadata and telemetry snapshot in parallel.
2. Load extra performance and curtailment metrics.
3. Merge websocket patches into the current state.
4. Cache the latest dashboard snapshot for fast return navigation.
5. Keep refreshing live data while the page is active.

## Core logic

- Uses the snapshot endpoint as the primary source for totals.
- Uses websocket messages only as incremental patches.
- Uses a local dashboard cache to avoid reloading the same plant repeatedly.
- Collects realtime telemetry fields from the snapshot device payload.
- Preserves the last known valid values when a partial patch omits data.

## APIs used

- `GET /api/plants/:plantId`
- `GET /api/telemetry/snapshot?plant_id=<plantId>`
- `GET /api/plants/:plantId/kpi`
- `GET /api/curtailments/daily-duration?plant_id=<plantId>`
- `GET https://performance.sentinel.lk/api/pr/latest`
- `GET https://performance.sentinel.lk/api/pr/losses`
- `GET /api/plants/:plantId/curt-losses`
- WebSocket stream at `wsUrl?plant_id=<plantId>`

## Data handled

- Plant metadata
- Telemetry totals
- KPI payload
- PR percentage
- Curtailment duration
- Loss summaries
- Realtime device telemetry

