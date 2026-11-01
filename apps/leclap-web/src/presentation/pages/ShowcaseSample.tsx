import { Link } from 'react-router-dom';
import { SAMPLE_PAGES, samplePage } from '@/config/sample-pages';
import { SITE_URL } from '@/config/site';
import { Seo } from '@/presentation/components/Seo';
import { ShowcasePlayer } from '@/presentation/components/showcase/ShowcasePlayer';
import { SHOWCASE_SAMPLES, mediaPath } from '@/presentation/components/showcase/catalog';
import { Prose } from '@/presentation/components/doc/DocBlocks';
import './showcase.css';

export function ShowcaseSample({ sampleId }: { sampleId: string }) {
  const page = samplePage(sampleId);
  const sample = SHOWCASE_SAMPLES.find(({ id }) => id === sampleId);

  if (!page || !sample) throw new Error(`Unknown showcase page: ${sampleId}`);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'LeClap', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Motion showcase', item: `${SITE_URL}/showcase` },
      { '@type': 'ListItem', position: 3, name: page.title, item: `${SITE_URL}${page.path}` },
    ],
  };

  return (
    <article className="showcase-page mx-auto w-full max-w-6xl px-5 pb-20 pt-28 sm:px-8">
      <Seo title={page.title} description={page.description} path={page.path} />
      <script type="application/ld+json">{JSON.stringify(schema).replace(/</g, String.raw`\u003c`)}</script>
      <nav aria-label="Breadcrumb" className="mb-5 flex gap-3 text-sm text-muted-foreground">
        <a href="/">LeClap</a>
        <span aria-hidden="true">/</span>
        <a href="/showcase">Motion showcase</a>
      </nav>
      <header className="mb-7 max-w-3xl">
        <p className="mb-3 text-sm uppercase tracking-widest text-primary">Editable video example</p>
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{page.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{page.description}</p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-divider bg-surface">
        {typeof window === 'undefined' ? (
          <video
            className="aspect-video w-full"
            controls
            muted
            playsInline
            preload="none"
            poster={mediaPath(sample, 'webp')}
            aria-label={sample.title}
          >
            <source src={mediaPath(sample, 'mp4')} type="video/mp4" />
            <a href={mediaPath(sample, 'mp4')}>Watch {sample.title}</a>
          </video>
        ) : (
          <ShowcasePlayer sample={sample} requested={false} still />
        )}
      </div>
      <div className="my-7 flex flex-wrap gap-4">
        <a
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-primary-foreground"
          href={mediaPath(sample, 'json')}
          download
        >
          Download editable JSON
        </a>
        <a
          className="inline-flex min-h-11 items-center px-2 text-primary underline underline-offset-4"
          href={`https://github.com/heristop/leclap/blob/main/${sample.source}`}
        >
          View source template
        </a>
      </div>
      <Prose className="space-y-8">
        <section>
          <h2 className="mb-3 font-display text-2xl">How this example works</h2>
          <p>{page.explanation}</p>
        </section>
        <section>
          <h2 className="mb-3 font-display text-2xl">Make it yours</h2>
          <p>{page.customize}</p>
        </section>
        <section>
          <h2 className="mb-3 font-display text-2xl">Render with MCP or the CLI</h2>
          <p>{page.requirement}</p>
          <p className="mt-3">
            In your MCP client, ask the agent to call <code>get_samples</code> with{' '}
            <code>{`{ "id": "${sample.id}" }`}</code>. Inspect required inputs, customize the template, validate it and
            use <code>render_frames</code> before composing the final video.
          </p>
          <pre className="my-4 max-w-full overflow-x-auto rounded-xl border border-divider bg-surface p-4 text-sm">
            <code>{`npx @leclap/cli samples show ${sample.id}\nnpx @leclap/cli samples export ${sample.id} --output ${sample.id}.json\nnpx @leclap/cli diagnose\nnpx @leclap/cli validate ${sample.id}.json`}</code>
          </pre>
          <p>
            After supplying the listed assets and media, follow the{' '}
            <Link to="/doc/cli">CLI rendering instructions</Link> or <Link to="/doc/mcp">MCP setup guide</Link>. The
            preview above is a prepared render; your changes render locally.
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-display text-2xl">Continue exploring</h2>
          <ul>
            <li>
              <Link to={page.guide}>{page.guideLabel}</Link>
            </li>
            {SAMPLE_PAGES.filter(({ id }) => id !== sample.id).map((related) => (
              <li key={related.id}>
                <a href={related.path}>{related.title}</a>
              </li>
            ))}
          </ul>
        </section>
      </Prose>
    </article>
  );
}
