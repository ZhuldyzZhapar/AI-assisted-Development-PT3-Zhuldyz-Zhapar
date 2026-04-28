import http from 'http';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'orders.json');
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const ALLOWED_STATUSES = new Set(['pending', 'paid', 'shipped', 'cancelled']);
const ALLOWED_ORDER_FIELDS = new Set(['customerName', 'amount', 'status', 'orderDate']);
const MAX_LIMIT = 100;

export async function ensureDatabase() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }

  if (!existsSync(DB_FILE)) {
    await writeFile(DB_FILE, JSON.stringify([], null, 2));
  }
}

export async function readOrders() {
  await ensureDatabase();
  const raw = await readFile(DB_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error(`Database file is corrupted: ${error.message}`);
  }
}

export async function writeOrders(orders) {
  await ensureDatabase();
  await writeFile(DB_FILE, JSON.stringify(orders, null, 2));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendNotFound(res) {
  sendJson(res, 404, {
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist.'
    }
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      reject(new Error('Content-Type must be application/json.'));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function validateCreateOrderPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object.' }]
    };
  }

  const unknownFields = Object.keys(payload).filter(key => !ALLOWED_ORDER_FIELDS.has(key));
  if (unknownFields.length > 0) {
    errors.push({ field: 'body', message: `Unexpected fields: ${unknownFields.join(', ')}.` });
  }

  const customerName = normalizeString(payload.customerName);
  const status = normalizeString(payload.status || 'pending');
  const amount = Number(payload.amount);
  const orderDate = normalizeString(payload.orderDate || new Date().toISOString());

  if (!customerName || typeof customerName !== 'string') {
    errors.push({ field: 'customerName', message: 'customerName is required and must be a non-empty string.' });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({ field: 'amount', message: 'amount is required and must be a positive number.' });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    errors.push({ field: 'status', message: 'status must be one of: pending, paid, shipped, cancelled.' });
  }

  if (!isValidISODate(orderDate)) {
    errors.push({ field: 'orderDate', message: 'orderDate must be a valid ISO date string.' });
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      customerName,
      amount: Number(amount.toFixed(2)),
      status,
      orderDate: new Date(orderDate).toISOString()
    }
  };
}

function parsePagination(searchParams) {
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const errors = [];

  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'page must be a positive integer.' });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `limit must be a positive integer between 1 and ${MAX_LIMIT}.` });
  }

  return { page, limit, errors };
}

function parseFilters(searchParams) {
  const status = normalizeString(searchParams.get('status') || undefined);
  const minAmount = toNumber(searchParams.get('minAmount'));
  const maxAmount = toNumber(searchParams.get('maxAmount'));
  const fromDate = normalizeString(searchParams.get('fromDate') || undefined);
  const toDate = normalizeString(searchParams.get('toDate') || undefined);
  const errors = [];

  if (status && !ALLOWED_STATUSES.has(status)) {
    errors.push({ field: 'status', message: 'status filter must be one of: pending, paid, shipped, cancelled.' });
  }

  if (Number.isNaN(minAmount) || Number.isNaN(maxAmount)) {
    errors.push({ field: 'amount', message: 'minAmount and maxAmount must be valid numbers.' });
  }

  if (minAmount !== undefined && minAmount < 0) {
    errors.push({ field: 'minAmount', message: 'minAmount cannot be negative.' });
  }

  if (maxAmount !== undefined && maxAmount < 0) {
    errors.push({ field: 'maxAmount', message: 'maxAmount cannot be negative.' });
  }

  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    errors.push({ field: 'amountRange', message: 'minAmount cannot be greater than maxAmount.' });
  }

  if (fromDate && !isValidISODate(fromDate)) {
    errors.push({ field: 'fromDate', message: 'fromDate must be a valid ISO date.' });
  }

  if (toDate && !isValidISODate(toDate)) {
    errors.push({ field: 'toDate', message: 'toDate must be a valid ISO date.' });
  }

  if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
    errors.push({ field: 'dateRange', message: 'fromDate cannot be later than toDate.' });
  }

  return { status, minAmount, maxAmount, fromDate, toDate, errors };
}

function applyFilters(orders, filters) {
  return orders.filter(order => {
    if (filters.status && order.status !== filters.status) return false;
    if (filters.minAmount !== undefined && order.amount < filters.minAmount) return false;
    if (filters.maxAmount !== undefined && order.amount > filters.maxAmount) return false;
    if (filters.fromDate && new Date(order.orderDate) < new Date(filters.fromDate)) return false;
    if (filters.toDate && new Date(order.orderDate) > new Date(filters.toDate)) return false;
    return true;
  });
}

function paginate(items, page, limit) {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    data,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

async function handleCreateOrder(req, res) {
  try {
    const payload = await parseBody(req);
    const validation = validateCreateOrderPayload(payload);

    if (!validation.valid) {
      return sendJson(res, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Order payload validation failed.',
          details: validation.errors
        }
      });
    }

    const orders = await readOrders();
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      ...validation.value,
      createdAt: now,
      updatedAt: now
    };

    orders.push(order);
    await writeOrders(orders);

    return sendJson(res, 201, { data: order });
  } catch (error) {
    return sendJson(res, 400, {
      error: {
        code: 'BAD_REQUEST',
        message: error.message
      }
    });
  }
}

async function handleGetOrders(req, res, url) {
  const pagination = parsePagination(url.searchParams);
  const filters = parseFilters(url.searchParams);
  const errors = [...pagination.errors, ...filters.errors];

  if (errors.length > 0) {
    return sendJson(res, 400, {
      error: {
        code: 'QUERY_VALIDATION_ERROR',
        message: 'Query parameter validation failed.',
        details: errors
      }
    });
  }

  const orders = await readOrders();
  const filtered = applyFilters(orders, filters).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const result = paginate(filtered, pagination.page, pagination.limit);

  return sendJson(res, 200, result);
}

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/orders') {
    return handleCreateOrder(req, res);
  }

  if (req.method === 'GET' && url.pathname === '/orders') {
    return handleGetOrders(req, res, url);
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', service: 'orders-api' });
  }

  return sendNotFound(res);
}

export function createServer() {
  return http.createServer(requestListener);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await ensureDatabase();
  const server = createServer();
  server.listen(DEFAULT_PORT, () => {
    console.log(`Orders API is running on http://localhost:${DEFAULT_PORT}`);
  });
}
