import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatValidation, exitCodeFor } from '../src/commands/validate';

const validateTemplateMock = vi.fn();
const getGeometryWarningsMock = vi.fn();
// A recognisable stand-in for the loader `createBundledFontLoader` produces, so a test can assert
// this exact value — not just "a function" — reaches `getGeometryWarnings`.
const bundledFontLoaderMock = vi.fn();

vi.mock('ffmpeg-video-composer', () => ({
  TemplateValidator: vi.fn().mockImplementation(function TemplateValidatorMock() {
    return {
      validateTemplate: validateTemplateMock,
      getGeometryWarnings: getGeometryWarningsMock,
    };
  }),
  FilesystemNodeAdapter: vi.fn(),
  PinoLogAdapter: vi.fn(),
  createBundledFontLoader: vi.fn(() => bundledFontLoaderMock),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => '{"sections":[]}'),
  },
}));

// picocolors honours NO_COLOR; strip any ANSI so assertions match the text regardless of env.
const plain = (s: string): string => s.replace(/\[[0-9;]*m/g, '');

describe('formatValidation', () => {
  it('reports a valid template on one line', () => {
    const lines = formatValidation({ success: true, errors: [] }).map(plain);
    expect(lines.join('\n')).toContain('valid');
    expect(lines.some((l) => l.includes('✗'))).toBe(false);
  });

  it('lists each error as "✗ <path> — <message>"', () => {
    const lines = formatValidation({
      success: false,
      errors: [
        { path: 'sections[0].type', message: 'unknown section type', code: 'invalid' },
        { path: 'global.music.url', message: 'must be a url', code: 'invalid_url' },
      ],
    }).map(plain);

    const text = lines.join('\n');
    expect(text).toContain('✗ sections[0].type — unknown section type');
    expect(text).toContain('✗ global.music.url — must be a url');
    expect(text).toContain('2'); // a count of problems is surfaced
  });

  it('falls back gracefully when there are no error details', () => {
    const lines = formatValidation({ success: false }).map(plain);
    expect(lines.join('\n').toLowerCase()).toContain('invalid');
  });
});

describe('formatValidation with geometry warnings', () => {
  it('prints warnings even when the template is valid', () => {
    const output = formatValidation({
      success: true,
      warnings: [{ path: 'sections[0].caption', message: 'overflows the safe width by 84px' }],
    })
      .map(plain)
      .join('\n');

    expect(output).toContain('sections[0].caption');
    expect(output).toContain('overflows');
  });

  it('still reports success when the only findings are warnings', () => {
    const output = formatValidation({
      success: true,
      warnings: [{ path: 'sections[0].caption', message: 'too small' }],
    })
      .map(plain)
      .join('\n');

    // The exit code is driven by `success`, and a warning must never change it — otherwise
    // `leclap validate` becomes unusable as a CI gate.
    expect(output).toContain('valid');
  });

  it('is unchanged for a clean template', () => {
    expect(formatValidation({ success: true }).map(plain).join('\n')).toContain('valid');
  });
});

describe('exitCodeFor', () => {
  it('is 0 when the template is valid, even with warnings present', () => {
    expect(
      exitCodeFor({
        success: true,
        warnings: [{ path: 'sections[0].caption', message: 'too small' }],
      })
    ).toBe(0);
  });

  it('is 1 when the template is invalid', () => {
    expect(exitCodeFor({ success: false })).toBe(1);
  });
});

// End-to-end pin: exercises the actual `validate` command (not just the pure formatter/exit helpers)
// against a mocked engine, so a future change that lets a warning leak into `errors` — or otherwise
// flips `success` — fails here even if it never touches `formatValidation` or `exitCodeFor` directly.
describe('validate command exit code with geometry warnings', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never) as never);
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('never exits 1 when the template is valid but geometry warnings are found', async () => {
    validateTemplateMock.mockReturnValue({ success: true, data: { sections: [] } });
    getGeometryWarningsMock.mockResolvedValue([
      {
        path: 'sections[0].caption',
        message: 'overflows the safe width by 84px',
        code: 'text_overflow',
        severity: 'warn',
        approx: true,
      },
    ]);

    const { validate } = await import('../src/commands/validate');
    await validate.run?.({ args: { template: 'template.json', json: true } } as never);

    expect(exitSpy).not.toHaveBeenCalledWith(1);

    const out = writeSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    expect(out).toContain('"success":true');
    expect(out).toContain('overflows the safe width by 84px');
  });

  it('still exits 1 for a genuinely invalid template regardless of warnings', async () => {
    validateTemplateMock.mockReturnValue({
      success: false,
      errors: [{ path: 'sections[0].type', message: 'unknown section type', code: 'invalid' }],
    });
    getGeometryWarningsMock.mockResolvedValue([]);

    const { validate } = await import('../src/commands/validate');
    await validate.run?.({ args: { template: 'template.json', json: true } } as never);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // Passing no loader is itself a legitimate, fully-supported path (measurements degrade to
  // approximate), so nothing else here would fail if the wiring were silently dropped. This pins
  // that `getGeometryWarnings` is actually called with a loader — and specifically the one
  // `createBundledFontLoader` produced, not merely "some function" — so removing the wiring fails
  // this test even though the command would still run, still print, and still exit 0.
  it('passes the loader produced by createBundledFontLoader to getGeometryWarnings', async () => {
    const descriptor = { sections: [] };
    validateTemplateMock.mockReturnValue({ success: true, data: descriptor });
    getGeometryWarningsMock.mockResolvedValue([]);

    const { validate } = await import('../src/commands/validate');
    await validate.run?.({ args: { template: 'template.json', json: true } } as never);

    expect(getGeometryWarningsMock).toHaveBeenCalledWith(descriptor, bundledFontLoaderMock);
  });
});
