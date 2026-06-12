import { test, expect } from '@playwright/test';

test.describe('Full Human Journey - 4 Days', () => {

  test('Day 1: Install, Scan, Journal', async ({ request }) => {
    // Health check (app opens)
    let r = await request.get('/health');
    expect(r.status()).toBe(200);
    expect((await r.json()).status).toBe('ok');

    // Barcode lookup
    r = await request.post('/products/lookup', { data: { barcode: '000000000001' } });
    expect(r.status()).toBeLessThan(500);

    // Keto scan - compliant
    r = await request.post('/scans/ingredients', {
      data: { ingredients: ['almond flour', 'eggs', 'butter'], protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).passed).toBe(true);

    // Keto scan - non-compliant (sugar detected)
    r = await request.post('/scans/ingredients', {
      data: { ingredients: ['wheat flour', 'sugar'], protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(200);
    const body1 = await r.json();
    expect(body1.passed).toBe(false);
    expect(body1.flaggedIngredients).toContain('sugar');

    // Log breakfast
    r = await request.post('/journal', {
      data: { mealType: 'breakfast', complianceScore: 100 }
    });
    expect(r.status()).toBe(201);
    const journalId = (await r.json()).id;

    // Log lunch
    r = await request.post('/journal', {
      data: { mealType: 'lunch', complianceScore: 50 }
    });
    expect(r.status()).toBe(201);

    // View journal
    r = await request.get('/journal');
    expect(r.status()).toBe(200);
    expect((await r.json()).length).toBeGreaterThan(0);

    // Compliance summary
    r = await request.get('/journal/summary');
    expect(r.status()).toBe(200);
    expect((await r.json())).toHaveProperty('averageCompliance');
  });

  test('Day 2: Nutrition & Meal Planning', async ({ request }) => {
    // Daily nutrition
    let r = await request.get('/nutrition/daily?date=2026-06-12');
    expect(r.status()).toBe(200);
    expect((await r.json())).toHaveProperty('summary');

    // Weekly dashboard
    r = await request.get('/nutrition/weekly');
    expect(r.status()).toBe(200);
    const weekly = await r.json();
    expect(weekly.dailyData).toHaveLength(7);
    expect(weekly).toHaveProperty('streak');

    // Create meal plan
    r = await request.post('/meal-plans', {
      data: { weekStart: '2026-06-08', protocolSlug: 'keto' }
    });
    expect(r.status()).toBe(201);
    const planId = (await r.json()).id;

    // Add meal entry
    r = await request.post(`/meal-plans/${planId}/entries`, {
      data: { dayOfWeek: 'Mon', mealType: 'breakfast', productId: '00000000-0000-0000-0000-000000000001' }
    });
    expect(r.status()).toBe(201);

    // Create shopping list
    r = await request.post('/shopping/lists', { data: { name: 'Weekly Keto' } });
    expect(r.status()).toBe(201);
    const listId = (await r.json()).id;

    // Add item
    r = await request.post(`/shopping/lists/${listId}/items`, {
      data: { productId: '00000000-0000-0000-0000-000000000001', quantity: 2 }
    });
    expect(r.status()).toBe(201);

    // View list
    r = await request.get(`/shopping/lists/${listId}`);
    expect(r.status()).toBe(200);
  });

  test('Day 3: Search & Sync', async ({ request }) => {
    // Search products
    let r = await request.get('/search/products?q=cookies&protocol=keto');
    expect(r.status()).toBe(200);

    // Affiliate click
    r = await request.post('/clicks', {
      data: {
        productId: '00000000-0000-0000-0000-000000000001',
        retailerId: '00000000-0000-0000-0000-000000000001',
        redirectUrl: 'https://iherb.com/product/test'
      }
    });
    expect(r.status()).toBeLessThan(500);

    // Sync products
    r = await request.get('/api/v1/sync/products');
    expect(r.status()).toBe(200);

    // Sync protocols
    r = await request.get('/api/v1/sync/protocols');
    expect(r.status()).toBe(200);

    // Upload offline scans
    r = await request.post('/api/v1/sync/scans', {
      data: { scans: [{ barcode: '737628064502', timestamp: new Date().toISOString() }] }
    });
    expect(r.status()).toBe(200);
  });

  test('Day 4: GDPR & Account', async ({ request }) => {
    // Register push
    let r = await request.post('/notifications/register', {
      data: { token: 'ExponentPushToken[journey-test]' }
    });
    expect(r.status()).toBeLessThan(500);

    // Export data
    r = await request.get('/gdpr/export');
    expect(r.status()).toBe(200);
    const exportData = await r.json();
    expect(exportData).toHaveProperty('user');
    expect(exportData).toHaveProperty('scans');
    expect(exportData).toHaveProperty('mealJournal');

    // Read privacy policy
    r = await request.get('/gdpr/privacy');
    expect(r.status()).toBe(200);
    expect((await r.json())).toHaveProperty('policy');

    // Delete account
    r = await request.delete('/gdpr/account');
    expect(r.status()).toBe(200);
    expect((await r.json()).message).toContain('deleted');
  });
});

