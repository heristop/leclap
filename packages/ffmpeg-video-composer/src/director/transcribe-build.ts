// Wires the director's build state into the transcription step (transcribe-sections.ts): the service the
// host registered (Node only), the section clips (footage-source.ts) and the probed lengths and kept
// windows the footage plans recorded.

import type { Section } from '@/core/types';
import type Project from '../core/models/Project';
import { footageSource, type FootageSourceDeps } from './footage-source';
import { TRANSCRIPTION_SERVICE, transcribeSections, type TranscriptionService } from './transcribe-sections';

// tsyringe is loaded on use, as in beats-analysis.ts.
async function registeredService(): Promise<TranscriptionService | null> {
  const { container } = await import('tsyringe');

  return container.isRegistered(TRANSCRIPTION_SERVICE)
    ? container.resolve<TranscriptionService>(TRANSCRIPTION_SERVICE)
    : null;
}

/** The build's descriptor with every transcription request pinned; `sections` are updated in place. */
export async function transcribeBuild<T extends { meta?: unknown; sections?: unknown }>(
  template: { descriptor: T },
  sections: Section[],
  deps: FootageSourceDeps,
  project: Pick<Project, 'buildInfos' | 'config'>
): Promise<T> {
  const descriptor = template.descriptor;
  const all = (Array.isArray(descriptor.sections) ? descriptor.sections : []) as Section[];

  return transcribeSections(descriptor, sections, {
    service: await registeredService(),
    sourceOf: async (name) => {
      const section = all.find((candidate) => candidate.name === name);

      return section ? footageSource(deps, section) : null;
    },
    fps: project.config.videoConfig?.fps ?? 30,
    buildInfos: project.buildInfos,
    logger: {
      info: (message) => {
        deps.logger.info(message);
      },
      warn: (message) => {
        deps.logger.warn(message);
      },
    },
  });
}
