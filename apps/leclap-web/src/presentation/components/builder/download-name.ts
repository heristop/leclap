// Long enough to keep a template name recognisable, short enough that the date stays visible in a
// file list.
const MAX_SLUG = 40;

const slugify = (title: string): string =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '');

const pad = (value: number): string => String(value).padStart(2, '0');

// The saved file's name: the project title as a readable slug plus the local render date, so a folder
// of renders reads "present-yourself-2026-09-27.mp4" instead of a wall of epoch timestamps. A title
// with nothing to slug (emoji only, or none at all) falls back to the brand.
export const downloadName = (title: string | undefined, date: Date): string => {
  const slug = slugify(title ?? '') || 'leclap';
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return `${slug}-${day}.mp4`;
};
