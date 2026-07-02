# Work Orders Page

## What it does

This is the main CMMS work order screen.
It combines search, filters, details, tasks, labor, comments, status changes, and attachments.

## How it works

1. Ensure a CMMS token exists or is being fetched in the background.
2. Resolve the current CMMS user identity from `/api/auth/me` and token payloads.
3. Load assigned work orders with `assignedToUser = true`.
4. Open a selected work order and fetch its detail, tasks, labor, and comments.
5. Allow task edits, comment edits, comment deletion, labor timer actions, and status changes.

## Core logic

- Technician visibility is enforced by the backend.
- The page also filters results locally against the current user identity.
- Work order detail is loaded on demand when a route-selected id is present.
- Task drafts are tracked locally before PATCH updates are sent.
- Comment and task edits are normalized before sending to CMMS.
- File uploads go through the CMMS file upload endpoint before being attached.

## APIs used

- `POST /api/work-orders/search`
- `GET /api/auth/me`
- `GET /api/work-orders/:id`
- `GET /api/tasks/work-order/:id`
- `POST /api/comments/search/:workOrderId`
- `GET /api/labors/work-order/:id`
- `POST /api/labors/work-order/:id?start=true`
- `POST /api/labors/work-order/:id?start=false`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/work-orders/:id/change-status`
- `PATCH /api/work-orders/:id`
- `POST /api/comments`
- `PATCH /api/comments/:id`
- `DELETE /api/comments/:id`
- `POST /api/files/upload`

## Data handled

- Work order summary and detail
- Assigned users and teams
- Status and priority
- Tasks and checklist values
- Labor entries and timer state
- Comments and attachments
- Failure analysis fields

