#!/usr/bin/env python3
"""Compose a before/after evidence video's cards and panels with ffmpeg, then hand them to LeClap.

  python3 build.py --content content.json --work build/evidence --logo mark.svg --leclap "npx @leclap/cli"

--content is the only file you write; content.example.json is its shape. Every colour, font, size,
position and easing comes from global.variables in template.json, so a render is reproducible from
those two files. LeClap then does the join: the crossfades, the watermark and the final encode.

ffmpeg draws the cards because the house layout needs what LeClap's titleCard/lowerThird text sugar
does not do: a label column beside the playing clip, BEFORE/AFTER chips lined up with their copy, and
every string wrapped on measured glyph widths (drawtext itself never wraps).
"""

import argparse
import itertools
import json
import os
import pathlib
import re
import shlex
import shutil
import subprocess
import sys

from wrap import CopyError, cap_height, fits, line_height, wrap_checked

SKILL_DIR = pathlib.Path(__file__).resolve().parent
# Where the LeClap repo keeps its OFL fonts. A copy of the skill elsewhere finds them in ./fonts.
LIBRARY_FONTS = pathlib.Path("packages/leclap-creative-kit/src/library/fonts")

# Compose in RGB and convert once, with the matrix the engine tags its output with. drawbox and
# drawtext convert their colours with BT.601 on a YUV frame, and the engine stamps BT.709 on every
# segment, so composing in YUV decodes the BEFORE red a few points off the colour it was given.
TO_BT709 = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
BT709_TAGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]

# The label panel's vertical rhythm, in px: chip to rule, rule to title, title to description, and
# the accent rule's full width.
RULE_GAP, TITLE_GAP, DESC_GAP, RULE_W = 12, 14, 16, 88
# Space between a chip and its neighbour in the intro rows.
ROW_GAP = 28


class V:
    """Typed accessors over global.variables, so a missing key fails here and not mid-filtergraph."""

    def __init__(self, raw, font_dir, ffmpeg, fps):
        self.raw, self.font_dir, self.ffmpeg, self.fps = raw, pathlib.Path(font_dir), ffmpeg, fps

    def get(self, key):
        if key not in self.raw:
            raise SystemExit(f"template.json: global.variables has no {key!r}")
        return self.raw[key]

    def s(self, key):
        value = self.get(key)
        return value if isinstance(value, str) else value[0]

    def i(self, key, index=None):
        value = self.get(key)
        return int(value if index is None else value[index])

    def f(self, key):
        return float(self.get(key))

    def font(self, key):
        path = self.font_dir / self.s(key)
        if not path.is_file():
            # drawtext does NOT fail on a missing fontfile: it silently falls back to a wide default
            # sans. Checking here is the only way that mistake surfaces.
            raise SystemExit(f"font not found: {path}")
        try:
            cap_height(str(path), 1)  # parse it now, so a woff2 or a collection fails by name
        except ValueError as error:
            raise SystemExit(str(error)) from None
        return str(path)


def ease(v, kind, start, duration):
    progress = f"clip((t-{start})/{duration},0,1)"
    power = v.i("motion.easeOutPow") if kind == "out" else v.i("motion.springPow")
    return f"(1-pow(1-{progress},{power}))"


# Every path this script hands ffmpeg is spliced raw into the `-vf` filtergraph, where these
# characters are syntax: a colon in --work truncates the option and ffmpeg reports "No option name
# near …", which reads like a filter bug rather than the path problem it actually is.
_FILTER_HOSTILE = frozenset(":,;'\\[]")


def check_filter_path(label, path):
    bad = "".join(sorted(_FILTER_HOSTILE & set(str(path))))
    if bad:
        raise SystemExit(f"{label} contains filtergraph-special character(s) {bad!r}: {path}")


_seq = itertools.count()


