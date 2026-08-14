# Awesome-list submissions

One row per target. Fill in the PR URL when submitted, and the outcome when it resolves.
Read each list's CONTRIBUTING before opening a PR — most reject entries that skip the format,
and a rejected PR is harder to retry than a slow one.

Nothing here has been submitted. Every target below was verified on 2026-08-14; three of the five
lists the plan originally named turned out to be unusable, and the replacements are listed with them.

## The entry

Derived from the `description` field of `.github/repo-metadata.json` — one pitch, everywhere.

General lists:

```markdown
- [LeClap](https://github.com/heristop/leclap) - Deterministic video composition from one JSON template; renders on Node, in the browser via WebAssembly, and fully on-device on React Native.
```

MCP lists, leading on the agent angle:

```markdown
- [LeClap](https://github.com/heristop/leclap) - Compose and render video from JSON templates. Deterministic, runs locally, no LLM in the output path.
```

The MCP variant is also what `packages/leclap-mcp/server.json` carries as its `description`, trimmed
to the registry's 100-character ceiling.

## Targets

| List                                                                                        | Section            | PR  | Status             |
| ------------------------------------------------------------------------------------------- | ------------------ | --- | ------------------ |
| [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)             | Multimedia Process |     | not submitted      |
| [wong2/awesome-mcp-servers](https://github.com/wong2/awesome-mcp-servers)                   | n/a — web form     |     | not submitted      |
| [transitive-bullshit/awesome-ffmpeg](https://github.com/transitive-bullshit/awesome-ffmpeg) | JavaScript         |     | not submitted      |
| ~~modelcontextprotocol/servers~~                                                            | —                  | —   | dropped, see below |
| ~~jondot/awesome-react-native~~                                                             | —                  | —   | dropped, see below |
| ~~sindresorhus/awesome-nodejs~~                                                             | —                  | —   | blocked, see below |

## Per-list notes

### punkpeye/awesome-mcp-servers — submit

92.3k stars, last commit 2026-08-03. Very much alive; PRs merge daily.

The section is **`### 🎥 Multimedia Process`**, not "Video" — that section does not exist. Entries are
ordered alphabetically by `owner/repo`, so `heristop/leclap` goes between `FileToPDF/filetopdf-mcp`
and `huseyinstif/klaket`.

`CONTRIBUTING.md` requires: one server per line, existing format and style, alphabetical order within
the category, an individual PR. The list uses a legend of annotation emoji that entries are expected
to carry. For LeClap that is 📇 (TypeScript codebase) 🏠 (local service) 🍎 🪟 🐧 (macOS/Windows/Linux).

There is an explicit agent-PR convention: appending `🤖🤖🤖` to the PR title opts into a fast-track
merge path for automated contributions. Use it only if an agent actually opens the PR.

Entry, formatted for this list:

```markdown
- [heristop/leclap](https://github.com/heristop/leclap) 📇 🏠 🍎 🪟 🐧 - Compose and render video from JSON templates. Deterministic, runs locally, no LLM in the output path. `npx -y @leclap/mcp`
```

Do not include that `npx` invocation until the packaging defect in `packages/leclap-mcp` is fixed and
republished — see `.superpowers/sdd/2026-08-14-open-source-visibility/task-8-10-report.md`.

### wong2/awesome-mcp-servers — replaces modelcontextprotocol/servers

4.3k stars, last commit 2026-07-13. Alive, but the README states plainly:

> We do not accept PRs. Please submit your MCP on the website: https://mcpservers.org/submit

So this is a web-form submission, not a PR. There is no section to pick; the form assigns placement.

### transitive-bullshit/awesome-ffmpeg — submit, with a caveat

1.2k stars, last commit 2025-08-09 — a year stale. Not archived, and the maintainer still merges
community PRs, but expect a slow response. Worth the one PR; do not expect it to land quickly.

The section is **`## JavaScript`**, not "Libraries" — that section does not exist. The list's sections
are Docs, JavaScript, Native, Mobile, Tutorials, Community.

`contributing.md` requires: additions at the **bottom** of the category, format `[package](link) - Description.`,
link to the GitHub repo rather than npm, description starts with a capital and ends with a period,
does not start with "A"/"An", and does not mention Node.js (implied). One PR per suggestion. There is
also a rule to wait at least 7 days after creating a project before submitting — LeClap is well past that.

Entry, formatted for this list (Node.js dropped per their rule):

```markdown
- [LeClap](https://github.com/heristop/leclap) - Deterministic video composition from one JSON template, rendering in the browser via WebAssembly and on-device on React Native.
```

### modelcontextprotocol/servers — dropped

Not archived and actively developed, but its `CONTRIBUTING.md` retired the third-party server list:

> The README no longer contains a list of third-party MCP servers — that list has been retired in
> favor of the MCP Server Registry.

and, under what they do not accept:

> **New server implementations** — We encourage you to publish them to the MCP Server Registry instead.

There is no "Community servers" section left to add a row to. A PR here would be closed on sight. The
replacement for this channel is the registry submission itself (Task 8), plus wong2's list above.

### jondot/awesome-react-native — dropped

35.7k stars, not archived, but the last commit is **2021-04-25** and the last push 2024-07-05. Five
years without a merged change means a PR would sit unread indefinitely.

No replacement is proposed: a search of `awesome-react-native`-named lists turned up no maintained
general-purpose alternative. The remaining candidates are either single-component repos or dead
(`crazycodeboy/react-native-awesome`, last touched 2019). The React Native angle is better served by
the ffmpeg and MCP lists until a maintained RN list appears.

### sindresorhus/awesome-nodejs — blocked on eligibility, not dropped

66.5k stars, last commit 2026-05-03, and the repo description currently reads
"BECAUSE OF TOO MUCH SPAM AND LOW-QUALITY SUBMISSIONS, SUBMISSIONS ARE PAUSED UNTIL JULY".

The harder blocker is in `contributing.md`:

> **The submitted project should be more than 30 days old and the repo should have at least 100 stars.**

`heristop/leclap` had **23 stars** on 2026-08-14. LeClap does not clear the bar, and submitting anyway
burns the one shot on a list whose maintainer is explicit about a high acceptance threshold. Revisit
once the repo is past 100 stars; the entry to use then is the general one above, with "Node.js"
removed from the description per their rules.

There is no "Video" section in that list either — the closest fit today would be a new entry under a
media category, which their guidelines say must be proposed in a separate PR.

## Sequencing

Space the submissions out rather than firing them in one hour. Several of these lists share a small
pool of maintainers, and a burst reads as spam.
