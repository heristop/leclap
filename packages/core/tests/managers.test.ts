import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import FormatterManager from '@/editor/managers/FormatterManager';
import FilterManager from '@/editor/managers/FilterManager';
import MapManager from '@/editor/managers/MapManager';
import VariableManager from '@/editor/managers/VariableManager';
import type { Filter, Map as FilterMap, MapAnimationInput, Section } from '@/core/types';

// ---------------------------------------------------------------------------
// Lightweight stubs for the DI-injected collaborators. Managers are plain
// classes whose constructors only store references, so we can instantiate them
// directly with hand-rolled doubles instead of booting the tsyringe container.
// ---------------------------------------------------------------------------

interface StubTemplate {
  descriptor: {
    global?: {
      variables?: Record<string, string | string[]>;
      transitionDuration?: number;
    };
  };
  assets: {
    fonts: Record<string, string>;
    musics: Record<string, string>;
    inputs: Record<string, string | string[]>;
  };
}

function createTemplate(overrides: Partial<StubTemplate> = {}): StubTemplate {
  return {
    descriptor: overrides.descriptor ?? {},
    assets: overrides.assets ?? { fonts: {}, musics: {}, inputs: {} },
  };
}

function createProject(config: Record<string, unknown> = {}) {
  return { config };
}

function createSegment(currentSection?: Section) {
  return {
    currentSection,
    filtersList: [] as string[],
    filtersMapList: [] as string[],
    mapsList: [] as string[],
    assetsDir: '',
    fontsDir: '',
    animationsDir: '',
    tempFonts: [] as string[],
    inputsAsset: [] as string[],
    inputsMapCount: 0,
  };
}

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// VariableManager double that just passes text through unchanged unless overridden.
function createVariableManagerStub() {
  return {
    mapVariables: vi.fn((value: string) => value),
    mapFields: vi.fn((value: string) => value),
  };
}

// ---------------------------------------------------------------------------
// VariableManager (real implementation)
// ---------------------------------------------------------------------------

describe('VariableManager', () => {
  function build(variables?: Record<string, string | string[]>, fields?: Record<string, string>): VariableManager {
    const template = createTemplate({
      descriptor: { global: variables ? { variables } : undefined },
    });
    const project = createProject(fields ? { fields } : {});

    return new VariableManager(template as any, project as any);
  }

  it('returns value unchanged when no variables defined', () => {
    const vm = build(undefined);
    expect(vm.mapVariables('hello {{ name }}')).toBe('hello {{ name }}');
  });

  it('returns value unchanged when variables object is empty', () => {
    const vm = build({});
    expect(vm.mapVariables('hello {{ name }}')).toBe('hello {{ name }}');
  });

  it('replaces a single placeholder', () => {
    const vm = build({ name: 'Alice' });
    expect(vm.mapVariables('hello {{ name }}')).toBe('hello Alice');
  });

  it('replaces multiple distinct placeholders in one pass', () => {
    const vm = build({ first: 'Ada', last: 'Lovelace' });
    expect(vm.mapVariables('{{ first }} {{ last }}')).toBe('Ada Lovelace');
  });

  it('joins array placeholder values with a comma', () => {
    const vm = build({ tags: ['a', 'b', 'c'] });
    expect(vm.mapVariables('tags: {{ tags }}')).toBe('tags: a, b, c');
  });

  it('escapes special regex characters in keys', () => {
    const vm = build({ 'weird.key': 'ok' });
    expect(vm.mapVariables('val {{ weird.key }}')).toBe('val ok');
  });

  it('mapFields returns value unchanged when no fields defined', () => {
    const vm = build({ a: '1' });
    expect(vm.mapFields('x {{ field }}')).toBe('x {{ field }}');
  });

  it('mapFields replaces field placeholders', () => {
    const vm = build(undefined, { firstname: 'Bob' });
    expect(vm.mapFields('hi {{ firstname }}')).toBe('hi Bob');
  });

  it('mapFields returns value unchanged when fields object is empty', () => {
    const vm = build(undefined, {});
    expect(vm.mapFields('hi {{ firstname }}')).toBe('hi {{ firstname }}');
  });
});

