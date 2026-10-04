// OpenAI Chat Completions, called from the browser with the user's own key, in JSON mode. Not
// streamed (the dialog shows indeterminate progress); the model id is free text because OpenAI's
// catalogue moves fast — an unknown id is passed through and the API decides.
import {
  ProviderError,
  type GenerateRequest,
  type TemplateModelProvider,
} from '@/application/usecases/ai-template/model-provider';
import { postJson, readJson } from './http';

export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface Completion {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
}

export function openAiRequest(request: GenerateRequest) {
  return {
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${request.apiKey}`,
    },
    body: {
      model: request.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: request.system },
        ...request.messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    },
  };
}

export function readCompletion(payload: unknown): string {
  const choice = (payload as Completion).choices?.[0];

  if (!choice?.message) throw new ProviderError('bad-response', { detail: 'No completion in the response.' });

  if (choice.message.refusal) throw new ProviderError('refused', { detail: choice.message.refusal });

  if (choice.finish_reason === 'length') throw new ProviderError('truncated');

  return choice.message.content ?? '';
}

async function generate(request: GenerateRequest): Promise<string> {
  const { headers, body } = openAiRequest(request);
  const response = await postJson(OPENAI_URL, { headers, body, signal: request.signal });
  const text = readCompletion(await readJson(response));
  request.onProgress?.(text.length);

  return text;
}

export const openAiProvider: TemplateModelProvider = {
  id: 'openai',
  label: 'OpenAI',
  defaultModel: 'gpt-5',
  models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  freeformModel: true,
  looksLikeKey: (key) => key.startsWith('sk-') && !key.startsWith('sk-ant-') && key.length > 20,
  keyPlaceholder: 'sk-…',
  keyUrl: 'https://platform.openai.com/api-keys',
  generate,
};
