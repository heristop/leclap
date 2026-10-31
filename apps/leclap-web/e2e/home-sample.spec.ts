import { test, expect } from '@playwright/test';

test('the homepage renders a bundled sample without upload or camera', async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('leclap-lang', 'en');
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Camera must not be requested'));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it in your browser', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Create my intro' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Create my intro' }).click();
  await expect(dialog.getByRole('button', { name: 'Render a sample now' })).toHaveCount(0);
  await dialog.getByLabel('Your name').fill('Alex');
  await expect(dialog.getByRole('button', { name: 'Create my video' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Create my video' }).click();
  await expect(dialog.getByRole('heading', { name: 'Your first video is ready!' })).toBeVisible({ timeout: 150_000 });
  await expect(dialog.getByRole('button', { name: 'Start creating' })).toBeVisible();
  const video = dialog.locator('video');
  await expect(video).toHaveAttribute('src', /^blob:/);
});
