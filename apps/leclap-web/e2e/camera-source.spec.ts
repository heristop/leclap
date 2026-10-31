import { test, expect } from '@playwright/test';

test('camera failure keeps source options available for switching to upload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('leclap-lang', 'en');
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try it in your browser', exact: true }).click();
  await page.getByRole('button', { name: 'Create my intro', exact: true }).click();
  await page.getByRole('button', { name: 'Record an intro with your camera', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Camera unavailable', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch camera', exact: true })).toHaveCount(0);
  const sources = page.getByRole('group', { name: 'Video source', exact: true });
  await expect(sources.getByRole('button', { name: 'Front', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sources.getByRole('button', { name: 'Upload', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(sources.getByRole('button', { name: 'Upload', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Camera unavailable', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose a video', exact: true })).toBeVisible();
});
