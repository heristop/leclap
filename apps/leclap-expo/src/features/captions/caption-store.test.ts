import {
  applyCaptionPins,
  readSectionCaptions,
  withSectionCaptions,
  isCaptionsStale,
  isCaptionable,
  hasSectionCaptions,
  editWord,
} from './caption-store';

const captions = {
  words: [
    { text: 'Hello', start: 0, end: 0.4 },
    { text: 'wrld', start: 0.5, end: 0.9 },
  ],
  coarse: false,
  clipPath: 'file:///clip.mov',
  record: { from: 'self' as const, engine: 'android-speech', language: 'fr-FR', at: '2026-10-07T10:00:00.000Z' },
};

describe('section captions in the project form data', () => {
  it('stores, reads and clears one section', () => {
    const formData = withSectionCaptions({ name: 'Ada' }, 'intro', captions);

    expect(formData.name).toBe('Ada');
    expect(readSectionCaptions(formData, 'intro')).toEqual(captions);
    expect(readSectionCaptions(withSectionCaptions(formData, 'intro', null), 'intro')).toBeNull();
    expect(readSectionCaptions({ 'captions:intro': 'garbage' }, 'intro')).toBeNull();
  });

  it('pins every stored section into the compiled descriptor', () => {
    const descriptor = { sections: [{ name: 'intro', type: 'project_video' }] };
    const compiled = applyCaptionPins(descriptor, withSectionCaptions({}, 'intro', captions));

    expect(compiled.sections[0]).toMatchObject({ subtitles: { words: captions.words, karaoke: 'word' } });
    expect(applyCaptionPins(descriptor, {})).toBe(descriptor);
  });

  it('is stale once the section clip was retaken', () => {
    expect(isCaptionsStale(captions, 'file:///clip.mov')).toBe(false);
    expect(isCaptionsStale(captions, 'file:///retake.mov')).toBe(true);
  });
});

describe('isCaptionable', () => {
  const project = {
    templateContent: {
      sections: [
        { name: 'talk', type: 'project_video' },
        { name: 'photo', type: 'picture' },
      ],
    },
    recordedVideos: { talk: { path: 'file:///talk.mov' }, photo: { path: 'file:///photo.jpg' } },
  };

  it('offers captions on recorded video steps only', () => {
    expect(isCaptionable(project, 'talk')).toBe(true);
    expect(isCaptionable(project, 'photo')).toBe(false);
    expect(isCaptionable({ ...project, recordedVideos: {} }, 'talk')).toBe(false);
    expect(isCaptionable(project, undefined)).toBe(false);
    expect(isCaptionable(null, 'talk')).toBe(false);
  });

  it('tells whether a step has pinned captions', () => {
    expect(hasSectionCaptions({ formData: withSectionCaptions({}, 'talk', captions) }, 'talk')).toBe(true);
    expect(hasSectionCaptions({ formData: {} }, 'talk')).toBe(false);
    expect(hasSectionCaptions(undefined, 'talk')).toBe(false);
    expect(hasSectionCaptions({ formData: {} }, undefined)).toBe(false);
  });
});

describe('editWord', () => {
  it('fixes one word in place', () => {
    expect(editWord(captions.words, 1, 'world')[1]).toEqual({ text: 'world', start: 0.5, end: 0.9 });
  });

  it('removes a word cleared to nothing', () => {
    expect(editWord(captions.words, 0, '  ').map((word) => word.text)).toEqual(['wrld']);
  });

  it('splits a word typed as several into its window by character count', () => {
    expect(editWord(captions.words, 1, 'new york')).toEqual([
      captions.words[0],
      { text: 'new', start: 0.5, end: 0.671 },
      { text: 'york', start: 0.671, end: 0.9 },
    ]);
  });
});
