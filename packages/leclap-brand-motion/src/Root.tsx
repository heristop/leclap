import { Composition } from 'remotion';
import { Bumper } from './Bumper';
import { Kinetic } from './Kinetic';

const bumperProps = { wordmark: 'LeClap', tagline: 'CINEMATIC VIDEOS, ANYWHERE' };
const kineticProps = { wordmark: 'LeClap', tagline: 'MOTION, AUTHORED' };

// 3s @ 30fps. The marks are centered, so each composition renders cleanly at both aspects.
// `wordmark`/`tagline` are overridable via inputProps (e.g. the MCP's render_remotion_bumper tool).
// Two animation styles: `clapper` (logo clap) and `kinetic` (per-letter typography reveal).
export const RemotionRoot = () => (
  <>
    <Composition
      id="LeClapBrandMotion"
      component={Bumper}
      durationInFrames={90}
      fps={30}
      width={1280}
      height={720}
      defaultProps={bumperProps}
    />
    <Composition
      id="LeClapBrandMotionPortrait"
      component={Bumper}
      durationInFrames={90}
      fps={30}
      width={720}
      height={1280}
      defaultProps={bumperProps}
    />
    <Composition
      id="LeClapKinetic"
      component={Kinetic}
      durationInFrames={90}
      fps={30}
      width={1280}
      height={720}
      defaultProps={kineticProps}
    />
    <Composition
      id="LeClapKineticPortrait"
      component={Kinetic}
      durationInFrames={90}
      fps={30}
      width={720}
      height={1280}
      defaultProps={kineticProps}
    />
    {/* 1200x630 social card (og:image / twitter:image). Rendered as a still on the settled
        final frame via `pnpm --filter @leclap/brand-motion render:og`. */}
    <Composition
      id="LeClapOg"
      component={Bumper}
      durationInFrames={90}
      fps={30}
      width={1200}
      height={630}
      defaultProps={bumperProps}
    />
  </>
);
