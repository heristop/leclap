// The shared "Legibility" control for sugar text (title card, lower third, caption, global overlay).
// Two toggles — drop shadow and outline — each revealing a colour picker when on. The value is the
// descriptor `effect` shape: `shadow`/`outline` are `true` at their defaults, or an object once a
// colour (or outline width) is overridden, so it round-trips through buildDescriptor unchanged.
import { useTranslation } from 'react-i18next';
import type { TextEffect } from '../templateEditorModel';
import { Checkbox, ColorPicker } from '@/presentation/components/ui';

const DEFAULT_SHADOW_COLOR = '#000000';
const DEFAULT_OUTLINE_COLOR = '#000000';

type ShadowObject = { color?: string; dx?: number; dy?: number };
type OutlineObject = { color?: string; width?: number };

// Read the active colour for a shadow/outline value (`true` → the default, object → its colour).
function colorOf(value: boolean | { color?: string } | undefined, fallback: string): string {
  if (value && typeof value === 'object' && value.color) return stripAlpha(value.color);

  return fallback;
}

// The picker emits #rrggbb; shadow defaults carry an @alpha the engine understands, so show the hex only.
function stripAlpha(color: string): string {
  return color.split('@')[0];
}

// Collapse an effect to undefined once neither shadow nor outline is set, so a cleared control removes it.
function pack(effect: TextEffect): TextEffect | undefined {
  if (!effect.shadow && !effect.outline) return undefined;

  return effect;
}

interface TextEffectControlProps {
  effect: TextEffect | undefined;
  onChange: (effect: TextEffect | undefined) => void;
}

export const TextEffectControl = ({ effect, onChange }: TextEffectControlProps) => {
  const { t } = useTranslation('admin');
  const current: TextEffect = effect ?? {};
  const shadowOn = Boolean(current.shadow);
  const outlineOn = Boolean(current.outline);

  const set = (patch: Partial<TextEffect>) => {
    onChange(pack({ ...current, ...patch }));
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('textEffect.label')}
      </span>

      <Toggle
        label={t('textEffect.shadow')}
        checked={shadowOn}
        onChange={(on) => {
          set({ shadow: on ? true : undefined });
        }}
      />
      {shadowOn && (
        <div className="pl-6">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('textEffect.shadowColor')}
          </span>
          <ColorPicker
            aria-label={t('textEffect.shadowColor')}
            value={colorOf(current.shadow, DEFAULT_SHADOW_COLOR)}
            onChange={(color) => {
              const shadow: ShadowObject = { color };
              set({ shadow });
            }}
          />
        </div>
      )}

      <Toggle
        label={t('textEffect.outline')}
        checked={outlineOn}
        onChange={(on) => {
          set({ outline: on ? true : undefined });
        }}
      />
      {outlineOn && (
        <div className="pl-6">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('textEffect.outlineColor')}
          </span>
          <ColorPicker
            aria-label={t('textEffect.outlineColor')}
            value={colorOf(current.outline, DEFAULT_OUTLINE_COLOR)}
            onChange={(color) => {
              const outline: OutlineObject = { color };
              set({ outline });
            }}
          />
        </div>
      )}
    </div>
  );
};

// A small labelled checkbox toggle — the shared studio Checkbox so it matches every other toggle
// in the panels (focus ring, hover, pointer cursor) instead of a bare native input.
const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
    <Checkbox
      checked={checked}
      onCheckedChange={(c) => {
        onChange(c === true);
      }}
    />
    {label}
  </label>
);
