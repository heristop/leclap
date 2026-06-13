// A small, dependency-free "sample frame" used by the look / grade / motion previews.
// Rather than bundle a placeholder photo, it paints a layered scene (sky, sun, hills)
// with enough colour and tonal range that CSS filters read clearly on it.
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface PreviewSurfaceProps {
  /** A CSS `filter` string applied to the scene (look/grade approximation). */
  filter?: string;
  /** Inline style applied to the inner scene (e.g. a motion transform). */
  sceneStyle?: CSSProperties;
  className?: string;
}

// The painted scene, isolated so both the static preview and the animated motion
// preview can wrap it. Layered radial/linear gradients give shadows, midtones and
// highlights for filters to act on.
const SCENE_BG = [
  'radial-gradient(circle at 72% 26%, rgba(255,238,180,0.95) 0 7%, rgba(255,238,180,0) 22%)',
  'linear-gradient(180deg, #4c5fd8 0%, #7b86e6 38%, #f5a97a 62%, #2f6e4f 62%, #1f4d38 100%)',
].join(',');

export const PreviewSurface = ({ filter, sceneStyle, className }: PreviewSurfaceProps) => (
  <div className={cn('relative overflow-hidden rounded-lg border border-foreground/10 bg-surface-2', className)}>
    <div
      className="absolute inset-0"
      style={{ background: SCENE_BG, filter: filter ?? 'none', transition: 'filter 200ms ease', ...sceneStyle }}
    />
  </div>
);
