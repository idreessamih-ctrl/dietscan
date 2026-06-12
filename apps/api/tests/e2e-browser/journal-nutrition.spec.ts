import { test, expect } from '@playwright/test';

test.describe('Journal & Nutrition', () => {
  let journalId: string;

  test('POST /journal - log breakfast', async ({ request }) => {
    const r = await request.post('/journal', {
      data: { mealType: 'breakfast', complianceScore: 100 }
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.id).toBeDefined();
    journalId = body.id;
  });

  test('POST /journal - log lunch', async ({ request }) => {
    const r = await request.post('/journal', {
      data: { mealType: 'lunch', complianceScore: 50 }
    });
    expect(r.status()).toBe(201);
  });

  test('POST /journal - log dinner', async ({ request }) => {
    const r = await request.post('/journal', {
      data: { mealType: 'dinner', complianceScore: 80 }
    });
    expect(r.status()).toBe(201);
  });

  test('POST /journal - log snack', async ({ request }) => {
    const r = await request.post('/journal', {
      data: { mealType: 'snack', complianceScore: 90 }
    });
    expect(r.status()).toBe(201);
  });

  test('GET /journal - list entries', async ({ request }) => {
    const r = await request.get('/journal');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('GET /journal/summary - compliance stats', async ({ request }) => {
    const r = await request.get('/journal/summary');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('averageCompliance');
  });

  test('DELETE /journal/:id - remove entry', async ({ request }) => {
    const r = await request.delete(`/journal/${journalId}`);
    expect(r.status()).toBe(200);
  });

  test('DELETE /journal/:id - 404 on missing', async ({ request }) => {
    const r = await request.delete('/journal/nonexistent-id');
    expect(r.status()).toBe(404);
  });

  test('GET /nutrition/daily - with date', async ({ request }) => {
    const r = await request.get('/nutrition/daily?date=2026-06-12');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('summary');
  });

  test('GET /nutrition/daily - without date', async ({ request }) => {
    const r = await request.get('/nutrition/daily');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('summary');
  });

  test('GET /nutrition/daily - bad date format', async ({ request }) => {
    const r = await request.get('/nutrition/daily?date=not-a-date');
    expect(r.status()).toBe(400);
  });

  test('GET /nutrition/weekly - dashboard', async ({ request }) => {
    const r = await request.get('/nutrition/weekly');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('dailyData');
    expect(Array.isArray(body.dailyData)).toBe(true);
    expect(body).toHaveProperty('streak');
  });
});

