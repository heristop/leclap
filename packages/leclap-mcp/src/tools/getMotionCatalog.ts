import type { McpServer } from '@modelcontextprotocol/server';
import { motionCatalog } from 'ffmpeg-video-composer';

// The v2 motion catalog (kinetic typography presets, exits, orders, easing grammar, built-in tokens,
// art-direction rules and a complete starter beat) straight from the engine, so an agent can design
// "wow" motion without reading source, and every name it picks is one the renderer accepts.
export function registerGetMotionCatalog(server: McpServer): void {
  server.registerTool(
    'get_motion_catalog',
    {
      title: 'Get Motion Catalog',
      description:
        'Return the motion system v2 catalog: kinetic typography presets with their defaults, exit presets, ' +
        'stagger orders, the easing grammar (springs, cubic-bezier, named curves), built-in motion tokens, ' +
        'art-direction rules and a complete starter template. Call it before authoring animated copy; then ' +
        'set meta.motionVersion: 2 and use section `kinetic` blocks.',
    },
    () => ({
      content: [{ type: 'text', text: JSON.stringify(motionCatalog(), null, 2) }],
    })
  );
}
