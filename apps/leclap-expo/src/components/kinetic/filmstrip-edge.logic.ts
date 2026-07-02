// Pure layout for FilmstripEdge — how many sprocket holes fit a given height, and where their
// centres sit. Memoized by the component; unit-tested here so the perforation never drifts.

export const holeCount = (height: number, spacing: number, inset = 0): number => {
  const usable = height - inset * 2;

  if (usable <= 0 || spacing <= 0) return 0;

  return Math.max(0, Math.floor(usable / spacing));
};

// The y-centre of each hole, evenly spaced within the inset band.
export const holeOffsets = (height: number, spacing: number, inset = 0): number[] => {
  const count = holeCount(height, spacing, inset);
  const offsets: number[] = [];

  for (let i = 0; i < count; i++) {
    offsets.push(inset + spacing / 2 + i * spacing);
  }

  return offsets;
};
