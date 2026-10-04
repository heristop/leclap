// Shared fetch plumbing for the bring-your-own-key AI adapters: one place that turns network
// failures, aborts and HTTP statuses into ProviderErrors the UI can explain. Nothing here logs, and
// error details only ever carry the provider's response text — the key lives in request headers.
import { ProviderError } from '@/application/usecases/ai-template/model-provider';

// Pull a human message out of the usual `{ error: { message } }` / `{ message }` error bodies.
export function errorDetail(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown };
    const nested = typeof parsed.error === 'object' ? parsed.error.message : parsed.error;
    const message = nested ?? parsed.message;

    return typeof message === 'string' ? message.slice(0, 400) : undefined;
  } catch {
    return body.trim() === '' ? undefined : body.trim().slice(0, 400);
  }
}

export function errorForStatus(status: number, body: string): ProviderError {
  const detail = errorDetail(body);

  if (status === 401 || status === 403) return new ProviderError('auth', { status, detail });

  if (status === 429) return new ProviderError('rate-limit', { status, detail });

  if (status === 529 || status === 503) return new ProviderError('overloaded', { status, detail });

  if (status === 400 || status === 404 || status === 413 || status === 422) {
    return new ProviderError('bad-request', { status, detail });
  }

  return new ProviderError('http', { status, detail });
}

// fetch() that rejects with a ProviderError: aborted → 'aborted'; a TypeError (offline, DNS, or the
// API refusing this origin via CORS — browsers don't tell them apart) → 'network'; non-2xx → by status.
export async function postJson(
  url: string,
  init: { headers: Record<string, string>; body: unknown; signal?: AbortSignal }
) {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: init.headers,
      body: JSON.stringify(init.body),
      signal: init.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch (error) {
    if (init.signal?.aborted) throw new ProviderError('aborted');

    throw new ProviderError('network', { detail: error instanceof Error ? error.message : undefined });
  }

  if (!response.ok) throw errorForStatus(response.status, await response.text().catch(() => ''));

  return response;
}

// Read a JSON body, mapping a malformed one to 'bad-response'.
export async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ProviderError('bad-response', { detail: 'The response was not valid JSON.' });
  }
}
