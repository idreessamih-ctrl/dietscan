import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e-browser',
  timeout: 30000,
  retries: 0,
  use: { baseURL: 'http://localhost:3011' },
  reporter: [['list'], ['json', { outputFile: 'test-results.json' }]],
});