def txt(text, font, size, colour, x, top, alpha, extra="", *, tmp):
    """One animated `drawtext`, with its copy passed by FILE rather than inline, its capitals at `top`.

    `text='…'` cannot carry an apostrophe. Not "needs escaping": cannot. `\\'`, `'\\''` and `\\\\'`
    all exit 0 and all render "it's" as "its", dropping the character silently, and one of them also
    swallows `:fontfile=…` so the rest of the filter is drawn on screen as literal text. `textfile=`
    has no quoting layer at all, so every literal this file draws goes through here; `tmp` is
    keyword-REQUIRED so the broken inline form cannot be selected by accident.

    `expansion=none` closes the other half of the same hole: drawtext expands `%{…}` out of a
    textfile exactly as it does inline, so a bare `%` in copy is ffmpeg syntax until switched off.

    drawtext's own `y` is the top of the tallest glyph the line happens to contain, so an accented
    capital (É, À) pushes the whole line down and a chip reading APRÈS sits lower than its row.
    Anchoring on the baseline (`max_glyph_a` is the line's tallest ascent) puts every line where the
    geometry says, on FFmpeg 6.0 and 8.1 alike.
    """
    baseline = f"({top})+{cap_height(font, size)}"
    return (
        f"drawtext=textfile={_tmp_line(text, tmp)}:fontfile={font}:fontsize={size}"
        f":fontcolor={colour}:expansion=none:x={x}:y='{baseline}-max_glyph_a':alpha='{alpha}'{extra}"
    )


def _tmp_line(text, tmp):
    # UTF-8 explicitly: write_text() otherwise encodes with the locale's codec, which RAISES on "’"
    # under a POSIX/latin-1 locale and silently emits cp1252 on Windows, while drawtext decodes the
    # file as UTF-8 regardless. The pid keeps two renders sharing one --work from overwriting lines.
    path = tmp / f"_line{os.getpid()}-{next(_seq)}.txt"
    path.write_text(text, encoding="utf-8")
    return path


def source_args(v, src, ss, dur):
    if src is None:
        w, h = v.i("geom.canvas", 0), v.i("geom.canvas", 1)
        return ["-f", "lavfi", "-i", f"color=c={v.s('colour.surface')}:s={w}x{h}:d={dur}:r={v.fps}"]
    return ["-ss", f"{ss:.3f}", "-t", f"{dur:.3f}", "-i", str(src)]


def encode(v, vf, out, dur, src=None, ss=0.0):
    cmd = [v.ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *source_args(v, src, ss, dur)]
    cmd += ["-vf", f"{vf},{TO_BT709}", "-r", str(v.fps), "-an", "-c:v", "libx264", "-crf", "16"]
    subprocess.run([*cmd, "-pix_fmt", "yuv420p", *BT709_TAGS, str(out)], check=True)


def centred(v, where, lines):
    """Budget each centred line against the card's measure: nothing on a card wraps."""
    measure = v.i("geom.canvas", 0) - 2 * v.i("geom.cardMargin")
    for part, text, font, size in lines:
        fits(f"{where} {part}", text, font, size, measure)


def card(v, out, kicker, head, sub, accent, dur, tmp):
    ky, hy, ry, sy = (v.i("geom.card", i) for i in range(4))
    rw, rh = v.i("geom.rule", 0), v.i("geom.rule", 1)
    gentle, slow = v.s("motion.gentle"), v.s("motion.slow")
    label, display, body = v.font("font.label"), v.font("font.display"), v.font("font.body")
    kicker_size, head_size, sub_size = v.i("size.kicker"), v.i("size.headline"), v.i("size.subtitle")
    centred(v, out.stem, [("kicker", kicker, label, kicker_size), ("headline", head, display, head_size),
                          ("subtitle", sub, body, sub_size)])
    f = [
        "format=rgb24",
        txt(kicker, label, kicker_size, accent, "(w-text_w)/2", f"({ky})+(1-{ease(v, 'out', 0.00, gentle)})*16",
            ease(v, "out", 0.00, gentle), tmp=tmp),
        txt(head, display, head_size, v.s("colour.ink"), "(w-text_w)/2",
            f"({hy})+(1-{ease(v, 'spring', 0.06, slow)})*28", ease(v, "out", 0.06, 0.20), tmp=tmp),
        (f"drawbox=x='(iw-{rw}*{ease(v, 'out', 0.20, gentle)})/2':y={ry}"
         f":w='max(2,{rw}*{ease(v, 'out', 0.20, gentle)})':h={rh}:c={accent}@1:t=fill"),
        txt(sub, body, sub_size, v.s("colour.inkSubtle"), "(w-text_w)/2",
            f"({sy})+(1-{ease(v, 'out', 0.30, gentle)})*16", ease(v, "out", 0.30, gentle), tmp=tmp),
    ]
    encode(v, ",".join(f), out, dur)


