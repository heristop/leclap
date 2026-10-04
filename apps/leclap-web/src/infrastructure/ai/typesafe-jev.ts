// Jev (TypeSafe AI) "System One" client, over plain fetch. Jev does not write text: it answers typed
// questions — choice, score, yes/no — about a `state` with calibrated probabilities. The builder
// uses it as a decision provider (brief routing, best-match picking), never to write the template.
// The key travels only in the Authorization header. Browser (CORS) support for this API is not
// confirmed; a blocked call surfaces as a 'network' ProviderError the UI explains.
import { ProviderError } from '@/application/usecases/ai-template/model-provider';
import type { JevAnswer, JevAsk, JevQuestion } from '@/application/usecases/ai-template/brief-router';
import { postJson, readJson } from './http';

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-latest';
export const JEV_KEY_ID = 'jev';
export const JEV_KEY_URL = 'https://typesafe.ai';

export interface JevRequest {
  apiKey: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
  signal?: AbortSignal;
  model?: string;
}

export function jevRequest(request: JevRequest) {
  return {
    headers: {
      authorization: `Bearer ${request.apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: { model: request.model ?? JEV_MODEL, state: request.state, questions: request.questions },
  };
}

export function readJevAnswers(payload: unknown): Record<string, JevAnswer> {
  const answers = (payload as { answers?: unknown } | null)?.answers;

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new ProviderError('bad-response', { detail: 'Jev returned no answers.' });
  }

  return answers as Record<string, JevAnswer>;
}

export async function askJev(request: JevRequest): Promise<Record<string, JevAnswer>> {
  const { headers, body } = jevRequest(request);
  const response = await postJson(JEV_URL, { headers, body, signal: request.signal });

  return readJevAnswers(await readJson(response));
}

// Bind a key (and an abort signal) into the `ask` function the pure router expects.
export function jevAsker(apiKey: string, signal?: AbortSignal): JevAsk {
  return (state, questions) => askJev({ apiKey, state, questions, signal });
}
