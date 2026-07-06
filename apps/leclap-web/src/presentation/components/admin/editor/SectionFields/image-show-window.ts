// Pure normalizer for an image overlay's show-window seconds (start/end NumberRows in
// ImageOverlayField). The editor model treats an absent bound as "untimed" (the image spans the
// whole scene), so 0 and invalid values normalize to undefined instead of being stored — keeping
// the descriptor minimal (buildDescriptor emits start/duration only when the window is set).
export function showWindowSeconds(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;

  if (value <= 0) return undefined;

  // Trim stepper float noise (0.1 + 0.2 → 0.3) so the stored seconds round-trip cleanly through
  // buildDescriptor's start/duration arithmetic.
  return Number(value.toFixed(4));
}
