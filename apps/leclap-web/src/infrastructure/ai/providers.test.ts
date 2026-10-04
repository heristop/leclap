import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, type GenerateRequest } from '@/application/usecases/ai-template/model-provider';
import { ANTHROPIC_URL, anthropicProvider } from './anthropic-provider';
import { OPENAI_URL, openAiProvider } from './openai-provider';
import { findProvider, TEMPLATE_MODEL_PROVIDERS } from './registry';
import { parseSseBlock, splitSseBuffer } from './sse';

const KEY = 'sk-ant-secret-key-0123456789';

function request(overrides: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    system: 'SYSTEM PROMPT',
    messages: [{ role: 'user', content: 'Brief: a launch' }],
    model: 'claude-opus-5-5',
    apiKey: KEY,
    ...overrides,
  };
}

function sseResponse(events: Array<Record<string, unknown>>): Response {
  const text = events.map((event) => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  // Deliver in two uneven chunks so events straddle a chunk boundary.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 37));
      controller.enqueue(bytes.slice(37));
      controller.close();
    },
  });

  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function delta(text: string) {
  return { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
}

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  );
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

// The key may only appear in the auth header: never in the URL or the body.
function expectKeyOnlyInHeader(fetchMock: ReturnType<typeof mockFetch>, header: string, expected: string) {
  const [url, init] = fetchMock.mock.calls[0];
  const headers = init.headers as Record<string, string>;

  expect(url).not.toContain(KEY);
  expect(init.body as string).not.toContain(KEY);
  expect(headers[header]).toBe(expected);

  for (const [name, value] of Object.entries(headers)) {
    if (name !== header) expect(value).not.toContain(KEY);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('anthropicProvider', () => {
  it('posts a streaming Messages request with the browser headers', async () => {
    const fetchMock = mockFetch(
      sseResponse([
        { type: 'message_start', message: {} },
        delta('{"sections":'),
        delta('[]}'),
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' },
      ])
    );
    const progress: number[] = [];
    const text = await anthropicProvider.generate(request({ onProgress: (chars) => progress.push(chars) }));
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(text).toBe('{"sections":[]}');
    expect(progress.at(-1)).toBe(15);
    expect(url).toBe(ANTHROPIC_URL);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      stream: true,
      messages: [{ role: 'user', content: 'Brief: a launch' }],
    });
    expect(body.max_tokens).toBeGreaterThanOrEqual(16_000);
    expect(body.system).toEqual([{ type: 'text', text: 'SYSTEM PROMPT', cache_control: { type: 'ephemeral' } }]);
    expectKeyOnlyInHeader(fetchMock, 'x-api-key', KEY);
  });

  it('maps a refusal, a truncation and a streamed error', async () => {
    mockFetch(sseResponse([delta('{'), { type: 'message_delta', delta: { stop_reason: 'max_tokens' } }]));
    await expect(anthropicProvider.generate(request())).rejects.toMatchObject({ kind: 'truncated' });

    mockFetch(sseResponse([{ type: 'message_delta', delta: { stop_reason: 'refusal' } }]));
    await expect(anthropicProvider.generate(request())).rejects.toMatchObject({ kind: 'refused' });

    mockFetch(sseResponse([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]));
    await expect(anthropicProvider.generate(request())).rejects.toMatchObject({ kind: 'overloaded' });
  });

  it('maps HTTP 401 / 429 and network failures to actionable kinds', async () => {
    mockFetch(new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 }));
    await expect(anthropicProvider.generate(request())).rejects.toMatchObject({
      kind: 'auth',
      detail: 'invalid x-api-key',
    });

    mockFetch(new Response('{}', { status: 429 }));
    await expect(anthropicProvider.generate(request())).rejects.toMatchObject({ kind: 'rate-limit', status: 429 });

    mockFetch(new TypeError('Failed to fetch'));
    await expect(anthropicProvider.generate(request())).rejects.toMatchObject({ kind: 'network' });
  });

  it('reports an aborted request as aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch(new DOMException('aborted', 'AbortError'));

    await expect(anthropicProvider.generate(request({ signal: controller.signal }))).rejects.toMatchObject({
      kind: 'aborted',
    });
  });

  it('checks the key format lightly', () => {
    expect(anthropicProvider.looksLikeKey(KEY)).toBe(true);
    expect(anthropicProvider.looksLikeKey('sk-proj-abcdefghijklmnopqrstuvwxyz')).toBe(false);
  });
});

describe('openAiProvider', () => {
  const OPENAI_KEY = 'sk-proj-openai-secret-0123456789';

  it('posts a JSON-mode chat completion with the Bearer key only in the header', async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"a":1}' } }] }), {
        status: 200,
      })
    );
    const text = await openAiProvider.generate(request({ apiKey: OPENAI_KEY, model: 'some-future-model' }));
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    const headers = init.headers as Record<string, string>;

    expect(text).toBe('{"a":1}');
    expect(url).toBe(OPENAI_URL);
    expect(body).toEqual({
      model: 'some-future-model',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'SYSTEM PROMPT' },
        { role: 'user', content: 'Brief: a launch' },
      ],
    });
    expect(headers.authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(init.body as string).not.toContain(OPENAI_KEY);
    expect(url).not.toContain(OPENAI_KEY);
  });

  it('maps truncation and refusals', async () => {
    mockFetch(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{' } }] })));
    await expect(openAiProvider.generate(request())).rejects.toMatchObject({ kind: 'truncated' });

    mockFetch(new Response(JSON.stringify({ choices: [{ message: { content: null, refusal: 'No.' } }] })));
    await expect(openAiProvider.generate(request())).rejects.toBeInstanceOf(ProviderError);
  });

  it('accepts free-text models and checks the key format', () => {
    expect(openAiProvider.freeformModel).toBe(true);
    expect(openAiProvider.looksLikeKey(OPENAI_KEY)).toBe(true);
    expect(openAiProvider.looksLikeKey(KEY)).toBe(false);
  });
});

describe('registry', () => {
  it('lists every provider once and falls back to Anthropic', () => {
    expect(TEMPLATE_MODEL_PROVIDERS.map((provider) => provider.id)).toEqual(['anthropic', 'openai']);
    expect(findProvider('openai')).toBe(openAiProvider);
    expect(findProvider('unknown')).toBe(anthropicProvider);
  });
});

describe('sse parsing', () => {
  it('splits CRLF buffers and keeps the unfinished tail', () => {
    expect(splitSseBuffer('data: 1\r\n\r\ndata: 2')).toEqual({ blocks: ['data: 1'], rest: 'data: 2' });
    expect(parseSseBlock(': comment')).toBeNull();
    expect(parseSseBlock('event: ping\ndata: {}')).toEqual({ event: 'ping', data: '{}' });
  });
});