// ---------------------------------------------------------------------------
// FormatterManager
// ---------------------------------------------------------------------------

describe('FormatterManager', () => {
  function build(
    opts: {
      section?: Section;
      variables?: Record<string, string | string[]>;
      colorsList?: string[];
      transitionDuration?: number;
      fonts?: Record<string, string>;
      currentLocale?: string;
      vmStub?: ReturnType<typeof createVariableManagerStub>;
    } = {}
  ) {
    const template = createTemplate({
      descriptor: {
        global: {
          variables: { ...opts.variables, ...(opts.colorsList ? { colorsList: opts.colorsList } : undefined) },
          transitionDuration: opts.transitionDuration,
        },
      },
      assets: { fonts: opts.fonts ?? {}, musics: {}, inputs: {} },
    });
    const project = createProject({ currentLocale: opts.currentLocale ?? 'en' });
    const segment = createSegment(opts.section);
    const logger = createLogger();
    const vm = opts.vmStub ?? createVariableManagerStub();

    const manager = new FormatterManager(project as any, template as any, vm as any, segment as any, logger as any);

    return { manager, segment, logger, vm, template };
  }

  describe('formatMultipleTypesValue', () => {
    it('setpts uses normal PTS when no speed option', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.formatMultipleTypesValue({ type: 'setpts' } as Filter)).toBe('setpts=PTS');
    });

    it('setpts multiplies PTS by speed when speed set', () => {
      const { manager } = build({ section: { name: 's', type: 'video', options: { speed: 0.25 } } });
      expect(manager.formatMultipleTypesValue({ type: 'setpts' } as Filter)).toBe('setpts=0.25*PTS');
    });

    it('atempo inverts speed and stays within [0.5, 2]', () => {
      const { manager } = build({ section: { name: 's', type: 'video', options: { speed: 0.5 } } });
      // 1/0.5 = 2 -> capped at 2
      expect(manager.formatMultipleTypesValue({ type: 'atempo' } as Filter)).toBe('atempo=2');
    });

    it('atempo clamps very low speeds to 0.5', () => {
      const { manager } = build({ section: { name: 's', type: 'video', options: { speed: 4 } } });
      // 1/4 = 0.25 -> clamped to 0.5
      expect(manager.formatMultipleTypesValue({ type: 'atempo' } as Filter)).toBe('atempo=0.5');
    });

    it('atempo defaults speed to 1 when unset', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.formatMultipleTypesValue({ type: 'atempo' } as Filter)).toBe('atempo=1');
    });

    it('default branch concatenates type and value', () => {
      const { manager } = build();
      expect(manager.formatMultipleTypesValue({ type: 'eq', value: 'contrast=1' } as Filter)).toBe('eq=contrast=1');
    });
  });

  describe('formatMultipleTypesValues', () => {
    it('returns type= when no values present', () => {
      const { manager } = build();
      expect(manager.formatMultipleTypesValues({ type: 'drawtext' } as Filter)).toBe('drawtext=');
    });

    it('formats text value with escaping and locale', () => {
      const { manager } = build({
        section: { name: 's', type: 'color_background' },
        currentLocale: 'en',
      });
      const filter = { type: 'drawtext', values: { text: { en: "It's 50%: ok" } } } as unknown as Filter;
      const result = manager.formatMultipleTypesValues(filter);
      // ' -> right single quote, % -> escaped, : -> escaped
      expect(result).toContain('drawtext=text=');
      expect(result).toContain('’'); // apostrophe replaced
    });

    it('formats an empty localized text record as empty quotes', () => {
      const { manager } = build({ section: { name: 's', type: 'color_background' } });
      // a present (truthy) text object still formats, resolving to empty string
      const filter = { type: 'drawtext', values: { text: { en: '' } } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toBe("drawtext=text=''");
    });

    it('skips the text part entirely when the text value is falsy', () => {
      const { manager } = build({ section: { name: 's', type: 'color_background' } });
      // empty-string text is falsy -> formatTextValue returns null -> nothing pushed
      const filter = { type: 'drawtext', values: { text: '' } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toBe('drawtext=');
    });

    it('formats numeric duration value substituting transition and section duration', () => {
      const { manager } = build({
        section: { name: 's', type: 'video', options: { duration: 12 } },
        transitionDuration: 2,
      });
      const filter = {
        type: 'fade',
        values: { d: '{{ transitionDuration }}', duration: '{{ section_duration }}' },
      } as unknown as Filter;
      const result = manager.formatMultipleTypesValues(filter);
      expect(result).toContain("d='2'");
      expect(result).toContain("duration='12'");
    });

    it('skips duration value when undefined', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'fade', values: { d: undefined } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toBe('fade=');
    });

    it('skips duration when not numeric after substitution', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'fade', values: { d: 'abc' } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toBe('fade=');
    });

    it('defaults transitionDuration to 0 when global value missing', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'fade', values: { d: '{{ transitionDuration }}' } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toContain("d='0'");
    });

    it('formats start_time value with speed and transition offset', () => {
      const { manager } = build({
        section: { name: 's', type: 'video', options: { duration: 10, speed: 2 } },
        transitionDuration: 1,
      });
      const filter = { type: 'fade', values: { st: '{{ transitionStartTime }}' } } as unknown as Filter;
      // stTime = 10 * 2 - 1 = 19
      expect(manager.formatMultipleTypesValues(filter)).toContain("st='19'");
    });

    it('start_time falls back to duration 0 and no transition when unset', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'fade', values: { st: '{{ transitionStartTime }}' } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toContain("st='0'");
    });

    it('skips start_time when value is not a string', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'fade', values: { st: 5 } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toBe('fade=');
    });

    it('skips start_time when not numeric after substitution', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'fade', values: { st: 'notnum' } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toBe('fade=');
    });

    it('formats color keys (fontcolor, boxcolor, color, c, fontcolor_expr)', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = {
        type: 'drawtext',
        values: { fontcolor: '#FFFFFF', boxcolor: '#000000', color: 'red', c: 'blue', fontcolor_expr: '#ABCABC' },
      } as unknown as Filter;
      const result = manager.formatMultipleTypesValues(filter);
      expect(result).toContain("fontcolor='#FFFFFF'");
      expect(result).toContain("boxcolor='#000000'");
      expect(result).toContain("color='red'");
      expect(result).toContain("c='blue'");
      expect(result).toContain("fontcolor_expr='#ABCABC'");
    });

    it('color value uses black when value is not a string', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'drawtext', values: { fontcolor: 123 } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toContain("fontcolor='black'");
    });

    it('formats fontfile value and queues the font', () => {
      const { manager, segment } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'drawtext', values: { fontfile: 'Roboto-Bold.ttf' } } as unknown as Filter;
      const result = manager.formatMultipleTypesValues(filter);
      expect(result).toContain('fontfile=');
      expect(segment.tempFonts).toContain('Roboto-Bold.ttf');
    });

    it('fontfile defaults to empty string when not provided', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'drawtext', values: { fontfile: undefined } } as unknown as Filter;
      const result = manager.formatMultipleTypesValues(filter);
      expect(result).toContain("fontfile='");
    });

    it('formats default unknown keys as key=value', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'drawtext', values: { fontsize: 48 } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toContain('fontsize=48');
    });

    it('default key with undefined value becomes key=', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const filter = { type: 'drawtext', values: { fontsize: undefined } } as unknown as Filter;
      expect(manager.formatMultipleTypesValues(filter)).toContain('fontsize=');
    });
  });

  describe('formatText', () => {
    it('uses locale-specific text from a record', () => {
      const { manager } = build({ section: { name: 's', type: 'video' }, currentLocale: 'fr' });
      expect(manager.formatText({ fr: 'Bonjour', en: 'Hello' })).toBe('Bonjour');
    });

    it('falls back to empty string when locale missing in record', () => {
      const { manager } = build({ section: { name: 's', type: 'video' }, currentLocale: 'de' });
      expect(manager.formatText({ en: 'Hello' })).toBe('');
    });

    it('uses empty locale when currentLocale undefined', () => {
      const template = createTemplate({ descriptor: { global: {} } });
      const project = createProject({}); // no currentLocale
      const segment = createSegment({ name: 's', type: 'video' });
      const logger = createLogger();
      const vm = createVariableManagerStub();
      const manager = new FormatterManager(project as any, template as any, vm as any, segment as any, logger as any);
      expect(manager.formatText('plain')).toBe('plain');
    });

    it('applies upperCase option', () => {
      const { manager } = build({ section: { name: 's', type: 'video', options: { upperCase: true } } });
      expect(manager.formatText('hello')).toBe('HELLO');
    });

    it('applies lowerCase option', () => {
      const { manager } = build({ section: { name: 's', type: 'video', options: { lowerCase: true } } });
      expect(manager.formatText('HELLO')).toBe('hello');
    });

    it('escapes reserved characters', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      const out = manager.formatText("a:b'c%d");
      expect(out).toContain('’'); // apostrophe
      expect(out).not.toBe("a:b'c%d");
    });
  });

  describe('formatFont', () => {
    it('returns cached font path from assets and logs', () => {
      const { manager, logger } = build({
        section: { name: 's', type: 'video' },
        fonts: { 'Roboto.ttf': '/cached/Roboto.ttf' },
      });
      expect(manager.formatFont('Roboto.ttf')).toBe('/cached/Roboto.ttf');
      expect(logger.info).toHaveBeenCalled();
    });

    it('queues font for download and returns fontsDir path', () => {
      const { manager, segment } = build({ section: { name: 's', type: 'video' } });
      segment.fontsDir = '/fonts';
      const result = manager.formatFont('NewFont.ttf');
      expect(result).toBe('/fonts/NewFont.ttf');
      expect(segment.tempFonts).toContain('NewFont.ttf');
    });

    it('does not re-queue a font already in tempFonts', () => {
      const { manager, segment } = build({ section: { name: 's', type: 'video' } });
      segment.fontsDir = '/fonts';
      segment.tempFonts.push('Existing.ttf');
      manager.formatFont('Existing.ttf');
      expect(segment.tempFonts.filter((f) => f === 'Existing.ttf')).toHaveLength(1);
    });
  });

  describe('formatColor', () => {
    it('returns black for falsy color', () => {
      const { manager } = build();
      expect(manager.formatColor('')).toBe('black');
    });

    it('maps variables when no colorsList and returns result', () => {
      const vmStub = createVariableManagerStub();
      vmStub.mapVariables.mockReturnValue('#123456');
      const { manager } = build({ vmStub });
      expect(manager.formatColor('{{ brand }}')).toBe('#123456');
    });

    it('returns black when variable mapping yields empty string', () => {
      const vmStub = createVariableManagerStub();
      vmStub.mapVariables.mockReturnValue('');
      const { manager } = build({ vmStub });
      expect(manager.formatColor('{{ missing }}')).toBe('black');
    });

    it('replaces {{ colorN }} from colorsList (hex passthrough)', () => {
      const { manager } = build({ colorsList: ['#AAAAAA', '#BBBBBB'] });
      expect(manager.formatColor('{{ color1 }} and {{ color2 }}')).toBe('#AAAAAA and #BBBBBB');
    });

    it('converts rgb colorsList entries to hex', () => {
      const { manager } = build({ colorsList: ['rgb(255, 0, 0)'] });
      expect(manager.formatColor('{{ color1 }}')).toBe('#FF0000');
    });

    it('leaves out-of-range color index untouched', () => {
      const { manager } = build({ colorsList: ['#AAAAAA'] });
      expect(manager.formatColor('{{ color5 }}')).toBe('{{ color5 }}');
    });

    it('only replaces the first occurrence of a repeated color tag', () => {
      const { manager } = build({ colorsList: ['#AAAAAA'] });
      // seen set keeps the second untouched
      expect(manager.formatColor('{{ color1 }} {{ color1 }}')).toBe('#AAAAAA {{ color1 }}');
    });
  });

  describe('convertRGBToHex', () => {
    it('converts a standard rgb string', () => {
      const { manager } = build();
      expect(manager.convertRGBToHex('rgb(16, 32, 48)')).toBe('#102030');
    });

    it('handles missing channels by defaulting them to 0', () => {
      const { manager } = build();
      expect(manager.convertRGBToHex('rgb()')).toBe('#000000');
    });
  });
});

