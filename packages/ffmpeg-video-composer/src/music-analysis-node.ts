// Music analysis exports for the Node entry: the platform-neutral analyzer, and decoding a file with
// FFmpeg first. Kept out of index.ts for its line budget.
export { analyzeBeats, detectOnsets, MIN_CONFIDENCE, type BeatAnalysis, type MusicCues } from './core/audio/beats';
export { applyMusicAnalysis, beatsFromAnalysis, type MusicAnalysis } from './core/audio/apply-analysis';
export { analyzeMusicFile, type AnalyzeMusicOptions } from './services/beats-analysis-node';
export { decodeMonoPcm, ANALYSIS_SAMPLE_RATE } from './platform/ffmpeg/decode-pcm-node';
