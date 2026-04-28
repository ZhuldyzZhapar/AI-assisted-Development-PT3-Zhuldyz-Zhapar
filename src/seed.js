import { writeOrders, ensureDatabase } from './server.js';
import crypto from 'crypto';

const statuses = ['pending', 'paid', 'shipped', 'cancelled'];
const names = ['Amina', 'Maks', 'Ali', 'Sara', 'Nurlan', 'Dana', 'Omar', 'Aigerim', 'Timur', 'Zara'];

function createSeedOrder(index) {
  const createdAt = new Date(Date.UTC(2026, 0, 1 + index)).toISOString();
  return {
    id: crypto.randomUUID(),
    customerName: `${names[index % names.length]} Customer ${index + 1}`,
    amount: Number((25 + index * 13.75).toFixed(2)),
    status: statuses[index % statuses.length],
    orderDate: createdAt,
    createdAt,
    updatedAt: createdAt
  };
}

await ensureDatabase();
await writeOrders(Array.from({ length: 50 }, (_, index) => createSeedOrder(index)));
console.log('Seeded 50 sample orders into data/orders.json');
