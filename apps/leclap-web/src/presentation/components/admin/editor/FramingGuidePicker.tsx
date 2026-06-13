// Recording framing guide for project_video sections: a none/left/center/right
// segmented control with a mini camera-frame mockup showing where the silhouette sits,
// plus an opacity slider. The viewfinder mock matches the template orientation so a
// landscape template previews wide, a portrait one tall. Writes
// section.framingGuide = {type:'silhouette',position,opacity?} or clears it.
// The guide is shown in the recording UI only — never rendered into the video.
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import type { FramingGuide, Orientation } from '../templateEditorModel';
import { SegmentedControl, RangeSlider, type SegmentOption } from './controls';

type Position = 'left' | 'center' | 'right';
type Choice = 'none' | Position;

const DEFAULT_OPACITY = 0.5;

interface FramingGuidePickerProps {
  guide: FramingGuide | undefined;
  orientation: Orientation;
  onChange: (guide: FramingGuide | undefined) => void;
}

export const FramingGuidePicker = ({ guide, orientation, onChange }: FramingGuidePickerProps) => {
  const { t } = useTranslation('admin');
  const choice: Choice = guide?.position ?? 'none';
  const opacity = guide?.opacity ?? DEFAULT_OPACITY;

  const options: ReadonlyArray<SegmentOption<Choice>> = [
    { value: 'none', label: t('framing.none') },
    { value: 'left', label: t('framing.left') },
    { value: 'center', label: t('framing.center') },
    { value: 'right', label: t('framing.right') },
  ];

  const setChoice = (next: Choice) => {
    const guideValue: FramingGuide | undefined =
      next === 'none' ? undefined : { type: 'silhouette', position: next, opacity };
    onChange(guideValue);
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('framing.label')}
      </span>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('framing.hint')}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-3">
          <SegmentedControl value={choice} options={options} onChange={setChoice} />
          {guide && (
            <RangeSlider
              label={t('framing.opacity')}
              value={opacity}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(o) => {
                onChange({ type: 'silhouette', position: guide.position, opacity: o });
              }}
            />
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('framing.mirrorNote')}</p>
        </div>
        <FrameMockup position={guide?.position ?? null} opacity={opacity} orientation={orientation} />
      </div>
    </div>
  );
};

// Horizontal dock for the silhouette — a comfortable inset so left / center / right
// read as three distinct spots at a glance.
const POSITION_CLASS: Record<Position, string> = {
  left: 'left-[14%]',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-[14%]',
};

// A viewfinder mock matching the template orientation, with faint rule-of-thirds
// guides and a small silhouette docked to the chosen spot. Decorative → aria-hidden.
const FrameMockup = ({
  position,
  opacity,
  orientation,
}: {
  position: Position | null;
  opacity: number;
  orientation: Orientation;
}) => {
  const { t } = useTranslation('admin');
  const ratio = orientation === 'landscape' ? 'aspect-[16/9]' : 'aspect-[9/16]';
  const maxW = orientation === 'landscape' ? 'max-w-[8rem]' : 'max-w-[4.5rem]';

  return (
    <div
      aria-hidden
      className={`relative mx-auto ${ratio} w-full ${maxW} overflow-hidden rounded-lg border border-foreground/15 bg-[radial-gradient(120%_120%_at_50%_0%,#2b2b3a,#15151f)] sm:sticky sm:top-2 sm:self-start`}
    >
      <Thirds />
      {position && (
        <User
          className={`absolute bottom-[8%] h-[40%] w-auto text-white ${POSITION_CLASS[position]}`}
          style={{ opacity }}
        />
      )}
      {!position && (
        <span className="absolute inset-0 grid place-items-center text-[0.6rem] text-white/40">
          {t('framing.noGuide')}
        </span>
      )}
    </div>
  );
};

// Faint rule-of-thirds gridlines — sells the "framing" idea without competing with the silhouette.
const Thirds = () => (
  <div className="pointer-events-none absolute inset-0">
    <span className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
    <span className="absolute inset-y-0 left-2/3 w-px bg-white/10" />
    <span className="absolute inset-x-0 top-1/3 h-px bg-white/10" />
    <span className="absolute inset-x-0 top-2/3 h-px bg-white/10" />
  </div>
);
