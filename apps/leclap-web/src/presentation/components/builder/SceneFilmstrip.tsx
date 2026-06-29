import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type UIEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Template, InputSection } from '@/services/templateService';
import { SceneCell } from '@/presentation/components/editor-shell';
import { resolveTranslation } from '@/lib/i18nText';
import { displayFromTokens } from '@/lib/variableSyntax';
import { sectionComplete, nextCue, type SceneModel } from './sceneStatus';
import { sectionKindMeta } from './sectionKind';
import { useObjectUrl } from './useObjectUrl';
import { arrowTarget } from './rovingKeys';

const fmtDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return `${m}:${String(s).padStart(2, '0')}`;
};

// Track the pointer for the spotlight glow (cheap: CSS vars, no re-render).
const trackSpotlight = (e: MouseEvent<HTMLButtonElement>): void => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

interface CellProps {
  template: Template;
  section: InputSection;
  index: number;
  active: boolean;
  isNext: boolean;
  clip: File | undefined;
  model: SceneModel;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  tabIndex: number;
  buttonRef: (el: HTMLButtonElement | null) => void;
  t: TFunction<'builder'>;
}

const Cell = ({
  template,
  section,
  index,
  active,
  isNext,
  clip,
  model,
  onSelect,
  onKeyDown,
  tabIndex,
  buttonRef,
  t,
}: CellProps) => {
  const { i18n } = useTranslation('builder');
  const url = useObjectUrl(clip);
  const [duration, setDuration] = useState<number | null>(null);
  const done = sectionComplete(template, section, model);
  const title = displayFromTokens(resolveTranslation(section.title, i18n.language) ?? t('hub.section'));
  const { Icon, labelKey } = sectionKindMeta(section);

  return (
    <SceneCell
      index={index}
      role="tab"
      compact
      title={title}
      eyebrow={t(labelKey)}
      icon={Icon}
      poster={
        url ? (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
            }}
            className="h-full w-full object-cover"
          />
        ) : undefined
      }
      done={done}
      active={active}
      isNext={isNext}
      durationLabel={url && duration !== null ? fmtDuration(duration) : undefined}
      tabIndex={tabIndex}
      onSelect={onSelect}
      onKeyDown={onKeyDown}
      onPointerMove={trackSpotlight}
      buttonRef={buttonRef}
    />
  );
};

// Drive the edge-fade mask from the scroll position: each side's fade collapses to 0 once that end is
// reached, so the cue only appears when there's actually more to scroll. CSS vars avoid re-renders.
const syncEdges = (el: HTMLElement): void => {
  const max = el.scrollWidth - el.clientWidth;
  const atStart = el.scrollLeft <= 1;
  const atEnd = el.scrollLeft >= max - 1;
  el.style.setProperty('--edge-l', atStart ? '0px' : '1.5rem');
  el.style.setProperty('--edge-r', max <= 0 || atEnd ? '0px' : '1.5rem');
};

const useEdgeFade = (deps: number): ((el: HTMLElement | null) => void) => {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current) syncEdges(ref.current);
  }, [deps]);

  return (el) => {
    ref.current = el;

    if (el) syncEdges(el);
  };
};

interface SceneFilmstripProps {
  template: Template;
  sections: InputSection[];
  model: SceneModel;
  showMedia: boolean;
  activeName: string | null;
  onSelect: (name: string) => void;
}

// The bottom scene strip: one cell per section in order — the editor's spatial map. Recorded clips show
// a poster frame + duration; everything else a kind tile. The next-to-do cell is accented, the selected
// one ringed. A roving-tabindex tablist: ←/→/Home/End move and select. Horizontally scrollable.
export const SceneFilmstrip = ({ template, sections, model, showMedia, activeName, onSelect }: SceneFilmstripProps) => {
  const { t } = useTranslation('builder');
  const { nextSectionIndex } = nextCue(sections, template, model, showMedia);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const laneRef = useEdgeFade(sections.length);

  const move = (event: KeyboardEvent, from: number) => {
    const target = arrowTarget(event.key, from, sections.length - 1);

    if (target < 0) return;

    event.preventDefault();
    onSelect(sections[target].name);
    tabs.current[target]?.focus();
  };

  return (
    <div
      ref={laneRef}
      role="tablist"
      aria-label={t('hub.subtitle')}
      onScroll={(e: UIEvent<HTMLDivElement>) => {
        syncEdges(e.currentTarget);
      }}
      className="track-edge-fade flex flex-1 scroll-px-3 items-stretch gap-2 overflow-x-auto scroll-smooth px-3 py-2.5 [scrollbar-width:thin] motion-reduce:scroll-auto"
    >
      {sections.map((section, i) => (
        <Cell
          key={section.name}
          template={template}
          section={section}
          index={i}
          active={section.name === activeName}
          isNext={i === nextSectionIndex}
          clip={section.kind === 'clip' ? model.clipsBySection[section.name] : undefined}
          model={model}
          onSelect={() => {
            onSelect(section.name);
          }}
          onKeyDown={(e) => {
            move(e, i);
          }}
          tabIndex={section.name === activeName ? 0 : -1}
          buttonRef={(el) => {
            tabs.current[i] = el;
          }}
          t={t}
        />
      ))}
    </div>
  );
};
