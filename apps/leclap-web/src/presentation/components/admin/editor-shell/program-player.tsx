// The live program monitor's playback surface: mounts the scene(s) under the playhead and lets the
// rAF clock paint them. Two-tier design (the load-bearing performance discipline):
//   - COARSE (React state): which scenes are mounted — flips only at boundaries / transition windows.
//   - FINE (raw DOM writes at 60fps): overlay reveal/exit opacity+transform, Ken Burns backdrop
//     transform, transition blend styles, all written straight to refs — zero re-renders per frame.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorState } from '../templateEditorModel';
import { sceneClockAt, transitionAt, kenburnsTransformAt, type Segment } from './program-timeline.logic';
import { overlayVisibilityAt } from './overlay-visibility.logic';
import { transitionBlendAt, type BlendLayerStyle } from './transition-blend.logic';
import { useFrameHeight } from './SugarPreviewLayer';
import { ProgramScene, type ProgramSceneHandles, type VisualSection } from './program-scene';
import type { ProgramClock } from './use-program-clock';

interface Mounted {
  active: number; // original section index under the playhead
  incoming: number | null; // next scene, mounted early during a transition window
}

const sameMount = (a: Mounted, b: Mounted): boolean => a.active === b.active && a.incoming === b.incoming;

// Write one blend layer's sampled styles; empty strings clear leftovers from the previous frame.
function writeBlend(el: HTMLDivElement | null, style: BlendLayerStyle): void {
  if (!el) return;

  el.style.opacity = style.opacity === undefined ? '' : String(style.opacity);
  el.style.transform = style.transform ?? '';
  el.style.clipPath = style.clipPath ?? '';
  el.style.filter = style.filter ?? '';
}

// Paint one mounted scene at its local clock: backdrop Ken Burns + per-overlay reveal/exit.
function paintScene(
  handles: ProgramSceneHandles | null,
  section: VisualSection,
  localT: number,
  duration: number
): void {
  if (!handles) return;

  const kenburns = kenburnsTransformAt(section.motion, duration > 0 ? localT / duration : 0);

  if (handles.backdrop) handles.backdrop.style.transform = kenburns ?? '';

  for (const [i, overlay] of section.overlays.entries()) {
    const el = handles.overlays[i];

    if (!el) continue;

    const vis = overlayVisibilityAt(overlay.reveal, overlay.exit, localT, duration);
    el.style.opacity = String(vis.opacity);
    el.style.transform = `translate(${vis.translateX.toFixed(2)}px, ${vis.translateY.toFixed(2)}px)`;
  }
}

// Monitor frame aspect per template orientation.
const ORIENTATION_ASPECT: Record<EditorState['orientation'], string> = {
  landscape: 'aspect-video',
  portrait: 'aspect-[9/16] max-h-full w-auto h-full',
  square: 'aspect-square max-h-full',
};

interface ProgramPlayerProps {
  state: EditorState;
  clock: ProgramClock;
  timeline: Segment[];
}

export const ProgramPlayer = ({ state, clock, timeline }: ProgramPlayerProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const previewH = useFrameHeight(frameRef);
  const [mounted, setMounted] = useState<Mounted>(() => ({
    active: timeline[0]?.index ?? -1,
    incoming: null,
  }));

  // Latest data for the paint closure without re-subscribing per render.
  const dataRef = useRef({ state, timeline, mounted });
  dataRef.current = { state, timeline, mounted };

  const containers = useRef(new Map<number, HTMLDivElement | null>());
  const handles = useRef(new Map<number, ProgramSceneHandles | null>());

  useEffect(() => {
    return clock.subscribe((t) => {
      const { state: s, timeline: line, mounted: mount } = dataRef.current;
      const at = sceneClockAt(line, t);

      if (!at) return;

      const trans = transitionAt(line, t);
      const want: Mounted = { active: at.index, incoming: trans?.toIndex ?? null };

      // Boundary crossed: remount and let the NEXT tick paint the fresh refs.
      if (!sameMount(want, mount)) {
        dataRef.current.mounted = want;
        setMounted(want);

        return;
      }

      const active = s.sections[at.index] as VisualSection | undefined;

      if (!active) return;

      paintScene(handles.current.get(at.index) ?? null, active, at.localT, at.segment.duration);

      if (!trans || want.incoming === null) {
        writeBlend(containers.current.get(at.index) ?? null, {});

        return;
      }

      const incoming = s.sections[want.incoming] as VisualSection | undefined;

      // The incoming scene idles at its first frame until the boundary flips the mount.
      if (incoming) paintScene(handles.current.get(want.incoming) ?? null, incoming, 0, 1);

      const blend = transitionBlendAt(trans.family, trans.progress);
      writeBlend(containers.current.get(at.index) ?? null, blend.outgoing);
      writeBlend(containers.current.get(want.incoming) ?? null, blend.incoming);
    });
  }, [clock]);

  const scenes = useMemo(() => {
    const indices = mounted.incoming === null ? [mounted.active] : [mounted.active, mounted.incoming];

    return indices
      .map((index) => ({ index, section: state.sections[index] as VisualSection | undefined }))
      .filter((entry): entry is { index: number; section: VisualSection } => Boolean(entry.section));
  }, [mounted, state.sections]);

  if (timeline.length === 0) return null;

  return (
    <div className="grid h-full place-items-center overflow-hidden p-4 sm:p-6">
      <div
        ref={frameRef}
        className={`relative w-full max-w-full overflow-hidden rounded-xl border border-foreground/10 bg-black ${ORIENTATION_ASPECT[state.orientation]}`}
      >
        {/* Incoming (second entry) stacks above the active scene for the blend window. */}
        {scenes.map(({ index, section }) => (
          <div
            key={index}
            ref={(el) => {
              containers.current.set(index, el);
            }}
            className="absolute inset-0"
          >
            <ProgramScene
              ref={(h) => {
                handles.current.set(index, h);
              }}
              section={section}
              orientation={state.orientation}
              frameRef={frameRef}
              previewH={previewH}
              globalTreatment={{ look: state.globalLook, grade: state.globalGrade }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
