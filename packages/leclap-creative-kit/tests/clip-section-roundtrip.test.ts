import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
  type MediaChoice,
} from '../src/editor/templateEditorModel';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Clip section test',
  description: '',
  orientation: 'landscape',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

const video = (extra: Partial<VideoSection> = {}): EditorSection => ({
  ...(newSection('video') as VideoSection),
  ...extra,
});

const clipUrl: MediaChoice = { source: 'url', url: 'https://cdn.example.com/bumper.mp4' };
const clipUpload: MediaChoice = { source: 'upload', key: 'media-123', label: 'bumper.mp4' };
const clipLibrary: MediaChoice = { source: 'library', id: 'stock-drinks' };

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('asset-backed clip sections (type video + options.videoUrl)', () => {
  it('still emits type project_video for a camera section without a clip source', () => {
    const section = buildDescriptor(stateWith([video()])).sections?.[0];
    expect(section?.type).toBe('project_video');
    expect(section?.options).not.toHaveProperty('videoUrl');
  });

  it('emits type video + options.videoUrl for a pasted-url clip source', () => {
    const section = buildDescriptor(stateWith([video({ videoUrl: clipUrl })])).sections?.[0];
    expect(section?.type).toBe('video');
    expect(section?.name).toBe('clip_1');
    expect(section?.options?.videoUrl).toBe('https://cdn.example.com/bumper.mp4');
    expect(section?.options?.duration).toBe(8);
    expect(section?.options?.muteSection).toBe(false);
  });

  it('emits a media:// marker for an uploaded clip and library:// for a library clip', () => {
    const descriptor = buildDescriptor(stateWith([video({ videoUrl: clipUpload }), video({ videoUrl: clipLibrary })]));
    expect(descriptor.sections?.[0]?.options?.videoUrl).toBe('media://media-123');
    expect(descriptor.sections?.[1]?.options?.videoUrl).toBe('library://stock-drinks');
  });

  it('drops recorder-only metadata (countdown / framing / capture / description) on a clip section', () => {
    const section = buildDescriptor(
      stateWith([
        video({
          videoUrl: clipUrl,
          countdown: true,
          countdownSeconds: 5,
          description: 'stand center',
          captureMode: 'back',
          allowedCaptureModes: ['back'],
          framingGuide: { type: 'silhouette', position: 'center', style: 'bust' },
        }),
      ])
    ).sections?.[0];
    expect(section?.options).not.toHaveProperty('countdown');
    expect(section?.options).not.toHaveProperty('countdownDuration');
    expect(section?.options).not.toHaveProperty('captureMode');
    expect(section?.options).not.toHaveProperty('allowedCaptureModes');
    expect(section?.options).not.toHaveProperty('framingGuide');
    expect(section).not.toHaveProperty('description');
  });

  it('numbers camera and clip sections on separate counters', () => {
    const descriptor = buildDescriptor(stateWith([video(), video({ videoUrl: clipUrl }), video()]));
    expect(descriptor.sections?.map((s) => s.name)).toEqual(['video_1', 'clip_1', 'video_2']);
    expect(descriptor.sections?.map((s) => s.type)).toEqual(['project_video', 'video', 'project_video']);
  });

  it('keeps duration / mute / speed and visual extras on a clip section', () => {
    const section = buildDescriptor(
      stateWith([video({ videoUrl: clipUrl, duration: 4, mute: true, speed: 2, look: 'noir' })])
    ).sections?.[0];
    expect(section?.options?.duration).toBe(4);
    expect(section?.options?.muteSection).toBe(true);
    expect(section?.options?.speed).toBe(2);
    expect(section?.look).toBe('noir');
  });

  it('round-trips a pasted-url clip source through toEditorState', () => {
    const back = toEditorState(templateFrom(stateWith([video({ videoUrl: clipUrl, duration: 4, mute: true })])));
    const section = back.sections[0] as VideoSection;
    expect(section.kind).toBe('video');
    expect(section.videoUrl).toEqual(clipUrl);
    expect(section.duration).toBe(4);
    expect(section.mute).toBe(true);
  });

  it('round-trips an uploaded clip source as an upload choice (label falls back to the key)', () => {
    const back = toEditorState(templateFrom(stateWith([video({ videoUrl: clipUpload })])));
    const section = back.sections[0] as VideoSection;
    expect(section.videoUrl).toEqual({ source: 'upload', key: 'media-123', label: 'media-123' });
  });

  it('round-trips a library clip source as a library choice', () => {
    const back = toEditorState(templateFrom(stateWith([video({ videoUrl: clipLibrary })])));
    const section = back.sections[0] as VideoSection;
    expect(section.videoUrl).toEqual(clipLibrary);
  });

  it('leaves videoUrl absent after a round-trip of a camera section', () => {
    const back = toEditorState(templateFrom(stateWith([video()])));
    expect(back.sections[0]).not.toHaveProperty('videoUrl');
  });

  it('re-emits type video after a full build -> import -> build cycle', () => {
    const back = toEditorState(templateFrom(stateWith([video({ videoUrl: clipUrl })])));
    const rebuilt = buildDescriptor(back);
    expect(rebuilt.sections?.[0]?.type).toBe('video');
    expect(rebuilt.sections?.[0]?.options?.videoUrl).toBe('https://cdn.example.com/bumper.mp4');
  });
});
