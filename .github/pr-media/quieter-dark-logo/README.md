# Quieter dark logo evidence

Before: `a0e2872c` (the PR base). After: `5186a685` (the logo change).
Both captures run the real web app on `/about`, at 1440×900 and 390×844,
with device scale 2, in light and dark mode. Native UI was not recorded.

Run the base worktree's web app on port 5186 and the PR worktree on port 5187,
then from the PR worktree:

```sh
node .github/pr-media/quieter-dark-logo/record.mjs
python3 examples/agentic-pr-video/evidence-skill/build.py \
  --content .github/pr-media/quieter-dark-logo/content.json \
  --work build/logo-evidence \
  --leclap "node packages/leclap-cli/dist/index.js"
```

Recordings stay under ignored `build/logo-evidence/raw`. Adjust each `trim` in
`content.json` to start four seconds before that recording ends, after dark mode
has settled. The three-second comparison includes a three-second freeze.
Convert snapshots to still WebP at quality 82; copy the final MP4 and its poster
from `build/logo-evidence` into this directory. The video uses the repository's
house template through `build.py`.
