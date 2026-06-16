# Remotion-Assisted Template Descriptor Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo owner rule:** never run `git commit`/`git push` without explicit consent. Treat every "Commit" step as a checkpoint to request approval, or batch commits at the end with one approval.

**Goal:** Help an LLM use Remotion's composition/sequence mental model to create valid LeClap template descriptors through `@leclap/mcp`, without using Remotion as the runtime renderer.

**Architecture:** Keep `compose_video` and the FFmpeg composer unchanged. Add authoring-only MCP affordances: a Remotion-to-LeClap guide and a deterministic `draft_template_from_remotion_storyboard` tool. The calling LLM can use Remotion MCP or Remotion concepts to plan a video as a structured storyboard, then ask LeClap MCP to convert that storyboard into a strict `TemplateDescriptor`, validate it, and render with the existing `compose_video` flow.

**Tech Stack:** Node 24, TypeScript 6, pnpm 11, `@modelcontextprotocol/sdk`, zod 4, existing `ffmpeg-video-composer` schemas, vitest, `vp` lint/build flow. No Remotion runtime dependency is added to `@leclap/mcp` for this MVP.

---

## Design Correction

Remotion is an authoring aid, not a renderer, in this plan.

- Do not add `renderer`, `remotion`, or runtime render-selection fields to `compose_video`.
- Do not create a Remotion composition package for runtime output in this iteration.
- Do not parse arbitrary Remotion TSX. That is brittle and would require executing or partially compiling user code.
- Use a small structured bridge: a Remotion-style storyboard JSON that maps cleanly to the LeClap descriptor schema.
- The LLM owns creative interpretation. The MCP server owns deterministic conversion and validation.

The intended agent flow becomes:

1. Call `get_template_schema` and `get_remotion_authoring_guide`.
2. Use Remotion MCP or Remotion concepts to think in `Composition` and `Sequence` terms.
3. Produce a structured storyboard JSON.
4. Call `draft_template_from_remotion_storyboard`.
5. Call `validate_template` on the returned descriptor.
6. Call `compose_video` with the descriptor.

---

## File Structure

Create:

- `packages/mcp/src/authoring/remotionGuide.ts` - plain-language Remotion-to-LeClap mapping and examples for LLMs.
- `packages/mcp/src/authoring/remotionStoryboard.ts` - zod schema and TS types for the structured storyboard bridge.
- `packages/mcp/src/authoring/storyboardToTemplate.ts` - deterministic storyboard-to-`TemplateDescriptor` conversion.
- `packages/mcp/src/tools/getRemotionAuthoringGuide.ts` - MCP tool that returns the authoring guide.
- `packages/mcp/src/tools/draftTemplateFromRemotionStoryboard.ts` - MCP tool that converts storyboard JSON into a descriptor and validation summary.
- `packages/mcp/tests/remotion-authoring-guide.test.ts`
- `packages/mcp/tests/remotion-storyboard.test.ts`
- `packages/mcp/tests/storyboard-to-template.test.ts`
- `packages/mcp/tests/draft-template-from-remotion-storyboard.test.ts`

Modify:

- `packages/mcp/src/server.ts` - register the two authoring tools.
- `packages/mcp/src/prompts/composeGuide.ts` - update the prompt to steer LLMs through Remotion-assisted descriptor authoring.
- `packages/mcp/README.md` - document the new authoring flow.
- `packages/mcp/features/agent.feature` - add a BDD scenario for authoring a descriptor from a Remotion-style storyboard.
- `packages/mcp/features/steps/agent.steps.ts` - add step definitions for the new scenario.

Do not modify:

- `packages/mcp/src/tools/composeVideo.ts` except if documentation strings need a tiny mention that descriptors can be drafted by the new authoring tool.
- `packages/mcp/src/compose/renderRunner.ts`
- `packages/mcp/src/worker/renderWorker.ts`
- `packages/ffmpeg-video-composer` runtime code

---

### Task 1: Add the Remotion-to-LeClap authoring guide

This gives the LLM a stable, discoverable mapping from Remotion vocabulary to LeClap descriptor fields.

**Files:**

