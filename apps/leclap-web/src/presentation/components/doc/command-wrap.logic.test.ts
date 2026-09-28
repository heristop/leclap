import { describe, expect, it } from 'vitest';
import { commandSegments } from './command-wrap.logic';

describe('commandSegments', () => {
  it('keeps each short token whole and the spaces between them as break points', () => {
    expect(commandSegments('leclap render --field title=Summer', 24)).toEqual([
      { text: 'leclap', whole: true },
      { text: ' ', whole: false },
      { text: 'render', whole: true },
      { text: ' ', whole: false },
      { text: '--field', whole: true },
      { text: ' ', whole: false },
      { text: 'title=Summer', whole: true },
    ]);
  });

  it('lets a token longer than a line break inside', () => {
    expect(commandSegments('node packages/leclap-mcp/dist/index.js', 24)).toEqual([
      { text: 'node', whole: true },
      { text: ' ', whole: false },
      { text: 'packages/leclap-mcp/dist/index.js', whole: false },
    ]);
  });

  it('returns nothing for an empty command', () => {
    expect(commandSegments('', 24)).toEqual([]);
  });
});
