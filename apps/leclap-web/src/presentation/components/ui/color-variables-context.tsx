// In-scope template colour variables for every colour field beneath an editor shell. The provider
// is mounted once per editor (template/partial shell) with the author's global variables; each
// ColorPicker then offers them as pickable '{{ name }}' token chips and resolves stored tokens to
// their current colour — no per-field threading. Outside a provider the default empty scope keeps
// pickers plain (e.g. the Design gallery page).
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { toColorVariableMap } from '@leclap/creative-kit/editor';

export interface ColorVariablesScope {
  // name -> current value map (includes the palette's colorN slots when a colorsList exists).
  variables: Record<string, string>;
  // The template's colorsList palette, for pickers that surface the slots as color1..colorN chips.
  colorsList: readonly string[];
}

const EMPTY_SCOPE: ColorVariablesScope = { variables: {}, colorsList: [] };

const ColorVariablesContext = createContext<ColorVariablesScope>(EMPTY_SCOPE);

/** The colour-variable scope of the nearest editor shell (empty outside one). */
export function useColorVariables(): ColorVariablesScope {
  return useContext(ColorVariablesContext);
}

interface ColorVariablesProviderProps {
  // The editor's author-defined variable rows (EditorState.globalVariables).
  variables: readonly { name: string; value: string }[];
  // The template's colour palette, once the colorsList editor lands. 1-indexed as {{ colorN }}.
  colorsList?: readonly string[];
  children: ReactNode;
}

export function ColorVariablesProvider({ variables, colorsList = [], children }: ColorVariablesProviderProps) {
  const scope = useMemo<ColorVariablesScope>(() => {
    const map = toColorVariableMap(variables);

    for (const [i, color] of colorsList.entries()) map[`color${i + 1}`] = color;

    return { variables: map, colorsList };
  }, [variables, colorsList]);

  return <ColorVariablesContext.Provider value={scope}>{children}</ColorVariablesContext.Provider>;
}
