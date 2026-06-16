import { describeOnDeviceCapability, isOnDeviceCapable } from './capability';
import type { TemplateDescriptor } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';

const oneClip: CompileRecordedVideos = { video_1: { path: '/clip.mp4', orientation: 'landscape' } };

// The reused core handles everything the server does, so capability is permissive — only animation
// `maps` (unsupported unzip) route to the server; compileHybrid falls back on any on-device error.
describe('describeOnDeviceCapability', () => {
  it('allows a single project_video clip', () => {
    const d: TemplateDescriptor = { sections: [{ name: 'video_1', type: 'project_video' }] };
    expect(describeOnDeviceCapability(d, oneClip)).toEqual({ capable: true });
    expect(isOnDeviceCapable(d, oneClip)).toBe(true);
  });

  it('allows multi-section templates (color card + clip → concat)', () => {
    const d: TemplateDescriptor = {
      sections: [
        { name: 'color_1', type: 'color_background' },
        { name: 'video_1', type: 'project_video' },
      ],
    };
    expect(isOnDeviceCapable(d, oneClip)).toBe(true);
  });

  it('allows drawtext overlays, multiple clips, mute and duration', () => {
    const d: TemplateDescriptor = {
      sections: [
        { name: 'video_1', type: 'project_video', filters: [{ type: 'drawtext' }], options: { duration: 8 } },
        { name: 'video_2', type: 'project_video', options: { muteSection: true } },
      ],
    };
    const twoClips: CompileRecordedVideos = {
      video_1: { path: '/a.mp4', orientation: 'landscape' },
      video_2: { path: '/b.mp4', orientation: 'landscape' },
    };
    expect(isOnDeviceCapable(d, twoClips)).toBe(true);
  });

  it('routes animation-map sections to the server (unzip unsupported)', () => {
    const d: TemplateDescriptor = {
      sections: [{ name: 'video_1', type: 'project_video', maps: [{ frames: 'anim.zip' }] }],
    };
    expect(describeOnDeviceCapability(d, oneClip)).toMatchObject({ capable: false });
    expect(isOnDeviceCapable(d, oneClip)).toBe(false);
  });
});
