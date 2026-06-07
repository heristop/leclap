// Local oxlint JS plugin. Loaded by vp lint via `lint.jsPlugins` in
// vite.config.ts. Node 24's native TS type-stripping handles this file
// at runtime; no build step required.

interface AstNode {
  type: string;
  loc?: { start: { line: number }; end: { line: number } };
  parent?: AstNode | null;
  body?: AstNode[];
  consequent?: AstNode[];
  alternate?: AstNode | null;
}

interface Fixer {
  insertTextAfter(node: AstNode, text: string): unknown;
}

interface Comment {
  type: 'Line' | 'Block';
  value: string;
  loc?: { start: { line: number }; end: { line: number } };
  range?: [number, number];
}

interface SourceCode {
  getAllComments(): Comment[];
  getText(node?: AstNode): string;
}

interface RuleContext {
  sourceCode: SourceCode;
  report(descriptor: {
    node?: AstNode;
    loc?: { start: { line: number }; end: { line: number } };
    messageId: string;
    data?: Record<string, string>;
    fix?: (fixer: Fixer) => unknown;
  }): void;
}

const TRIGGER_TYPES = [
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ReturnStatement',
  'SwitchStatement',
  'TryStatement',
  'ThrowStatement',
] as const;

const FRIENDLY: Record<string, string> = {
  IfStatement: 'if',
  ForStatement: 'for',
  ForInStatement: 'for-in',
  ForOfStatement: 'for-of',
  WhileStatement: 'while',
  DoWhileStatement: 'do-while',
  ReturnStatement: 'return',
  SwitchStatement: 'switch',
  TryStatement: 'try',
  ThrowStatement: 'throw',
};

function siblingsOf(parent: AstNode | null | undefined): AstNode[] | null {
  if (!parent) return null;

  if (parent.type === 'BlockStatement' || parent.type === 'Program' || parent.type === 'StaticBlock') {
    return parent.body ?? null;
  }

  if (parent.type === 'SwitchCase') {
    return parent.consequent ?? null;
  }

  return null;
}

const paddingLineBeforeStatements = {
  meta: {
    type: 'layout' as const,
    fixable: 'whitespace' as const,
    docs: {
      description:
        'Require a blank line before control-flow statements when they follow a sibling statement in the same block.',
    },
    schema: [],
    messages: {
      missingPadding: 'Expected a blank line before this `{{name}}` statement.',
    },
  },
  create(context: RuleContext) {
    function check(node: AstNode) {
      const siblings = siblingsOf(node.parent);

      if (!siblings) return;

      const index = siblings.indexOf(node);

      if (index <= 0) return;

      const prev = siblings[index - 1];

      if (!prev.loc || !node.loc) return;

      if (node.loc.start.line - prev.loc.end.line <= 1) {
        context.report({
          node,
          messageId: 'missingPadding',
          data: { name: FRIENDLY[node.type] ?? node.type },
          // Insert after the previous statement so the current line's
          // indentation is preserved (insertTextBefore on the current
          // node would strand the leading whitespace on the new blank line).
          fix(fixer) {
            return fixer.insertTextAfter(prev, '\n');
          },
        });
      }
    }

    const visitors: Record<string, (n: AstNode) => void> = {};

    for (const t of TRIGGER_TYPES) {
      visitors[t] = check;
    }

    return visitors;
  },
};

const noDisableComments = {
  meta: {
    type: 'suggestion' as const,
    docs: {
      description:
        'Forbid all eslint/oxlint disable directives. Fix the underlying code or change the rule configuration instead of silencing it locally.',
    },
    schema: [],
    messages: {
      noDisable: 'Disable directives are forbidden. Refactor the code or update the rule config.',
    },
  },
  create(context: RuleContext) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments();

        for (const comment of comments) {
          const text = comment.value.trim();

          if (text.startsWith('eslint-disable') || text.startsWith('oxlint-disable')) {
            context.report({
              loc: comment.loc,
              messageId: 'noDisable',
            });
          }
        }
      },
    };
  },
};

const noElseClause = {
  meta: {
    type: 'suggestion' as const,
    docs: {
      description:
        'Disallow `else` and `else if` clauses. Prefer early returns (guard clauses) for binary branches, or a strategy lookup (map/record) for multi-way dispatch.',
    },
    schema: [],
    messages: {
      noElse:
        'Avoid `else` / `else if`. Use an early return for binary branches, or a strategy lookup (map/record) for multi-way dispatch.',
    },
  },
  create(context: RuleContext) {
    return {
      IfStatement(node: AstNode) {
        if (!node.alternate) return;

        context.report({
          node: node.alternate,
          messageId: 'noElse',
        });
      },
    };
  },
};

export default {
  meta: { name: 'local' },
  rules: {
    'padding-line-before-statements': paddingLineBeforeStatements,
    'no-else-clause': noElseClause,
    'no-disable-comments': noDisableComments,
  },
};
