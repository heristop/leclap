import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  type VideoEdit,
  type VideoCrop,
  type ClipSegment,
  isCropApplied,
  isTimelineApplied,
  resolveSegments,
} from '@/domain/valueObjects/videoEdits';
import { FULL_CROP, computeVideoRect } from '@/features/editor/useVideoEditor';
import {
  splitAt,
  setSpeed as setSegmentSpeed,
  trimEdge,
  deleteSegment,
  segmentOutputDuration,
  timelineOutputDuration,
} from '@/features/editor/timelineSegments';

export type Mode = 'timeline' | 'crop';

// The output-time offset where each segment begins (used for the output clock, not the source track).
const segmentStarts = (segments: ClipSegment[]): number[] => {
  const starts: number[] = [];
  let acc = 0;

  for (const s of segments) {
    starts.push(acc);
    acc += segmentOutputDuration(s);
  }

  return starts;
};

// The segment whose [start, end] range contains a source time, else the last one that starts before it.
const segmentAtSource = (segments: ClipSegment[], t: number): number => {
  const inside = segments.findIndex((s) => t >= s.start - 0.0001 && t <= s.end + 0.0001);

  if (inside !== -1) return inside;

  let idx = 0;

  for (let k = 0; k < segments.length; k += 1) {
    if (segments[k].start <= t) idx = k;
  }

  return idx;
};

/** Tracks an element's size via ResizeObserver. */
function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    const update = () => {
      if (el) setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    const observer = new ResizeObserver(update);

    if (el) {
      update();
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}

// Plays the kept segments in order on a single <video> (each from its source `start` to `end` at its
// `speed`, looping at the end). The timeline shows SOURCE time, so the playhead is the raw
// `video.currentTime`; the clock shows the OUTPUT position (post-speed), which is what the export runs.
function useSequencer(videoRef: RefObject<HTMLVideoElement | null>, segments: ClipSegment[]) {
  const activeIndex = useRef(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [outputPosition, setOutputPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const starts = segmentStarts(segments);
  const outputDuration = timelineOutputDuration(segments);

  const seekSource = (t: number): void => {
    const video = videoRef.current;

    if (!video) return;

    const clamped = Math.min(Math.max(t, 0), video.duration || t);
    const i = segmentAtSource(segments, clamped);
    const s = segments.at(i);

    activeIndex.current = i;
    video.currentTime = clamped;
    video.playbackRate = s?.speed ?? 1;
    setSourceTime(clamped);
    setOutputPosition(starts[i] + Math.max(0, clamped - (s?.start ?? 0)) / (s?.speed ?? 1));
  };

  const onTimeUpdate = (): void => {
    const video = videoRef.current;
    const i = activeIndex.current;
    const s = segments.at(i);

    if (!video || !s) return;

    setSourceTime(video.currentTime);

    if (video.currentTime >= s.end - 0.03) {
      const next = i + 1 < segments.length ? i + 1 : 0;
      const nextSeg = segments.at(next);

      if (!nextSeg) return;

      activeIndex.current = next;
      video.currentTime = nextSeg.start;
      video.playbackRate = nextSeg.speed;
      setSourceTime(nextSeg.start);
      setOutputPosition(next === 0 ? 0 : starts[next]);

      return;
    }

    setOutputPosition(starts[i] + (video.currentTime - s.start) / s.speed);
  };

  const togglePlay = (): void => {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      video.playbackRate = segments.at(activeIndex.current)?.speed ?? 1;
      video.play().catch(() => {});
      setPlaying(true);

      return;
    }

    video.pause();
    setPlaying(false);
  };

  return { sourceTime, outputPosition, outputDuration, playing, seekSource, onTimeUpdate, togglePlay };
}

interface UseTimelineEditorParams {
  file: File;
  edit: VideoEdit | undefined;
  onChange: (edit: VideoEdit | undefined) => void;
}

export function useTimelineEditor({ file, edit, onChange }: UseTimelineEditorParams) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<Mode>('timeline');
  const [duration, setDuration] = useState(0);
  const [srcSize, setSrcSize] = useState<{ w: number; h: number } | null>(null);
  const [segments, setSegments] = useState<ClipSegment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [crop, setCrop] = useState<VideoCrop>(edit?.crop ?? FULL_CROP);
  const containerSize = useElementSize(containerRef);
  const seq = useSequencer(videoRef, segments);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Apply the segment edit + crop, but report only a meaningful edit upward (an untouched single
  // full-speed segment + no crop → undefined, so the clip skips the ffmpeg pass).
  const commit = (nextSegments: ClipSegment[], nextCrop: VideoCrop): void => {
    setSegments(nextSegments);
    setCrop(nextCrop);

    const next: VideoEdit = {};

    if (isTimelineApplied(nextSegments, duration)) next.segments = nextSegments;

    if (isCropApplied(nextCrop)) next.crop = nextCrop;

    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const onLoadedMetadata = (): void => {
    const video = videoRef.current;

    if (!video || initialized.current) return;

    initialized.current = true;
    setDuration(video.duration);
    setSrcSize({ w: video.videoWidth, h: video.videoHeight });

    const initial = resolveSegments(edit, video.duration);
    setSegments(initial);
    setSelectedId(initial[0]?.id ?? null);
  };

  const api = {
    split: () => {
      // Cut at the playhead; if it sits at a segment edge (or hasn't moved off 0), fall back to the
      // selected segment's midpoint so Split always produces a cut.
      const atPlayhead = splitAt(segments, seq.sourceTime);

      if (atPlayhead !== segments) {
        commit(atPlayhead, crop);

        return;
      }

      const target = segments.find((s) => s.id === selectedId) ?? segments.at(0);

      if (target) commit(splitAt(segments, (target.start + target.end) / 2), crop);
    },
    splitAtSource: (t: number) => {
      const next = splitAt(segments, t);

      if (next !== segments) commit(next, crop);
    },
    setSpeed: (id: string, speed: number) => {
      commit(setSegmentSpeed(segments, id, speed), crop);
    },
    trim: (id: string, side: 'start' | 'end', t: number) => {
      commit(trimEdge(segments, id, side, t, duration), crop);
    },
    remove: (id: string) => {
      const next = deleteSegment(segments, id);

      if (next === segments) return;

      commit(next, crop);

      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    },
    resetTimeline: () => {
      const whole: ClipSegment[] = [{ id: 'seg-0', start: 0, end: duration, speed: 1 }];
      commit(whole, crop);
      setSelectedId(whole[0].id);
    },
    handleCropChange: (next: VideoCrop) => {
      commit(segments, next);
    },
    resetCrop: () => {
      commit(segments, FULL_CROP);
    },
    switchMode: (next: Mode) => {
      if (next === 'crop') videoRef.current?.pause();

      setMode(next);
    },
  };

  const videoRect = srcSize
    ? computeVideoRect(containerSize, srcSize.w, srcSize.h)
    : { left: 0, top: 0, width: containerSize.width, height: containerSize.height };

  return {
    url,
    videoRef,
    containerRef,
    mode,
    duration,
    segments,
    selectedId,
    setSelectedId,
    crop,
    sourceTime: seq.sourceTime,
    outputPosition: seq.outputPosition,
    outputDuration: seq.outputDuration,
    playing: seq.playing,
    containerSize,
    videoRect,
    cropActive: isCropApplied(crop),
    timelineActive: isTimelineApplied(segments, duration),
    seekSource: seq.seekSource,
    togglePlay: seq.togglePlay,
    onTimeUpdate: seq.onTimeUpdate,
    ...api,
    onLoadedMetadata,
  };
}
