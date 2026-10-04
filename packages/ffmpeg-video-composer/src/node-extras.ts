// Feature exports of the Node entry, kept out of index.ts for its line budget: per-format compositions
// (core/formats), probed media traits, and music analysis (the platform-neutral analyzer, and decoding a file with FFmpeg first).
export * from './core/formats';
export { analyzeBeats, detectOnsets, MIN_CONFIDENCE, type BeatAnalysis, type MusicCues } from './core/audio/beats';
export { applyMusicAnalysis, beatsFromAnalysis, type MusicAnalysis } from './core/audio/apply-analysis';
export { analyzeMusicFile, type AnalyzeMusicOptions } from './services/beats-analysis-node';
export { decodeMonoPcm, ANALYSIS_SAMPLE_RATE } from './platform/ffmpeg/decode-pcm-node';
// Probed source traits (HDR transfer, bit depth, VFR, rotation), shared with the MCP probe_media tool.
export { mediaTraits, type ProbeVideoStream } from './core/footage/media-traits';
