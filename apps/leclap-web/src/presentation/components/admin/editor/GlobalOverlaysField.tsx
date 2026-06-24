// Whole-video TEXT overlays (descriptor global.overlays) — a brand watermark authored once and drawn
// on every section, the text sibling of WholeVideoAnimations. A small list editor: each row is a text
// line with a position anchor, a colour and an entrance. Empty rows are dropped on emit.
import { useTranslation } from 'react-i18next';
import { GLOBAL_TEXT_POSITIONS } from 'ffmpeg-video-composer/src/schemas/global.schemas.ts';
import type { EditorState, GlobalTextOverlay } from '../templateEditorModel';
import {
  Button,
  ColorPicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui';
import { Plus, X } from '@/presentation/components/icons';
import { RevealControl } from './RevealControl';
import { TextEffectControl } from './TextEffectControl';
import { EDITOR_INPUT_CLASS } from './editorStyles';

type Position = NonNullable<GlobalTextOverlay['position']>;
const DEFAULT_COLOR = '#ffffff';

interface GlobalOverlaysFieldProps {
  overlays: GlobalTextOverlay[];
  patch: (p: Partial<EditorState>) => void;
}

export const GlobalOverlaysField = ({ overlays, patch }: GlobalOverlaysFieldProps) => {
  const { t } = useTranslation('admin');

  const replace = (index: number, next: GlobalTextOverlay) => {
    patch({ globalOverlays: overlays.map((overlay, i) => (i === index ? next : overlay)) });
  };

  const remove = (index: number) => {
    patch({ globalOverlays: overlays.filter((_, i) => i !== index) });
  };

  const add = () => {
    patch({ globalOverlays: [...overlays, { text: { en: '' }, position: 'top-right' }] });
  };

  return (
    <div className="mt-4 border-t border-foreground/10 pt-4">
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('globalOverlay.label')}
      </span>
      <p className="mt-1 mb-3 text-xs text-gray-500">{t('globalOverlay.hint')}</p>

      <div className="space-y-3">
        {overlays.map((overlay, index) => (
          <OverlayRow
            key={index}
            overlay={overlay}
            onChange={(next) => {
              replace(index, next);
            }}
            onRemove={() => {
              remove(index);
            }}
          />
        ))}
      </div>

      <Button variant="secondary" className="mt-3 gap-1.5" onClick={add}>
        <Plus className="size-4" aria-hidden /> {t('globalOverlay.add')}
      </Button>
    </div>
  );
};

const OverlayRow = ({
  overlay,
  onChange,
  onRemove,
}: {
  overlay: GlobalTextOverlay;
  onChange: (next: GlobalTextOverlay) => void;
  onRemove: () => void;
}) => {
  const { t } = useTranslation('admin');
  const position = overlay.position ?? 'top-right';

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface p-3 space-y-3">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={overlay.text.en}
          placeholder={t('globalOverlay.textPlaceholder')}
          aria-label={t('globalOverlay.text')}
          className={EDITOR_INPUT_CLASS}
          onChange={(e) => {
            onChange({ ...overlay, text: { en: e.target.value } });
          }}
        />
        <button
          type="button"
          aria-label={t('globalOverlay.remove')}
          onClick={onRemove}
          className="tap mt-1.5 shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-foreground/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-90"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('globalOverlay.position')}
          </span>
          <Select
            value={position}
            onValueChange={(value) => {
              onChange({ ...overlay, position: value as Position });
            }}
          >
            <SelectTrigger aria-label={t('globalOverlay.position')} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GLOBAL_TEXT_POSITIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`globalOverlay.pos.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('globalOverlay.color')}
          </span>
          <ColorPicker
            aria-label={t('globalOverlay.color')}
            value={overlay.color ?? DEFAULT_COLOR}
            onChange={(color) => {
              onChange({ ...overlay, color });
            }}
          />
        </div>
      </div>
      <RevealControl
        reveal={overlay.reveal}
        onChange={(reveal) => {
          onChange({ ...overlay, reveal });
        }}
      />
      <TextEffectControl
        effect={overlay.effect}
        onChange={(effect) => {
          onChange({ ...overlay, effect });
        }}
      />
    </div>
  );
};
