import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: [
    ['list'],
    ['./reporters/github-summary.ts'],
    ['html', { open: 'never' }],
  ],
});
