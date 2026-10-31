import { test, expect } from '@playwright/test';

for (const format of ['landscape', 'portrait'] as const) {
  test(`the homepage renders clean ${format} rushes without upload or camera`, async ({ page }) => {
    await page.setViewportSize(format === 'portrait' ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const expectedClip = format === 'portrait' ? 'video_portrait.mp4' : 'video_1.mp4';
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('leclap-lang', 'en');
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Camera must not be requested'));
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try it in your browser', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Create my intro' })).toBeEnabled({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Create my intro' }).click();
    await expect(dialog.getByRole('button', { name: 'Render a sample now' })).toHaveCount(0);
    await dialog.getByLabel('Your name').fill('Alex');
    await expect(dialog.getByRole('button', { name: 'Create my video' })).toBeEnabled();
    const rushRequest = page.waitForResponse((response) => response.url().endsWith(`/assets/videos/${expectedClip}`));
    await dialog.getByRole('button', { name: 'Create my video' }).click();
    expect((await rushRequest).ok()).toBe(true);
    await expect(dialog.getByRole('heading', { name: 'Your first video is ready!' })).toBeVisible({ timeout: 150_000 });
    await expect(dialog.getByRole('button', { name: 'Start creating' })).toBeVisible();
    const video = dialog.locator('video');
    await expect(video).toHaveAttribute('src', /^blob:/);
  });
}