- Create: `packages/mcp/src/authoring/remotionGuide.ts`
- Create: `packages/mcp/src/tools/getRemotionAuthoringGuide.ts`
- Modify: `packages/mcp/src/server.ts`
- Test: `packages/mcp/tests/remotion-authoring-guide.test.ts`

- [ ] **Step 1: Write the failing guide tool test**

Create `packages/mcp/tests/remotion-authoring-guide.test.ts`:

```ts
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { registerGetRemotionAuthoringGuide } from '../src/tools/getRemotionAuthoringGuide.js';

type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerGetRemotionAuthoringGuide(fakeServer as never);

  if (!captured) throw new Error('handler was not registered');

  return captured;
}

describe('get_remotion_authoring_guide', () => {
  it('returns Remotion-to-LeClap mapping guidance', () => {
    const result = captureHandler()({}) as { content: { text: string }[]; structuredContent?: Record<string, unknown> };

    expect(result.content[0].text).toContain('Composition');
    expect(result.content[0].text).toContain('Sequence');
    expect(result.content[0].text).toContain('TemplateDescriptor');
    expect(result.structuredContent?.workflow).toEqual(
      expect.arrayContaining(['plan_storyboard', 'draft_template', 'validate_template', 'compose_video'])
    );
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/remotion-authoring-guide.test.ts`

Expected: FAIL because the tool does not exist.

- [ ] **Step 3: Implement the guide text**

Create `packages/mcp/src/authoring/remotionGuide.ts`:

```ts
export const REMOTION_AUTHORING_WORKFLOW = [
  'plan_storyboard',
  'draft_template',
  'validate_template',
  'compose_video',
] as const;

export function remotionAuthoringGuide(): string {
  return [
    'Use Remotion as an authoring mental model, not as the LeClap runtime renderer.',
    '',
    'Mapping:',
    '- Remotion Composition -> LeClap TemplateDescriptor with global.orientation.',
    '- Remotion Sequence -> one LeClap section with options.duration in seconds.',
    '- Remotion AbsoluteFill background -> color_background or image_background section.',
    '- Remotion Video -> project_video when the user supplies a clip, or video when the URL is fixed.',
    '- Remotion Img -> image_background with options.pictureUrl.',
    '- Remotion text overlay -> caption for simple one-line text, or drawtext filter for custom positioning.',
    '- Remotion Audio -> global.music plus global.audio.musicVolume.',
    '- Remotion transition timing -> section.transition after the outgoing section.',
    '',
    'Rules:',
    '- Produce JSON descriptors, not TSX.',
    '- Durations are seconds in LeClap descriptors.',
    '- Prefer structured descriptor fields: caption, transition, look, grade, motion, audio, layers.',
    '- Use raw filters only when structured fields cannot express the design.',
    '- Always call validate_template before compose_video.',
  ].join('\\n');
}
```

- [ ] **Step 4: Implement the MCP tool**

Create `packages/mcp/src/tools/getRemotionAuthoringGuide.ts`:

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { REMOTION_AUTHORING_WORKFLOW, remotionAuthoringGuide } from '../authoring/remotionGuide.js';

const outputShape = {
  workflow: z.array(z.string()),
  guide: z.string(),
};

export function registerGetRemotionAuthoringGuide(server: McpServer): void {
  server.registerTool(
    'get_remotion_authoring_guide',
    {
      title: 'Get Remotion Authoring Guide',
      description:
        'Explains how an LLM should use Remotion Composition/Sequence concepts to draft a LeClap TemplateDescriptor. ' +
        'This is authoring guidance only; rendering still happens through compose_video.',
      outputSchema: outputShape,
    },
    () => {
      const guide = remotionAuthoringGuide();

      return {
        content: [{ type: 'text' as const, text: guide }],
        structuredContent: {
          workflow: [...REMOTION_AUTHORING_WORKFLOW],
          guide,
        },
      };
    }
  );
}
```

- [ ] **Step 5: Register the tool**

In `packages/mcp/src/server.ts`:

```ts
import { registerGetRemotionAuthoringGuide } from './tools/getRemotionAuthoringGuide.js';
```

Call it after `registerGetTemplateSchema(server);`:

```ts
registerGetRemotionAuthoringGuide(server);
```

- [ ] **Step 6: Run guide tests**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/remotion-authoring-guide.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/src/authoring/remotionGuide.ts packages/mcp/src/tools/getRemotionAuthoringGuide.ts packages/mcp/src/server.ts packages/mcp/tests/remotion-authoring-guide.test.ts
git commit -m "feat(mcp): add Remotion authoring guide"
```

