# Curtailment Page

## What it does

This page shows curtailment history for one plant.
It supports an initial visible batch and background loading of more records.

## How it works

1. Load plant context and the first curtailment batch together.
2. Append additional history in the background until exhausted.
3. Filter entries by requested-by party.
4. Format timestamps for list display.

## Core logic

- Uses a sequence id to ignore stale responses when the plant changes.
- Prevents duplicate history rows while background paging continues.
- Keeps the screen usable even if later history pages fail.
- Uses party-based filtering derived from the loaded history.

## APIs used

- `GET /api/plants/:plantId`
- `GET /api/curtailments?plant_id=<plantId>&limit=<n>&offset=<n>`

## Data handled

- Created timestamp
- Active power setpoint percentage
- Active power
- Irradiance
- Reason
- Requested-by party

