// Pure filtergraph builders for the xfade/acrossfade transition assembly. Extracted from VideoEditor
// so the (stateless) timeline math — offsets, capped durations, the xfade/acrossfade chains — is
// testable on its own and VideoEditor stays focused on orchestration. No FFmpeg or IO here.

/** A boundary transition between two adjacent segments — `type` is an xfade name or `cut`. */
export type Transition = { type: string; duration: number };

/** Per-segment probe result the assembly graph is built from. */
export type SegmentProbe = { duration: number; hasAudio: boolean };

// FFmpeg accepts decimals; trim float noise (4.499999) to keep commands clean and assertable.
export const round = (value: number): number => Math.round(value * 1000) / 1000;

const transitionName = (transition: Transition): string => (transition.type === 'cut' ? 'fade' : transition.type);

/**
 * xfade requires all inputs to share one resolution/SAR, and segments can disagree (forceAspectRatio
 * sections, mixed sources). Scale-and-pad every segment to the project scale before the xfade chain.
 */
export const buildNormalizeGraph = (segmentCount: number, scale: string): string => {
  const links: string[] = [];

  for (let k = 0; k < segmentCount; k++) {
    links.push(
      `[${k}:v]scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2,setsar=1[vs${k}]`
    );
  }

  return links.join(';');
};

/**
 * offset_k = (Σ_{i≤k} d_i) − (Σ_{i≤k} effTr_i). The cumulative subtraction of prior transition
 * durations keeps every clip starting where the previous cross-dissolve ends, so later boundaries
 * don't drift.
 */
export const computeOffsets = (probes: SegmentProbe[], effectiveDurations: number[]): number[] => {
  const offsets: number[] = [];
  let durationSum = 0;
  let transitionSum = 0;

  for (let k = 0; k < effectiveDurations.length; k++) {
    durationSum += probes[k].duration;
    transitionSum += effectiveDurations[k];
    offsets.push(round(durationSum - transitionSum));
  }

  return offsets;
};

/**
 * Per-boundary transition duration fed to xfade/acrossfade. A `cut` is a near-zero fade so the graph
 * stays uniform. Every other transition is capped to at most HALF the shorter adjacent segment: an
 * xfade overlaps both neighbours, so a transition as long as a clip collapses the cumulative offset
 * to ≤0 and the whole timeline folds into one clip (the xfade-short-segment-collapse). Capping to half
 * keeps each clip ≥50% non-overlap so offsets stay strictly increasing. Normal multi-second clips pass
 * through unchanged.
 */
export const effectiveDurations = (transitions: Transition[], probes: SegmentProbe[]): number[] =>
  transitions.map((transition, k) => {
    if (transition.type === 'cut') {
      return 0.001;
    }

    return round(Math.min(transition.duration, Math.min(probes[k].duration, probes[k + 1].duration) / 2));
  });

export const buildVideoGraph = (
  transitions: Transition[],
  offsets: number[],
  effectiveDurationsList: number[],
  finalLabel = '[vout]'
): string => {
  const links: string[] = [];

  for (let k = 0; k < transitions.length; k++) {
    const left = k === 0 ? '[vs0]' : `[v${k - 1}]`;
    const out = k === transitions.length - 1 ? finalLabel : `[v${k}]`;
    const name = transitionName(transitions[k]);

    links.push(
      `${left}[vs${k + 1}]xfade=transition=${name}:duration=${effectiveDurationsList[k]}:offset=${offsets[k]}${out}`
    );
  }

  return links.join(';');
};

export const buildAudioGraph = (
  transitions: Transition[],
  audioInputIndex: number[],
  effectiveDurationsList: number[]
): string => {
  const links: string[] = [];

  for (let k = 0; k < transitions.length; k++) {
    const left = k === 0 ? `[${audioInputIndex[0]}:a]` : `[a${k - 1}]`;
    const out = k === transitions.length - 1 ? '[aout]' : `[a${k}]`;

    links.push(`${left}[${audioInputIndex[k + 1]}:a]acrossfade=d=${effectiveDurationsList[k]}:c1=tri:c2=tri${out}`);
  }

  return links.join(';');
};
