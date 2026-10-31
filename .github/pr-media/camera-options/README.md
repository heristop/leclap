# Camera source selector evidence

The comparison shows the selector before this refinement (55a762a7) and after it. Chromium supplies a synthetic camera feed; no personal camera footage is used.

Serve the respective checkout on port 5412, then run `PHASE=before node .github/pr-media/camera-options/capture.cjs` or `PHASE=after node .github/pr-media/camera-options/capture.cjs`. Raw recordings and screenshots go to `build/pr/camera-options/`.

Render the comparison with:

```sh
python3 examples/agentic-pr-video/evidence-skill/build.py --content .github/pr-media/camera-options/content.json --work build/pr/camera-options --leclap 'node packages/leclap-cli/dist/index.js'
```

The stills focus on the source controls: mobile is before/after side by side; desktop is before above after.
