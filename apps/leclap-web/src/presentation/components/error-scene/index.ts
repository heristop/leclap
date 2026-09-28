// The error pages: one scene (error-scene.tsx) played three ways — a missing page, a request that can't be
// served, and a crash or a lost connection — with Clappy reacting to each.
export { ErrorScene, type ErrorSceneProps, type SceneTone } from './error-scene';
export { NotFoundScene, type NotFoundSceneProps } from './not-found-scene';
export { ProblemScene, type ProblemKind, type ProblemSceneProps } from './problem-scene';
export { suggestPath } from './not-found.logic';
export { isChunkLoadError, routeErrorKind, type RouteErrorKind } from './route-error.logic';
