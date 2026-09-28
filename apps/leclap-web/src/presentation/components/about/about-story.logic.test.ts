import { describe, expect, it } from 'vitest';
import { STORY_CHAPTERS, storyMonth } from './about-story.logic';

describe('storyMonth', () => {
  it.each([
    ['en', 'May 2024'],
    ['fr', 'mai 2024'],
    ['de', 'Mai 2024'],
    ['es', 'mayo de 2024'],
    ['it', 'maggio 2024'],
  ])('writes the release month the way %s readers write it', (lang, expected) => {
    expect(storyMonth('2024-05-01', lang)).toBe(expected);
  });

  it('keeps the first of the month in its own month whatever the reader’s time zone', () => {
    expect(storyMonth('2026-06-01', 'en')).toBe('June 2026');
  });
});

describe('STORY_CHAPTERS', () => {
  it('runs in release order and ends on the present, which has no release of its own', () => {
    const dated = STORY_CHAPTERS.filter((chapter) => chapter.date !== null).map((chapter) => chapter.date as string);

    expect(dated).toEqual([...dated].sort());
    expect(STORY_CHAPTERS.at(-1)).toMatchObject({ date: null, version: null });
  });
});
