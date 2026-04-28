import { createServer, writeOrders } from '../src/server.js';
import crypto from 'crypto';

let server;
let baseUrl;

function sampleOrder(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    customerName: 'Test Customer',
    amount: 100,
    status: 'paid',
    orderDate: '2026-01-10T00:00:00.000Z',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  return { status: response.status, body: await response.json() };
}

beforeAll(done => {
  server = createServer();
  server.listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll(done => server.close(done));

beforeEach(async () => {
  await writeOrders([
    sampleOrder({ amount: 50, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z', orderDate: '2026-01-01T00:00:00.000Z' }),
    sampleOrder({ amount: 150, status: 'paid', createdAt: '2026-01-05T00:00:00.000Z', orderDate: '2026-01-05T00:00:00.000Z' }),
    sampleOrder({ amount: 250, status: 'shipped', createdAt: '2026-01-10T00:00:00.000Z', orderDate: '2026-01-10T00:00:00.000Z' }),
    sampleOrder({ amount: 350, status: 'cancelled', createdAt: '2026-01-15T00:00:00.000Z', orderDate: '2026-01-15T00:00:00.000Z' })
  ]);
});

test('GET /health returns service status', async () => {
  const res = await request('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('POST /orders creates a valid order', async () => {
  const res = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({ customerName: 'New Customer', amount: 99.99, status: 'pending' })
  });
  expect(res.status).toBe(201);
  expect(res.body.data.id).toBeDefined();
  expect(res.body.data.customerName).toBe('New Customer');
});

test('POST /orders rejects missing customerName', async () => {
  const res = await request('/orders', { method: 'POST', body: JSON.stringify({ amount: 99, status: 'paid' }) });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

test('POST /orders rejects negative amount', async () => {
  const res = await request('/orders', { method: 'POST', body: JSON.stringify({ customerName: 'Bad', amount: -1 }) });
  expect(res.status).toBe(400);
});

test('POST /orders rejects invalid status', async () => {
  const res = await request('/orders', { method: 'POST', body: JSON.stringify({ customerName: 'Bad', amount: 10, status: 'unknown' }) });
  expect(res.status).toBe(400);
});

test('POST /orders rejects invalid JSON', async () => {
  const res = await request('/orders', { method: 'POST', body: '{bad json' });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('BAD_REQUEST');
});

test('POST /orders rejects unknown fields', async () => {
  const res = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({ customerName: 'New Customer', amount: 99.99, status: 'pending', extra: 'value' })
  });

  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].message).toMatch(/Unexpected fields/);
});

test('POST /orders rejects non-object JSON bodies', async () => {
  const res = await request('/orders', {
    method: 'POST',
    body: JSON.stringify(['customerName', 'amount'])
  });

  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

test('GET /orders returns paginated results', async () => {
  const res = await request('/orders?page=1&limit=2');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
  expect(res.body.meta.totalItems).toBe(4);
});

test('GET /orders page 2 returns next slice', async () => {
  const res = await request('/orders?page=2&limit=2');
  expect(res.status).toBe(200);
  expect(res.body.meta.page).toBe(2);
  expect(res.body.meta.hasPreviousPage).toBe(true);
});

test('GET /orders filters by status', async () => {
  const res = await request('/orders?status=paid');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0].status).toBe('paid');
});

test('GET /orders filters by amount range', async () => {
  const res = await request('/orders?minAmount=100&maxAmount=300');
  expect(res.status).toBe(200);
  expect(res.body.data.every(order => order.amount >= 100 && order.amount <= 300)).toBe(true);
});

test('GET /orders filters by date range', async () => {
  const res = await request('/orders?fromDate=2026-01-04&toDate=2026-01-11');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
});

test('GET /orders rejects invalid page', async () => {
  const res = await request('/orders?page=0&limit=10');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('QUERY_VALIDATION_ERROR');
});

test('GET /orders rejects invalid limit above max', async () => {
  const res = await request('/orders?page=1&limit=500');
  expect(res.status).toBe(400);
});

test('GET /orders rejects invalid amount range', async () => {
  const res = await request('/orders?minAmount=300&maxAmount=100');
  expect(res.status).toBe(400);
});

test('GET /orders rejects invalid status filter', async () => {
  const res = await request('/orders?status=unknown');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('QUERY_VALIDATION_ERROR');
});

test('GET /orders rejects invalid date filters', async () => {
  const res = await request('/orders?fromDate=2026-13-01&toDate=2026-01-01');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('QUERY_VALIDATION_ERROR');
});

test('GET /orders returns newest orders first by createdAt', async () => {
  const res = await request('/orders?limit=4');
  expect(res.status).toBe(200);
  expect(res.body.data[0].createdAt).toBe('2026-01-15T00:00:00.000Z');
  expect(res.body.data[res.body.data.length - 1].createdAt).toBe('2026-01-01T00:00:00.000Z');
});

test('POST /orders defaults orderDate when omitted', async () => {
  const res = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({ customerName: 'No Date Customer', amount: 120.5, status: 'paid' })
  });

  expect(res.status).toBe(201);
  expect(res.body.data.orderDate).toBeDefined();
  expect(new Date(res.body.data.orderDate).toString()).not.toBe('Invalid Date');
});

test('Unknown endpoint returns 404', async () => {
  const res = await request('/unknown');
  expect(res.status).toBe(404);
});
