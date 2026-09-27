import { Html5Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { DUCK_DEPTH, SCORE_LEVEL, scoreVolumeAt } from './ducking';
import { useLang } from './lang';
import { NARRATION, type NarrationLang } from './narration';

// A film's audio in the composition: the synthesised score (audio/generate-score.ts) and the narration
// lines (audio/generate-voice.ts → voice-manifest.json), the score ducked under each line (ducking.ts). The
// score is the same in every language; the narration is the one NARRATION gives the cut (English for all).
// Final renders mix the same curve offline (audio/mix-soundtrack.ts) — this is what Studio plays.

export interface VoiceManifest {
  lines: readonly { id: string; start: number; duration: number; file: string }[];
}

export const Soundtrack = ({
  score,
  manifests,
  level = SCORE_LEVEL,
  duck = DUCK_DEPTH,
}: {
  /** Score path under public/. */
  score: string;
  /** The narration, per narrated language. */
  manifests: Record<NarrationLang, VoiceManifest>;
  level?: number;
  duck?: number;
}) => {
  const { fps } = useVideoConfig();
  const lang = useLang();
  const manifest = manifests[NARRATION[lang]];

  return (
    <>
      <Html5Audio src={staticFile(score)} volume={(frame) => scoreVolumeAt(frame / fps, manifest.lines, level, duck)} />
      {manifest.lines.map((line) => (
        <Sequence
          key={line.id}
          name={line.id}
          from={Math.round(line.start * fps)}
          durationInFrames={Math.round((line.duration + 0.5) * fps)}
          layout="none"
        >
          <Html5Audio src={staticFile(line.file)} volume={1} />
        </Sequence>
      ))}
    </>
  );
};
