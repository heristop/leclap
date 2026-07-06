import { useLayoutEffect, useRef } from 'react';
import { displayFromTokens, tokensFromDisplay } from '@/lib/variableSyntax';
import { useVariableAutocomplete, VariableSuggestions, type VariableOption } from './variableAutocomplete';

export type { VariableOption } from './variableAutocomplete';

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

// A text field where typing `#` opens an autocomplete of the in-scope variables; picking one splices
// in the canonical `{{ name }}` token. The author never types braces; the stored value stays `{{ }}`.
// The query/keyboard/popover machinery is the shared variableAutocomplete, also used by the canvas
// inline editors.
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
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  // Restore the caret after a programmatic value change (token insert).
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      ref.current.focus();
      pendingCaret.current = null;
    }
  });

  // The field works in display space: the descriptor's `{{ name }}` is shown as `#name`, and edits are
  // converted back to `{{ name }}` for known variables on the way out (literal `#`s are left alone).
  const display = displayFromTokens(value);
  const known = new Set(variables.map((v) => v.name));
  const emit = (text: string) => {
    onChange(tokensFromDisplay(text, known));
  };

  const autocomplete = useVariableAutocomplete({
    variables,
    elementRef: ref,
    onInsert: (next, caret) => {
      pendingCaret.current = caret;
      emit(next);
    },
  });

  const shared = {
    ref: ref as never,
    value: display,
    placeholder,
    className,
    'aria-label': ariaLabel,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      emit(event.target.value);
      autocomplete.sync();
    },
    onClick: () => {
      autocomplete.sync();
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      autocomplete.syncFromKeyUp(event.key);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      autocomplete.handleKeyDown(event);
    },
    // Delay close so a pointer-down on a popover row registers first.
    onBlur: () => {
      window.setTimeout(() => {
        autocomplete.close();
      }, 120);
    },
  };

  return (
    <div className="relative">
      {multiline ? <textarea {...shared} rows={rows} /> : <input type="text" {...shared} />}

      {autocomplete.query && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1">
          <VariableSuggestions autocomplete={autocomplete} totalCount={variables.length} />
        </div>
      )}
    </div>
  );
}
