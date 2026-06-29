import { describe, it, expect } from 'vitest';
import { displayFromTokens, tokensFromDisplay } from './variableSyntax';

describe('variableSyntax', () => {
  it('shows tokens as #name (with surrounding text preserved)', () => {
    expect(displayFromTokens('{{ optionA1 }} or {{ optionB1 }}')).toBe('#optionA1 or #optionB1');
    expect(displayFromTokens('Hello {{form_1_name}}!')).toBe('Hello #form_1_name!');
    expect(displayFromTokens('no tokens here')).toBe('no tokens here');
  });

  it('parses #name back to {{ name }} only for known variables', () => {
    const known = ['optionA1', 'form_1_name'];
    expect(tokensFromDisplay('#optionA1 or #optionB1', known)).toBe('{{ optionA1 }} or #optionB1');
    expect(tokensFromDisplay('Hello #form_1_name!', known)).toBe('Hello {{ form_1_name }}!');
  });

  it('leaves literal hashes (hashtags, #1, hex) untouched', () => {
    const known = ['brand'];
    expect(tokensFromDisplay('#sale #1 color #fff', known)).toBe('#sale #1 color #fff');
    expect(tokensFromDisplay('a #brand b', known)).toBe('a {{ brand }} b');
  });

  it('round-trips display → tokens for known names', () => {
    const known = ['form_1_name', 'brand'];
    const tokens = 'Hi {{ form_1_name }} from {{ brand }}';
    expect(tokensFromDisplay(displayFromTokens(tokens), known)).toBe(tokens);
  });
});
