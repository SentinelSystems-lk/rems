# Inverter Detail Page

## What it does

This is the deep inverter telemetry screen.
It shows electrical data, temperature data, chart data, and bridge state details.

## How it works

1. Load inverter snapshot detail and power trend data.
2. Refresh while the page is visible.
3. Show tabbed content for different groups of inverter telemetry.
4. Allow navigation back to the inverter list.

## Core logic

- Polls every 10 seconds while visible.
- Stops polling work when the screen is unmounted.
- Uses one data model for both summary and detail values.
- Normalizes many field-name variants from telemetry into a stable view model.
- Uses status-specific styling for online, generating, fault, idle, and offline states.

## APIs used

- `GET /api/telemetry/snapshot?plant_id=<plantId>&device_id=<inverterId>`
- `GET /api/data-points?device_id=<inverterId>&plant_id=<plantId>`
- `GET /api/telemetry/query?...`

## Data handled

- Current inverter state
- Electrical measurements
- Temperature measurements
- Power trend points
- Digital input and output labels
- Bridge state labels

