import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'admin',
      testMatch: /admin[\\/].*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'doctor',
      testMatch: /doctor[\\/].*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/doctor.json' },
      dependencies: ['setup'],
    },
    {
      name: 'patient',
      testMatch: /patient[\\/].*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/patient.json' },
      dependencies: ['setup'],
    },
    {
      name: 'therapist',
      testMatch: /therapist[\\/].*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/therapist.json' },
      dependencies: ['setup'],
    },
  ],
});
