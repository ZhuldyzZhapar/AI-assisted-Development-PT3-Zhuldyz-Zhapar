# Orders Management API

A simple Node.js REST API for managing orders with pagination, filtering, seed data, and Jest tests.

## Overview

This project implements a minimal orders service using an on-disk JSON datastore. It supports:

- creating orders via `POST /orders`
- retrieving paginated orders via `GET /orders`
- filtering by `status`, `minAmount`, `maxAmount`, `fromDate`, and `toDate`
- a health check endpoint
- a seed script that generates 50 sample orders
- Jest-based tests and coverage checks

## Features

- `POST /orders` to create new orders
- `GET /orders` for paginated order retrieval
- filters for status, amount range, and order date range
- request validation and structured error responses
- simple local storage in `data/orders.json`
- default limit enforcement (`1 <= limit <= 100`)
- health endpoint at `GET /health`

## Requirements

- Node.js 18+ (supports built-in `fetch` in tests)
- npm

## Installation

```bash
npm install
```

## Seed sample data

Generate sample orders before starting the server:

```bash
npm run seed
```

This creates or overwrites `data/orders.json` with 50 sample orders.

## Start the server

```bash
npm start
```

The API listens on port `3000` by default. Use `PORT` to override:

```bash
PORT=4000 npm start
```

## API Endpoints

### GET /health

Health check response:

```json
{
  "status": "ok",
  "service": "orders-api"
}
```

### POST /orders

Create a new order.

Request body example:

```json
{
  "customerName": "Amina Customer",
  "amount": 199.99,
  "status": "pending",
  "orderDate": "2026-01-15T10:00:00.000Z"
}
```

Notes:

- `customerName` must be a non-empty string
- `amount` must be a positive number
- `status` must be one of: `pending`, `paid`, `shipped`, `cancelled`
- `orderDate` is optional and defaults to the current date/time if omitted

Successful response:

```json
{
  "data": {
    "id": "uuid",
    "customerName": "Amina Customer",
    "amount": 199.99,
    "status": "pending",
    "orderDate": "2026-01-15T10:00:00.000Z",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }
}
```

### GET /orders

Retrieve orders with optional pagination and filtering.

Query parameters:

- `page`: page number (integer, default `1`)
- `limit`: page size (integer, default `10`, maximum `100`)
- `status`: order status filter
- `minAmount`: minimum order amount
- `maxAmount`: maximum order amount
- `fromDate`: start order date (ISO string)
- `toDate`: end order date (ISO string)

Example request:

```bash
curl "http://localhost:3000/orders?page=1&limit=10&status=paid&minAmount=100&maxAmount=500"
```

Example response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Validation and error handling

The API returns JSON error payloads with structured codes and details.

Common error codes:

- `VALIDATION_ERROR`: invalid request body for `POST /orders`
- `QUERY_VALIDATION_ERROR`: invalid query parameters for `GET /orders`
- `BAD_REQUEST`: malformed JSON body or oversized payload
- `NOT_FOUND`: unknown endpoint

## Running tests

```bash
npm test
```

This runs Jest with coverage and enforces minimum global thresholds.

## Notes

- The service uses a local JSON file at `data/orders.json` for persistence.
- It is intended for development/demo use and not as a production-grade database.
