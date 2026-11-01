# PR 154: watch-page refinement

These before/after captures compare the initial watch pages at `0d46e622004516ad0dbbbfe71f3829824805c150` with the polished implementation at `ae875021`. They document the refinement within this PR, not a comparison with the main branch (where these watch pages do not exist).

Desktop: 1440×900, light. Mobile: 390×844, dark. Reduced motion is enabled in both runs. The flow opens `/showcase/type-impact`; the after capture then follows **Render this template** to the instructions. Additional responsive checks cover all three watch pages at widths 320, 390, 768 and 1024.

The video uses the repository-owned `examples/agentic-pr-video/evidence-skill/build.py` and `template.json`, without a replacement wrapper. Raw recordings and intermediate render files remain outside git.

To render again, place the matching real recordings at `<work>/raw/before.webm` and `<work>/raw/after.webm`, then run from the repository root:

```sh
python3 examples/agentic-pr-video/evidence-skill/build.py \
  --content .github/pr-media/seo-watch-pages/content.json \
  --work <work> --leclap "node packages/leclap-cli/dist/index.js"
```

The trim values belong to these recordings. Re-measure them if recording again; never reconstruct the before state for a comparison.
