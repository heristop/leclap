import { test, expect } from '@playwright/test';

// End-to-end coverage for the studio builder's new editing features: the cold-start preset picker,
// the global keyboard shortcuts (cheat sheet + undo), and the live program monitor (play → the
// playhead advances and the scene changes without any WASM compile).

test.describe('studio builder', () => {
  test('cold start offers starter presets and picking one populates the timeline', async ({ page }) => {
    await page.goto('/studio/builder');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Start your template')).toBeVisible();

    await dialog.getByRole('button', { name: /Talking-head intro/ }).click();
    await expect(dialog).toBeHidden();

    // The preset creates 3 scenes (color → video → color) and names the template.
    const lane = page.getByRole('toolbar', { name: 'Scenes' });
    await expect(lane.getByRole('button', { name: /Color background/ }).first()).toBeVisible();
    await expect(lane.getByRole('button', { name: /Your video/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Template name' })).toHaveValue('Talking-head intro');
  });

  test('starting blank keeps the pristine single-scene timeline and shows the hint', async ({ page }) => {
    await page.goto('/studio/builder');

    await page.getByRole('dialog').getByRole('button', { name: 'Start blank' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect(page.getByText('Build your story scene by scene')).toBeVisible();
  });

  test('? opens the shortcut cheat sheet and mod+Z undoes an edit', async ({ page }) => {
    await page.goto('/studio/builder');
    await page.getByRole('dialog').getByRole('button', { name: 'Start blank' }).click();

    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Keyboard shortcuts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // Type a name, then undo it from anywhere (mod-combos fire even inside inputs).
    const name = page.getByRole('textbox', { name: 'Template name' });
    await name.fill('My template');
    await expect(name).toHaveValue('My template');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(name).not.toHaveValue('My template');
  });

  test('the program monitor plays across scenes without a compile', async ({ page }) => {
    await page.goto('/studio/builder');
    await page.getByRole('dialog').getByRole('button', { name: /Talking-head intro/ }).click();

    // The transport idles at zero, then play sweeps the playhead and the status strip flips to PLAYING.
    const scrubber = page.getByRole('slider', { name: 'Seek through the video' });
    await expect(scrubber).toHaveValue('0');

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByText('Playing')).toBeVisible();

    // Scene 1 is a title card — its headline renders live on the playback stage (checked BEFORE the
    // 3s scene boundary unmounts it; scoped to the stage because the panel shows the same text).
    await expect(page.locator('.studio-stage').getByText('Your headline here')).toBeVisible();

    // The playhead advances (poll until the range moved meaningfully).
    await expect.poll(async () => Number(await scrubber.inputValue()), { timeout: 5_000 }).toBeGreaterThan(100);

    // Selecting a scene card exits play mode back to the edit canvas.
    await page
      .getByRole('toolbar', { name: 'Scenes' })
      .getByRole('button', { name: /Your video/ })
      .click();
    await expect(page.getByText('Playing')).toBeHidden();
  });
});
