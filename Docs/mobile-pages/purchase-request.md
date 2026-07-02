# Purchase Request Page

## What it does

This page lists the user’s purchase requests and also supports creating a new one.

## How it works

1. Ensure CMMS auth is ready.
2. Load the user’s purchase requests with paging.
3. Load lookup data for parts, assets, categories, and vendors.
4. Build a local draft with part or asset line items.
5. Submit the request to CMMS and refresh the list.

## Core logic

- The page maintains a local draft object for the create form.
- Line items can be either part-based or asset-based.
- Lookups are loaded in parallel and used to populate selects.
- The UI splits list rendering from draft editing.
- Validation requires a request name plus at least one valid line item.

## APIs used

- `GET /api/purchase-orders/my`
- `POST /api/purchase-orders/my`
- `GET /api/parts/mini`
- `GET /api/assets/mini`
- `GET /api/purchase-order-categories`
- `GET /api/vendors/mini`

## Data handled

- Request name and status
- Category and vendor
- Shipping and additional info fields
- Part or asset line items
- Total cost
- Creator information

