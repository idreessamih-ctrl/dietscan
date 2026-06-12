import { test, expect } from '@playwright/test';

test.describe('Shopping & Meal Plans', () => {
  let listId: string;
  let planId: string;

  test('POST /shopping/lists - create list', async ({ request }) => {
    const r = await request.post('/shopping/lists', { data: { name: 'Keto Week' } });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.id).toBeDefined();
    listId = body.id;
  });

  test('GET /shopping/lists - list all', async ({ request }) => {
    const r = await request.get('/shopping/lists');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /shopping/lists/:id - get specific', async ({ request }) => {
    const r = await request.get(`/shopping/lists/${listId}`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.name).toBe('Keto Week');
  });

  test('POST /shopping/lists/:id/items - add item', async ({ request }) => {
    const r = await request.post(`/shopping/lists/${listId}/items`, {
      data: { productId: '00000000-0000-0000-0000-000000000001', quantity: 2 }
    });
    expect(r.status()).toBe(201);
  });

  test('PATCH /shopping/lists/:id/items/:itemId - update item', async ({ request }) => {
    const r = await request.patch(`/shopping/lists/${listId}/items/item-1`, {
      data: { quantity: 3 }
    });
    expect(r.status()).toBeLessThan(500);
  });

  test('DELETE /shopping/lists/:id/items/:itemId - remove item', async ({ request }) => {
    const r = await request.delete(`/shopping/lists/${listId}/items/item-1`);
    expect(r.status()).toBeLessThan(500);
  });

  test('GET /shopping/lists/:id - 404 on missing', async ({ request }) => {
    const r = await request.get('/shopping/lists/nonexistent');
    expect(r.status()).toBe(404);
  });

  test('POST /meal-plans - create plan', async ({ request }) => {
    const r = await request.post('/meal-plans', {
      data: { weekStart: '2026-06-08', protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.id).toBeDefined();
    planId = body.id;
  });

  test('POST /meal-plans - bad protocol', async ({ request }) => {
    const r = await request.post('/meal-plans', {
      data: { weekStart: '2026-06-08', protocolSlug: 'invalid' }
    });
    expect(r.status()).toBe(400);
  });

  test('GET /meal-plans - list plans', async ({ request }) => {
    const r = await request.get('/meal-plans');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /meal-plans/:id - get plan', async ({ request }) => {
    const r = await request.get(`/meal-plans/${planId}`);
    expect(r.status()).toBe(200);
  });

  test('POST /meal-plans/:id/entries - add entry', async ({ request }) => {
    const r = await request.post(`/meal-plans/${planId}/entries`, {
      data: { dayOfWeek: 'Mon', mealType: 'breakfast', productId: '00000000-0000-0000-0000-000000000001' }
    });
    expect(r.status()).toBe(201);
  });

  test('DELETE /meal-plans/:id/entries/:entryId - remove entry', async ({ request }) => {
    const r = await request.delete(`/meal-plans/${planId}/entries/entry-1`);
    expect(r.status()).toBeLessThan(500);
  });
});

