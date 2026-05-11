import { test as setup } from '@playwright/test';
import { USERS } from './fixtures/test-data';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authDir = path.join(__dirname, '.auth');

async function loginAndSave(
  page: any,
  user: { email: string; password: string },
  filePath: string
) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
  await page.waitForURL(
    (url: URL) => !url.pathname.includes('/login'),
    { timeout: 15000 }
  );
  await page.context().storageState({ path: filePath });
  console.log(`Saved session for ${user.email}`);
}

setup('Authenticate as ADMIN', async ({ page }) => {
  await loginAndSave(page, USERS.admin, `${authDir}/admin.json`);
});

setup('Authenticate as DOCTOR', async ({ page }) => {
  await loginAndSave(page, USERS.doctor, `${authDir}/doctor.json`);
});

setup('Authenticate as PATIENT', async ({ page }) => {
  await loginAndSave(page, USERS.patient, `${authDir}/patient.json`);
});

setup('Authenticate as THERAPIST', async ({ page }) => {
  await loginAndSave(page, USERS.therapist, `${authDir}/therapist.json`);
});