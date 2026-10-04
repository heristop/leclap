// The generation pipeline: brief → model → JSON extraction → engine validation → automatic repair.
// When the reply is not valid, the validator's issues go back to the model as a follow-up turn and
// it returns a corrected template — up to `maxRepairs` times. No React, no DOM: the provider is
// injected, so the whole loop runs in unit tests against a fake.
import type { TemplateDescriptor } from '@leclap/creative-kit/editor';
import { extractJsonObject } from './extract-json';
import type { ChatMessage, TemplateModelProvider } from './model-provider';
import { buildUserBrief, type GenerationHints } from './system-prompt';
import { formatIssues, validateGenerated, type ValidationIssue } from './validate-generated';

export type GenerationPhase =
  | { kind: 'thinking'; receivedChars: number }
  | { kind: 'validating'; round: number }
  | { kind: 'repairing'; round: number; issueCount: number; receivedChars: number };

export interface GenerateTemplateInput {
  provider: TemplateModelProvider;
  model: string;
  apiKey: string;
  system: string;
  prompt: string;
  hints: GenerationHints;
  signal?: AbortSignal;
  onPhase?: (phase: GenerationPhase) => void;
  maxRepairs?: number;
}

export interface GenerationResult {
  descriptor: TemplateDescriptor;
  // Model calls made: 1 when the first reply validated.
  rounds: number;
  warnings: string[];
}

export class GenerationFailedError extends Error {
  readonly issues: ValidationIssue[];
  readonly rounds: number;

  constructor(issues: ValidationIssue[], rounds: number) {
    super(
      `The generated template still had ${String(issues.length)} validation issue(s) after ${String(rounds)} attempts.`
    );
    this.name = 'GenerationFailedError';
    this.issues = issues;
    this.rounds = rounds;
  }
}

export const DEFAULT_MAX_REPAIRS = 3;

export function repairMessage(issues: ValidationIssue[]): string {
  return [
    'That template does not validate. Fix every issue below and reply with the complete corrected JSON object only.',
    formatIssues(issues),
  ].join('\n\n');
}

type Check = { ok: true; descriptor: TemplateDescriptor } | { ok: false; issues: ValidationIssue[] };

export function checkReply(reply: string): Check {
  const extracted = extractJsonObject(reply);

  if (!extracted.ok) return { ok: false, issues: [{ path: 'root', code: 'invalid_json', message: extracted.error }] };

  return validateGenerated(extracted.value);
}

function resultWarnings(descriptor: TemplateDescriptor, input: GenerateTemplateInput, rounds: number): string[] {
  const warnings: string[] = [];
  const wanted = input.hints.orientation;

  if (wanted && descriptor.global?.orientation !== wanted) {
    warnings.push(`Asked for ${wanted}, the model chose ${descriptor.global?.orientation ?? 'landscape'}.`);
  }

  if (rounds > 1) warnings.push(`Fixed validation issues automatically (${String(rounds - 1)} repair round(s)).`);

  return warnings;
}

function emit(input: GenerateTemplateInput, round: number, issueCount: number, receivedChars: number): void {
  input.onPhase?.(
    round === 1
      ? { kind: 'thinking', receivedChars }
      : { kind: 'repairing', round: round - 1, issueCount, receivedChars }
  );
}

async function attempt(
  input: GenerateTemplateInput,
  messages: ChatMessage[],
  round: number,
  lastIssues: ValidationIssue[]
): Promise<GenerationResult> {
  emit(input, round, lastIssues.length, 0);
  const reply = await input.provider.generate({
    system: input.system,
    messages,
    model: input.model,
    apiKey: input.apiKey,
    signal: input.signal,
    onProgress: (chars) => {
      emit(input, round, lastIssues.length, chars);
    },
  });
  input.onPhase?.({ kind: 'validating', round });
  const check = checkReply(reply);

  if (check.ok) {
    return { descriptor: check.descriptor, rounds: round, warnings: resultWarnings(check.descriptor, input, round) };
  }

  if (round > (input.maxRepairs ?? DEFAULT_MAX_REPAIRS)) throw new GenerationFailedError(check.issues, round);

  const next: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: reply },
    { role: 'user', content: repairMessage(check.issues) },
  ];

  return attempt(input, next, round + 1, check.issues);
}

export function generateTemplate(input: GenerateTemplateInput): Promise<GenerationResult> {
  return attempt(input, [{ role: 'user', content: buildUserBrief(input.prompt, input.hints) }], 1, []);
}
