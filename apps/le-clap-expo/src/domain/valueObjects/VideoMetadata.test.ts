import { VideoMetadata } from './VideoMetadata';

describe('VideoMetadata', () => {
  describe('constructor', () => {
    it('stores the provided fields', () => {
      const recordedAt = new Date('2026-01-01T00:00:00.000Z');
      const meta = new VideoMetadata({
        path: '/tmp/clip.mp4',
        orientation: 'landscape',
        duration: 12.5,
        width: 1920,
        height: 1080,
        recordedAt,
        trim: { start: 1, end: 9 },
        crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
      });

      expect(meta.path).toBe('/tmp/clip.mp4');
      expect(meta.orientation).toBe('landscape');
      expect(meta.duration).toBe(12.5);
      expect(meta.width).toBe(1920);
      expect(meta.height).toBe(1080);
      expect(meta.recordedAt).toBe(recordedAt);
      expect(meta.trim).toEqual({ start: 1, end: 9 });
      expect(meta.crop).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
    });

    it('defaults recordedAt to a Date and leaves optional fields undefined', () => {
      const meta = new VideoMetadata({ path: '/tmp/a.mp4' });

      expect(meta.recordedAt).toBeInstanceOf(Date);
      expect(meta.orientation).toBeUndefined();
      expect(meta.duration).toBeUndefined();
      expect(meta.trim).toBeUndefined();
      expect(meta.crop).toBeUndefined();
    });
  });

  describe('hasValidDimensions', () => {
    it('is true only when both width and height are positive', () => {
      expect(new VideoMetadata({ path: 'p', width: 100, height: 50 }).hasValidDimensions()).toBe(true);
      expect(new VideoMetadata({ path: 'p', width: 0, height: 50 }).hasValidDimensions()).toBe(false);
      expect(new VideoMetadata({ path: 'p' }).hasValidDimensions()).toBe(false);
    });
  });

  describe('getAspectRatio', () => {
    it('returns width/height when dimensions are valid', () => {
      expect(new VideoMetadata({ path: 'p', width: 1920, height: 1080 }).getAspectRatio()).toBeCloseTo(16 / 9);
    });

    it('returns null when dimensions are missing', () => {
      expect(new VideoMetadata({ path: 'p' }).getAspectRatio()).toBeNull();
    });
  });

  describe('isPortrait', () => {
    it('is true when the aspect ratio is below 1', () => {
      expect(new VideoMetadata({ path: 'p', width: 1080, height: 1920 }).isPortrait()).toBe(true);
      expect(new VideoMetadata({ path: 'p', width: 1920, height: 1080 }).isPortrait()).toBe(false);
    });

    it('is false when dimensions are unknown', () => {
      expect(new VideoMetadata({ path: 'p' }).isPortrait()).toBe(false);
    });
  });

  describe('toJSON / fromJSON', () => {
    it('serializes recordedAt to an ISO string and includes trim/crop', () => {
      const recordedAt = new Date('2026-06-07T10:00:00.000Z');
      const json = new VideoMetadata({
        path: '/tmp/clip.mp4',
        orientation: 'portrait',
        duration: 8,
        recordedAt,
        trim: { start: 0, end: 4 },
        crop: { x: 0, y: 0, w: 0.8, h: 0.8 },
      }).toJSON();

      expect(json).toMatchObject({
        path: '/tmp/clip.mp4',
        orientation: 'portrait',
        duration: 8,
        recordedAt: '2026-06-07T10:00:00.000Z',
        trim: { start: 0, end: 4 },
        crop: { x: 0, y: 0, w: 0.8, h: 0.8 },
      });
    });

    it('round-trips trim/crop and core fields through toJSON -> fromJSON', () => {
      const original = new VideoMetadata({
        path: '/tmp/clip.mp4',
        orientation: 'landscape',
        duration: 15,
        trim: { start: 2, end: 12 },
        crop: { x: 0.05, y: 0.1, w: 0.9, h: 0.7 },
      });

      const restored = VideoMetadata.fromJSON(original.toJSON());

      expect(restored.path).toBe(original.path);
      expect(restored.orientation).toBe(original.orientation);
      expect(restored.duration).toBe(original.duration);
      expect(restored.trim).toEqual(original.trim);
      expect(restored.crop).toEqual(original.crop);
    });

    it('defaults recordedAt to a Date when missing from the plain object', () => {
      const restored = VideoMetadata.fromJSON({ path: '/tmp/x.mp4' });

      expect(restored.recordedAt).toBeInstanceOf(Date);
      expect(restored.trim).toBeUndefined();
      expect(restored.crop).toBeUndefined();
    });
  });
});
