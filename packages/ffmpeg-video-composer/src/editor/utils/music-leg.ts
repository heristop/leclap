import { effectiveDurations, round, type Transition } from './transition-graph';
import { buildMusicFilter } from './music-fade';

// A music leg (one section's slice of the source track) whose true video-timeline advance isn't
// known yet — it depends on the transition into the NEXT section, which hasn't been seen at the time
// this leg is first encountered. See MusicComposer.prepareMusicTrack / finalizeLeg.
export type PendingLeg = {
  ss: number;
  duration: number;
  sectionIncrement: number;
  musicVolumeLevel: number;
  mapName: string;
};

export type FinalizedLeg = {
  filter: string;
  crossfade: string | null;
  nextCurrentLength: number;
};

// Boundary's effective (capped) overlap, reusing the same rule the video xfade graph itself uses
// (transition-graph's effectiveDurations) so the music advance matches the ACTUAL rendered video
// timeline, including the half-adjacent-duration cap that guards against a transition longer than a
// short section. A `cut` boundary has no video overlap (buildInfos.transitions already stores 0 for
// it), so it's short-circuited here rather than reusing the xfade filter's own near-zero (0.001s)
// stand-in for a cut, which is an ffmpeg-graph technicality irrelevant to audio timing.
// Not done in this pass (tracked separately): boundaryOverlap/effectiveDurations both take/return
// single-boundary scalars derived piecemeal from ad-hoc { duration, hasAudio } probes; a deeper
// refactor to a shared scalar type across the video xfade graph and this music-leg math was scoped
// out as too large for this change — revisit if the two drift further.
export function boundaryOverlap(transition: Transition | undefined, legDuration: number, nextDuration: number): number {
  const resolved = transition ?? { type: 'cut', duration: 0 };

  if (resolved.type === 'cut') {
    return 0;
  }

  return (
    effectiveDurations(
      [resolved],
      [
        { duration: legDuration, hasAudio: true },
        { duration: nextDuration, hasAudio: true },
      ]
    )[0] ?? 0
  );
}

function buildCrossfadeFilter(
  sectionIncrement: number,
  mapName: string,
  isLastSection: boolean,
  musicFade: number
): string {
  const acrossfadeMapName = isLastSection ? 'lastcrossed' : `crossed${sectionIncrement - 1}`;
  const previousMapName = sectionIncrement === 2 ? `section${sectionIncrement - 1}` : `crossed${sectionIncrement - 2}`;

  return ` [${previousMapName}][${mapName}]acrossfade=d=${musicFade}:c1=tri:c2=tri[${acrossfadeMapName}];`;
}

/**
 * Resolves a leg's own filter (baseFilter + volume/fade) plus the crossfade linking it to the
 * previous leg, and this leg's true video-timeline advance.
 *
 * `nextDuration` is the following section's duration, needed to compute this leg's outgoing
 * transition overlap; `null` for the last section (no outgoing boundary, advance = its own full
 * duration). The window length `t` is `advance + musicFade`, NOT `duration + musicFade` — shrinking
 * the leg's own atrim window by the same amount as its advance keeps the tail/head invariant intact:
 * leg N's last `musicFade` seconds of SOURCE audio must equal leg N+1's first `musicFade` seconds
 * (both start at the new, correctly-advanced `ss`), or the acrossfade blends two different moments of
 * the song — the doubled/echo artifact a prior attempt hit by shifting `ss` WITHOUT shrinking `t` to
 * match.
 */
export function finalizeLeg(
  leg: PendingLeg,
  nextDuration: number | null,
  transition: Transition | undefined,
  transitionDuration: number,
  musicFade: number
): FinalizedLeg {
  const isFirstSection = leg.sectionIncrement === 1;
  const isLastSection = nextDuration === null;
  const overlap = isLastSection ? 0 : boundaryOverlap(transition, leg.duration, nextDuration);
  const advance = isLastSection ? leg.duration : round(leg.duration - overlap);
  const t = round(advance + musicFade);
  const nextCurrentLength = round(leg.ss + advance);

  const baseFilter = `[1:a]atrim=start=${leg.ss}:duration=${t},asetpts=PTS-STARTPTS`;
  const filter = buildMusicFilter({
    baseFilter,
    isFirstSection,
    isLastSection,
    transitionDuration,
    duration: leg.duration,
    musicVolumeLevel: leg.musicVolumeLevel,
    mapName: leg.mapName,
  });

  const crossfade =
    leg.sectionIncrement > 1 ? buildCrossfadeFilter(leg.sectionIncrement, leg.mapName, isLastSection, musicFade) : null;

  return { filter, crossfade, nextCurrentLength };
}
