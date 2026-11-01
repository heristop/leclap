import { Link } from 'react-router-dom';
import { SAMPLE_PAGES, samplePage } from '@/config/sample-pages';
import { SITE_URL } from '@/config/site';
import { Seo } from '@/presentation/components/Seo';
import { ShowcasePlayer } from '@/presentation/components/showcase/ShowcasePlayer';
import { SHOWCASE_SAMPLES, mediaPath } from '@/presentation/components/showcase/catalog';
import { Button } from '@/presentation/components/ui/button';
import { ArrowRight, ChevronRight, Download, FileCode } from '@/presentation/components/icons';
import { CommandList, CommandPill, Prose } from '@/presentation/components/doc/DocBlocks';
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
    <article className="showcase-page mx-auto w-full max-w-7xl px-5 pb-20 pt-24 sm:px-8 sm:pt-28">
      <Seo title={page.title} description={page.description} path={page.path} />
      <script type="application/ld+json">{JSON.stringify(schema).replace(/</g, String.raw`\u003c`)}</script>
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <a className="sample-text-link inline-flex min-h-11 items-center" href="/">
          LeClap
        </a>
        <ChevronRight aria-hidden="true" className="size-4" />
        <a className="sample-text-link inline-flex min-h-11 items-center" href="/showcase">
          Motion showcase
        </a>
        <ChevronRight aria-hidden="true" className="size-4" />
        <span aria-current="page">{sample.title}</span>
      </nav>
      <header className="mb-6 max-w-4xl">
        <h1 className="text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
          {page.title}
        </h1>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)] lg:gap-10">
        <div className="sample-watch-screen min-w-0 overflow-hidden rounded-2xl bg-surface">
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
        <div className="flex min-w-0 flex-col gap-5 lg:py-2">
          <p className="max-w-[33rem] text-lg leading-relaxed text-muted-foreground">{page.description}</p>
          <div className="flex flex-col items-stretch gap-3">
            <Button asChild size="lg" className="whitespace-normal text-center">
              <a href={mediaPath(sample, 'json')} download>
                <Download aria-hidden="true" />
                Download editable JSON
              </a>
            </Button>
            <Button asChild variant="outline" className="min-h-12">
              <a href="#render">
                Render this template
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The preview is a prepared render. Download the template to customize it and render locally.
          </p>
          <a
            className="sample-text-link inline-flex min-h-11 items-center gap-2 self-start text-sm"
            href={`https://github.com/heristop/leclap/blob/main/${sample.source}`}
          >
            <FileCode aria-hidden="true" className="size-4" />
            View source template
          </a>
        </div>
      </div>
      <nav
        aria-label="On this example page"
        className="my-10 flex flex-wrap gap-x-6 gap-y-1 border-y border-divider py-2 text-sm"
      >
        <a className="sample-text-link inline-flex min-h-11 items-center" href="#overview">
          How it works
        </a>
        <a className="sample-text-link inline-flex min-h-11 items-center" href="#customize">
          Make it yours
        </a>
        <a className="sample-text-link inline-flex min-h-11 items-center" href="#render">
          MCP & CLI
        </a>
        <a className="sample-text-link inline-flex min-h-11 items-center" href="#explore">
          More examples
        </a>
      </nav>
      <Prose className="!max-w-none space-y-12">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <section id="overview" className="max-w-[33rem] scroll-mt-28">
            <h2 className="mb-3 font-display text-2xl">How this example works</h2>
            <p>{page.explanation}</p>
          </section>
          <section id="customize" className="max-w-[33rem] scroll-mt-28">
            <h2 className="mb-3 font-display text-2xl">Make it yours</h2>
            <p>{page.customize}</p>
          </section>
        </div>
        <section id="render" className="scroll-mt-28 border-t border-divider pt-10">
          <h2 className="mb-3 font-display text-2xl">Render with MCP or the CLI</h2>
          <p className="max-w-[33rem]">{page.requirement}</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="min-w-0">
              <h3 className="font-display text-xl text-foreground">With an AI agent</h3>
              <p className="mt-3">
                In your MCP client, ask the agent to call <code>get_samples</code> with{' '}
                <code>{`{ "id": "${sample.id}" }`}</code>. Inspect required inputs, customize the template, validate it
                and use <code>render_frames</code> before composing the final video.
              </p>
              <p className="mt-4">
                <Link to="/doc/mcp">Connect your agent with MCP</Link>
              </p>
            </div>
            <div className="min-w-0">
              <h3 className="mb-4 font-display text-xl text-foreground">In your terminal</h3>
              <CommandList>
                <CommandPill
                  command={`npx @leclap/cli samples show ${sample.id}`}
                  label="Inspect the required inputs"
                />
                <CommandPill
                  command={`npx @leclap/cli samples export ${sample.id} --output ${sample.id}.json`}
                  label="Export an editable template"
                />
                <CommandPill command="npx @leclap/cli diagnose" label="Check your local render capabilities" />
                <CommandPill command={`npx @leclap/cli validate ${sample.id}.json`} label="Validate before rendering" />
              </CommandList>
            </div>
          </div>
          <p className="mt-6 max-w-[33rem]">
            After supplying the listed assets and media, follow the{' '}
            <Link to="/doc/cli">CLI rendering instructions</Link> or <Link to="/doc/mcp">MCP setup guide</Link>. The
            preview above is a prepared render; your changes render locally.
          </p>
        </section>
      </Prose>
      <section id="explore" className="mt-12 scroll-mt-28 border-t border-divider pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl">Continue exploring</h2>
          <Link className="sample-text-link inline-flex min-h-11 items-center gap-2" to={page.guide}>
            {page.guideLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {SAMPLE_PAGES.filter(({ id }) => id !== sample.id).map((related) => (
            <a
              key={related.id}
              href={related.path}
              className="sample-related group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-surface-2"
            >
              <img
                src={`/videos/showcase/${related.id}.webp`}
                alt=""
                width="720"
                height="405"
                loading="lazy"
                className="aspect-video w-28 shrink-0 rounded-lg object-cover sm:w-40"
              />
              <span className="min-w-0 flex-1 text-lg font-semibold leading-snug">{related.title}</span>
              <ArrowRight
                aria-hidden="true"
                className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
              />
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}
