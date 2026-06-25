// Pick a hardware H.264 encoder for the current platform when the FFmpeg build exposes one, else ''
// (which resolveVideoCodec maps to the libx264 default). Hardware encoders are platform-bound:
// videotoolbox on macOS, mediacodec on Android. Pure — `available` is the encoder list from a probe.
export const selectVideoCodec = (available: string[], platform: NodeJS.Platform | 'android'): string => {
  if (platform === 'darwin' && available.includes('h264_videotoolbox')) {
    return 'h264_videotoolbox';
  }

  if (platform === 'android' && available.includes('h264_mediacodec')) {
    return 'h264_mediacodec';
  }

  return '';
};
