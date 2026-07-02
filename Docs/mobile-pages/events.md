# Events Page

## What it does

This page shows plant events with pagination.
It is similar to alarms, but it is event-focused and supports adjustable page size.

## How it works

1. Load plant context and the first page of events.
2. Sort newest events first.
3. Allow the user to change the page size.
4. Load more records when requested.

## Core logic

- Event severity and status are mapped into UI colors.
- The screen keeps track of `offset`, `pageSize`, and `hasMore`.
- It maintains a local scroller target so the scroll-to-top behavior works.
- Events linked to alarms are counted separately.

## APIs used

- `GET /api/plants/:plantId`
- `GET /api/events?include_alarms=true&plant_id=<plantId>&limit=<n>&offset=<n>`

## Data handled

- Event title
- Category
- Severity
- Status
- Description
- Source
- Tags
- Alarm linkage
- Occurred and created timestamps

