import { describe, it, expect } from 'vitest';
import { aiChatUrl, mcpInstallUrl, chatPrompt, truncateMarkdown } from './docMarkdown';

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
