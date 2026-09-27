import { type ComponentType } from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, Flash, Grain, ImpactCamera, Letterbox, Vignette } from '../film/cinema';
import { type Lang, LangProvider } from '../film/lang';
import { Soundtrack, type VoiceManifest } from '../film/soundtrack';
import { type NarrationLang } from '../film/narration';
import { AgenticScene } from './scenes/agentic';
import { CurtainScene } from './scenes/curtain';
import { DesktopScene } from './scenes/desktop';
import { EverywhereScene } from './scenes/everywhere';
import { FinaleScene } from './scenes/finale';
import { MobileScene } from './scenes/mobile';
import { TemplateScene } from './scenes/template';
import { TitleScene } from './scenes/title';
import { UseCasesScene } from './scenes/use-cases';
import { CLAPS, DURATION, HITS, SCENES, type SceneId, toFrames } from './timeline';
import voiceManifest from './voice-manifest.json';

// The LeClap showcase film: a 78-second trailer that presents the tool, its use cases, and closes on
// agentic development — scored and narrated. See storyboard.md for the shot list and the rules it
// was cut to. Picture, score and voice share one clock (timeline.ts).
//
// Layering, bottom to top: scenes (inside the impact camera: shake + RGB split on hits), impact
// flashes, vignette, grain, letterbox. Audio: the synthesized score, ducked under each voice line.
//
// `lang` picks the copy (copy.ts) and the picture beats — LeClapShowcase is English, LeClapShowcaseFr
// French (Root.tsx). Both are narrated in English (src/film/narration.ts).

const VOICE_MANIFESTS: Record<NarrationLang, VoiceManifest> = { en: voiceManifest };

const SCENE_COMPONENTS: Record<SceneId, ComponentType> = {
  curtain: CurtainScene,
  title: TitleScene,
  template: TemplateScene,
  everywhere: EverywhereScene,
  desktop: DesktopScene,
  mobile: MobileScene,
  useCases: UseCasesScene,
  agentic: AgenticScene,
  finale: FinaleScene,
};

const IMPACTS = [
  { frame: toFrames(HITS.title), strength: 1 },
  { frame: toFrames(HITS.magic), strength: 0.55 },
  { frame: toFrames(HITS.drop), strength: 1.3 },
  { frame: toFrames(HITS.proof), strength: 0.7 },
  { frame: toFrames(HITS.finale), strength: 1.1 },
  ...CLAPS.map((seconds) => ({ frame: toFrames(seconds), strength: 0.45 })),
];

const FLASHES = [
  { at: toFrames(HITS.title), peak: 0.85 },
  { at: toFrames(HITS.magic), peak: 0.35 },
  { at: toFrames(HITS.drop), peak: 0.95 },
  { at: toFrames(HITS.proof), peak: 0.45 },
  { at: toFrames(HITS.finale), peak: 0.9 },
  ...CLAPS.map((seconds) => ({ at: toFrames(seconds), peak: 0.4 })),
];

export const Showcase = ({ lang = 'en' }: { lang?: Lang }) => {
  const frame = useCurrentFrame();

  // Bars are on from the first frame (it's a theatre); in the last second they close like an iris.
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

        <Soundtrack score="showcase/score.wav" manifests={VOICE_MANIFESTS} />
      </AbsoluteFill>
    </LangProvider>
  );
};
