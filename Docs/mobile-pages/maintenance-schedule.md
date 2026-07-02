# Maintenance Schedule Page

## What it does

This page shows preventive maintenance schedules and their related work orders.

## How it works

1. Ensure CMMS auth is ready.
2. Load the current user profile for identity matching.
3. Search preventive maintenance records.
4. Load detail and recent work orders for selected items.
5. Group and sort records by schedule and current user relevance.

## Core logic

- The page uses the current user identity to determine assigned items.
- Preventive maintenance entries are normalized from multiple field names.
- Recent work orders are loaded for each selected preventive maintenance item.
- Image URLs are resolved against the CMMS base URL when needed.

## APIs used

- `GET /api/auth/me`
- `POST /api/preventive-maintenances/search`
- `GET /api/preventive-maintenances/:id`
- `GET /api/preventive-maintenances/:id/recent-work-orders`

## Data handled

- Preventive maintenance title and id
- Priority and status
- Asset and location
- Next work order date
- Image or attachment URL
- Assigned users
- Recent work orders

