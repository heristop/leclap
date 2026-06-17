import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { findHashQuery, insertVariableAtHash, filterVariables, type HashQuery } from './variableInsert';

export interface VariableOption {
  name: string;
  scope: 'global' | 'local';
}

interface VariableTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  variables: VariableOption[];
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const SCOPE_ORDER: VariableOption['scope'][] = ['local', 'global'];

// A text field where typing `#` opens an autocomplete of the in-scope variables; picking one splices
// in the canonical `{{ name }}` token. The author never types braces; the stored value stays `{{ }}`.
export function VariableTextField({
  value,
  onChange,
  variables,
  multiline = false,
  rows,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: VariableTextFieldProps) {
  const { t } = useTranslation('admin');
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<HashQuery | null>(null);
  const [highlight, setHighlight] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  // Restore the caret after a programmatic value change (token insert).
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      ref.current.focus();
      pendingCaret.current = null;
    }
  });

  const names = variables.map((v) => v.name);
  const matches = query ? new Set(filterVariables(names, query.query)) : new Set<string>();
  // Local variables first, then global; this order drives both the rendered list and keyboard nav.
  const options = query
    ? variables
        .filter((v) => matches.has(v.name))
        .sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope))
    : [];

  const syncQuery = (el: HTMLInputElement | HTMLTextAreaElement) => {
    const caret = el.selectionStart ?? el.value.length;
    setQuery(findHashQuery(el.value, caret));
    setHighlight(0);
  };

  const pick = (name: string) => {
    const el = ref.current;

    if (!query || !el) {
      return;
    }

    const caret = el.selectionStart ?? value.length;
    const next = insertVariableAtHash(value, query.start, caret, name);
    pendingCaret.current = next.caret;
    onChange(next.text);
    setQuery(null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!query || options.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => (h + 1) % options.length);

      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);

      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(options[highlight].name);

      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setQuery(null);
    }
  };

  const shared = {
    ref: ref as never,
    value,
    placeholder,
    className,
    'aria-label': ariaLabel,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
      syncQuery(event.target);
    },
    onClick: (event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      syncQuery(event.currentTarget);
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
        return;
      }

      syncQuery(event.currentTarget);
    },
    onKeyDown,
    // Delay close so a pointer-down on a popover row registers first.
    onBlur: () => {
      window.setTimeout(() => {
        setQuery(null);
      }, 120);
    },
  };

  let lastScope: VariableOption['scope'] | null = null;

  return (
    <div className="relative">
      {multiline ? <textarea {...shared} rows={rows} /> : <input type="text" {...shared} />}

      {query && options.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-foreground/10 bg-surface py-1 shadow-xl"
        >
          {options.map((option, index) => {
            const showHeader = option.scope !== lastScope;
            lastScope = option.scope;

            return (
              <li key={`${option.scope}:${option.name}`}>
                {showHeader && (
                  <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {option.scope === 'local' ? t('variables.local') : t('variables.global')}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(option.name);
                  }}
                  onMouseEnter={() => {
                    setHighlight(index);
                  }}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    index === highlight ? 'bg-brand-500/15 text-foreground' : 'text-gray-600 dark:text-gray-300'
                  )}
                >
                  <span className="font-mono text-brand-600 dark:text-brand-300">#</span>
                  {option.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
