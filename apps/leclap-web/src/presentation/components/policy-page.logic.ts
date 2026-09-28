/** One stretch of a policy paragraph: plain prose, or the bare address of a page it links to. */
export type PolicyRun = { readonly text: string; readonly href: string | null };

const bare = (url: string): string => url.replace(/^https?:\/\//, '');

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Split `text` so every bare mention of one of `urls` — written without its protocol, the way the copy
 * spells an address out loud ("github.com/heristop/leclap") — becomes a link run to the full URL.
 *
 * The policy copy names its only contact channel as text, because a translated sentence cannot carry
 * markup; this keeps the words exactly as translated and makes the address clickable anyway. Runs are
 * plain data rendered as text nodes, so a translation can never inject HTML. Splitting on one capturing
 * group makes the runs alternate (prose, mention, prose); empty prose at either end is dropped.
 */
export function linkMentions(text: string, urls: readonly string[]): PolicyRun[] {
  if (urls.length === 0) {
    return [{ text, href: null }];
  }

  const hrefByMention = new Map(urls.map((url) => [bare(url), url]));
  const pattern = new RegExp(`(${[...hrefByMention.keys()].map(escapeRegExp).join('|')})`);

  return text
    .split(pattern)
    .map((part, index) => ({ text: part, href: index % 2 === 1 ? (hrefByMention.get(part) ?? null) : null }))
    .filter((run) => run.text.length > 0);
}
