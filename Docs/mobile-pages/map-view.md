# Map View Page

## What it does

This is the plant discovery screen.
It shows the plant list, basic plant health filtering, and quick navigation into plant dashboards.

## How it works

1. Load all plants from the stats-enabled plant list endpoint.
2. Normalize each plant into a local `PlantCard` model.
3. Fetch telemetry snapshots for each plant to enrich current power and today's energy.
4. Allow filtering by `all`, `active`, or `inactive`.
5. Open `/dashboard/:plantId` when a plant card is tapped.

## Core logic

- Derives status from `is_active` and/or backend `status`.
- Treats missing coordinates as absent rather than crashing the screen.
- Combines plant list data with telemetry snapshot data.
- Converts current active power from kW to MW for display.
- Uses availability and active alarms to label a plant as `Normal`, `Warning`, or `Critical`.

## APIs used

- `GET /api/plants?stats=true`
- `GET /api/telemetry/snapshot?plant_id=<plantId>` for each plant card

## Data handled

- Plant name and id
- Coordinates
- Capacity
- Current active power
- Today's energy
- Availability percent
- Active alarms
- City/site label when available