// ---------------------------------------------------------------------------
// FilterManager
// ---------------------------------------------------------------------------

describe('FilterManager', () => {
  function build(
    opts: {
      section?: Section;
      transitionDuration?: number;
    } = {}
  ) {
    const template = createTemplate({
      descriptor: { global: { transitionDuration: opts.transitionDuration } },
    });
    const segment = createSegment(opts.section);
    const formatters = {
      formatMultipleTypesValue: vi.fn((f: Filter) => `single:${f.type}=${String(f.value)}`),
      formatMultipleTypesValues: vi.fn((f: Filter) => `multi:${f.type}`),
    };
    const manager = new FilterManager(template as any, formatters as any, segment as any);

    return { manager, formatters, segment };
  }

  it('delegates single-value filters to formatMultipleTypesValue', () => {
    const { manager, formatters } = build();
    const out = manager.addFilter({ type: 'eq', value: 'x' } as Filter);
    expect(formatters.formatMultipleTypesValue).toHaveBeenCalled();
    expect(out).toBe('single:eq=x');
  });

  it('delegates multi-value filters to formatMultipleTypesValues', () => {
    const { manager, formatters } = build();
    const out = manager.addFilter({ type: 'drawtext', values: { fontsize: 1 } } as unknown as Filter);
    expect(formatters.formatMultipleTypesValues).toHaveBeenCalled();
    expect(out).toBe('multi:drawtext');
  });

  it('returns the bare type when neither value nor values present', () => {
    const { manager } = build();
    expect(manager.addFilter({ type: 'hflip' } as Filter)).toBe('hflip');
  });

  it('applies enable-between suffix when range present', () => {
    const { manager } = build({
      section: { name: 's', type: 'video', options: { duration: 8 } },
      transitionDuration: 1,
    });
    const out = manager.addFilter({
      type: 'overlay',
      value: '0:0',
      range: 'start=2:end=8',
    } as Filter);
    // single value filter -> formatMultipleTypesValue invoked with mutated value
    expect(out).toContain('single:overlay=');
    expect(out).toContain("enable='between(t,2,8)'");
  });

  describe('remapEnableBetweenSuffix', () => {
    it('returns filter unchanged when no range', () => {
      const { manager } = build();
      const filter = { type: 'overlay', value: 'x' } as Filter;
      expect(manager.remapEnableBetweenSuffix(filter)).toBe(filter);
    });

    it('returns filter unchanged when range lacks two segments', () => {
      const { manager } = build();
      const filter = { type: 'overlay', value: 'x', range: 'start=1' } as Filter;
      expect(manager.remapEnableBetweenSuffix(filter)).toBe(filter);
    });

    it('uses transitionDuration as end when only start matches', () => {
      const { manager } = build({ transitionDuration: 3 });
      const filter = { type: 'overlay', value: 'v', range: 'start=2:nope=5' } as Filter;
      const out = manager.remapEnableBetweenSuffix(filter);
      expect(out.value).toContain('between(t,2,3)');
    });

    it('keeps default start=0/end=transition when start does not match', () => {
      const { manager } = build({ transitionDuration: 4 });
      // first segment has no "start=" substring, so startTime is undefined and
      // the end-override block is skipped, leaving start=0 / end=transitionDuration.
      const filter = { type: 'overlay', value: 'v', range: 'from=1:end=9' } as Filter;
      const out = manager.remapEnableBetweenSuffix(filter);
      expect(out.value).toContain('between(t,0,4)');
    });

    it('substitutes section_duration token in a numeric end value', () => {
      const { manager } = build({ section: { name: 's', type: 'video', options: { duration: 6 } } });
      // addMapAnimation always emits numeric ranges; assert the start path and a
      // resolved numeric end derived from the section duration.
      const filter = { type: 'overlay', value: 'v', range: 'start=1:end=6' } as Filter;
      const out = manager.remapEnableBetweenSuffix(filter);
      expect(out.value).toContain('between(t,1,6)');
    });
  });

  describe('remapFadeTypeShortcuts', () => {
    it('expands fadein into a fade filter with in defaults', () => {
      const { manager } = build();
      const out = manager.remapFadeTypeShortcuts({ type: 'fadein' } as Filter);
      expect(out.type).toBe('fade');
      expect(out.values?.t).toBe('in');
      expect(out.values?.d).toBe('{{ transitionDuration }}');
    });

    it('expands fadeout into a fade filter with out defaults', () => {
      const { manager } = build();
      const out = manager.remapFadeTypeShortcuts({ type: 'fadeout' } as Filter);
      expect(out.type).toBe('fade');
      expect(out.values?.t).toBe('out');
      expect(out.values?.st).toBe('{{ transitionStartTime }}');
    });

    it('preserves user-provided values over fade defaults', () => {
      const { manager } = build();
      const out = manager.remapFadeTypeShortcuts({
        type: 'fadein',
        values: { t: 'custom' },
      } as unknown as Filter);
      // user value overrides default because spread of existing values comes last
      expect(out.values?.t).toBe('custom');
    });

    it('returns non-fade filters unchanged via default branch', () => {
      const { manager } = build();
      const filter = { type: 'scale', value: '2' } as Filter;
      const out = manager.remapFadeTypeShortcuts(filter);
      expect(out.type).toBe('scale');
    });

    it('addFilter routes fadein through remap then formatter', () => {
      const { manager, formatters } = build({ transitionDuration: 1 });
      const out = manager.addFilter({ type: 'fadein' } as Filter);
      expect(formatters.formatMultipleTypesValues).toHaveBeenCalled();
      expect(out).toBe('multi:fade');
    });
  });
});

