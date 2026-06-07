import { createThumbnail } from 'react-native-create-thumbnail';

/**
 * Generates a thumbnail from a video file.
 * @param videoPath The path to the video file.
 * @returns A promise that resolves with the path to the generated thumbnail image.
 */
export const generateThumbnail = async (videoPath: string): Promise<string | null> => {
  try {
    // Normalize video path: remove 'file://' prefix if present
    const normalizedVideoPath = videoPath.startsWith('file://') ? videoPath.replace('file://', '') : videoPath;

    const thumbnail = await createThumbnail({
      url: normalizedVideoPath,
      timeStamp: 0, // Get thumbnail from the beginning of the video
    });

    return thumbnail.path;
  } catch (error: unknown) {
    console.error('Error generating thumbnail:', error instanceof Error ? error.message : error);
    // Return null or a default placeholder path on error instead of throwing
    return null;
  }
};

// Add a default export to satisfy Expo Router
const VideoProcessing = {
  name: 'VideoProcessing',
};

export default VideoProcessing;