---

### Task 2: Define the Remotion-style storyboard schema

The bridge format should be simple enough for an LLM to produce reliably and strict enough to convert deterministically.

**Files:**

- Create: `packages/mcp/src/authoring/remotionStoryboard.ts`
- Test: `packages/mcp/tests/remotion-storyboard.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/mcp/tests/remotion-storyboard.test.ts`:

```ts
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RemotionStoryboardSchema } from '../src/authoring/remotionStoryboard.js';

describe('RemotionStoryboardSchema', () => {
  it('accepts a simple sequence-based storyboard', () => {
    const result = RemotionStoryboardSchema.safeParse({
      title: 'Launch card',
      orientation: 'landscape',
      sequences: [
        {
          id: 'intro',
          duration: 2.5,
          background: { type: 'color', color: '#111111' },
          text: [{ value: 'Launch day', position: 'center', style: 'bold' }],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty sequence lists', () => {
    const result = RemotionStoryboardSchema.safeParse({
      title: 'Empty',
      orientation: 'portrait',
      sequences: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid durations', () => {
    const result = RemotionStoryboardSchema.safeParse({
      title: 'Bad',
      orientation: 'landscape',
      sequences: [{ id: 'bad', duration: 0, background: { type: 'color', color: '#000000' } }],
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/remotion-storyboard.test.ts`

Expected: FAIL because the schema does not exist.

- [ ] **Step 3: Implement schema and types**

Create `packages/mcp/src/authoring/remotionStoryboard.ts`:

```ts
import { z } from 'zod';

const TranslationInputSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const TextOverlaySchema = z.object({
  value: TranslationInputSchema,
  position: z.enum(['top', 'center', 'bottom', 'lower-third']).default('lower-third'),
  style: z.enum(['bar', 'subtle', 'bold']).default('bar'),
});

const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('color'), color: z.string().min(1) }),
  z.object({ type: z.literal('image'), src: z.string().min(1) }),
  z.object({ type: z.literal('video'), src: z.string().min(1), userProvided: z.boolean().default(false) }),
]);

const TransitionSchema = z.object({
  type: z.string().min(1).default('cut'),
  duration: z.number().positive().optional(),
});

export const RemotionStoryboardSequenceSchema = z.object({
  id: z.string().regex(/^[A-Za-z][\\w-]*$/),
  duration: z.number().positive(),
  background: BackgroundSchema,
  text: z.array(TextOverlaySchema).default([]),
  transitionAfter: TransitionSchema.optional(),
  look: z.enum(['cinematic', 'warm', 'cool', 'vintage', 'noir', 'vivid', 'dreamy']).optional(),
});

export const RemotionStoryboardSchema = z.object({
  title: z.string().optional(),
  orientation: z.enum(['landscape', 'portrait']).default('landscape'),
  variables: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  music: z
    .object({
      src: z.string().min(1),
      volume: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
  sequences: z.array(RemotionStoryboardSequenceSchema).min(1),
});

export type RemotionStoryboard = z.infer<typeof RemotionStoryboardSchema>;
```

- [ ] **Step 4: Run schema tests**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/remotion-storyboard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/src/authoring/remotionStoryboard.ts packages/mcp/tests/remotion-storyboard.test.ts
git commit -m "feat(mcp): define Remotion storyboard schema"
```

---

### Task 3: Convert storyboards into LeClap template descriptors

This is the core authoring helper. It should produce descriptors that pass the existing core validator.

**Files:**

- Create: `packages/mcp/src/authoring/storyboardToTemplate.ts`
- Test: `packages/mcp/tests/storyboard-to-template.test.ts`

- [ ] **Step 1: Write failing converter tests**

Create `packages/mcp/tests/storyboard-to-template.test.ts`:

```ts
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateTemplate } from '../src/compose/validation.js';
import { storyboardToTemplate } from '../src/authoring/storyboardToTemplate.js';

