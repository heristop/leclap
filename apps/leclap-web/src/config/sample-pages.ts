// A curated set of useful watch pages, rather than thin pages for every catalog entry.
export const SAMPLE_PAGES = [
  {
    id: 'type-impact',
    path: '/showcase/type-impact',
    title: 'Animated titles with JSON and FFmpeg',
    description:
      'Watch a kinetic typography example, download its editable JSON and learn how to render animated titles locally with LeClap and FFmpeg.',
    explanation:
      'This three-scene composition uses opposing word entrances, bounded overshoot and a readable final hold. It builds its titles from positioned text over solid backgrounds, so the example needs no source footage.',
    customize:
      'Change the text in the drawtext entries, then tune reveal.delay, reveal.duration and exit timing. Keep the final hold long enough to read the revised copy. Preserve the bundled font filenames or supply replacements supported by your FFmpeg build.',
    requirement:
      'Use FFmpeg with drawtext and the fonts referenced by the JSON. Check capabilities with leclap diagnose before rendering.',
    guide: '/doc/motion',
    guideLabel: 'Motion and layers reference',
  },
  {
    id: 'html-motion',
    path: '/showcase/html-motion',
    title: 'JSON motion graphics with animated HTML cards',
    description:
      'Preview animated listing cards and stat tiles, inspect the JSON template and customize staged HTML motion with LeClap.',
    explanation:
      'A listing card introduces its tag, address and feature chips in sequence. A second scene brings stat tiles into place in reading order. Each scene uses one HTML layer with timed element entrances rather than a recorded interface.',
    customize:
      'Replace the typed global.fields values for the address, details and statistics. Adjust the motion and data-motion timings in the HTML layers to change the order and rhythm of the reveal. Preview long addresses to check line wrapping.',
    requirement:
      'Use a LeClap runtime with HTML-layer rendering and the fonts referenced by the template. Supply any assets reported by samples show before rendering.',
    guide: '/doc/reference',
    guideLabel: 'HTML layers and template reference',
  },
  {
    id: 'pr-evidence',
    path: '/showcase/pr-evidence',
    title: 'MCP video generation for pull request evidence',
    description:
      'Watch a review-evidence video and download the JSON recipe for composing real screen recordings with LeClap MCP or CLI.',
    explanation:
      'This review-focused composition introduces the change, plays a real walkthrough and closes with checks and limitations. An AI agent can author the JSON and call LeClap through MCP to validate and render the supplied recording.',
    customize:
      'Replace the title and review details with facts from your change. Bind your own walkthrough recording, preserve its normal playback speed and keep the result unobstructed. Report only checks that actually ran.',
    requirement:
      'This recipe needs your own screen recording and its declared font and asset bindings. LeClap composes supplied footage; it does not generate footage from a prompt or upload the result to a pull request.',
    guide: '/doc/agents',
    guideLabel: 'AI-agent video workflow',
  },
] as const;

export const samplePage = (id: string) => SAMPLE_PAGES.find((page) => page.id === id);
