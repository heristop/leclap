---
'@leclap/mcp': patch
---

`render_remotion_clip` now reports render progress on stderr. Remotion's per-frame callback is
throttled to the same 2% step `compose_video` uses, so a long clip render prints roughly fifty
`[render_remotion_clip] render <id> <n>%` lines instead of one per frame — a render that used to
look hung now shows it is moving. Non-finite progress values are dropped rather than logged, so a
missing figure can neither print `NaN%` nor disable the throttle for the rest of the render.

stdout is untouched: it stays the JSON-RPC framing channel, and the tool's result payload is
unchanged.
