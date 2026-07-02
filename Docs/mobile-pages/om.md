# O and M Page

## What it does

This is the operations and maintenance overview page.
It focuses on assigned work orders and planning by date, status, and priority.

## How it works

1. Resolve the current CMMS user identity.
2. Load work orders assigned to the current user.
3. Build KPI summaries, charts, and calendar views from the assigned set.
4. Navigate back to the work orders page with the selected order in context.

## Core logic

- The default view is the assigned work order set.
- Status and priority are normalized before grouping.
- The page computes due-today, this-week, overdue, and assigned subsets.
- It renders both chart summaries and date-based schedule views.

## APIs used

- `GET /api/auth/me`
- `POST /api/work-orders/search`

## Data handled

- Work order id and custom id
- Title and description
- Status and priority
- Due date
- Location and asset
- Assigned users and primary user
- Created-by identity

