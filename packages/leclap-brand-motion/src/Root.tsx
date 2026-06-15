import { Composition } from 'remotion';
import { Bumper } from './Bumper';

// 3s @ 30fps: the clap lands early, then the lockup holds so the brand reads.
// The mark is centered, so the same composition renders cleanly at both aspects.
export const RemotionRoot = () => (
  <>
    <Composition id="LeClapBrandMotion" component={Bumper} durationInFrames={90} fps={30} width={1280} height={720} />
    <Composition
      id="LeClapBrandMotionPortrait"
      component={Bumper}
      durationInFrames={90}
      fps={30}
      width={720}
      height={1280}
    />
  </>
);
