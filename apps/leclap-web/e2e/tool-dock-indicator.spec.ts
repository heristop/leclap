import { test, expect } from '@playwright/test';

// The editor ToolDock active-indicator is a single brand-gradient bar that slides to the active tool via
// a translateY computed from a fixed slot height. Regression guard for a bug where the bar was
// `absolute left-0` with no `top-0`, so its static-flow baseline sat inside the nav's top padding and the
// translateY re-added that padding — leaving the bar ~12px below the active tool. Reduced motion makes the
// indicator snap instead of animate, so each measurement reads the settled position.
test.use({ reducedMotion: 'reduce' });

test('the tool dock indicator bar stays vertically centered on the active tool', async ({ page }) => {
  await page.goto('/templates/new');

  const toolbar = page.getByRole('toolbar', { name: 'Editor tools' });
  await expect(toolbar).toBeVisible();

  // The indicator only renders on desktop (lg: the vertical rail); Desktop Chrome's 1280px viewport hits it.
  const indicator = toolbar.locator(':scope > span[aria-hidden="true"]');
  await expect(indicator).toBeVisible();

  for (const label of ['Scenes', 'Basics', 'Audio', 'Variables', 'Advanced']) {
    await toolbar.getByRole('button', { name: label, exact: true }).click();
    await expect(toolbar.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'true');

    // Poll the settled position (the bar springs to the active tool, so measure once it lands). Bar center
    // vs active-tool center must coincide — a little rounding slack. The original bug left a ~13px gap.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const nav = document.querySelector('nav[role="toolbar"]');
            const bar = nav?.querySelector(':scope > span[aria-hidden="true"]');
            const active = nav?.querySelector('button[aria-current="true"]');

            if (!bar || !active) return Number.NaN;

            const b = bar.getBoundingClientRect();
            const a = active.getBoundingClientRect();

            return Math.abs(b.top + b.height / 2 - (a.top + a.height / 2));
          }),
        { message: `indicator drift on "${label}"`, timeout: 2000 }
      )
      .toBeLessThanOrEqual(1.5);
  }
});
