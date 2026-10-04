import { afterEach, describe, expect, it, vi } from 'vitest';
import { askJev, JEV_URL, jevAsker, readJevAnswers } from './typesafe-jev';

const KEY = 'jev-secret-key-42';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('askJev', () => {
  it('posts to System One with the exact headers and body shape', async () => {
    const answers = {
      genre: { type: 'choice', choice: 'explainer', confidence: 0.8, probabilities: { explainer: 0.8 } },
    };
    const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ model: 'jev-latest', answers, usage: { input_tokens: 1, output_tokens: 1 } }))
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const questions = {
      genre: { type: 'choice' as const, instructions: 'Which kind?', criteria: { explainer: 'Explains', other: null } },
    };

    const result = await askJev({ apiKey: KEY, state: 'a calm explainer', questions });
    const [url, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;

    expect(result).toEqual(answers);
    expect(url).toBe(JEV_URL);
    expect(init.method).toBe('POST');
    expect(headers).toEqual({
      authorization: `Bearer ${KEY}`,
      'content-type': 'application/json',
      accept: 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({ model: 'jev-latest', state: 'a calm explainer', questions });
    expect(init.body as string).not.toContain(KEY);
    expect(url).not.toContain(KEY);
  });

  it('turns a CORS/network failure into a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(jevAsker(KEY)('x', {})).rejects.toMatchObject({ kind: 'network' });
  });

  it('maps a rejected key and a malformed body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"bad key"}', { status: 401 })));
    await expect(askJev({ apiKey: KEY, state: 'x', questions: {} })).rejects.toMatchObject({ kind: 'auth' });

    expect(() => readJevAnswers({ model: 'jev-latest' })).toThrow();
  });
});
