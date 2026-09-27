// Clappy, the LeClap mascot (clappy.tsx), and what he does in the app: run the render loader, cheer a
// finished render, and react to a page that went wrong. His acting is pure maths in clappy.logic.ts.
export { Clappy, clappyHeight, type ClappyProps } from './clappy';
export { ClappyRunner, type ClappyRunnerProps } from './clappy-runner';
export { ClappyCheer, type ClappyCheerProps } from './clappy-cheer';
export { ClappyReaction, type ClappyReactionProps } from './clappy-reaction';
export type { ClappyMood, ClappyPose, ClappyReaction as ClappyReactionName } from './clappy.logic';
