import { type ComponentType } from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, Flash, Grain, ImpactCamera, Letterbox, Vignette } from '../film/cinema';
import { type Lang, LangProvider } from '../film/lang';
import { Soundtrack, type VoiceManifest } from '../film/soundtrack';
import { type NarrationLang } from '../film/narration';
import { HookScene } from './scenes/hook';
import { LoopScene } from './scenes/loop';
import { OutroScene } from './scenes/outro';
import { ReviewScene } from './scenes/review';
import { TitleScene } from './scenes/title';
import { CLAP, DURATION, HITS, SCENES, type SceneId, toFrames } from './timeline';
import voiceManifest from './voice-manifest.json';

// LeClap for agentic development: a 50-second film on one idea — don't describe the change, show it. A pull
// request that reads like prose; the loop (implement, collect evidence, render, attach) on the Kiln & Co.
// demo shop; the reviewer pressing play on real before/after evidence; the page's closing line. See
// storyboard.md. Same film kit, narrator and synth as the showcase; `lang` picks the copy (copy.ts) —
// LeClapAgentic is English, LeClapAgenticFr French (Root.tsx), both narrated in English (narration.ts).

const VOICE_MANIFESTS: Record<NarrationLang, VoiceManifest> = { en: voiceManifest };

const SCENE_COMPONENTS: Record<SceneId, ComponentType> = {
  hook: HookScene,
  title: TitleScene,
  loop: LoopScene,
  review: ReviewScene,
  outro: OutroScene,
};

const IMPACTS = [
  { frame: toFrames(CLAP), strength: 0.45 },
  { frame: toFrames(HITS.title), strength: 1 },
  { frame: toFrames(HITS.review), strength: 0.55 },
  { frame: toFrames(HITS.outro), strength: 0.8 },
  { frame: toFrames(HITS.logo), strength: 0.5 },
];

const FLASHES = [
  { at: toFrames(CLAP), peak: 0.4 },
  { at: toFrames(HITS.title), peak: 0.85 },
  { at: toFrames(HITS.review), peak: 0.3 },
  { at: toFrames(HITS.outro), peak: 0.8 },
  { at: toFrames(HITS.logo), peak: 0.5 },
];

export const AgenticFilm = ({ lang = 'en' }: { lang?: Lang }) => {
  const frame = useCurrentFrame();
  const bars = interpolate(frame, [toFrames(DURATION - 0.9), toFrames(DURATION)], [1, 8.6], CLAMP);

  return (
    <LangProvider lang={lang}>
      <AbsoluteFill style={{ background: '#000' }}>
        <ImpactCamera hits={IMPACTS}>
          {SCENES.map((scene) => {
            const Scene = SCENE_COMPONENTS[scene.id];

            return (
              <Sequence
                key={scene.id}
                name={scene.id}
                from={toFrames(scene.from)}
                durationInFrames={toFrames(scene.to - scene.from)}
              >
                <Scene />
              </Sequence>
            );
          })}
        </ImpactCamera>

        {FLASHES.map((flash) => (
          <Flash key={flash.at} at={flash.at} peak={flash.peak} />
        ))}
        <Vignette strength={0.55} />
        <Grain opacity={0.08} />
        <Letterbox amount={bars} />

        <Soundtrack score="agentic/score.wav" manifests={VOICE_MANIFESTS} />
      </AbsoluteFill>
    </LangProvider>
  );
};
