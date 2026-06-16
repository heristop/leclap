// Capture a downscaled JPEG poster (as a data URL) from the first visible frame of a video blob.
// Browser-only (needs <video> + <canvas>); returns null when unavailable, on any failure, or if the
// decode stalls past `timeoutMs` — so a corrupt blob can never hang the caller.
export async function captureVideoPoster(blob: Blob, maxWidth = 480, timeoutMs = 4000): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  const cleanup = () => {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  };

  const once = (target: HTMLVideoElement, event: string) =>
    new Promise<void>((resolve, reject) => {
      target.addEventListener(
        event,
        () => {
          resolve();
        },
        { once: true }
      );
      target.addEventListener(
        'error',
        () => {
          reject(new Error(`video ${event} error`));
        },
        { once: true }
      );
    });

  const grab = async (): Promise<string | null> => {
    await once(video, 'loadeddata');

    // Grab a representative frame: 10s in, but never past the midpoint so short clips land in their
    // middle rather than near the end. Falls back to a hair past 0 when the duration isn't known yet.
    const duration = video.duration;
    const target = Number.isFinite(duration) && duration > 0 ? Math.min(10, duration / 2) : 0.1;

    if (target > 0) {
      const seeked = once(video, 'seeked');
      video.currentTime = target;
      await seeked;
    }

    const sourceWidth = video.videoWidth || maxWidth;
    const scale = Math.min(1, maxWidth / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round((video.videoHeight || maxWidth) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.72);
  };

  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([grab(), timeout]);
  } catch {
    return null;
  } finally {
    cleanup();
  }
}
