import * as React from 'react';
import { cn } from '@/lib/utils';
import { normalizeHex, BRAND_SWATCHES } from '@/lib/color';

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  presets?: readonly string[];
  className?: string;
  'aria-label'?: string;
}

// On-brand color picker: native swatch (OS picker) + validated hex entry + quick-pick swatches.
// No extra deps — the native <input type="color"> drives the actual picking UI.
const ColorPicker = React.forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ value, onChange, id, presets = BRAND_SWATCHES, className, 'aria-label': ariaLabel }, ref) => {
    const [draft, setDraft] = React.useState(() => value.replace(/^#/, ''));

    // Keep the hex field in sync when the value changes from outside (swatch/native picker).
    React.useEffect(() => {
      setDraft(value.replace(/^#/, ''));
    }, [value]);

    const commit = (raw: string) => {
      const hex = normalizeHex(raw);

      if (hex) {
        onChange(hex);

        return;
      }

      setDraft(value.replace(/^#/, '')); // revert an invalid entry
    };

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <div className="flex items-center gap-2">
          <input
            ref={ref}
            id={id}
            type="color"
            aria-label={ariaLabel ?? 'Pick a color'}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className="tap h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-divider bg-surface-2 p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0"
          />
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-gray-500">
              #
            </span>
            <input
              type="text"
              spellCheck={false}
              maxLength={6}
              aria-label={`${ariaLabel ?? 'Color'} hex value`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value.replace(/[^0-9a-fA-F]/g, ''));
              }}
              onBlur={(e) => {
                commit(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
              }}
              className="field-focus-gradient w-full rounded-lg border border-divider bg-surface-2 py-2 pl-7 pr-3 font-mono text-sm uppercase text-foreground transition-colors focus-visible:outline-none"
            />
          </div>
        </div>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((c) => {
              const active = normalizeHex(c) === normalizeHex(value);

              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select ${c}`}
                  aria-pressed={active}
                  onClick={() => {
                    onChange(c);
                  }}
                  style={{ backgroundColor: c }}
                  className={cn(
                    'tap h-6 w-6 rounded-md border border-foreground/15 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                    active && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface'
                  )}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);
ColorPicker.displayName = 'ColorPicker';

export { ColorPicker };
