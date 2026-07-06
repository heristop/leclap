// Capture-source picker for a project_video section: which recorder inputs the end-user may use
// (front/back camera, screen recording, file upload) and which one the recorder opens on. Pure
// recorder metadata honoured by both capture UIs (web CameraCapture/StepClip, expo VideoRecorder) —
// never rendered into the video. The selection logic lives in capture-modes.ts (tested).
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Check } from '@/presentation/components/icons';
import { ALL_CAPTURE_MODES, type CaptureMode } from '../../templateEditorModel';
import { SegmentedControl, type SegmentOption } from '../controls';
import {
  allowedSetFrom,
  effectiveModeFrom,
  toggleAllowedMode,
  pickDefaultMode,
  type CaptureSelection,
} from './capture-modes';

interface CaptureModeFieldProps {
  selection: CaptureSelection;
  onChange: (next: CaptureSelection) => void;
}

export const CaptureModeField = ({ selection, onChange }: CaptureModeFieldProps) => {
  const { t } = useTranslation('admin');
  const allowed = allowedSetFrom(selection.allowedCaptureModes);
  const effective = effectiveModeFrom(selection);

  const defaultOptions: ReadonlyArray<SegmentOption<CaptureMode>> = allowed.map((mode) => ({
    value: mode,
    label: t(`capture.mode.${mode}`),
  }));

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('capture.hint')}</p>
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('capture.allowedLabel')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CAPTURE_MODES.map((mode) => {
            const active = allowed.includes(mode);

            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onChange(toggleAllowedMode(selection, mode));
                }}
                className={cn(
                  'tap flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? 'border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                    : 'border-foreground/10 text-gray-500 hover:text-foreground'
                )}
              >
                {active && <Check className="size-3" aria-hidden />}
                {t(`capture.mode.${mode}`)}
              </button>
            );
          })}
        </div>
      </div>
      {allowed.length > 1 && (
        <SegmentedControl
          label={t('capture.defaultLabel')}
          value={effective}
          options={defaultOptions}
          onChange={(mode) => {
            onChange(pickDefaultMode(selection, mode));
          }}
        />
      )}
      {allowed.length === 1 && <p className="text-xs text-gray-400 dark:text-gray-500">{t('capture.lockedNote')}</p>}
    </div>
  );
};
