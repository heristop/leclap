// The determinism contract (docs/plans/motion-system-v2.md §1): pure, platform-neutral helpers that
// every entry point can re-export.
export { fnv1a32, deriveSeed, seededRandom, canonicalJson } from './hash';
export { sha256Hex } from './sha256';
export {
  MOTION_VERSIONS,
  LATEST_MOTION_VERSION,
  MAX_SEED,
  resolveMotionVersion,
  resolveSeed,
  resolveDeterministic,
  timeVariable,
  type MotionVersion,
} from './contract';
export { findNondeterministicExpressions, type NondeterministicFinding } from './hygiene';
export { BITEXACT_OUTPUT_ARGS, X264_THREADS, applyDeterministicProfile, injectOutputArgs } from './command-tap';
export {
  MANIFEST_SCHEMA_VERSION,
  buildRenderManifest,
  graphDigest,
  normalizeCommand,
  templateDigest,
  type ManifestRoots,
  type RenderManifest,
} from './manifest';
