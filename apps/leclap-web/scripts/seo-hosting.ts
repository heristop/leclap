import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { LOCALE_CODES } from '../src/config/site.ts';

export async function writeHostingFiles(template: string, appDir: string, distDir: string) {
  const noindex = template
    .replace(/<title>[\s\S]*?<\/title>/, '<title>Workspace — LeClap</title>')
    .replace(/(<meta\s+name="robots"\s+content=")[^"]*(")/, '$1noindex, follow$2')
    .replace(/<link\s+rel="canonical"[^>]*>/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace(/<meta\s+name="google-site-verification"[^>]*>/g, '');

  await Promise.all(
    LOCALE_CODES.map(async (lang) => {
      const directory = path.join(distDir, lang === 'en' ? '' : lang);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, 'app-shell.html'),
        noindex.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
      );
    })
  );

  const notFound = noindex
    .replace(/<title>[\s\S]*?<\/title>/, '<title>Page not found — LeClap</title>')
    .replace(
      '<div id="root"></div>',
      '<div id="root"><main class="min-h-screen bg-background px-6 py-24 text-foreground"><h1 class="font-display text-5xl">Page not found</h1><p class="mt-6">This address does not exist.</p><a class="mt-6 inline-block text-primary underline" href="/">Return to LeClap</a></main></div>'
    );
  await writeFile(path.join(distDir, '404.html'), notFound);
  const worker = await readFile(path.join(appDir, 'src/hosting/pages-worker.ts'), 'utf8');
  await writeFile(path.join(distDir, '_worker.js'), stripTypeScriptTypes(worker));
  await writeFile(
    path.join(distDir, '_routes.json'),
    JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2)
  );
}