// ---------------------------------------------------------------------------
// MapManager
// ---------------------------------------------------------------------------

describe('MapManager', () => {
  function build(
    opts: {
      section?: Section;
      transitionDuration?: number;
      inputsCache?: Record<string, string | string[]>;
    } = {}
  ) {
    const template = createTemplate({
      descriptor: { global: { transitionDuration: opts.transitionDuration } },
      assets: { fonts: {}, musics: {}, inputs: opts.inputsCache ?? {} },
    });
    const segment = createSegment(opts.section);
    const formatters = {};
    const filterManager = {
      addFilter: vi.fn((f: Filter) => `F(${f.type})`),
    };
    const manager = new MapManager(template as any, formatters as any, filterManager as any, segment as any);

    return { manager, segment, filterManager, template };
  }

  describe('addMap', () => {
    it('throws when currentSection is unset and section filters are needed', () => {
      const { manager } = build({ section: undefined });
      // No section filters branch requires currentSection getter -> throws
      expect(() => manager.addMap({ inputs: ['0:v'], outputs: ['out'], filters: [] } as FilterMap)).toThrow(
        '[MapManager] currentSection is not set'
      );
    });

    it('builds a filter graph with mapped inputs and outputs', () => {
      const { manager, segment, filterManager } = build({
        section: { name: 's', type: 'video', filters: [] },
      });
      manager.addMap({
        inputs: ['0:v'],
        outputs: ['vout'],
        filters: [{ type: 'scale', value: '2' }],
      } as FilterMap);
      expect(segment.mapsList).toContain('vout');
      expect(filterManager.addFilter).toHaveBeenCalled();
      expect(segment.filtersMapList[0]).toBe('[0:v]F(scale)[vout]');
    });

    it('merges section filters when useSectionFilters is true', () => {
      const sectionFilters: Filter[] = [{ type: 'eq', value: '1' }];
      const { manager, segment, filterManager } = build({
        section: { name: 's', type: 'video', filters: sectionFilters },
      });
      manager.addMap({
        inputs: ['0:v'],
        outputs: ['o'],
        filters: [{ type: 'scale', value: '2' }],
        options: { useSectionFilters: true },
      } as FilterMap);
      // both map filter and section filter applied
      expect(filterManager.addFilter).toHaveBeenCalledTimes(2);
      expect(segment.filtersMapList[0]).toContain('F(scale)');
      expect(segment.filtersMapList[0]).toContain('F(eq)');
    });

    it('merges section filters when map has no filters', () => {
      const sectionFilters: Filter[] = [{ type: 'eq', value: '1' }];
      const { manager, filterManager } = build({
        section: { name: 's', type: 'video', filters: sectionFilters },
      });
      manager.addMap({ inputs: ['0:v'], outputs: ['o'] } as FilterMap);
      expect(filterManager.addFilter).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVideoInputIncrement', () => {
    it('returns 0 for project_video', () => {
      const { manager } = build({ section: { name: 's', type: 'project_video' } });
      expect(manager.getVideoInputIncrement()).toBe(0);
    });

    it('returns 0 for a fresh video section (no reuse)', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.getVideoInputIncrement()).toBe(0);
    });

    it('returns 0 for reused video section that is explicitly not muted', () => {
      const { manager } = build({
        section: { name: 's', type: 'video', options: { useVideoSection: 'main', muteSection: false } },
      });
      expect(manager.getVideoInputIncrement()).toBe(0);
    });

    it('returns 1 for a reused, muted video section', () => {
      const { manager } = build({
        section: { name: 's', type: 'video', options: { useVideoSection: 'main', muteSection: true } },
      });
      expect(manager.getVideoInputIncrement()).toBe(1);
    });

    it('returns 1 for other section types (default)', () => {
      const { manager } = build({ section: { name: 's', type: 'color_background' } });
      expect(manager.getVideoInputIncrement()).toBe(1);
    });
  });

  describe('hasLastFrameAnimationPersisted', () => {
    function makeInput(options: Partial<MapAnimationInput['options']>, name = 'anim'): MapAnimationInput {
      return {
        url: '',
        name,
        type: 'frame',
        extension: 'png',
        options: { frames: 0, frequency: 1, duration: 0, overlay: '', scale: '', persistent: false, ...options },
        filters: [],
      };
    }

    it('returns false when not persistent', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.hasLastFrameAnimationPersisted(makeInput({ persistent: false, frames: 3 }), 3)).toBe(false);
    });

    it('returns true on the last frame when persistent', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.hasLastFrameAnimationPersisted(makeInput({ persistent: true, frames: 3 }), 3)).toBe(true);
    });

    it('returns false on a non-last frame when persistent', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.hasLastFrameAnimationPersisted(makeInput({ persistent: true, frames: 3 }), 2)).toBe(false);
    });

    it('derives frames from the zip cache when frames is 0', () => {
      const { manager } = build({
        section: { name: 's', type: 'video' },
        inputsCache: { anim: ['a.png', 'b.png'] },
      });
      const input = makeInput({ persistent: true, frames: 0 });
      // cache length is 2 -> frames becomes 2 -> frame 2 is last
      expect(manager.hasLastFrameAnimationPersisted(input, 2)).toBe(true);
      expect(input.options.frames).toBe(2);
    });

    it('treats a non-array cache entry as 0 frames', () => {
      const { manager } = build({
        section: { name: 's', type: 'video' },
        inputsCache: { anim: '/single/path' },
      });
      const input = makeInput({ persistent: true, frames: 0 });
      expect(manager.hasLastFrameAnimationPersisted(input, 1)).toBe(false);
      expect(input.options.frames).toBe(0);
    });
  });

  describe('mapInputsVariables', () => {
    it('returns the value unchanged when there are no section inputs', () => {
      const { manager } = build({ section: { name: 's', type: 'video' } });
      expect(manager.mapInputsVariables('@video')).toBe('@video');
    });

    it('replaces @video with the video input increment', () => {
      const section = {
        name: 's',
        type: 'video',
        inputs: { 0: { name: 'logo', type: 'image', options: {} } },
      } as unknown as Section;
      const { manager } = build({ section });
      // @video resolves to 0:v (video increment for fresh video section)
      expect(manager.mapInputsVariables('@video')).toBe('0:v');
    });

    it('replaces a frame-type input reference with its last frame label', () => {
      const section = {
        name: 's',
        type: 'video',
        inputs: { 0: { name: 'spark', type: 'frame', options: { frames: 5 } } },
      } as unknown as Section;
      const { manager } = build({ section });
      expect(manager.mapInputsVariables('@spark')).toBe('spark_5');
    });

    it('replaces a non-frame input reference with an incremented stream index', () => {
      const section = {
        name: 's',
        type: 'color_background', // increment = 1
        inputs: { 0: { name: 'logo', type: 'image', options: {} } },
      } as unknown as Section;
      const { manager } = build({ section });
      // increment(1) + parseInt('0') + 1 = 2 -> 2:v
      expect(manager.mapInputsVariables('@logo')).toBe('2:v');
    });

    it('uses animation-aware increment when a frame input precedes a non-frame input', () => {
      const section = {
        name: 's',
        type: 'color_background', // increment = 1
        inputs: {
          0: { name: 'spark', type: 'frame', options: { frames: 2 } },
          1: { name: 'logo', type: 'image', options: {} },
        },
      } as unknown as Section;
      const { manager, segment } = build({ section });
      segment.inputsMapCount = 3;
      // hasAnimation true after spark -> increment(1) + inputsMapCount(3) + 1 = 5 -> 5:v
      expect(manager.mapInputsVariables('@logo')).toBe('5:v');
    });
  });

  describe('addMapAnimation', () => {
    function animationSection(): Section {
      return { name: 's', type: 'video', filters: [], options: { duration: 10 } } as Section;
    }
    function makeAnimInput(overrides: Partial<MapAnimationInput['options']> = {}): MapAnimationInput {
      return {
        url: '',
        name: 'anim',
        type: 'frame',
        extension: 'png',
        options: {
          frames: 3,
          frequency: 2,
          duration: 0,
          overlay: '0:0',
          scale: '100:100',
          persistent: false,
          ...overrides,
        },
        filters: [],
      };
    }

    it('builds the first-frame map concatenating the main video and increments count', () => {
      const { manager, segment, filterManager } = build({ section: animationSection() });
      manager.addMapAnimation(makeAnimInput(), 1);
      expect(segment.inputsMapCount).toBe(1);
      // overlay + scale filters produced
      expect(filterManager.addFilter).toHaveBeenCalled();
      // first frame uses [increment:v, increment+1:v]
      expect(segment.filtersMapList[0]).toContain('[1:v]');
      expect(segment.mapsList).toContain('anim_1');
    });

    it('uses the previous map output as the first input on a later frame', () => {
      const { manager, segment } = build({ section: animationSection() });
      segment.mapsList.push('prev_out');
      manager.addMapAnimation(makeAnimInput(), 1);
      // buildAnimationInputsForFirstFrame returns [lastMap, increment+1:v]
      expect(segment.filtersMapList[0]).toContain('[prev_out]');
    });

    it('chains subsequent frames from the prior frame label', () => {
      const { manager, segment } = build({ section: animationSection() });
      manager.addMapAnimation(makeAnimInput(), 2);
      // frame 2 inputs: anim_1 + increment:v
      expect(segment.filtersMapList[0]).toContain('[anim_1]');
      expect(segment.mapsList).toContain('anim_2');
    });

    it('extends the last frame to section duration when persistent', () => {
      const { manager, segment } = build({ section: animationSection() });
      manager.addMapAnimation(makeAnimInput({ persistent: true, frames: 1 }), 1);
      // overlay range end should reflect duration (10) for persisted last frame
      const graph = segment.filtersMapList[0];
      expect(graph).toContain('anim_1');
    });
  });
});
