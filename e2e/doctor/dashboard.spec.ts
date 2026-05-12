import { test, expect } from '@playwright/test';

test('doctor dashboard loads after login', async ({ page }) => {
  await page.goto('/doctor');

  // Saved auth state should keep us on /doctor (not redirect to /login).
  await expect(page).toHaveURL(/\/doctor/);

  // Dashboard renders some heading.
  await expect(page.locator('h1').first()).toBeVisible();
});
