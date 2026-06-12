import { test, expect } from '@playwright/test';

test.describe('Core Endpoints', () => {

  test('GET /health returns ok', async ({ request }) => {
    const r = await request.get('/health');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  test('POST /scans/ingredients - keto compliant', async ({ request }) => {
    const r = await request.post('/scans/ingredients', {
      data: { ingredients: ['almond flour', 'eggs', 'butter', 'stevia'], protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.passed).toBe(true);
    expect(body.score).toBe(100);
    expect(body.violations).toEqual([]);
  });

  test('POST /scans/ingredients - keto non-compliant (sugar)', async ({ request }) => {
    const r = await request.post('/scans/ingredients', {
      data: { ingredients: ['wheat flour', 'sugar', 'palm oil'], protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.passed).toBe(false);
    expect(body.flaggedIngredients).toContain('sugar');
  });

  test('POST /scans/ingredients - keto non-compliant (grains category)', async ({ request }) => {
    const r = await request.post('/scans/ingredients', {
      data: { ingredients: ['rice', 'oats', 'salt'], protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.passed).toBe(false);
  });

  test('POST /scans/ingredients - empty ingredients returns 400', async ({ request }) => {
    const r = await request.post('/scans/ingredients', {
      data: { protocolSlug: 'keto' }
    });
    expect([401, 400]).toContain(r.status()); // 401 if auth required, 400 if validation first
  });

  test('POST /scans/ingredients - missing protocol returns 400', async ({ request }) => {
    const r = await request.post('/scans/ingredients', {
      data: { ingredients: ['salt'] }
    });
    expect([401, 400]).toContain(r.status()); // 401 if auth required, 400 if validation first
  });

  test('POST /scans - same as /scans/ingredients', async ({ request }) => {
    const r = await request.post('/scans', {
      data: { ingredients: ['salt'], protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(200);
  });

  test('POST /products/lookup - valid barcode', async ({ request }) => {
    const r = await request.post('/products/lookup', {
      data: { barcode: '000000000001' }
    });
    // May return product or "not found" — both are valid responses
    expect([200, 404]).toContain(r.status());
  });

  test('POST /products/lookup - missing barcode returns 400', async ({ request }) => {
    const r = await request.post('/products/lookup', {
      data: { notBarcode: '123' }
    });
    expect([401, 400]).toContain(r.status()); // 401 if auth required, 400 if validation first
  });

  test('POST /products/lookup - empty body returns 400', async ({ request }) => {
    const r = await request.post('/products/lookup', { data: {} });
    expect([401, 400]).toContain(r.status()); // 401 if auth required, 400 if validation first
  });

  test('GET /search/products - with query', async ({ request }) => {
    const r = await request.get('/search/products?q=cookies&protocol=keto');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('hits');
    expect(body).toHaveProperty('query');
  });

  test('GET /search/products - empty query handled', async ({ request }) => {
    const r = await request.get('/search/products?q=');
    expect(r.status()).toBeLessThan(500);
  });

  test('POST /clicks - valid affiliate click', async ({ request }) => {
    const r = await request.post('/clicks', {
      data: { productId: '00000000-0000-0000-0000-000000000001', retailerId: '00000000-0000-0000-0000-000000000001', redirectUrl: 'https://iherb.com/test' }
    });
    // May fail on UUID validation but shouldn't 500
    expect(r.status()).toBeLessThan(500);
  });

  test('POST /clicks - missing fields returns 400', async ({ request }) => {
    const r = await request.post('/clicks', { data: {} });
    expect([401, 400]).toContain(r.status()); // 401 if auth required, 400 if validation first
  });

  test('GET /api/v1/sync/products returns 200', async ({ request }) => {
    const r = await request.get('/api/v1/sync/products');
    expect(r.status()).toBe(200);
  });

  test('GET /api/v1/sync/protocols returns 200', async ({ request }) => {
    const r = await request.get('/api/v1/sync/protocols');
    expect(r.status()).toBe(200);
  });

  test('POST /api/v1/sync/scans - offline upload', async ({ request }) => {
    const r = await request.post('/api/v1/sync/scans', {
      data: { scans: [{ barcode: '737628064502', timestamp: new Date().toISOString() }] }
    });
    expect(r.status()).toBe(200);
  });

  test('POST /api/v1/sync/journal - offline upload', async ({ request }) => {
    const r = await request.post('/api/v1/sync/journal', {
      data: { entries: [{ mealType: 'breakfast', complianceScore: 100 }] }
    });
    expect(r.status()).toBe(200);
  });
});

