// Renders an animation overlay thumbnail: a <video> for WebM (alpha VP9 doesn't show in <img>) or an
// <img> for APNG/WebP/GIF. Used for the library cards and the upload preview.
import { isAnimationVideo } from './animationOverlay';

interface AnimationMediaProps {
  url: string;
  className?: string;
}

export const AnimationMedia = ({ url, className }: AnimationMediaProps) => {
  if (isAnimationVideo(url)) {
    return <video src={url} className={className} autoPlay loop muted playsInline aria-hidden draggable={false} />;
  }

  return <img src={url} alt="" loading="lazy" className={className} draggable={false} />;
};
