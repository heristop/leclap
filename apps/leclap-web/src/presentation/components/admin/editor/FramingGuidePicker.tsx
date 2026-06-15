// Recording framing guide for project_video sections: a none/left/center/right segmented control,
// a bust/outline style toggle, and an opacity slider, with a mini camera-frame mockup showing the
// real silhouette where it will sit. The viewfinder mock matches the template orientation so a
// landscape template previews wide, a portrait one tall. Writes
// section.framingGuide = {type:'silhouette',position,opacity?,style?} or clears it.
// The guide is shown in the recording UI only — never rendered into the video.
import { useTranslation } from 'react-i18next';
import { DEFAULT_FRAMING_OPACITY, type FramingGuide, type Orientation } from '../templateEditorModel';
import { SilhouetteSvg, silhouetteDockClass } from '@/presentation/components/FramingGuideOverlay';
import { SegmentedControl, RangeSlider, type SegmentOption } from './controls';

type Position = 'left' | 'center' | 'right';
type Choice = 'none' | Position;
type Style = 'bust' | 'outline';

// 'bust' is the default, so it is omitted from the descriptor to keep stored templates minimal.
const buildGuide = (position: Position, opacity: number, style: Style): FramingGuide => ({
  type: 'silhouette',
  position,
  opacity,
  ...(style === 'bust' ? {} : { style }),
});

interface FramingGuidePickerProps {
  guide: FramingGuide | undefined;
  orientation: Orientation;
  onChange: (guide: FramingGuide | undefined) => void;
}

export const FramingGuidePicker = ({ guide, orientation, onChange }: FramingGuidePickerProps) => {
  const { t } = useTranslation('admin');
  const choice: Choice = guide?.position ?? 'none';
  const opacity = guide?.opacity ?? DEFAULT_FRAMING_OPACITY;
  const style: Style = guide?.style ?? 'bust';

  const options: ReadonlyArray<SegmentOption<Choice>> = [
    { value: 'none', label: t('framing.none') },
    { value: 'left', label: t('framing.left') },
    { value: 'center', label: t('framing.center') },
    { value: 'right', label: t('framing.right') },
  ];

  const styleOptions: ReadonlyArray<SegmentOption<Style>> = [
    { value: 'bust', label: t('framing.styleBust') },
    { value: 'outline', label: t('framing.styleOutline') },
  ];

  const setChoice = (next: Choice) => {
    onChange(next === 'none' ? undefined : buildGuide(next, opacity, style));
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
            <>
              <SegmentedControl
                value={style}
                options={styleOptions}
                onChange={(s) => {
                  onChange(buildGuide(guide.position, opacity, s));
                }}
              />
              <RangeSlider
                label={t('framing.opacity')}
                value={opacity}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(o) => {
                  onChange(buildGuide(guide.position, o, style));
                }}
              />
            </>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('framing.mirrorNote')}</p>
        </div>
        <FrameMockup position={guide?.position ?? null} opacity={opacity} style={style} orientation={orientation} />
      </div>
    </div>
  );
};

// A viewfinder mock matching the template orientation, with faint rule-of-thirds guides and the real
// recording silhouette docked to the chosen spot — same shape, style, and position as the live
// overlay, so the preview is WYSIWYG. Decorative → aria-hidden.
const FrameMockup = ({
  position,
  opacity,
  style,
  orientation,
}: {
  position: Position | null;
  opacity: number;
  style: Style;
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
        <div className={silhouetteDockClass(orientation === 'portrait', position)}>
          <SilhouetteSvg opacity={opacity} style={style} />
        </div>
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
