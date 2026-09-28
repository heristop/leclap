import { fail, hint, step } from './ui.js';

// Why a render failed, as the engine reported it through onError. It prints as-is, without the FFmpeg
// install hints: those are for an engine that could not start, and reinstalling FFmpeg does not fix a
// filter FFmpeg rejected.
export class EngineFailure extends Error {}

// compile() only resolves null on failure; the reason arrives through onError, unless the engine
// predates that hook.
export function compileFailure(reported: Error | undefined): Error {
  if (!reported) return new Error('Compilation failed to produce output');

  return new EngineFailure(reported.message, { cause: reported });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();

  if (typeof error === 'string') return error.trim();

  return JSON.stringify(error);
}

export function printErrorHints(error: unknown): void {
  const message = errorMessage(error);
  console.error(`\n${fail(message)}`);

  if (error instanceof EngineFailure) return;

  if (message.includes('FFmpeg') || message.includes('ffmpeg')) {
    console.error(hint('  try'));
    console.error(step('leclap diagnose'));
    console.error(step('npm i ffmpeg-static  (bundled fallback)'));
    console.error(step('macOS: brew install ffmpeg  ·  Linux: sudo apt install ffmpeg'));
  }
}
