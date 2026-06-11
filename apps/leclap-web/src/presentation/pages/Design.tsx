import { useState } from 'react';
import { Sparkles, Play, Download } from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  ColorPicker,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/presentation/components/ui';
import { Seo } from '@/presentation/components/Seo';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-12">
    <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">{title}</h2>
    {children}
  </section>
);

const Swatch = ({ name, className }: { name: string; className: string }) => (
  <div className="flex flex-col gap-1">
    <div className={`h-12 rounded-lg border border-divider ${className}`} />
    <span className="text-xs text-gray-400">{name}</span>
  </div>
);

const ColorPickerDemo = () => {
  const [color, setColor] = useState('#7c83fd');

  return (
    <div className="max-w-sm">
      <ColorPicker aria-label="Demo color" value={color} onChange={setColor} />
      <p className="mt-2 text-xs text-gray-400">
        Selected: <span className="font-mono text-foreground">{color}</span>
      </p>
    </div>
  );
};

export const Design = () => (
  <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground bg-dots">
    <Seo
      title="Design System"
      description="The LeClap design system — colors, typography, motion and UI components."
      path="/design"
    />
    <div className="container mx-auto px-4 pt-24 pb-16 max-w-5xl">
      <h1 className="text-[length:var(--text-display-sm)] font-bold font-display text-gradient-animated mb-2">
        Design System
      </h1>
      <p className="text-gray-300 mb-12">
        shadcn/ui + Radix primitives, styled with the LeClap brand tokens (OKLCH, light/dark).
      </p>

      <Section title="Brand palette">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <Swatch name="brand-500" className="bg-brand-500" />
          <Swatch name="brand-300" className="bg-brand-300" />
          <Swatch name="secondary-400" className="bg-secondary-400" />
          <Swatch name="accent-400" className="bg-accent-400" />
          <Swatch name="surface" className="bg-surface" />
          <Swatch name="gradient" className="brand-gradient" />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3 mb-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">
            <Sparkles /> Large
          </Button>
          <Button size="icon" aria-label="Play">
            <Play />
          </Button>
          <Button disabled>Disabled</Button>
          <Button asChild variant="secondary">
            <a href="#download">
              <Download /> As link
            </a>
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge variant="brand">Brand</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="success">Success</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Raised</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400">Default elevation surface.</CardContent>
          </Card>
          <Card elevation="floating">
            <CardHeader>
              <CardTitle>Floating</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400">More depth for overlays.</CardContent>
          </Card>
          <Card interactive gradientBorder>
            <CardHeader>
              <CardTitle>Interactive</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-400">Hover for the brand pop + gradient ring.</CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Input">
        <div className="max-w-sm">
          <Input placeholder="Your name" />
        </div>
      </Section>

      <Section title="Color picker">
        <ColorPickerDemo />
      </Section>

      <Section title="Dialog (Radix — focus-trap, ESC, scroll-lock)">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete template?</DialogTitle>
              <DialogDescription>
                This can't be undone. The template will be removed from this browser.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger">Delete</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>
    </div>
  </div>
);