def intro(v, out, kicker, head, rows, dur, tmp):
    ky, hy = v.i("geom.card", 0) - 80, v.i("geom.card", 1) - 80  # the rows need the room; keep the gap
    rw, rh = v.i("geom.rule", 0), v.i("geom.rule", 1)
    gentle, slow = v.s("motion.gentle"), v.s("motion.slow")
    badge_size, desc_size, pad = v.i("size.introBadge"), v.i("size.introDesc"), v.i("geom.badgePad") - 1
    display, body, label = v.font("font.display"), v.font("font.body"), v.font("font.label")
    kicker_size, head_size, canvas_w = v.i("size.kicker"), v.i("size.headline"), v.i("geom.canvas", 0)
    centred(v, "intro", [("kicker", kicker, label, kicker_size), ("headline", head, display, head_size)])
    chip_w = int(max(fits(f"intro badge {badge}", badge, display, badge_size, 400) for badge, _, _ in rows)) + 2 * pad
    widest = max(fits("intro chip copy", chip, body, desc_size, 700) for _, _, chip in rows)
    chip_x = int((canvas_w - (chip_w + ROW_GAP + widest)) / 2)
    desc_x = chip_x + chip_w + ROW_GAP
    f = [
        "format=rgb24",
        txt(kicker, label, kicker_size, v.s("colour.neutral"), "(w-text_w)/2",
            f"({ky})+(1-{ease(v, 'out', 0.00, gentle)})*16", ease(v, "out", 0.00, gentle), tmp=tmp),
        txt(head, display, head_size, v.s("colour.ink"), "(w-text_w)/2",
            f"({hy})+(1-{ease(v, 'spring', 0.06, slow)})*28", ease(v, "out", 0.06, 0.20), tmp=tmp),
        (f"drawbox=x='(iw-{rw}*{ease(v, 'out', 0.20, gentle)})/2':y={v.i('geom.introRule')}"
         f":w='max(2,{rw}*{ease(v, 'out', 0.20, gentle)})':h={rh}:c={v.s('colour.neutral')}@1:t=fill"),
    ]
    for index, (badge, accent, chip) in enumerate(rows):
        y = v.i("geom.introRowY") + index * v.i("geom.introRowGap")
        start = 0.34 + index * v.f("motion.stagger")
        # A box sized by drawtext itself (box=1) auto-fits its text, so a longer badge cannot overflow.
        # The box grows `pad` around the text, so the text is inset by it to put the box at chip_x/y.
        f.append(txt(badge, display, badge_size, v.s("colour.onAccent"), chip_x + pad, f"({y + pad})",
                     ease(v, "out", start, v.s("motion.quick")),
                     f":box=1:boxcolor={accent}@1:boxborderw={pad}", tmp=tmp))
        # The copy shares the chip's baseline, whatever the two fonts' cap heights.
        copy_top = y + pad + cap_height(display, badge_size) - cap_height(body, desc_size)
        f.append(txt(chip, body, desc_size, v.s("colour.inkSubtle"), desc_x,
                     f"({copy_top})+(1-{ease(v, 'out', round(start + 0.06, 2), gentle)})*12",
                     ease(v, "out", round(start + 0.06, 2), gentle), tmp=tmp))
    encode(v, ",".join(f), out, dur)


def probe(ffmpeg, path):
    """Duration and frame size of a capture, read from ffmpeg's own banner so no ffprobe is needed."""
    if not pathlib.Path(path).is_file():
        raise SystemExit(f"capture not found: {path}")
    banner = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    size = re.search(r"Stream #.*?Video:.*?\b(\d{2,5})x(\d{2,5})\b", banner)
    if not size:
        raise SystemExit(f"no video stream in {path}")
    duration = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", banner)
    seconds = None
    if duration:
        hours, minutes, secs = duration.groups()
        seconds = int(hours) * 3600 + int(minutes) * 60 + float(secs)
    return seconds, int(size.group(1)), int(size.group(2))


