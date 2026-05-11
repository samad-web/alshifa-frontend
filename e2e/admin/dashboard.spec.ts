import { test, expect } from '@playwright/test';

test('admin dashboard loads after login', async ({ page }) => {
  await page.goto('/admin');

  // Saved auth state should keep us on /admin (not redirect to /login).
  await expect(page).toHaveURL(/\/admin/);

  // Dashboard renders some heading.
  await expect(page.locator('h1').first()).toBeVisible();
});
