// Drives one Generate-with-AI session: the optional Jev brief analysis and the generation run, each
// cancellable through its own AbortController (closing the dialog aborts both).
import { useEffect, useReducer, useRef, useState } from 'react';
import { routeBrief, type BriefRoute } from '@/application/usecases/ai-template/brief-router';
import { summarizeDescriptor } from '@/application/usecases/ai-template/descriptor-summary';
import { generateTemplate } from '@/application/usecases/ai-template/generate-template';
import { generationContext, promptFor } from '@/application/usecases/ai-template/generation-context';
import type { TemplateModelProvider } from '@/application/usecases/ai-template/model-provider';
import type { GenerationHints } from '@/application/usecases/ai-template/system-prompt';
import { jevAsker } from '@/infrastructure/ai/typesafe-jev';
import { describeFailure, IDLE, runReducer, type FailureCopy } from './ai-generation.logic';

export type RouteState =
  | { kind: 'none' }
  | { kind: 'routing' }
  | { kind: 'ready'; route: BriefRoute }
  | { kind: 'error'; error: FailureCopy };

export interface GenerateArgs {
  provider: TemplateModelProvider;
  model: string;
  apiKey: string;
  brief: string;
  hints: GenerationHints;
  preferSampleIds: string[];
  // Binding keep / avoid rules from an analysed reference ("Match a reference").
  referenceStyle?: string;
}

function abort(ref: { current: AbortController | null }): AbortController {
  ref.current?.abort();
  const next = new AbortController();
  ref.current = next;

  return next;
}

export function useAiGeneration() {
  const [status, dispatch] = useReducer(runReducer, IDLE);
  const [route, setRoute] = useState<RouteState>({ kind: 'none' });
  const runRef = useRef<AbortController | null>(null);
  const routeRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      runRef.current?.abort();
      routeRef.current?.abort();
    },
    []
  );

  const generate = async (args: GenerateArgs): Promise<void> => {
    const controller = abort(runRef);
    dispatch({ type: 'start' });

    try {
      const prompt = promptFor(args.brief, args.hints, args.preferSampleIds, args.referenceStyle);
      const result = await generateTemplate({
        provider: args.provider,
        model: args.model,
        apiKey: args.apiKey,
        system: prompt.system,
        prompt: args.brief,
        hints: args.hints,
        signal: controller.signal,
        onPhase: (phase) => {
          if (!controller.signal.aborted) dispatch({ type: 'phase', phase });
        },
      });

      if (!controller.signal.aborted) {
        dispatch({ type: 'done', result, summary: summarizeDescriptor(result.descriptor) });
      }
    } catch (error) {
      dispatch({ type: 'fail', error: controller.signal.aborted ? new DOMException('Aborted', 'AbortError') : error });
    }
  };

  // Resolves with the route (null on failure or cancel) so a caller can generate straight after.
  const analyse = async (brief: string, jevKey: string): Promise<BriefRoute | null> => {
    const controller = abort(routeRef);
    setRoute({ kind: 'routing' });

    try {
      const context = generationContext();
      const next = await routeBrief(
        brief,
        context.samples,
        jevAsker(jevKey, controller.signal),
        context.catalog.themes
      );

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      setRoute({ kind: 'ready', route: next });

      return next;
    } catch (error) {
      // A newer analysis owns the state now; leave it alone.
      if (routeRef.current !== controller) return null;

      setRoute(controller.signal.aborted ? { kind: 'none' } : { kind: 'error', error: describeFailure(error, 'jev') });

      return null;
    }
  };

  return {
    status,
    route,
    generate,
    analyse,
    cancel: () => {
      runRef.current?.abort();
      routeRef.current?.abort();
    },
    reset: () => {
      dispatch({ type: 'reset' });
    },
    clearRoute: () => {
      routeRef.current?.abort();
      setRoute({ kind: 'none' });
    },
  };
}
