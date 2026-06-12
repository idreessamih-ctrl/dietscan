import { test, expect } from '@playwright/test';

test.describe('GDPR, Auth & Notifications', () => {

  test('GET /gdpr/export - user data', async ({ request }) => {
    const r = await request.get('/gdpr/export');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('scans');
    expect(body).toHaveProperty('mealJournal');
  });

  test('GET /gdpr/privacy - policy text', async ({ request }) => {
    const r = await request.get('/gdpr/privacy');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('policy');
    expect(typeof body.policy).toBe('string');
    expect(body.policy.length).toBeGreaterThan(10);
  });

  test('DELETE /gdpr/account - cascade delete', async ({ request }) => {
    const r = await request.delete('/gdpr/account');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.message).toContain('deleted');
  });

  test('GET /api/auth/session-test - auth endpoint', async ({ request }) => {
    const r = await request.get('/api/auth/session-test');
    expect(r.status()).toBe(200);
  });

  test('POST /notifications/register - register token', async ({ request }) => {
    const r = await request.post('/notifications/register', {
      data: { token: 'ExponentPushToken[test-browser-123]' }
    });
    expect(r.status()).toBeLessThan(500);
  });

  test('POST /notifications/send - blocked without admin key', async ({ request }) => {
    const r = await request.post('/notifications/send', {
      data: { title: 'Test', body: 'Hello' }
    });
    // Should be 401 or 403 — not 200
    expect([401, 403]).toContain(r.status());
  });
});