def capture_hold(out, capture_seconds, ss, dur):
    """Seconds of last-frame hold needed so the clip fills its section, or a hard stop."""
    if capture_seconds is None:
        print(f"  {out.stem}: capture has no duration header; cannot check it covers {dur}s from {ss}s")
        return 0.0
    if ss >= capture_seconds:
        raise SystemExit(f"{out.stem}: trim {ss}s is past the end of the {capture_seconds:.2f}s capture "
                         "(trim is a START offset, not a length)")
    missing = round(ss + dur - capture_seconds, 3)
    if missing <= 0:
        return 0.0
    # The engine would pad or truncate silently; holding the final state is the honest version.
    print(f"  {out.stem}: capture ends {missing:.2f}s early; holding its last frame")
    return missing


def panel(v, out, src, ss, dur, accent, badge, title, desc, tmp):
    vocabulary = v.get("limit.badgeVocabulary")
    if badge not in vocabulary:
        raise SystemExit(f"badge {badge!r} not in {vocabulary}: the chip has no room to wrap")
    canvas_w, canvas_h = v.i("geom.canvas", 0), v.i("geom.canvas", 1)
    col, pad, pad_badge = v.i("geom.panelWidth"), v.i("geom.panelPad"), v.i("geom.badgePad")
    measure = col - 2 * pad
    display, body = v.font("font.display"), v.font("font.body")
    title_size, desc_size = v.i("size.panelTitle"), v.i("size.panelDesc")
    fits(f"{badge} chip", badge, display, v.i("size.panelBadge"), measure - 2 * pad_badge)
    title_lines = wrap_checked("title", title, display, title_size, measure, max_lines=v.i("limit.titleLines"))
    desc_lines = wrap_checked("desc", desc, body, desc_size, measure, max_lines=v.i("limit.descLines"))
    # Heights measured from the fonts like the widths, so the block centres on its real height. Each
    # wrapped line is its own drawtext on that pitch: drawtext's multi-line layout differs between
    # FFmpeg builds (6.0 spaces lines by the tallest glyph, 6.1+ by the font), and ours does not.
    line_spacing, rule_h = v.i("geom.lineSpacing"), v.i("geom.rule", 1)
    chip_h = cap_height(display, v.i("size.panelBadge")) + 2 * pad_badge  # badges are capitals
    title_pitch = line_height(display, title_size) + line_spacing
    desc_pitch = line_height(body, desc_size) + line_spacing
    title_h = len(title_lines) * title_pitch - line_spacing
    desc_h = len(desc_lines) * desc_pitch - line_spacing
    block = chip_h + RULE_GAP + rule_h + TITLE_GAP + title_h + DESC_GAP + desc_h
    y0 = int((canvas_h - block) / 2)
    rule_y = y0 + chip_h + RULE_GAP
    title_y = rule_y + rule_h + TITLE_GAP
    desc_y = title_y + title_h + DESC_GAP

    # Fit the capture inside the stage beside the panel: never crop it (the header and footer are
    # usually where the change shows) and never stretch it. A 4:3 capture fills the stage exactly.
    capture_seconds, src_w, src_h = probe(v.ffmpeg, src)
    stage_w, stage_h = canvas_w - col, canvas_h
    scale = min(stage_w / src_w, stage_h / src_h)
    fit_w, fit_h = int(src_w * scale) // 2 * 2, int(src_h * scale) // 2 * 2
    fit_x, fit_y = col + (stage_w - fit_w) // 2, (stage_h - fit_h) // 2
    hairline, gentle = v.s("colour.hairline"), v.s("motion.gentle")
    f = [
        f"scale={fit_w}:{fit_h}:flags=lanczos,setsar=1,format=rgb24",
        f"pad={canvas_w}:{canvas_h}:{fit_x}:{fit_y}:{v.s('colour.stage')}",
        f"drawbox=x=0:y=0:w={col}:h={canvas_h}:c={v.s('colour.surface')}@1:t=fill",
        f"drawbox=x={col - 1}:y=0:w=1:h={canvas_h}:c={hairline}@1:t=fill",
    ]
    if (fit_w, fit_h) != (stage_w, stage_h):
        f.append(f"drawbox=x={fit_x - 1}:y={fit_y - 1}:w={fit_w + 2}:h={fit_h + 2}:c={hairline}@1:t=1")
    f += [
        txt(badge, display, v.i("size.panelBadge"), v.s("colour.onAccent"), pad + pad_badge, y0 + pad_badge,
            ease(v, "out", 0.05, v.s("motion.quick")),
            f":box=1:boxcolor={accent}@1:boxborderw={pad_badge}", tmp=tmp),
        (f"drawbox=x={pad}:y={rule_y}:w='max(2,{RULE_W}*{ease(v, 'out', 0.20, gentle)})':h={rule_h}"
         f":c={accent}@1:t=fill"),
        *(txt(line, display, title_size, v.s("colour.ink"), pad,
              f"({title_y + index * title_pitch})+(1-{ease(v, 'out', 0.26, gentle)})*14",
              ease(v, "out", 0.26, gentle), tmp=tmp) for index, line in enumerate(title_lines)),
        *(txt(line, body, desc_size, v.s("colour.inkSubtle"), pad, desc_y + index * desc_pitch,
              ease(v, "out", 0.40, gentle), tmp=tmp) for index, line in enumerate(desc_lines)),
    ]
    hold = capture_hold(out, capture_seconds, ss, dur)
    if hold:
        f.append(f"tpad=stop_mode=clone:stop_duration={hold}")
    print(f"  {out.stem}: badge {badge} · title {len(title_lines)}L · desc {len(desc_lines)}L · block {block}px"
          f" · capture {src_w}x{src_h} → {fit_w}x{fit_h}")
    encode(v, ",".join(f), out, dur, src=src, ss=ss)


