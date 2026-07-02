# Alarms Page

## What it does

This page shows active alarms for a plant.
It also renders counters for total, critical, and acknowledged alarms.

## How it works

1. Load plant context and active alarms together.
2. Sort alarms newest first.
3. Derive counts and alarm status labels.
4. Show a scroll-to-top control when the list is long.

## Core logic

- Alarm severity is mapped into `critical` or `warning`.
- Alarm status is derived from `resolved` and `acknowledged`.
- The screen supports empty and error states.
- The list is scroll-parent aware so it works inside nested layout containers.

## APIs used

- `GET /api/plants/:plantId`
- `GET /api/alarms/active?plant_id=<plantId>`

## Data handled

- Device id and device name
- Severity
- Raw severity
- Category
- Message
- Occurred timestamp
- Acknowledged and resolved flags

