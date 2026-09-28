// Clappy, the LeClap mascot (clappy.tsx), and what he does in the app: run the render loader, cheer a
// finished render, react to a page that went wrong (or wave hello), and slate the camera's countdown. Wherever
// he stands, his eyes follow the pointer (use-clappy-gaze.ts) and a click makes him clap (use-click-clap.ts).
// His acting is pure maths in clappy.logic.ts, his gaze in clappy-gaze.logic.ts.
export { Clappy, clappyHeight, type ClappyProps } from './clappy';
export { ClappyRunner, type ClappyRunnerProps } from './clappy-runner';
export { ClappyCheer, type ClappyCheerProps } from './clappy-cheer';
export { ClappyReaction, type ClappyReactionProps } from './clappy-reaction';
export { ClappyCountdown, type ClappyCountdownProps } from './clappy-countdown';
export type { ClappyMood, ClappyPose, ClappyReaction as ClappyReactionName } from './clappy.logic';
