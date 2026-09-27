import { describe, it, expect } from 'vitest';
import {
  aiChatUrl,
  calloutMd,
  chatPrompt,
  commandItemMd,
  definitionMd,
  inlineCode,
  mcpInstallUrl,
  truncateMarkdown,
} from './docMarkdown';

describe('truncateMarkdown', () => {
  it('returns the content unchanged when under the cap', () => {
    expect(truncateMarkdown('short', 'https://x/doc', 100)).toBe('short');
  });

  it('caps long content and appends a source note', () => {
    const out = truncateMarkdown('x'.repeat(50), 'https://leclap.app/doc/schema', 10);
    expect(out.startsWith('xxxxxxxxxx')).toBe(true);
    expect(out).not.toContain('x'.repeat(11));
    expect(out).toContain('truncated');
    expect(out).toContain('https://leclap.app/doc/schema');
  });
});

describe('chatPrompt', () => {
  it('embeds the title, url and markdown body', () => {
    const prompt = chatPrompt('Looks', 'https://leclap.app/doc/looks', '# Looks\n\nbody');
    expect(prompt).toContain('"Looks"');
    expect(prompt).toContain('https://leclap.app/doc/looks');
    expect(prompt).toContain('# Looks');
  });
});

describe('aiChatUrl', () => {
  it('targets chatgpt.com with a url-encoded q param', () => {
    const url = aiChatUrl('chatgpt', 'Audio', 'https://leclap.app/doc/audio', '# Audio');
    expect(url.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(decodeURIComponent(url.split('?q=')[1])).toContain('# Audio');
  });

  it('targets claude.ai/new', () => {
    const url = aiChatUrl('claude', 'Audio', 'https://leclap.app/doc/audio', '# Audio');
    expect(url.startsWith('https://claude.ai/new?q=')).toBe(true);
  });
});

describe('mcpInstallUrl', () => {
  it('builds a cursor:// deep-link carrying a base64 @leclap/mcp config', () => {
    const url = mcpInstallUrl('cursor');
    expect(url.startsWith('cursor://anysphere.cursor-deeplink/mcp/install?')).toBe(true);
    expect(url).toContain('name=leclap');

    const config = new URLSearchParams(url.split('?')[1]).get('config') ?? '';
    const decoded = JSON.parse(atob(config));
    expect(decoded.command).toBe('npx');
    expect(decoded.args).toContain('@leclap/mcp');
  });

  it('builds a vscode:mcp/install deep-link carrying the @leclap/mcp config', () => {
    const url = mcpInstallUrl('vscode');
    expect(url.startsWith('vscode:mcp/install?')).toBe(true);

    const payload = JSON.parse(decodeURIComponent(url.split('?')[1]));
    expect(payload.name).toBe('leclap');
    expect(payload.args).toContain('@leclap/mcp');
  });
});

describe('inlineCode', () => {
  it('wraps plain text in single backticks', () => {
    expect(inlineCode('leclap render')).toBe('`leclap render`');
  });

  it('fences past any backtick run inside, padding a leading or trailing tick', () => {
    expect(inlineCode('a`b')).toBe('``a`b``');
    expect(inlineCode('`a')).toBe('`` `a ``');
  });
});

describe('commandItemMd', () => {
  it('lists a command pill as code with its label', () => {
    expect(commandItemMd('leclap init [name]', 'scaffold a starter project')).toBe(
      '- `leclap init [name]` — scaffold a starter project'
    );
  });

  it('drops the dash when a pill has no label', () => {
    expect(commandItemMd('pnpm render', '')).toBe('- `pnpm render`');
  });
});

describe('definitionMd', () => {
  it('renders term, meta and meaning as one list item', () => {
    expect(definitionMd('--output <path>', '-o', 'Copy the finished mp4.')).toBe(
      '- `--output <path>` (-o) — Copy the finished mp4.'
    );
  });

  it('omits the parenthesis without a meta line', () => {
    expect(definitionMd('ping', '', 'Liveness check.')).toBe('- `ping` — Liveness check.');
  });
});

describe('calloutMd', () => {
  it('keeps the label apart from the body instead of running the two together', () => {
    expect(calloutMd('Tip', 'Use absolute paths.')).toBe('> **Tip:** Use absolute paths.');
  });

  it('quotes a bare body when there is no label', () => {
    expect(calloutMd('', 'Use absolute paths.')).toBe('> Use absolute paths.');
  });

  it('is empty when there is nothing to quote', () => {
    expect(calloutMd('Tip', '')).toBe('');
  });
});
