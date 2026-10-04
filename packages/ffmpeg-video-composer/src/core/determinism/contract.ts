// The determinism contract's descriptor-level switches (docs/plans/motion-system-v2.md §1).
//
// `meta.motionVersion` pins motion semantics. Version 1 is the historical output, byte-for-byte: every
// existing template keeps rendering exactly as before. Version 2 opts into the v2 motion system: motion
// tokens, the easing engine, `animate` tracks, frame-indexed time and seeded procedural filters. A preset
// retune always lands behind a new version, so an old render can never silently change.

export const MOTION_VERSIONS = [1, 2] as const;
export type MotionVersion = (typeof MOTION_VERSIONS)[number];
export const LATEST_MOTION_VERSION: MotionVersion = 2;

/** Upper bound of `global.seed` (uint32). */
export const MAX_SEED = 0xffffffff;

interface ContractSource {
  meta?: { motionVersion?: number; allowNondeterministic?: boolean } | null;
  global?: { seed?: number; fps?: number } | null;
}

export function resolveMotionVersion(descriptor: ContractSource | undefined): MotionVersion {
  return descriptor?.meta?.motionVersion === 2 ? 2 : 1;
}

export function resolveSeed(descriptor: ContractSource | undefined): number {
  const seed = descriptor?.global?.seed;

  return typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED ? seed : 0;
}

/**
 * Whether a render applies the deterministic encoder profile (bit-exact muxing, fixed encoder threads).
 * An explicit `ProjectConfig.deterministic` wins; otherwise a `motionVersion: 2` template opts in.
 */
export function resolveDeterministic(descriptor: ContractSource | undefined, configured: boolean | undefined): boolean {
  return configured ?? resolveMotionVersion(descriptor) >= 2;
}

/**
 * The time variable an animated expression reads. Version 1 keeps FFmpeg's `t` (historical output).
 * Version 2 reads the frame index over the constant output rate (`n/FPS`). After the engine's CFR
 * conform, the keyframe a frame shows depends only on its index, never on decoder timestamps, so
 * variable-frame-rate phone footage cannot drift an animation by a frame.
 */
export function timeVariable(version: MotionVersion, fps: number): string {
  return version >= 2 ? `(n/${fps})` : 't';
}
