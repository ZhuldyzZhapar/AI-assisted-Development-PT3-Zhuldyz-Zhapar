# Copilot Metrics Report - Practical Task 3

## Summary

Project: Orders Management API with pagination and filtering.  
Tech stack: Node.js, native HTTP server, JSON-file database, Jest tests.  
Final scope: `POST /orders`, `GET /orders`, pagination, filtering, seed data, validation improvements, README updates, and test expansion.

## Metrics

| Metric | Value |
|---|---:|
| Total source code lines in `src/` | 355 |
| Estimated Copilot-generated lines | 220 |
| Estimated manual lines | 135 |
| Copilot contribution | 62% |
| Suggestions shown | 48 |
| Suggestions accepted | 31 |
| Acceptance rate | 65% |
| Estimated time without Copilot | 5 hours |
| Actual time with Copilot | 2.5 hours |
| Estimated time saved | 50% |

## What Copilot Helped Generate

- Initial server and request handling boilerplate.
- `POST /orders` and `GET /orders` handlers.
- Pagination and filtering utilities.
- Seed script for creating 50 sample orders.
- Base Jest test structure and HTTP request helper.
- README structure and endpoint documentation.
- Initial error response formatting.

## Manual Fixes and Improvements

- Added strict `Content-Type: application/json` validation.
- Rejected non-object JSON bodies and unknown payload fields.
- Added request body size limiting and better malformed JSON handling.
- Enforced query validation for `page`, `limit`, `status`, `minAmount`, `maxAmount`, `fromDate`, and `toDate`.
- Updated `package.json` so `npm test` works with ESM via `NODE_OPTIONS=--experimental-vm-modules`.
- Added regression tests for invalid status filters, invalid date filters, response ordering, and default `orderDate` behavior.
- Refined README with exact startup, seeding, and API usage instructions.

## Generated vs Manually Fixed

- Generated: server skeleton, route routing, filter application, pagination metadata, test scaffolding, README draft.
- Manually fixed: validation rules, error codes, ESM Jest support, edge cases, request body handling, acceptance of non-object payloads, and README accuracy.

## 3 Key Learnings

1. Copilot is highly effective for generating initial structure and repetitive logic, which saved setup time and let me focus on correctness.
2. Copilot often produces workable code but requires careful review for validation, security, and edge cases in API input handling.
3. Explicit user requests like “extra tests” and “validation improvements” help steer Copilot-assisted development toward measurable quality improvements and stable behavior.

## Deliverables Verification

The project was reviewed against the assignment checklist and confirmed as implemented:

- Working API code exists in `src/server.js` and `src/seed.js`.
- Total source code size is 355 lines across `src/` (within the required 300–400 line range).
- `POST /orders` and `GET /orders` endpoints are implemented and tested.
- Pagination is supported via `page` and `limit` query parameters, with validation and maximum limit enforcement.
- Filtering is supported for `status`, `minAmount`, `maxAmount`, `fromDate`, and `toDate`.
- Project structure is proper with `package.json`, `src/`, `data/`, and `tests/` directories.
- Database setup uses `data/orders.json` with `ensureDatabase()`, `readOrders()`, and `writeOrders()` helpers.
- `src/seed.js` seeds 50 sample orders into `data/orders.json`.
- All functionality is tested and working: `npm test` passes with `21` passing tests.
- README is complete with installation instructions, API endpoint specifications, usage examples, and setup guidance.

Note: `package.json` now includes `NODE_OPTIONS=--experimental-vm-modules` for Jest ESM compatibility, so `npm test` works directly in this project setup.
