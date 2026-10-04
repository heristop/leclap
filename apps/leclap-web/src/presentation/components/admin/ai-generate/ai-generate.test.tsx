// @vitest-environment node
// Static-markup tests for the Generate-with-AI dialog parts (the web app has no jsdom/RTL): the brief
// form is labelled, the status announces progress politely, errors are alerts with actionable copy,
// the ready card summarises the template, and the footer keeps exactly one primary action.
import { beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import ai from '@/i18n/locales/en/ai.json';
import { BriefFields } from './BriefFields';
import { DialogFooterActions } from './DialogFooterActions';
import { GenerationStatus } from './GenerationStatus';
import { ResultCard } from './ResultCard';
import type { RunStatus } from './ai-generation.logic';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['ai'], defaultNS: 'ai', resources: { en: { ai } } });
});

const noop = () => {};

function render(node: React.ReactNode): string {
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);
}

function footer(status: RunStatus, confirming = false): string {
  return render(
    <DialogFooterActions
      status={status}
      confirming={confirming}
      canGenerate
      onGenerate={noop}
      onCancel={noop}
      onOpen={noop}
      onConfirmReplace={noop}
      onKeepEditing={noop}
      onRegenerate={noop}
    />
  );
}

describe('BriefFields', () => {
  it('labels the brief and offers example prompts', () => {
    const html = render(
      <BriefFields
        brief=""
        onBriefChange={noop}
        orientation="auto"
        onOrientationChange={noop}
        duration="auto"
        onDurationChange={noop}
        disabled={false}
      />
    );

    expect(html).toMatch(/<label for="[^"]+"[^>]*>What should the video be\?<\/label>/);
    expect(html).toContain(ai.examples.launch);
    expect(html).toContain(ai.examples.tutorial);
  });
});

describe('GenerationStatus', () => {
  it('announces the repair round in a polite live region', () => {
    const html = render(
      <GenerationStatus
        status={{ kind: 'repairing', round: 2, issueCount: 3, receivedChars: 0 }}
        providerLabel="Anthropic"
      />
    );

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Repairing (round 2): fixing 3 issue(s)…');
    expect(html).toContain('aria-current="step"');
  });

  it('shows a rejected key as an alert naming the provider', () => {
    const html = render(
      <GenerationStatus
        status={{ kind: 'error', error: { key: 'auth', detail: 'invalid x-api-key' } }}
        providerLabel="OpenAI"
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('OpenAI rejected the key');
    expect(html).toContain('invalid x-api-key');
  });
});

describe('ResultCard', () => {
  it('summarises scenes, clips, duration and effects', () => {
    const html = render(
      <ResultCard
        summary={{
          name: 'Notes launch',
          description: 'A punchy launch.',
          orientation: 'portrait',
          scenes: 4,
          footageScenes: 1,
          durationSeconds: 12.5,
          durationIsEstimate: false,
          effects: ['look: vivid', 'reveal: rise'],
        }}
        warnings={['Fixed validation issues automatically (1 repair round(s)).']}
      />
    );

    expect(html).toContain('Notes launch');
    expect(html).toContain('4 scenes');
    expect(html).toContain('1 clip to film');
    expect(html).toContain('12.5 s');
    expect(html).toContain('look: vivid · reveal: rise');
    expect(html).toContain('repair round');
  });
});

describe('DialogFooterActions', () => {
  it('offers one primary action per state', () => {
    expect(footer({ kind: 'idle' })).toContain('Generate');
    expect(footer({ kind: 'thinking', receivedChars: 0 })).toContain('Cancel');
    expect(footer({ kind: 'error', error: { key: 'network' } })).toContain('Try again');
    expect(footer({ kind: 'ready', result: {} as never, summary: {} as never })).toContain('Open in builder');
  });

  it('spells out what replacing the draft does before confirming', () => {
    const html = footer({ kind: 'idle' }, true);

    expect(html).toContain('Undo brings the draft back');
    expect(html).toContain('Replace draft');
    expect(html).toContain('Keep editing');
  });
});
