import { SAMPLE_PAGES } from './sample-pages.ts';
import { SITE_URL } from './site.ts';

/** Shared by prerendering and SPA navigation so a previous page's preview cannot leak. */
export function socialImage(route: string) {
  const sample = SAMPLE_PAGES.find(({ path }) => path === route);

  return sample
    ? {
        url: `${SITE_URL}/videos/showcase/${sample.id}.webp`,
        alt: sample.title,
        type: 'image/webp',
        width: '720',
        height: '405',
      }
    : {
        url: `${SITE_URL}/og-image.jpg`,
        alt: 'Clappy, the LeClap mascot, beside the LeClap wordmark',
        type: 'image/jpeg',
        width: '1200',
        height: '630',
      };
}
