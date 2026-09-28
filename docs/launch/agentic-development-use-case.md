# Agentic development use case — launch pack

## Message hierarchy

**Primary message:** Don't describe the change. Show it.

LeClap gives a development agent a deterministic way to turn implementation evidence into a short video artifact for a pull or merge request.

**Supporting points:**

- The source is real implementation evidence, not generated footage.
- A reusable JSON template keeps the structure consistent.
- Validation happens before rendering.
- The reviewer receives behavior, context, and a precise review focus beside the diff.
- LeClap renders the artifact; the surrounding workflow uploads it.

**Proof point:** The repository ships a runnable, schema-validated example that turns a walkthrough and explicit review focus into a short review artifact. Do not add confidential identifiers, private details, or performance claims.

## LinkedIn

Code review is still mostly asked to prove visual behavior with prose.

An agent finishes a feature, writes a clean summary, lists the tests, and opens a pull request. The diff may be correct. The description may be precise. But if the change affects an interface, the reviewer still has to reconstruct the behavior locally before they can see what changed.

That gap is a useful LeClap use case.

The workflow is simple:

1. The development agent implements the change.
2. It collects a short, real screen recording and states the exact review focus.
3. It fills a reusable LeClap template with the project, change, and review context.
4. It validates the descriptor and renders a deterministic MP4.
5. The surrounding workflow attaches that artifact to the pull or merge request.

The video is not generated from a vague prompt. LeClap composes explicit footage, text, timing, and transitions through a validated JSON template. The same inputs reproduce the same authored sequence on a given platform.

For the reviewer, that means the PR contains three complementary layers: the claim in the description, the implementation in the diff, and the visible behavior in the video. The clip is deliberately short. It names the change, shows the walkthrough, calls out what to inspect, then hands the reviewer back to the code.

An Evidence skill can structure the proof collected while an agent works. LeClap can turn the selected, publishable part of that evidence into a consistent review artifact. The important boundary is that evidence is curated: no confidential identifier or private implementation detail is required.

LeClap itself does not publish to GitHub or GitLab. It renders the artifact and returns its path. Uploading remains an explicit action in the agentic workflow, where permissions and review policy already live.

The broader idea is that agentic development should not stop at producing code. It should also produce reviewable evidence. If an agent can ship the change, it can ship the proof with it.

Runnable example: https://github.com/heristop/leclap/tree/main/examples/agentic-pr-video

## X thread

**1/5** Agentic development should ship more than code. For UI changes, the PR should include the visible behavior too. LeClap turns real implementation evidence into a short, deterministic review video.

**2/5** The loop: implement → collect a walkthrough + review focus → author a JSON template → validate → render → attach the MP4 to the PR/MR.

**3/5** This is composition, not generated video. The footage, text, timing, and transitions are explicit inputs. A reviewer sees the behavior before reconstructing it locally.

**4/5** An Evidence skill can structure proof collection during implementation. LeClap can package the selected, publishable evidence without exposing confidential identifiers or private details.

**5/5** LeClap renders the artifact; it does not upload it. The surrounding workflow keeps control of GitHub/GitLab permissions and publication. Example: https://github.com/heristop/leclap/tree/main/examples/agentic-pr-video

## GitHub / GitLab announcement

### Agentic PR evidence with LeClap

The repository now includes a runnable use case for agentic development: an agent can turn a real implementation walkthrough and explicit review focus into a short, deterministic MP4 for a pull or merge request.

The example covers the complete artifact flow:

`implement → collect evidence → author template → validate → render → attach`

Start with [`examples/agentic-pr-video`](../../examples/agentic-pr-video). The template opens with project and change context, shows the recorded implementation with a review-focus lower third, and closes by handing the reviewer back to the code.

LeClap renders the local artifact. It does not upload to GitHub or GitLab; keep that explicit step in the surrounding workflow.

## Publication checklist

- Verify every product claim against the current repository and docs.
- Use only deliberately selected, publishable evidence.
- Do not disclose confidential identifiers.
- Mention the Evidence skill only as structured proof collection.
- Do not invent metrics, outcomes, quotes, or adoption claims.
- Link the canonical landing page and runnable example.
- Confirm the example still validates before publication.
- Review the final copy manually; never auto-publish.
