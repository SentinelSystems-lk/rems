# Inverter Details List Page

## What it does

This page lists all inverters for a selected plant.
It is a parent screen that leads into the single-inverter detail view.

## How it works

1. Load the plant record.
2. Load inverter list for the plant.
3. Render each inverter as a summary card.
4. Navigate to `/inverter/:plantId/:inverterId` on tap.

## Core logic

- Combines plant context and inverter summary data.
- Shows active power, reactive power, energy today, grid frequency, and bridge state.
- Uses status-aware styling for online, fault, and offline devices.
- Bridge state is normalized from the telemetry snapshot and inverter metadata.

## APIs used

- `GET /api/plants/:plantId`
- `GET /api/devices?plant_id=<plantId>`
- `GET /api/telemetry/snapshot?plant_id=<plantId>`

## Data handled

- Plant name
- Inverter id and name
- Status
- Active power
- Reactive power
- Energy today
- Grid frequency
- Bridge 1 and bridge 2 state

