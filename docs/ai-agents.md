# AI motion graphics with MCP and JSON

LeClap is an open-source video engine for AI agents and developers building programmatic motion graphics. An agent authors editable JSON for typography, layers, transitions and timing; LeClap validates the template and renders it with FFmpeg. Connect through the Model Context Protocol (MCP), use the CLI, or integrate the TypeScript library.

Use it for animated titles, product demos, branded clips and review videos made from your own assets. The template remains editable after every render.

## Try a sample in your browser — no upload

[Try the browser sample on the homepage](https://leclap.dev/#browser-demo). Select the sample demo to compile a prepared template with its supplied assets using FFmpeg in your browser. You do not need to upload footage or connect an AI agent to try it. The first run downloads the renderer and sample assets before compilation.

For more designs, [explore the motion showcase](https://leclap.dev/showcase). The MCP and CLI sample catalog is separate: it supplies templates and asset requirements, not bundled sample media.

## Connect through MCP

Use Node 24.11 or later and an MCP client that supports local stdio servers. Rendering needs FFmpeg; use `get_capabilities` to check the selected build before choosing effects. Text rendering needs `drawtext`. Some tools also need `ffprobe`; the [MCP reference](https://leclap.dev/doc/mcp) explains optional capabilities.

Create a dedicated folder for input media and another for renders. Add this server to your client's MCP configuration, replacing both absolute paths with your own:

```json
{
  "mcpServers": {
    "leclap": {
      "command": "npx",
      "args": [
        "-y",
        "@leclap/mcp",
        "--media-dir",
        "/absolute/path/to/video-assets",
        "--output-dir",
        "/absolute/path/to/video-renders"
      ]
    }
  }
}
```

Restart or reconnect the client. Ask the agent to call `get_capabilities` and `get_template_schema`. Local media must be inside the configured media directory. MCP clients have different settings interfaces; use the configuration format your client expects.

## Make your first video

Start with a title card so there are no external footage or music dependencies. The native renderer includes bundled fonts. Copy this prompt into your connected agent:

> Make a three-second landscape title card that says “Your next release”, with a dark background and readable light text. Use native LeClap sections and bundled fonts, with no external media or Remotion. Read the template schema and motion catalog first. Validate the template, inspect a frame, and fix any layout issues before composing the MP4. Return the rendered file and save the editable JSON template in my workspace using your file tools.

The agent should follow this loop:

1. **Discover:** call `get_template_schema` and `get_motion_catalog`. Use `get_samples` for more elaborate compositions, and inspect each sample's required assets and backend before using it. Sample media is not bundled.
2. **Validate:** call `validate_template` with the descriptor. Resolve errors and review geometry advisories; a valid template can still need visual refinement.
3. **Inspect:** call `render_frames` at a useful moment. Look at the actual image, not only the JSON.
4. **Render:** call `compose_video`. Open its returned MP4 resource or local `outputPath`.
5. **Keep the source:** save the returned or authored template with your agent's file tools. The MCP server does not write a source JSON file for you.

## Direct the motion, then inspect the result

Give your agent a visual brief with an audience, pace and intended emphasis. For example:

> Turn this title card into a restrained product announcement. Animate the title entrance with a short upward move and a gentle ease-out, then hold it still long enough to read. Keep the background quiet. Use native motion primitives from the catalog, inspect frames during the entrance and hold, and render the revised MP4. Save the JSON too.

The agent should use `get_motion_catalog` to discover supported primitives and author their timing explicitly. For finer control, read the [motion and layer reference](https://leclap.dev/doc/motion), [creative-direction guide](https://leclap.dev/doc/creative-direction) and [complete template configuration](https://leclap.dev/doc/reference). Registered React effects use a separately configured trusted Node backend; they are not part of the native browser rendering path.

## Ask for a revision

> Shorten the title card to two seconds and change the title to “Available today”. Keep the background and typography. Validate, inspect a new frame, then render again and save the revised template beside the original.

Use `edit_template` with the current revision from validation for targeted patches. Validate the edited descriptor and check the frames again before composing. For multi-scene videos, change the relevant scenes rather than rebuilding the whole story.

## Use the CLI instead

An agent with terminal access can use the same engine without MCP. The starter provides a template and bundled font assets:

```bash
npx @leclap/cli init hello --no-remotion --no-mcp
cd hello
npm install
npx leclap diagnose
npx leclap validate template.json
npx leclap snapshot template.json --at 1 --out frames/
npm run render
```

The output is `build/output.mp4`. Open `frames/` to inspect the title card before reviewing the complete render. If text is absent, check `diagnose`: the selected FFmpeg must support `drawtext`.

Ask your agent to change the title and duration in `template.json`, then repeat validation, snapshot and rendering. To keep a render manifest and check that the saved output still matches it:

```bash
npx leclap render template.json --output build/revised.mp4 --manifest
npx leclap verify build/revised.mp4.manifest.json
```

## Hand off to the visual builder

Call `open_in_builder` with the template, or run:

```bash
npx leclap studio template.json
```

Open the returned link to inspect and edit the composition yourself. The JSON travels in the URL fragment. Local media files do not travel with it: rebind the assets in the builder and review any compatibility warnings.

## See a real workflow

[Watch the before/after review workflow](https://leclap.dev/#agentic), then open its [runnable example and source templates](../examples/agentic-pr-video/README.md). It uses actual screen recordings. LeClap renders the artifact; attaching it to a pull request is a separate step in the surrounding workflow.

For product demos and branded clips, [browse the showcase](https://leclap.dev/showcase) to watch renders and download their editable templates. Supply your own required media, copy and brand assets.

## Browser agents

The builder also exposes tools through WebMCP in compatible browsers. This is separate from the local MCP server and depends on the browser's agent and WebMCP availability. Follow the [browser-agent setup guide](https://leclap.dev/doc/webmcp) for requirements, confirmations and undo. Connecting a local MCP client does not automatically enable a browser agent.

## Rendering and data

LeClap composes supplied assets; it does not generate footage from a prompt. Local rendering keeps the render on your machine, but an external AI provider has its own data handling. Check what your agent sends to its provider.

For reproducible results, preserve the template, assets, fonts, configuration and runtime versions. Supported effects and encoded pixels differ across Node, browser and native backends. Registered React effects need the separately configured trusted Node backend.
