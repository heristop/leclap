// Anthropic Messages API, called straight from the browser with the user's own key. Streams the
// reply over SSE so the dialog can show live progress. The system prompt is marked cacheable: repair
// rounds resend it unchanged, so they are billed at the cache-read rate.
import {
  ProviderError,
  type GenerateRequest,
  type TemplateModelProvider,
} from '@/application/usecases/ai-template/model-provider';
import { postJson } from './http';
import { readSse, type SseEvent } from './sse';

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 32_000;

interface StreamState {
  text: string;
  stopReason: string | null;
  error: ProviderError | null;
}

const STREAM_ERRORS: Record<string, ProviderError['kind']> = {
  overloaded_error: 'overloaded',
  rate_limit_error: 'rate-limit',
  authentication_error: 'auth',
  permission_error: 'auth',
};

interface StreamPayload {
  type?: string;
  delta?: { type?: string; text?: string; stop_reason?: string };
  error?: { type?: string; message?: string };
}

function parsePayload(data: string): StreamPayload {
  try {
    return JSON.parse(data) as StreamPayload;
  } catch {
    throw new ProviderError('bad-response', { detail: 'The stream carried malformed data.' });
  }
}

function streamError(payload: StreamPayload): ProviderError {
  const kind = STREAM_ERRORS[payload.error?.type ?? ''] ?? 'http';

  return new ProviderError(kind, { detail: payload.error?.message });
}

function applyEvent(state: StreamState, event: SseEvent): void {
  const payload = parsePayload(event.data);

  if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
    state.text += payload.delta.text ?? '';
  }

  if (payload.type === 'message_delta' && payload.delta?.stop_reason) state.stopReason = payload.delta.stop_reason;

  if (payload.type === 'error') state.error = streamError(payload);
}

function finish(state: StreamState): string {
  if (state.error) throw state.error;

  if (state.stopReason === 'refusal') throw new ProviderError('refused');

  if (state.stopReason === 'max_tokens') throw new ProviderError('truncated');

  return state.text;
}

export function anthropicRequest(request: GenerateRequest) {
  return {
    headers: {
      'content-type': 'application/json',
      'x-api-key': request.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: {
      model: request.model,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    },
  };
}

async function generate(request: GenerateRequest): Promise<string> {
  const { headers, body } = anthropicRequest(request);
  const response = await postJson(ANTHROPIC_URL, { headers, body, signal: request.signal });

  if (!response.body) throw new ProviderError('bad-response', { detail: 'The response had no body.' });

  const state: StreamState = { text: '', stopReason: null, error: null };

  try {
    await readSse(response.body, (event) => {
      applyEvent(state, event);
      request.onProgress?.(state.text.length);
    });
  } catch (error) {
    if (request.signal?.aborted) throw new ProviderError('aborted');

    throw error instanceof ProviderError
      ? error
      : new ProviderError('network', { detail: 'The stream was interrupted.' });
  }

  return finish(state);
}

export const anthropicProvider: TemplateModelProvider = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  defaultModel: 'claude-opus-5-5',
  models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5-20251001'],
  looksLikeKey: (key) => key.startsWith('sk-ant-') && key.length > 20,
  keyPlaceholder: 'sk-ant-…',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  generate,
};
