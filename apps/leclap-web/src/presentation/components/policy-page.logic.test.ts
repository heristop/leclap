import { describe, expect, it } from 'vitest';
import { linkMentions } from './policy-page.logic';

const REPO = 'https://github.com/heristop/leclap';

describe('linkMentions', () => {
  it('leaves prose without a mention as one plain run', () => {
    expect(linkMentions('No account, no backend server.', [REPO])).toEqual([
      { text: 'No account, no backend server.', href: null },
    ]);
  });

  it('turns the bare address the copy spells out into a link to the full URL', () => {
    expect(linkMentions('Reach out on GitHub at github.com/heristop/leclap.', [REPO])).toEqual([
      { text: 'Reach out on GitHub at ', href: null },
      { text: 'github.com/heristop/leclap', href: REPO },
      { text: '.', href: null },
    ]);
  });

  it('drops the empty runs around a mention that opens or closes the sentence', () => {
    expect(linkMentions('github.com/heristop/leclap', [REPO])).toEqual([
      { text: 'github.com/heristop/leclap', href: REPO },
    ]);
  });

  it('links every mention, of every address, in reading order', () => {
    const docs = 'https://leclap.dev/doc';

    expect(linkMentions('See leclap.dev/doc, then github.com/heristop/leclap.', [REPO, docs])).toEqual([
      { text: 'See ', href: null },
      { text: 'leclap.dev/doc', href: docs },
      { text: ', then ', href: null },
      { text: 'github.com/heristop/leclap', href: REPO },
      { text: '.', href: null },
    ]);
  });

  it('treats the address literally, so its dots only match dots', () => {
    expect(linkMentions('githubXcom/heristop/leclap', [REPO])).toEqual([
      { text: 'githubXcom/heristop/leclap', href: null },
    ]);
  });

  it('returns the text untouched when there is nothing to link', () => {
    expect(linkMentions('Plain.', [])).toEqual([{ text: 'Plain.', href: null }]);
  });
});
