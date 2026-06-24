// The shared "Entrance" control for sugar text (title card, lower third, caption). A segmented control
// picks the entrance style; a small disclosure exposes the timing (delay / duration / distance). The
// value is the descriptor `reveal` shape — a bare type string when only the style is set, or the full
// object once any timing is overridden — so it round-trips through buildDescriptor unchanged.
import { useTranslation } from 'react-i18next';
import { REVEAL_TYPES } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { Reveal } from '../templateEditorModel';
import { SegmentedControl, RangeSlider, type SegmentOption } from './controls';
import { SectionDisclosure } from './SectionDisclosure';

type RevealType = (typeof REVEAL_TYPES)[number];
type RevealObject = { type: RevealType; delay?: number; duration?: number; distance?: number };

const MOVING: RevealType[] = ['rise', 'slide-left', 'slide-right'];
const DEFAULT_DELAY = 0.3;
const DEFAULT_DURATION = 0.6;
const DEFAULT_DISTANCE = 60;

function normalize(reveal: Reveal | undefined): RevealObject {
  if (reveal === undefined) return { type: 'none' };

  if (typeof reveal === 'string') return { type: reveal };

  return reveal;
}

// Emit the bare type when no timing is overridden (matches authored templates); the full object once it is.
function pack(obj: RevealObject): Reveal | undefined {
  if (obj.type === 'none') return undefined;

  const hasTiming = obj.delay !== undefined || obj.duration !== undefined || obj.distance !== undefined;

  return hasTiming ? obj : obj.type;
}

interface RevealControlProps {
  reveal: Reveal | undefined;
  onChange: (reveal: Reveal | undefined) => void;
}

export const RevealControl = ({ reveal, onChange }: RevealControlProps) => {
  const { t } = useTranslation('admin');
  const current = normalize(reveal);

  const options: ReadonlyArray<SegmentOption<RevealType>> = REVEAL_TYPES.map((value) => ({
    value,
    label: t(`reveal.${value}`),
  }));

  const set = (patch: Partial<RevealObject>) => {
    onChange(pack({ ...current, ...patch }));
  };

  return (
    <div className="space-y-2">
      <SegmentedControl
        label={t('reveal.label')}
        value={current.type}
        options={options}
        onChange={(type) => {
          set({ type });
        }}
      />
      {current.type !== 'none' && (
        <SectionDisclosure label={t('reveal.advanced')} summary={t('reveal.summaryDefault')}>
          <RangeSlider
            label={t('reveal.delay')}
            value={current.delay ?? DEFAULT_DELAY}
            min={0}
            max={2}
            step={0.05}
            format={(v) => `${v}s`}
            onChange={(delay) => {
              set({ delay });
            }}
          />
          <RangeSlider
            label={t('reveal.duration')}
            value={current.duration ?? DEFAULT_DURATION}
            min={0.1}
            max={2}
            step={0.05}
            format={(v) => `${v}s`}
            onChange={(duration) => {
              set({ duration });
            }}
          />
          {MOVING.includes(current.type) && (
            <RangeSlider
              label={t('reveal.distance')}
              value={current.distance ?? DEFAULT_DISTANCE}
              min={0}
              max={300}
              step={5}
              format={(v) => `${v}px`}
              onChange={(distance) => {
                set({ distance });
              }}
            />
          )}
        </SectionDisclosure>
      )}
    </div>
  );
};
