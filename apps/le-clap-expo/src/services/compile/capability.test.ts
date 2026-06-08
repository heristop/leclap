import { describeOnDeviceCapability, isOnDeviceCapable } from './capability';
import type { TemplateDescriptor } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';

const singleVideo: TemplateDescriptor = {
  global: { orientation: 'landscape' },
  sections: [{ name: 'video_1', type: 'project_video' }],
};

const oneClip: CompileRecordedVideos = { video_1: { path: '/clip.mp4', orientation: 'landscape' } };

describe('describeOnDeviceCapability', () => {
  it('allows a single untransformed project_video clip', () => {
    expect(describeOnDeviceCapability(singleVideo, oneClip)).toEqual({ capable: true });
    expect(isOnDeviceCapable(singleVideo, oneClip)).toBe(true);
  });

  it('rejects multi-section templates (concat/transitions)', () => {
    const d: TemplateDescriptor = {
      sections: [
        { name: 'color_1', type: 'color_background' },
        { name: 'video_1', type: 'project_video' },
      ],
    };
    expect(describeOnDeviceCapability(d, oneClip)).toMatchObject({ capable: false });
  });

  it('rejects non-video sections', () => {
    const d: TemplateDescriptor = { sections: [{ name: 'form_1', type: 'form' }] };
    expect(isOnDeviceCapable(d, {})).toBe(false);
  });

  it('rejects overlay filters, mute, and duration caps (need re-encode)', () => {
    const withText: TemplateDescriptor = {
      sections: [{ name: 'video_1', type: 'project_video', filters: [{ type: 'drawtext' }] }],
    };
    const muted: TemplateDescriptor = {
      sections: [{ name: 'video_1', type: 'project_video', options: { muteSection: true } }],
    };
    const trimmed: TemplateDescriptor = {
      sections: [{ name: 'video_1', type: 'project_video', options: { duration: 8 } }],
    };
    expect(isOnDeviceCapable(withText, oneClip)).toBe(false);
    expect(isOnDeviceCapable(muted, oneClip)).toBe(false);
    expect(isOnDeviceCapable(trimmed, oneClip)).toBe(false);
  });

  it('rejects clip-level trim/crop and wrong clip counts', () => {
    expect(isOnDeviceCapable(singleVideo, {})).toBe(false);
    expect(
      isOnDeviceCapable(singleVideo, {
        video_1: { path: '/c.mp4', orientation: 'landscape', trim: { start: 1, end: 3 } },
      })
    ).toBe(false);
    expect(
      isOnDeviceCapable(singleVideo, {
        video_1: { path: '/c.mp4', orientation: 'landscape', crop: { x: 0, y: 0, w: 1, h: 0.5 } },
      })
    ).toBe(false);
  });
});
