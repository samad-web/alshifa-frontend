import { test, expect } from '@playwright/test';

test('patient dashboard loads after login', async ({ page }) => {
  await page.goto('/patient');

  // Saved auth state should keep us on /patient (not redirect to /login).
  await expect(page).toHaveURL(/\/patient/);

  // Dashboard renders its greeting heading ("Good morning, X" / "Good evening, X" / etc.)
  await expect(page.locator('h1').first()).toBeVisible();
});
