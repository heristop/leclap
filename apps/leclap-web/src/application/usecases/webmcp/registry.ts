// Turns the tool definitions into registrable ToolSpecs: zod inputs become JSON Schema (top-level
// `type: "object"`), annotations follow each tool's kind, and every execute runs behind the same guard —
// abort check, input size, per-kind rate limit, zod parse, one mutating call at a time, the in-page
// confirmation its policy asks for — then reports the call to the activity log. Only this module is
// imported lazily by the builder (on idle, once WebMCP is present and enabled).
//
// Extension points: later phases append definitions to BUILDER_TOOL_DEFINITIONS (or pass their own list);
// a definition with `requires` registers only when the builder reports that capability, and `kind:
// 'consequential'` tools get consequentialHint plus an `always` confirmation by default.
import { z } from 'zod';
import type { EditorState } from '@leclap/creative-kit/editor';
import { createRateLimiter, inputBytes, MAX_INPUT_BYTES, sanitizeText, type RateLimiter } from './guard';
import { capOutput, errorCode, fail } from './results';
import { READ_TOOLS } from './read-tools';
import { REFERENCE_TOOLS } from './reference-tools';
import { VALIDATE_TOOLS } from './validate-tools';
import { EDIT_TOOLS } from './edit-tools';
import type {
  ActivityInput,
  BuilderPort,
  BuilderToolOptions,
  ConfirmPolicy,
  ToolAnnotations,
  ToolContext,
  ToolDefinition,
  ToolResult,
  ToolSpec,
} from './types';

export const BUILDER_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  ...READ_TOOLS,
  ...REFERENCE_TOOLS,
  ...VALIDATE_TOOLS,
  ...EDIT_TOOLS,
];

const DEFAULT_CONFIRM: Record<ToolDefinition['kind'], ConfirmPolicy> = {
  read: 'never',
  edit: 'ask-before-edit',
  consequential: 'always',
};

export function annotationsFor(definition: ToolDefinition): ToolAnnotations {
  return {
    readOnlyHint: definition.kind === 'read',
    ...(definition.kind === 'consequential' ? { consequentialHint: true } : {}),
    ...definition.annotations,
  };
}

export function inputSchemaOf(definition: ToolDefinition): Record<string, unknown> {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(definition.input, { io: 'input' }) as Record<string, unknown>;

  return { ...schema, type: 'object' };
}

/** State shared by one registration's tools. */
interface Session {
  limiter: RateLimiter;
  busy: boolean;
  /** States the agent's edits produced, oldest first. */
  steps: EditorState[];
}

function needsConfirm(policy: ConfirmPolicy, port: BuilderPort): boolean {
  return policy === 'always' || (policy === 'ask-before-edit' && port.askBeforeEdit());
}

function noteOf(args: unknown): string | undefined {
  const note = (args as { note?: unknown } | null)?.note;

  return typeof note === 'string' && note.trim() !== '' ? sanitizeText(note).slice(0, 200) : undefined;
}

// Guards that run before parsing: abort, size, rate.
function precheck(definition: ToolDefinition, raw: unknown, signal: AbortSignal, session: Session): ToolResult | null {
  if (signal.aborted) return fail('aborted', 'The call was cancelled.');

  if (inputBytes(raw) > MAX_INPUT_BYTES) return fail('too_large', 'The input is larger than 512 KB.');

  const rate = session.limiter.take(definition.kind);

  return rate.ok ? null : fail('rate_limited', 'Too many calls; wait and retry.', { retryAfterMs: rate.retryAfterMs });
}

function parse(definition: ToolDefinition, raw: unknown): { args: unknown } | ToolResult {
  const parsed = definition.input.safeParse(raw ?? {});

  if (parsed.success) return { args: parsed.data };

  const issues = parsed.error.issues
    .slice(0, 10)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);

  return fail('invalid_input', `Invalid input: ${issues.join('; ')}`);
}

interface CallRecord {
  produced?: EditorState;
  changed: number[];
}

