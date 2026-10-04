import type { McpServer } from '@modelcontextprotocol/server';
import { motionCatalog } from 'ffmpeg-video-composer';

// The motion catalog (kinetic typography presets, exits, orders, easing grammar, built-in tokens,
// built-in themes, art-direction rules, genre doctrine, scene blueprints and a complete starter beat)
// straight from the engine, so an agent can design "wow" motion without reading source, and every
// name it picks is one the renderer accepts.
export function registerGetMotionCatalog(server: McpServer): void {
  server.registerTool(
    'get_motion_catalog',
    {
      title: 'Get Motion Catalog',
      description:
        'Return the motion catalog: kinetic typography presets with their defaults, exit presets, ' +
        'stagger orders, the easing grammar (springs, cubic-bezier, named curves), built-in motion tokens, ' +
        'built-in themes (palette, fonts and motion feel for global.theme, referenced as $color.* / $font.*), ' +
        'art-direction rules, a doctrine per genre (product-launch, explainer, social-hook, cinematic-trailer, ' +
        'calm-tutorial), validated scene blueprints with [slot] copy and a signature move, a verb / useWhen / ' +
        'avoidWhen / pairsWith for every preset, transition and graphic, and a complete starter template. ' +
        'Call it before authoring animated copy, camera moves, graphics or designed transitions.',
    },
    () => ({
      content: [{ type: 'text', text: JSON.stringify(motionCatalog(), null, 2) }],
    })
  );
}