def keys(obj, where, required, optional=()):
    """Reject a content object with missing or unknown keys; `_`-prefixed keys are notes."""
    if not isinstance(obj, dict):
        raise SystemExit(f"content: {where} must be an object")
    missing = [key for key in required if key not in obj]
    if missing:
        raise SystemExit(f"content: {where} is missing {', '.join(missing)} (see content.example.json)")
    unknown = sorted(key for key in obj if key not in required and key not in optional and not key.startswith("_"))
    if unknown:
        raise SystemExit(f"content: {where} has unknown key(s) {', '.join(unknown)}: nothing draws them")


def pick(value, where, locale):
    """Copy is a string, or {locale: string} like LeClap's own translated fields."""
    text = value
    if isinstance(value, dict):
        if locale not in value:
            raise SystemExit(f"content: {where} has no {locale!r} copy (has {', '.join(value) or 'none'})")
        text = value[locale]
    if not isinstance(text, str) or not text.strip():
        raise SystemExit(f"content: {where} must be non-empty copy")
    return " ".join(text.split())


def load_content(path, prefixes):
    raw = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    keys(raw, "the file", required=("ticket", "intro", "outro", "sides"), optional=("clipSeconds",))
    keys(raw["intro"], "intro", required=("headline",))
    keys(raw["outro"], "outro", required=("headline", "subtitle"))
    sides = raw["sides"] if isinstance(raw["sides"], list) else []
    names = [side.get("side") for side in sides if isinstance(side, dict)]
    if names != prefixes:
        raise SystemExit(f"content: sides must be {prefixes} in that order (the template's partial prefixes), "
                         f"got {names}")
    for side in sides:
        where = f"sides[{side['side']}]"
        keys(side, where, required=("side", "badge", "capture", "trim", "chip", "card", "panel"))
        keys(side["card"], f"{where}.card", required=("headline", "subtitle"))
        keys(side["panel"], f"{where}.panel", required=("title", "desc"))
        if not isinstance(side["trim"], (int, float)) or side["trim"] < 0:
            raise SystemExit(f"content: {where}.trim is the START offset into the capture, in seconds (>= 0)")
    clip = raw.get("clipSeconds", 1)
    if not isinstance(clip, (int, float)) or clip <= 0:
        raise SystemExit("content: clipSeconds must be a positive number of seconds")
    return raw


