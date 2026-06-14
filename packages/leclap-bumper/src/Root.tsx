import { Composition } from 'remotion';
import { Bumper } from './Bumper';

// 2.4s @ 30fps to match the bumper clip the premium-logo-bumper partial plays.
export const RemotionRoot = () => (
  <Composition id="LeClapBumper" component={Bumper} durationInFrames={72} fps={30} width={1280} height={720} />
);