function contextFor(
  definition: ToolDefinition,
  port: BuilderPort,
  signal: AbortSignal,
  origin: string,
  session: Session
) {
  const record: CallRecord = { changed: [] };
  const context: ToolContext = {
    port,
    signal,
    origin,
    commit: (next, changed) => {
      port.commit(next, { tool: definition.name, changed });
      record.produced = next;
      record.changed = changed;
      session.steps.push(next);
    },
    undoAgentStep: () => {
      const present = port.getState();
      const index = session.steps.lastIndexOf(present);

      if (index === -1) return false;

      session.steps.length = index;

      return port.undoIfPresent(present);
    },
  };

  return { context, record };
}

async function confirmed(definition: ToolDefinition, args: unknown, port: BuilderPort, signal: AbortSignal) {
  if (!needsConfirm(definition.confirm ?? DEFAULT_CONFIRM[definition.kind], port)) return null;

  if (!port.isDocumentVisible()) {
    return fail('needs_user_attention', 'The builder tab is in the background; ask the user to switch to it.');
  }

  const accepted = await port.confirm({ tool: definition.name, kind: definition.kind, note: noteOf(args) }, signal);

  return accepted ? null : fail('user_declined', 'The user declined this action in the page.');
}

async function runGuarded(definition: ToolDefinition, args: unknown, signal: AbortSignal, deps: ExecuteDeps) {
  const { port, origin, session } = deps;
  const refused = await confirmed(definition, args, port, signal);

  if (refused) return { result: refused, record: { changed: [] } as CallRecord };

  const { context, record } = contextFor(definition, port, signal, origin, session);

  try {
    return { result: await definition.run(args, context), record };
  } catch (error) {
    return { result: fail('unavailable', error instanceof Error ? error.message : String(error)), record };
  }
}

function statusOf(code: ReturnType<typeof errorCode>): ActivityInput['status'] {
  if (code === 'user_declined') return 'declined';

  return code ? 'error' : 'ok';
}

interface ExecuteDeps {
  port: BuilderPort;
  origin: string;
  session: Session;
}

async function execute(definition: ToolDefinition, raw: unknown, signal: AbortSignal, deps: ExecuteDeps) {
  const early = precheck(definition, raw, signal, deps.session);

  if (early) return early;

  const parsed = parse(definition, raw);

  if (!('args' in parsed)) return parsed;

  const mutating = definition.kind !== 'read';

  if (mutating && deps.session.busy) return fail('busy', 'Another edit is still running; retry when it finishes.');

  deps.session.busy ||= mutating;

  try {
    const { result, record } = await runGuarded(definition, parsed.args, signal, deps);
    const code = errorCode(result);
    deps.port.report({
      tool: definition.name,
      kind: definition.kind,
      status: statusOf(code),
      ...(code ? { code } : {}),
      changed: record.changed,
      ...(record.produced ? { produced: record.produced } : {}),
      note: noteOf(parsed.args),
    });

    return capOutput(result, 'Ask for less (a query, a pointer or a filter).');
  } finally {
    if (mutating) deps.session.busy = false;
  }
}

/** The tools to register for this builder, given its capabilities. */
export function buildBuilderTools(
  port: BuilderPort,
  options: BuilderToolOptions,
  definitions: readonly ToolDefinition[] = BUILDER_TOOL_DEFINITIONS
): ToolSpec[] {
  const session: Session = { limiter: createRateLimiter(options.now ?? Date.now), busy: false, steps: [] };
  const deps: ExecuteDeps = { port, origin: options.origin, session };

  return definitions
    .filter((definition) => !definition.requires || options.capabilities.has(definition.requires))
    .map((definition) => ({
      name: definition.name,
      title: definition.title,
      description: definition.description,
      kind: definition.kind,
      confirm: definition.confirm ?? DEFAULT_CONFIRM[definition.kind],
      inputSchema: inputSchemaOf(definition),
      annotations: annotationsFor(definition),
      execute: (input, executeOptions) =>
        execute(definition, input, executeOptions?.signal ?? new AbortController().signal, deps),
    }));
}