def template_shape(tpl):
    """The sections build.py composes: intro, a card + clip pair per side, outro. Anything else is a
    different video, and this script would silently leave its sections without a clip."""
    sections = tpl.get("sections", [])
    refs = [section for section in sections if section.get("type") == "partial"]
    named = {section.get("name"): section for section in sections if section.get("type") != "partial"}
    partials = {partial["id"]: partial for partial in tpl.get("partials", [])}
    ref_ids = {ref.get("ref") for ref in refs}
    pair = partials.get(next(iter(ref_ids))) if len(ref_ids) == 1 else None
    pair_named = {section.get("name"): section for section in (pair or {}).get("sections", [])}
    all_clips = [*named.values(), *pair_named.values()]
    if set(named) != {"intro", "outro"} or len(refs) != 2 or set(pair_named) != {"card", "clip"} or any(
        section.get("type") != "project_video" for section in all_clips
    ):
        raise SystemExit("template.json: build.py composes project_video sections intro, outro and one "
                         "card + clip partial per side; this template has a different shape")
    return named, pair_named, [ref.get("prefix", "") for ref in refs]


def find_fonts(explicit, names):
    if explicit:
        return pathlib.Path(explicit).resolve()
    candidates = [SKILL_DIR / "fonts", *(parent / LIBRARY_FONTS for parent in SKILL_DIR.parents)]
    for directory in candidates:
        if all((directory / name).is_file() for name in names):
            return directory
    raise SystemExit(f"fonts not found: pass --fonts DIR holding {', '.join(names)} (OFL fonts from LeClap's "
                     "creative kit), or copy them with their licence into ./fonts beside build.py")


