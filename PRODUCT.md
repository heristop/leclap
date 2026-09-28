# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers and teams who need reproducible, reviewable video output inside software workflows, including AI agents working on code changes.

## Product Purpose

LeClap turns a validated JSON template plus source media into a deterministic finished video. It lets people and agents compose the same video through the CLI, MCP, browser, Node.js, or React Native without putting a generative model in the render path.

## Positioning

One template drives the same composition pipeline across Node.js, browser/WASM, and on-device React Native. The output is rendered from explicit inputs rather than sampled from a prompt.

## Operating Context

LeClap is used from terminals, agent toolchains, browser and mobile apps. In an agentic development workflow, an agent can collect implementation evidence, author and validate a template, render a short review video, then attach that artifact to a pull or merge request.

## Capabilities and Constraints

- Templates are validated with Zod before rendering.
- The CLI exposes `init`, `validate`, `render`, and `diagnose` workflows.
- The MCP server exposes schema, validation, composition, and media probing tools.
- LeClap creates the video artifact; it does not upload artifacts to GitHub or GitLab.
- Browser/WASM compilation is limited to roughly 2 GB of input.

## Brand Commitments

The LeClap name, clapperboard mark, lavender-to-pink identity, near-black surfaces, and direct technical voice are established in `DESIGN.md`. Product claims must stay precise: deterministic and reproducible per platform, not necessarily pixel-identical across encoders.

## Evidence on Hand

- The open-source monorepo and its test suite.
- Runnable creative-kit templates and CLI/MCP documentation.
- The runnable agentic PR video example and its schema validation test.
- No confidential identifier, implementation detail, or invented performance metric may be disclosed.

## Product Principles

- Ship proof with the code.
- Prefer explicit, validated inputs over hidden automation.
- Keep rendering local and deterministic where the platform permits.
- Make agent output inspectable by humans.
- Never imply that LeClap publishes or uploads review artifacts on the user's behalf.

## Accessibility & Inclusion

Web surfaces support keyboard navigation, visible focus, semantic structure, reduced motion, readable contrast, and localized copy.
