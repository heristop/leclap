import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseKeyValues, buildProjectConfig, withOrientation } from '../src/render-args';

describe('withOrientation', () => {
  const template = {
    global: { orientation: 'portrait', musicEnabled: true },
    sections: [{ name: 'intro', type: 'video' }],
  } as Parameters<typeof withOrientation>[0];

  it('returns the template untouched when no orientation flag was passed', () => {
    expect(withOrientation(template, undefined)).toBe(template);
  });

  // The engine reads orientation from descriptor.global.orientation (TemplateDirector), never from
  // ProjectConfig — so the flag must override the descriptor to have any effect.
  it('overrides descriptor.global.orientation without mutating the loaded template', () => {
    const out = withOrientation(template, 'landscape');

    expect(out.global?.orientation).toBe('landscape');
    expect(out.global?.musicEnabled).toBe(true);
    expect(out.sections).toBe(template.sections);
    expect(template.global?.orientation).toBe('portrait');
  });

  it('rejects a value the engine schema would refuse', () => {
    expect(() => withOrientation(template, 'diagonal')).toThrow(/--orientation/);
  });
});

describe('parseKeyValues', () => {
  it('parses key=value pairs into a record', () => {
    expect(parseKeyValues(['title=Hello', 'subtitle=World'], 'field')).toEqual({
      title: 'Hello',
      subtitle: 'World',
    });
  });

  it('keeps `=` in the value (splits on the first only) and trims the key', () => {
    expect(parseKeyValues([' url = https://x/y?a=b '], 'field')).toEqual({ url: 'https://x/y?a=b' });
  });

  it('lets a later pair override an earlier one for the same key', () => {
    expect(parseKeyValues(['k=1', 'k=2'], 'field')).toEqual({ k: '2' });
  });

  it('returns an empty record for no pairs', () => {
    expect(parseKeyValues([], 'field')).toEqual({});
    expect(parseKeyValues(undefined, 'field')).toEqual({});
  });

  it('throws a clear error when a pair has no `=`', () => {
    expect(() => parseKeyValues(['title'], 'field')).toThrow(/--field.*key=value.*"title"/);
  });

  it('throws when the key is empty', () => {
    expect(() => parseKeyValues(['=value'], 'video')).toThrow(/--video/);
  });
});

describe('buildProjectConfig', () => {
  const cwd = '/work/proj';

  it('defaults build + assets to cwd-relative dirs with empty fields', () => {
    const cfg = buildProjectConfig(cwd, {});
    expect(cfg.buildDir).toBe(path.resolve(cwd, 'build'));
    expect(cfg.assetsDir).toBe(path.resolve(cwd, 'assets'));
    expect(cfg.fields).toEqual({});
  });

  it('merges fields, resolves userVideoPaths vs cwd, and sets locale', () => {
    const cfg = buildProjectConfig(cwd, {
      field: ['title=Hi'],
      video: ['intro=clips/intro.mp4'],
      locale: 'fr',
      orientation: 'portrait',
    });
    expect(cfg.fields).toEqual({ title: 'Hi' });
    expect(cfg.userVideoPaths).toEqual({ intro: path.resolve(cwd, 'clips/intro.mp4') });
    expect(cfg.currentLocale).toBe('fr');
    // Regression guard: --orientation used to be forwarded as videoConfig.orientation, a field no
    // engine code reads — and the bare block also clobbered the engine's videoConfig defaults. The
    // flag now overrides the descriptor instead (see withOrientation).
    expect(cfg.videoConfig).toBeUndefined();
  });

  it('honors --assets and --build overrides (resolved vs cwd)', () => {
    const cfg = buildProjectConfig(cwd, { assets: 'media', build: '/tmp/out' });
    expect(cfg.assetsDir).toBe(path.resolve(cwd, 'media'));
    expect(cfg.buildDir).toBe('/tmp/out');
  });

  it('leaves userVideoPaths / videoConfig / currentLocale unset when no flags given', () => {
    const cfg = buildProjectConfig(cwd, {});
    expect(cfg.userVideoPaths).toBeUndefined();
    expect(cfg.videoConfig).toBeUndefined();
    expect(cfg.currentLocale).toBeUndefined();
  });
});
