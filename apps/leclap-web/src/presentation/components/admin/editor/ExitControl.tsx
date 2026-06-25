// The shared "Exit" control for animated text overlays. A segmented control picks the exit style; a
// disclosure exposes the timing (after / duration / distance). The value is the descriptor `exit`
// shape — a bare type string when only the style is set, or the full object once any timing is
// overridden — so it round-trips through buildDescriptor unchanged. `after` is when the exit begins
// (seconds from the section start); left unset, the engine times it to end at the section end.
import { useTranslation } from 'react-i18next';
import { REVEAL_TYPES } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { Exit } from '../templateEditorModel';
import { SegmentedControl, RangeSlider, type SegmentOption } from './controls';
import { SectionDisclosure } from './SectionDisclosure';

type ExitType = (typeof REVEAL_TYPES)[number];
type ExitObject = { type: ExitType; after?: number; duration?: number; distance?: number };

const MOVING: ExitType[] = ['rise', 'slide-left', 'slide-right'];
const DEFAULT_AFTER = 2.5;
const DEFAULT_DURATION = 0.6;
const DEFAULT_DISTANCE = 60;

function normalize(exit: Exit | undefined): ExitObject {
  if (exit === undefined) return { type: 'none' };

  if (typeof exit === 'string') return { type: exit };

  return exit;
}

// Emit the bare type when no timing is overridden; the full object once it is.
function pack(obj: ExitObject): Exit | undefined {
  if (obj.type === 'none') return undefined;

  const hasTiming = obj.after !== undefined || obj.duration !== undefined || obj.distance !== undefined;

  return hasTiming ? obj : obj.type;
}

interface ExitControlProps {
  exit: Exit | undefined;
  onChange: (exit: Exit | undefined) => void;
}

export const ExitControl = ({ exit, onChange }: ExitControlProps) => {
  const { t } = useTranslation('admin');
  const current = normalize(exit);

  const options: ReadonlyArray<SegmentOption<ExitType>> = REVEAL_TYPES.map((value) => ({
    value,
    label: t(`reveal.${value}`),
  }));

  const set = (patch: Partial<ExitObject>) => {
    onChange(pack({ ...current, ...patch }));
  };

  return (
    <div className="space-y-2">
      <SegmentedControl
        label={t('exit.label')}
        value={current.type}
        options={options}
        onChange={(type) => {
          set({ type });
        }}
      />
      {current.type !== 'none' && (
        <SectionDisclosure label={t('reveal.advanced')} summary={t('exit.summaryDefault')}>
          <RangeSlider
            label={t('exit.after')}
            value={current.after ?? DEFAULT_AFTER}
            min={0}
            max={10}
            step={0.1}
            format={(v) => `${v}s`}
            onChange={(after) => {
              set({ after });
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