describe('storyboardToTemplate', () => {
  it('converts color sequences into color_background sections', () => {
    const descriptor = storyboardToTemplate({
      title: 'Launch card',
      orientation: 'landscape',
      variables: { name: 'Alex' },
      sequences: [
        {
          id: 'intro',
          duration: 2,
          background: { type: 'color', color: '#111111' },
          text: [{ value: 'Hello {{ name }}', position: 'center', style: 'bold' }],
        },
      ],
    });

    expect(descriptor.global?.orientation).toBe('landscape');
    expect(descriptor.global?.variables).toEqual({ name: 'Alex' });
    expect(descriptor.sections?.[0]).toMatchObject({
      name: 'intro',
      type: 'color_background',
      options: { duration: 2, backgroundColor: '#111111' },
      caption: { text: { en: 'Hello {{ name }}' }, position: 'center', style: 'bold' },
    });
    expect(validateTemplate(descriptor).ok).toBe(true);
  });

  it('maps user-provided videos to project_video sections', () => {
    const descriptor = storyboardToTemplate({
      orientation: 'portrait',
      sequences: [
        {
          id: 'clip',
          duration: 5,
          background: { type: 'video', src: 'user clip', userProvided: true },
          text: [],
        },
      ],
    });

    expect(descriptor.sections?.[0]).toMatchObject({
      name: 'clip',
      type: 'project_video',
      options: { duration: 5 },
    });
    expect(validateTemplate(descriptor).ok).toBe(true);
  });

  it('drops a transition after the last section to satisfy validation rules', () => {
    const descriptor = storyboardToTemplate({
      orientation: 'landscape',
      sequences: [
        {
          id: 'only',
          duration: 2,
          background: { type: 'color', color: '#000000' },
          transitionAfter: { type: 'fade', duration: 0.4 },
        },
      ],
    });

    expect(descriptor.sections?.[0]?.transition).toBeUndefined();
    expect(validateTemplate(descriptor).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/storyboard-to-template.test.ts`

Expected: FAIL because converter does not exist.

- [ ] **Step 3: Implement converter**

Create `packages/mcp/src/authoring/storyboardToTemplate.ts`:

```ts
import type { TemplateDescriptor } from 'ffmpeg-video-composer';
import type { RemotionStoryboard } from './remotionStoryboard.js';

type Section = NonNullable<TemplateDescriptor['sections']>[number];

function translation(value: string | Record<string, string>): Record<string, string> {
  if (typeof value === 'string') return { en: value };

  return value;
}

function caption(sequence: RemotionStoryboard['sequences'][number]): Section['caption'] | undefined {
  const first = sequence.text[0];

  if (!first) return undefined;

  return {
    text: translation(first.value),
    position: first.position,
    style: first.style,
  };
}

function transition(
  sequence: RemotionStoryboard['sequences'][number],
  index: number,
  total: number
): Section['transition'] | undefined {
  if (index === total - 1) return undefined;

  return sequence.transitionAfter;
}

function sectionFor(sequence: RemotionStoryboard['sequences'][number], index: number, total: number): Section {
  const nextCaption = caption(sequence);
  const nextTransition = transition(sequence, index, total);
  const common = {
    name: sequence.id,
    ...(nextCaption ? { caption: nextCaption } : {}),
    ...(nextTransition ? { transition: nextTransition } : {}),
    ...(sequence.look ? { look: sequence.look } : {}),
  };

  if (sequence.background.type === 'color') {
    return {
      ...common,
      type: 'color_background',
      options: {
        duration: sequence.duration,
        backgroundColor: sequence.background.color,
      },
    };
  }

  if (sequence.background.type === 'image') {
    return {
      ...common,
      type: 'image_background',
      options: {
        duration: sequence.duration,
        pictureUrl: sequence.background.src,
      },
    };
  }

  if (sequence.background.userProvided) {
    return {
      ...common,
      type: 'project_video',
      options: {
        duration: sequence.duration,
      },
    };
  }

  return {
    ...common,
    type: 'video',
    options: {
      duration: sequence.duration,
      videoUrl: sequence.background.src,
    },
  };
}

function musicGlobal(storyboard: RemotionStoryboard): Partial<NonNullable<TemplateDescriptor['global']>> {
  if (!storyboard.music) return {};

  return {
    musicEnabled: true,
    music: { name: storyboard.music.src },
    audio: { musicVolume: storyboard.music.volume },
  };
}

export function storyboardToTemplate(storyboard: RemotionStoryboard): TemplateDescriptor {
  return {
    global: {
      orientation: storyboard.orientation,
      variables: storyboard.variables,
      ...musicGlobal(storyboard),
    },
    sections: storyboard.sequences.map((sequence, index) => sectionFor(sequence, index, storyboard.sequences.length)),
  };
}
```

- [ ] **Step 4: Run converter tests**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/storyboard-to-template.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/src/authoring/storyboardToTemplate.ts packages/mcp/tests/storyboard-to-template.test.ts
git commit -m "feat(mcp): convert Remotion storyboards to templates"
```

---

### Task 4: Add `draft_template_from_remotion_storyboard`

This MCP tool is the LLM-facing bridge from Remotion-style planning to a strict LeClap descriptor.

**Files:**

- Create: `packages/mcp/src/tools/draftTemplateFromRemotionStoryboard.ts`
- Modify: `packages/mcp/src/server.ts`
- Test: `packages/mcp/tests/draft-template-from-remotion-storyboard.test.ts`

- [ ] **Step 1: Write failing tool tests**

Create `packages/mcp/tests/draft-template-from-remotion-storyboard.test.ts`:

```ts
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { registerDraftTemplateFromRemotionStoryboard } from '../src/tools/draftTemplateFromRemotionStoryboard.js';

type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerDraftTemplateFromRemotionStoryboard(fakeServer as never);

  if (!captured) throw new Error('handler was not registered');

  return captured;
}

describe('draft_template_from_remotion_storyboard', () => {
  it('returns a valid descriptor and validation summary', () => {
    const result = captureHandler()({
      storyboard: {
        orientation: 'landscape',
        sequences: [
          {
            id: 'intro',
            duration: 2,
            background: { type: 'color', color: '#111111' },
            text: [{ value: 'Hello', position: 'center', style: 'bold' }],
          },
        ],
      },
    }) as { structuredContent?: Record<string, unknown>; isError?: boolean };

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.valid).toBe(true);
    expect(result.structuredContent?.descriptor).toMatchObject({
      global: { orientation: 'landscape' },
      sections: [{ name: 'intro', type: 'color_background' }],
    });
  });

  it('returns an MCP error for invalid storyboards', () => {
    const result = captureHandler()({
      storyboard: {
        orientation: 'landscape',
        sequences: [],
      },
    }) as { isError?: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid Remotion storyboard');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/draft-template-from-remotion-storyboard.test.ts`

Expected: FAIL because the tool does not exist.

- [ ] **Step 3: Implement tool**

Create `packages/mcp/src/tools/draftTemplateFromRemotionStoryboard.ts`:

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemotionStoryboardSchema } from '../authoring/remotionStoryboard.js';
import { storyboardToTemplate } from '../authoring/storyboardToTemplate.js';
import { validateTemplate } from '../compose/validation.js';

const inputShape = {
  storyboard: RemotionStoryboardSchema,
};

const outputShape = {
  valid: z.boolean(),
  descriptor: z.record(z.string(), z.unknown()),
  sectionCount: z.number(),
  requiredClips: z.array(z.string()),
  formFields: z.array(z.string()),
};

type DraftArgs = { storyboard: unknown };
type ToolError = { isError: true; content: [{ type: 'text'; text: string }] };

function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

function requiredClips(descriptor: ReturnType<typeof storyboardToTemplate>): string[] {
  return (descriptor.sections ?? [])
    .filter((section) => section.type === 'project_video')
    .map((section) => section.name);
}

export function registerDraftTemplateFromRemotionStoryboard(server: McpServer): void {
  server.registerTool(
    'draft_template_from_remotion_storyboard',
    {
      title: 'Draft Template From Remotion Storyboard',
      description:
        'Converts a Remotion-style storyboard JSON into a strict LeClap TemplateDescriptor. ' +
        'Use this after planning a video with Remotion Composition/Sequence concepts; then call validate_template.',
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    (args: DraftArgs) => {
      const parsed = RemotionStoryboardSchema.safeParse(args.storyboard);

      if (!parsed.success) {
        return errorResult(`Invalid Remotion storyboard: ${parsed.error.message}`);
      }

      const descriptor = storyboardToTemplate(parsed.data);
      const validation = validateTemplate(descriptor);

      if (!validation.ok) {
        return errorResult(validation.message);
      }

      const clips = requiredClips(descriptor);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Drafted valid template with ${descriptor.sections?.length ?? 0} section(s). Required clips: ${
              clips.length > 0 ? clips.join(', ') : 'none'
            }.`,
          },
        ],
        structuredContent: {
          valid: true,
          descriptor,
          sectionCount: descriptor.sections?.length ?? 0,
          requiredClips: clips,
          formFields: [],
        },
      };
    }
  );
}
```

- [ ] **Step 4: Register tool**

In `packages/mcp/src/server.ts`:

```ts
import { registerDraftTemplateFromRemotionStoryboard } from './tools/draftTemplateFromRemotionStoryboard.js';
```

Call it after `registerGetRemotionAuthoringGuide(server);`:

```ts
registerDraftTemplateFromRemotionStoryboard(server);
```

- [ ] **Step 5: Run tool tests**

Run: `pnpm --filter @leclap/mcp exec vitest run tests/draft-template-from-remotion-storyboard.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/src/tools/draftTemplateFromRemotionStoryboard.ts packages/mcp/src/server.ts packages/mcp/tests/draft-template-from-remotion-storyboard.test.ts
git commit -m "feat(mcp): draft templates from Remotion storyboards"
```

---

### Task 5: Update the compose prompt for Remotion-assisted authoring

The prompt should guide the LLM to use Remotion only before descriptor validation/rendering.

**Files:**

- Modify: `packages/mcp/src/prompts/composeGuide.ts`
- Test: existing prompt coverage if present, otherwise covered by MCP integration discovery.

- [ ] **Step 1: Update workflow text**

In `packages/mcp/src/prompts/composeGuide.ts`, change the workflow section to include:

```ts
'Optional Remotion-assisted authoring:',
'- If the client has a Remotion MCP or the user describes animation in Remotion terms, use it only to plan the timeline.',
'- Think in Composition + Sequence terms, then express the result as a structured storyboard JSON.',
'- Call get_remotion_authoring_guide for the mapping.',
'- Call draft_template_from_remotion_storyboard to produce the LeClap descriptor.',
'- Then call validate_template and compose_video. Do not ask compose_video to render with Remotion.',
```

- [ ] **Step 2: Keep on-device filter guidance**

Keep the current allowlist guidance in the same prompt. The point is still to create descriptors that render through the LeClap FFmpeg engine everywhere.

- [ ] **Step 3: Run MCP tests**

Run: `pnpm --filter @leclap/mcp test`

Expected: PASS.

- [ ] **Step 4: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/src/prompts/composeGuide.ts
git commit -m "docs(mcp): guide Remotion-assisted descriptor authoring"
```

---

### Task 6: Document the authoring flow

Make the README clear that Remotion helps the LLM draft descriptors, not render final output.

**Files:**

- Modify: `packages/mcp/README.md`

- [ ] **Step 1: Add tools to the README table**

Add:

```md
| `get_remotion_authoring_guide` | Maps Remotion Composition/Sequence concepts to LeClap descriptor fields for LLM authoring |
| `draft_template_from_remotion_storyboard` | Converts a structured Remotion-style storyboard into a validated LeClap template descriptor |
```

- [ ] **Step 2: Add a Remotion-assisted authoring section**

Add:

```md
### Remotion-assisted authoring

Remotion is used as a planning vocabulary for the LLM, not as the renderer. A client agent may use
Remotion MCP or Remotion examples to think through a Composition and Sequences, then pass a structured
storyboard to `draft_template_from_remotion_storyboard`. The returned descriptor should still go
through `validate_template`, then `compose_video`.

The final render remains deterministic LeClap/FFmpeg output.
```

- [ ] **Step 3: Run docs formatting**

Run: `pnpm fmt:check`

Expected: PASS, or identify unrelated formatting failures from the existing dirty worktree.

- [ ] **Step 4: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/README.md
git commit -m "docs(mcp): document Remotion-assisted authoring"
```

---

### Task 7: Add BDD coverage for the authoring workflow

The integration scenario should prove a real MCP client can discover the guide and draft a descriptor.

**Files:**

- Modify: `packages/mcp/features/agent.feature`
- Modify: `packages/mcp/features/steps/agent.steps.ts`

- [ ] **Step 1: Add feature scenario**

In `packages/mcp/features/agent.feature`, add:

```gherkin
  Scenario: Draft a template from a Remotion-style storyboard
    When the agent requests the Remotion authoring guide
    Then it receives Remotion-to-template guidance
    When the agent drafts a template from a Remotion-style storyboard
    Then it receives a valid template descriptor
```

- [ ] **Step 2: Add step definitions**

In `packages/mcp/features/steps/agent.steps.ts`, add steps that call:

```ts
await this.requireClient().callTool({ name: 'get_remotion_authoring_guide', arguments: {} });
```

and:

```ts
await this.requireClient().callTool({
  name: 'draft_template_from_remotion_storyboard',
  arguments: {
    storyboard: {
      orientation: 'landscape',
      sequences: [
        {
          id: 'intro',
          duration: 1.5,
          background: { type: 'color', color: '#111111' },
          text: [{ value: 'Hello from Remotion planning', position: 'center', style: 'bold' }],
        },
      ],
    },
  },
});
```

Assert `structuredContent.valid === true` and that `structuredContent.descriptor.sections` is non-empty.

- [ ] **Step 3: Run integration tests**

Run: `pnpm --filter @leclap/mcp test:integration`

Expected: PASS.

- [ ] **Step 4: Commit checkpoint**

Request consent, then:

```bash
git add packages/mcp/features/agent.feature packages/mcp/features/steps/agent.steps.ts
git commit -m "test(mcp): cover Remotion-assisted authoring"
```

---

### Task 8: Final verification

**Files:**

- No new files unless tests uncover gaps.

- [ ] **Step 1: Run targeted MCP unit tests**

Run:

```bash
pnpm --filter @leclap/mcp exec vitest run \
  tests/remotion-authoring-guide.test.ts \
  tests/remotion-storyboard.test.ts \
  tests/storyboard-to-template.test.ts \
  tests/draft-template-from-remotion-storyboard.test.ts
```

Expected: PASS.

- [ ] **Step 2: Typecheck MCP**

Run: `pnpm --filter @leclap/mcp exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Build MCP**

Run:

```bash
pnpm --filter ffmpeg-video-composer build
pnpm --filter @leclap/mcp build
```

Expected: PASS.

- [ ] **Step 4: Run MCP integration**

Run: `pnpm --filter @leclap/mcp test:integration`

Expected: PASS.

- [ ] **Step 5: Run repository checks if the branch is otherwise stable**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: PASS. If unrelated dirty-worktree changes fail these commands, record the unrelated failure and keep the authoring change verified with the targeted commands above.

- [ ] **Step 6: Final commit checkpoint**

Request consent, then:

```bash
git status --short
git add packages/mcp
git commit -m "feat(mcp): add Remotion-assisted template authoring"
```

---

## Follow-up Work

- Add a richer storyboard field for multiple text overlays once the core descriptor has first-class positioning for caption-like overlays.
- Add a `suggest_template_from_goal` prompt, not a tool, if clients need a higher-level guided authoring entry point.
- Add example transcripts showing an LLM using Remotion MCP for timeline ideation, then LeClap MCP for descriptor validation and rendering.
- Revisit TSX parsing only if there is a concrete, constrained Remotion export format. Do not parse arbitrary React components.
