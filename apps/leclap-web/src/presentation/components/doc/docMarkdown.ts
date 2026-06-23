// Turns a rendered doc page into Markdown and builds the "take this page elsewhere" links used by the
// docs Copy-page menu. Doc pages are JSX (no Markdown source), so we serialise the live DOM at click
// time — the output always matches what the reader sees. Only the link/prompt builders are pure and
// unit-tested; the DOM walk is exercised in the browser.

export type AiProvider = 'chatgpt' | 'claude';
export type McpEditor = 'cursor' | 'vscode';

// Keep inlined page content well under common URL ceilings when handing a page to a chat assistant.
const MAX_INLINE_MARKDOWN = 6000;

// The MCP server the editor deep-links install. `@leclap/mcp` is not yet published to npm, so this is
// forward-looking: the deep-links resolve once it ships. Until then the README documents a manual config.
const MCP_NAME = 'leclap';
const MCP_CONFIG = { command: 'npx', args: ['-y', '@leclap/mcp'] };

const AI_ENDPOINT: Record<AiProvider, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
};

export function truncateMarkdown(markdown: string, url: string, max = MAX_INLINE_MARKDOWN): string {
  if (markdown.length <= max) return markdown;

  return `${markdown.slice(0, max)}\n\n…(truncated — full page at ${url})`;
}

export function chatPrompt(title: string, url: string, markdown: string): string {
  const body = truncateMarkdown(markdown, url);

  return `I'm reading the LeClap docs page "${title}" (${url}). Here is its content:\n\n${body}\n\nHelp me understand it and answer my questions about it.`;
}

export function aiChatUrl(provider: AiProvider, title: string, url: string, markdown: string): string {
  return `${AI_ENDPOINT[provider]}?q=${encodeURIComponent(chatPrompt(title, url, markdown))}`;
}

export function mcpInstallUrl(editor: McpEditor): string {
  if (editor === 'cursor') {
    const config = btoa(JSON.stringify(MCP_CONFIG));

    return `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_NAME}&config=${encodeURIComponent(config)}`;
  }

  const payload = JSON.stringify({ name: MCP_NAME, ...MCP_CONFIG });

  return `vscode:mcp/install?${encodeURIComponent(payload)}`;
}

// ── DOM → Markdown ───────────────────────────────────────────────────────────────
// Browser-only. Walks the rendered doc content into block-level Markdown, handling the elements our
// DocBlocks actually emit (headings, prose, inline code, JSON blocks, field tables, callouts, chips).

// Interactive / non-content nodes (the Copy-page toolbar, copy pills, PM switchers, scripts).
const SKIP_TAGS = new Set(['button', 'script', 'style']);

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

const resolveHref = (href: string | null): string => {
  if (!href) return '';

  if (href.startsWith('#')) return href;

  try {
    return new URL(href, window.location.origin).toString();
  } catch {
    return href;
  }
};

// Serialise one inline child element (code, emphasis, link, line break) to Markdown.
const inlineChildMd = (child: HTMLElement): string => {
  const tag = child.tagName.toLowerCase();

  if (tag === 'code') return `\`${collapse(child.textContent)}\``;

  if (tag === 'strong' || tag === 'b') return `**${inlineMd(child).trim()}**`;

  if (tag === 'em' || tag === 'i') return `_${inlineMd(child).trim()}_`;

  if (tag === 'br') return '\n';

  if (tag === 'a') {
    const text = inlineMd(child).trim();

    // DocSection headings carry a bare "#" permalink anchor — drop it.
    if (!text || text === '#') return '';

    return `[${text}](${resolveHref(child.getAttribute('href'))})`;
  }

  return inlineMd(child);
};

// Serialise an element's inline content (text, code, emphasis, links) to Markdown.
function inlineMd(node: Node): string {
  let out = '';

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? '';

      continue;
    }

    if (child instanceof HTMLElement) out += inlineChildMd(child);
  }

  return out;
}

const headingText = (el: HTMLElement): string => collapse(el.textContent).replace(/\s*#$/, '');

// JsonBlock renders each line as a grid row: an aria-hidden line-number span + the content span.
// Take the last span per row so the gutter numbers don't leak into the fence.
const preText = (pre: HTMLElement): string => {
  const rows = pre.querySelectorAll('code > div');

  if (rows.length === 0) return pre.textContent;

  return [...rows]
    .map((row) => {
      const spans = [...row.querySelectorAll(':scope > span')];

      return spans.at(-1)?.textContent ?? '';
    })
    .join('\n');
};

const tableMd = (table: HTMLElement): string => {
  const headers = [...table.querySelectorAll('thead th')].map((th) => collapse(th.textContent));
  const bodyRows = [...table.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => collapse(td.textContent).replace(/\|/g, String.raw`\|`))
  );

  if (headers.length === 0 && bodyRows.length === 0) return '';

  const width = headers.length > 0 ? headers.length : (bodyRows[0]?.length ?? 0);
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  const body = bodyRows.map((cells) => `| ${cells.join(' | ')} |`).join('\n');

  return [head, sep, body].filter(Boolean).join('\n');
};

const listMd = (list: HTMLElement): string =>
  [...list.querySelectorAll(':scope > li')].map((li) => `- ${collapse(inlineMd(li))}`).join('\n');

// Markdown for one block-level element, or null when it's a container whose children carry the blocks.
const blockMd = (el: HTMLElement): string | null => {
  const tag = el.tagName.toLowerCase();

  if (SKIP_TAGS.has(tag)) return '';

  if (/^h[1-4]$/.test(tag)) {
    const text = headingText(el);

    return text ? `${'#'.repeat(Number(tag[1]))} ${text}` : '';
  }

  if (tag === 'p') return inlineMd(el).trim();

  if (tag === 'pre') return `\`\`\`json\n${preText(el)}\n\`\`\``;

  if (tag === 'table') return tableMd(el);

  if (tag === 'ul' || tag === 'ol') return listMd(el);

  if (tag === 'aside') {
    const text = collapse(el.textContent);

    return text ? `> ${text}` : '';
  }

  return null;
};

// Append the Markdown for one element (and, for containers, its descendants) to `blocks`.
const walk = (el: HTMLElement, blocks: string[]): void => {
  const md = blockMd(el);

  if (md === null) {
    for (const child of el.childNodes) {
      if (child instanceof HTMLElement) walk(child, blocks);
    }

    return;
  }

  if (md) blocks.push(md);
};

export function elementToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];
  walk(root, blocks);

  return blocks.join('\n\n');
}

export function pageTitle(root: HTMLElement): string {
  const h1 = root.querySelector('h1');

  return h1 ? headingText(h1).trim() : document.title;
}

export function pageMarkdown(root: HTMLElement, url: string): string {
  return `${elementToMarkdown(root)}\n\n---\nSource: ${url}\n`;
}
