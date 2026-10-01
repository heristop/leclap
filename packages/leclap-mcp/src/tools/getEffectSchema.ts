import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  TITLE_EFFECT_ID,
  TITLE_EFFECT_VERSION,
  TITLE_COMPOSITION_ID,
  titlePropsSchema,
  titleAssetsSchema,
} from '../effects/title-registry.js';

const inputSchema = z.object({ id: z.string().optional(), version: z.string().optional() }).strict();
export function registerGetEffectSchema(server: McpServer): void {
  server.registerTool(
    'get_effect_schema',
    {
      title: 'Get Effect Schema',
      description:
        'Describe a trusted registered JSON effect, its prop defaults/bounds, local assets and runtime restrictions. The first catalog contains leclap.title-reveal@1.0.0 only.',
      inputSchema,
    },
    (args: z.infer<typeof inputSchema>) => {
      try {
        const parsed = inputSchema.parse(args);

        if (
          (parsed.id ?? TITLE_EFFECT_ID) !== TITLE_EFFECT_ID ||
          (parsed.version ?? TITLE_EFFECT_VERSION) !== TITLE_EFFECT_VERSION
        ) {
          throw new Error('effect_not_registered: supported leclap.title-reveal@1.0.0 only.');
        }
        const schema = {
          id: TITLE_EFFECT_ID,
          version: TITLE_EFFECT_VERSION,
          compositionId: TITLE_COMPOSITION_ID,
          props: z.toJSONSchema(titlePropsSchema),
          assets: z.toJSONSchema(titleAssetsSchema),
          timing: 'logoDelayFrames + entranceDurationFrames must be <= 300.',
          runtime: {
            backend: 'Remotion/Chromium (Node MCP only)',
            requires:
              'allowRemotion + configured trusted remotionEntry + optional @remotion/bundler and @remotion/renderer peers',
            source:
              'No inline executable source or caller-selected entry. Configured source is trusted operator code, not sandboxed.',
          },
          output: {
            width: 1280,
            height: 720,
            fps: 30,
            durationInFrames: 300,
            durationSeconds: 10,
            orientation: 'landscape',
          },
          assetRestrictions:
            'Absolute regular local files within mediaDir, realpath-contained. Background video (.mp4/.mov/.webm/.m4v) >=10s; logo .png/.jpg/.jpeg/.webp; font .ttf/.otf/.woff/.woff2. Extra props/assets rejected. No remote scene assets.',
          geometry:
            'Remotion text fit and contrast are not measured by FFmpeg geometry validation; inspect render_preview.',
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }],
          structuredContent: schema,
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                code: 'effect_schema_error',
                message: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    }
  );
}