def require_drawtext(ffmpeg):
    try:
        filters = subprocess.run([ffmpeg, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    except FileNotFoundError:
        raise SystemExit(f"ffmpeg not found: {ffmpeg}") from None
    if re.search(r"\sdrawtext\s", filters):
        return
    raise SystemExit(f"{ffmpeg} has no drawtext filter (built without libfreetype), so it cannot draw a "
                     "single card. Point --ffmpeg at one that has it: see SKILL.md, 'The traps'.")


def stage_logo(logo, tpl, work):
    """Put the watermark image where the template's global.watermark.url points, under assets/."""
    mark = tpl["global"].get("watermark")
    if not mark or re.match(r"^(https?:|/|\{\{)", mark["url"]):
        return
    dest = work / "assets" / mark["url"]
    if logo is None and dest.is_file():
        return
    if logo is None:
        raise SystemExit(f"template.json declares global.watermark but {dest} does not exist: pass --logo "
                         "<png|svg> (your product's mark), or delete global.watermark")
    dest.parent.mkdir(parents=True, exist_ok=True)
    source = pathlib.Path(logo)
    if source.suffix.lower() == ".png":
        shutil.copyfile(source, dest)
        return
    if source.suffix.lower() != ".svg":
        raise SystemExit(f"--logo must be a .png or an .svg: {source}")
    if not shutil.which("rsvg-convert"):
        raise SystemExit("--logo is an SVG and rsvg-convert (librsvg) is not installed: pass a PNG instead")
    # 4x the on-screen width, so the engine's downscale keeps the mark's edges crisp.
    width = round(int(tpl["global"]["variables"]["geom.canvas"][0]) * mark.get("scale", 0.12) * 4)
    subprocess.run(["rsvg-convert", "-w", str(width), str(source), "-o", str(dest)], check=True)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--content", required=True, help="the copy and the two captures (content.example.json)")
    parser.add_argument("--template", default=str(SKILL_DIR / "template.json"))
    parser.add_argument("--work", required=True, help="scratch render root: gets assets/, build/ and "
                                                      "evidence.template.json; capture paths are relative to it")
    parser.add_argument("--fonts", help="TTF/OTF directory (default: ./fonts, then LeClap's creative kit)")
    parser.add_argument("--logo", help="PNG or SVG for global.watermark (your product's mark)")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="an ffmpeg WITH drawtext (see SKILL.md)")
    parser.add_argument("--locale", default="en", help="picks {locale: copy} entries; forwarded to the render")
    parser.add_argument("--leclap", help='render with this CLI command, e.g. "npx @leclap/cli"; omit to only '
                                         "build the clips (then use the MCP's compose_video)")
    parser.add_argument("--out", help="rendered file (default: <work>/<ticket>-evidence.mp4)")
    return parser.parse_args()


def main():
    # Line-buffered, so these notes interleave with the CLI's own output when piped to an agent.
    sys.stdout.reconfigure(line_buffering=True)
    args = parse_args()
    tpl = json.loads(pathlib.Path(args.template).read_text(encoding="utf-8"))
    named, pair, prefixes = template_shape(tpl)
    content = load_content(args.content, prefixes)
    variables = tpl["global"]["variables"]
    fonts = find_fonts(args.fonts, [variables[key] for key in ("font.display", "font.body", "font.label")])
    v = V(variables, fonts, args.ffmpeg, tpl["global"].get("fps", 30))
    require_drawtext(args.ffmpeg)

    work = pathlib.Path(args.work).resolve()
    videos, lines = work / "assets/videos", work / "build/lines"
    # Scratch copy for `textfile=` lives OUTSIDE assets/videos: it is never an asset, and a dozen
    # stray _line*.txt next to the shipped .mp4 only confuses whoever debugs a render.
    for directory in (videos, lines):
        directory.mkdir(parents=True, exist_ok=True)
    check_filter_path("--fonts", v.font_dir)
    check_filter_path("--work", lines)
    stage_logo(args.logo, tpl, work)

    # A capture is only as long as the flow it records, and the house 8.0 s clip does not fit every
    # change. clipSeconds overrides it, and the resolved template is written to the work dir so the
    # render (CLI or MCP) uses the SAME number the clips were cut to: a mismatch there is silent.
    if "clipSeconds" in content:
        pair["clip"]["options"]["duration"] = content["clipSeconds"]
    resolved = work / "evidence.template.json"
    resolved.write_text(json.dumps(tpl, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def copy(value, where):
        return pick(value, where, args.locale)

    ticket = copy(content["ticket"], "ticket")
    sides = content["sides"]
    accents = {side["side"]: v.s(f"colour.{side['side']}") for side in sides}
    try:
        # `chip` is its own copy, deliberately: deriving it from the panel description produces a line
        # several times the intro's measure, and the whole point of the intro row is to be scannable.
        intro(v, videos / "intro.mp4", ticket, copy(content["intro"]["headline"], "intro.headline"),
              [(copy(side["badge"], f"sides[{side['side']}].badge"), accents[side["side"]],
                copy(side["chip"], f"sides[{side['side']}].chip")) for side in sides],
              named["intro"]["options"]["duration"], lines)
        card(v, videos / "outro.mp4", ticket, copy(content["outro"]["headline"], "outro.headline"),
             copy(content["outro"]["subtitle"], "outro.subtitle"), v.s("colour.neutral"),
             named["outro"]["options"]["duration"], lines)
        for side in sides:
            name, where = side["side"], f"sides[{side['side']}]"
            card(v, videos / f"{name}card.mp4", ticket, copy(side["card"]["headline"], f"{where}.card.headline"),
                 copy(side["card"]["subtitle"], f"{where}.card.subtitle"), accents[name],
                 pair["card"]["options"]["duration"], lines)
            panel(v, videos / f"{name}clip.mp4", work / side["capture"], side["trim"],
                  pair["clip"]["options"]["duration"], accents[name], copy(side["badge"], f"{where}.badge"),
                  copy(side["panel"]["title"], f"{where}.panel.title"),
                  copy(side["panel"]["desc"], f"{where}.panel.desc"), lines)
    except CopyError as error:
        # The guard working, not an obstacle: shorten the copy. Never widen the box.
        raise SystemExit(f"{type(error).__name__}: {error}") from None

    clips = ["intro", *(f"{p}{s}" for p in prefixes for s in ("card", "clip")), "outro"]
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", ticket).strip("-").lower() or "evidence"
    out = pathlib.Path(args.out).resolve() if args.out else work / f"{slug}-evidence.mp4"
    print(f"Built {', '.join(clips)} in {videos}")
    if not args.leclap:
        paths = json.dumps({clip: str(videos / f"{clip}.mp4") for clip in clips})
        print(f"Render: leclap render {resolved} --assets {work / 'assets'} --build {work / 'build'} "
              f"--locale {args.locale} -o {out}")
        print(f"   or MCP compose_video with template = {resolved.name}, locale {args.locale!r}, userVideoPaths = "
              f"{paths}, the server started with LECLAP_MCP_MEDIA_DIR={work / 'assets'}")
        return
    command = [*shlex.split(args.leclap), "render", str(resolved), "--assets", str(work / "assets"),
               "--build", str(work / "build"), "--locale", args.locale, "-o", str(out)]
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
