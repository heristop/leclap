import { test, expect, type Page } from '@playwright/test';

// Browser-agent (WebMCP) tools on the studio builder, driven the way an agent would: through the dev
// polyfill (`?webmcp=polyfill`, which the dev server allows) and its `navigator.modelContextTesting`
// shim. No WASM is involved: every tool here is render-free.

interface TestingShim {
  listTools: () => Array<{ name: string; inputSchema?: string }>;
  executeTool: (name: string, inputJson: string) => Promise<string | null>;
}

type ToolCallResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text: string }>;
};

const PHASE_ONE_TOOLS = [
  'add_section',
  'edit_template',
  'get_motion_catalog',
  'get_sample',
  'get_template',
  'get_template_schema',
  'get_timeline',
  'list_samples',
  'list_sections',
  'move_section',
  'remove_section',
  'select_section',
  'set_texts',
  'undo',
  'validate_template',
];

async function toolNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (navigator as unknown as { modelContextTesting: TestingShim }).modelContextTesting
      .listTools()
      .map((tool) => tool.name)
      .sort()
  );
}

async function callTool(page: Page, name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
  const raw = await page.evaluate(
    ([tool, input]) =>
      (navigator as unknown as { modelContextTesting: TestingShim }).modelContextTesting.executeTool(tool, input),
    [name, JSON.stringify(args)] as const
  );

  return JSON.parse(raw ?? '{}') as ToolCallResult;
}

async function openBlankBuilder(page: Page): Promise<void> {
  await page.goto('/studio/builder?webmcp=polyfill');
  await page.getByRole('dialog').getByRole('button', { name: 'Start blank' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => toolNames(page), { timeout: 15_000 }).toEqual(PHASE_ONE_TOOLS);
}

test.describe('browser agent (WebMCP) tools', () => {
  test('without the polyfill flag and without native WebMCP, nothing loads and the pill stays hidden', async ({
    page,
  }) => {
    const loaded: string[] = [];
    page.on('request', (request) => {
      if (/usecases\/webmcp|webmcp-polyfill/.test(request.url())) loaded.push(request.url());
    });
    await page.goto('/studio/builder');
    await page.getByRole('dialog').getByRole('button', { name: 'Start blank' }).click();

    await expect(page.getByRole('textbox', { name: 'Template name' })).toBeVisible();
    await expect(page.locator('[data-agent-pill]')).toHaveCount(0);
    expect(await page.evaluate(() => 'modelContext' in document)).toBe(false);
    expect(loaded).toEqual([]);
  });

  test('an agent reads the template, adds a scene the user can see and undo', async ({ page }) => {
    await openBlankBuilder(page);

    const pill = page.locator('[data-agent-pill]');
    await expect(pill).toHaveAttribute('data-agent-pill', 'idle');

    const template = await callTool(page, 'get_template');
    expect(template.isError).toBeUndefined();
    const revision = template.structuredContent?.revision as string;
    expect(revision).toMatch(/^[0-9a-f]{64}$/);
    expect(template.structuredContent?.sectionCount).toBe(1);

    const lane = page.getByRole('toolbar', { name: 'Scenes' });
    await expect(lane.getByRole('button', { name: /Color background/ })).toHaveCount(0);

    const added = await callTool(page, 'add_section', {
      expectedRevision: revision,
      type: 'color_background',
      note: 'Opening title card',
    });
    expect(added.isError).toBeUndefined();
    expect(added.structuredContent?.changedPositions).toEqual([1]);

    // The new card appears, ringed, and is selected.
    await expect(lane.getByRole('button', { name: /Color background/ })).toBeVisible();
    await expect(page.locator('[data-agent-highlight]')).toHaveCount(1);

    // A stale revision is refused.
    const stale = await callTool(page, 'add_section', { expectedRevision: revision, type: 'form' });
    expect(stale.isError).toBe(true);
    expect(stale.structuredContent?.code).toBe('revision_conflict');

    // The activity popover lists the edit with its note and an Undo.
    await pill.click();
    const popover = page.getByRole('dialog', { name: 'Browser agent' });
    await expect(popover).toBeVisible();
    const entries = popover.getByRole('listitem');
    // Newest first: the refused call, then the edit, then the read.
    await expect(entries.nth(0)).toContainText('Added a scene');
    await expect(entries.nth(0)).toContainText('Failed · template changed meanwhile');
    await expect(entries.nth(1)).toContainText('Done');
    await expect(entries.nth(1)).toContainText("Agent's note: Opening title card");
    await expect(entries.nth(2)).toContainText('Read the template');
    await expect(popover.getByRole('button', { name: 'Undo: Added a scene' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();

    // The agent's edit is one ordinary undo step.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(lane.getByRole('button', { name: /Color background/ })).toHaveCount(0);
    expect((await callTool(page, 'get_template')).structuredContent?.revision).toBe(revision);
  });

  test('ask-before-every-edit shows an in-page confirmation; declining commits nothing', async ({ page }) => {
    await openBlankBuilder(page);
    await page.locator('[data-agent-pill]').click();
    await page.getByRole('switch', { name: 'Ask before every edit' }).click();
    await page.keyboard.press('Escape');

    const revision = (await callTool(page, 'get_template')).structuredContent?.revision as string;
    const pending = callTool(page, 'add_section', { expectedRevision: revision, type: 'form', note: 'Collect a name' });
    const confirm = page.getByRole('dialog', { name: 'Allow this browser agent action?' });

    await expect(confirm).toBeVisible();
    await expect(confirm.getByText("Agent's note: Collect a name")).toBeVisible();
    await confirm.getByRole('button', { name: "Don't allow" }).click();

    const declined = await pending;
    expect(declined.structuredContent?.code).toBe('user_declined');
    expect((await callTool(page, 'get_template')).structuredContent?.revision).toBe(revision);
  });

  test('turning the agent off removes every tool', async ({ page }) => {
    await openBlankBuilder(page);
    await page.locator('[data-agent-pill]').click();
    await page.getByRole('switch', { name: 'Let browser agents use this builder' }).click();

    await expect.poll(() => toolNames(page)).toEqual([]);
    await expect(page.locator('[data-agent-pill]')).toHaveAttribute('data-agent-pill', 'off');

    // Back on (and the stored choice does not leak into the next test's fresh context).
    await page.getByRole('switch', { name: 'Let browser agents use this builder' }).click();
    await expect.poll(() => toolNames(page)).toEqual(PHASE_ONE_TOOLS);
  });
});
