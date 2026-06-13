// Playful status lines for the render, shared by web + on-device (expo) so both surface the same
// little journey. Picked by progress bucket so the line advances as the bar climbs and stays put
// within a band instead of flickering on every progress tick.
export const RENDER_QUIPS = [
  'Warming up the projector…',
  'Wrangling pixels into place…',
  'Teaching your frames to dance…',
  'Splicing in the good bits…',
  'Sprinkling a little cinematic magic…',
  'Polishing every last frame…',
  'Cueing the dramatic finish…',
  'Almost showtime…',
];

export const renderQuip = (fraction: number): string => {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const index = Math.min(RENDER_QUIPS.length - 1, Math.floor(clamped * RENDER_QUIPS.length));

  return RENDER_QUIPS[index];
};
