import { test, expect } from '@playwright/test';

test('therapist dashboard loads after login', async ({ page }) => {
  await page.goto('/therapist');

  // Saved auth state should keep us on /therapist (not redirect to /login).
  await expect(page).toHaveURL(/\/therapist/);

  // Dashboard renders some heading.
  await expect(page.locator('h1').first()).toBeVisible();
});
