# Plants Page

## What it does

This is the summary list of all plants.
It shows rollup KPIs and a per-plant card list for direct navigation.

## How it works

1. Load the plant list.
2. Aggregate total active power, energy today, capacity, and active plant count.
3. Render each plant as a card with status and utilization.
4. Navigate to `/dashboard/:plantId` when a card is selected.

## Core logic

- Status badge colors are driven by plant status.
- The page uses theme-aware status styling in the current web app.
- Utilization is calculated as `activePower / capacity`.
- Empty or loading state is handled locally.

## APIs used

- `GET /api/plants`

## Data handled

- `activePower`
- `energyToday`
- `capacity`
- `inverterCount`
- `status`
- `location`

