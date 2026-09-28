// Evaluates the subset of FFmpeg's expression language the engine's text and box lowerings emit
// (`(w-text_w)/2`, `h-text_h-110`, the reveal ramps' `if(lt(t,…),…)`), so the geometry model reads
// positions off the filters the renderer actually runs instead of re-deriving them. Anything outside
// that vocabulary — an unknown name, a function it does not know, a malformed expression, a
// non-finite result — is `null`: unknown, never a guess.

export type ExprVariables = Record<string, number>;

// drawtext/drawbox aliases for the frame and the text box.
const ALIASES: Record<string, string> = {
  W: 'w',
  main_w: 'w',
  iw: 'w',
  in_w: 'w',
  H: 'h',
  main_h: 'h',
  ih: 'h',
  in_h: 'h',
  tw: 'text_w',
  th: 'text_h',
};

const CONSTANTS: Record<string, number> = { PI: Math.PI, E: Math.E };

type Fn = (args: number[]) => number;

function bool(value: boolean): number {
  return value ? 1 : 0;
}

const FUNCTIONS: Record<string, Fn> = {
  if: ([c, a, b = 0]) => (c === 0 ? b : a),
  ifnot: ([c, a, b = 0]) => (c === 0 ? a : b),
  lt: ([a, b]) => bool(a < b),
  lte: ([a, b]) => bool(a <= b),
  gt: ([a, b]) => bool(a > b),
  gte: ([a, b]) => bool(a >= b),
  eq: ([a, b]) => bool(a === b),
  between: ([x, lo, hi]) => bool(x >= lo && x <= hi),
  min: ([a, b]) => Math.min(a, b),
  max: ([a, b]) => Math.max(a, b),
  clip: ([x, lo, hi]) => Math.min(Math.max(x, lo), hi),
  abs: ([a]) => Math.abs(a),
  pow: ([a, b]) => a ** b,
  sqrt: ([a]) => Math.sqrt(a),
  exp: ([a]) => Math.exp(a),
  sin: ([a]) => Math.sin(a),
  cos: ([a]) => Math.cos(a),
  floor: ([a]) => Math.floor(a),
  ceil: ([a]) => Math.ceil(a),
  round: ([a]) => Math.round(a),
  trunc: ([a]) => Math.trunc(a),
  mod: ([a, b]) => a % b,
};

class Unknown extends Error {}

class Parser {
  private pos = 0;

  constructor(
    private readonly src: string,
    private readonly vars: ExprVariables
  ) {}

  parse(): number {
    const value = this.sum();

    this.skipSpace();

    if (this.pos !== this.src.length) {
      throw new Unknown();
    }

    return value;
  }

  private skipSpace(): void {
    while (this.src[this.pos] === ' ') {
      this.pos++;
    }
  }

  private peek(): string {
    this.skipSpace();

    return this.src[this.pos] ?? '';
  }

  private expect(char: string): void {
    if (this.peek() !== char) {
      throw new Unknown();
    }

    this.pos++;
  }

  private sum(): number {
    let value = this.product();

    for (let op = this.peek(); op === '+' || op === '-'; op = this.peek()) {
      this.pos++;
      const rhs = this.product();
      value = op === '+' ? value + rhs : value - rhs;
    }

    return value;
  }

  private product(): number {
    let value = this.unary();

    for (let op = this.peek(); op === '*' || op === '/'; op = this.peek()) {
      this.pos++;
      const rhs = this.unary();
      value = op === '*' ? value * rhs : value / rhs;
    }

    return value;
  }

  // Unary minus binds looser than `^`, as in FFmpeg: `-2^2` is -4.
  private unary(): number {
    const op = this.peek();

    if (op === '-' || op === '+') {
      this.pos++;
      const value = this.unary();

      return op === '-' ? -value : value;
    }

    return this.power();
  }

  private power(): number {
    const base = this.atom();

    if (this.peek() !== '^') {
      return base;
    }

    this.pos++;

    return base ** this.unary();
  }

  private atom(): number {
    const char = this.peek();

    if (char === '(') {
      this.pos++;
      const value = this.sum();
      this.expect(')');

      return value;
    }

    const number = /^\d+(?:\.\d*)?|^\.\d+/.exec(this.src.slice(this.pos));

    if (number) {
      this.pos += number[0].length;

      return Number(number[0]);
    }

    const name = /^[A-Za-z_]\w*/.exec(this.src.slice(this.pos));

    if (!name) {
      throw new Unknown();
    }

    this.pos += name[0].length;

    return this.peek() === '(' ? this.call(name[0]) : this.variable(name[0]);
  }

  private call(name: string): number {
    if (!Object.hasOwn(FUNCTIONS, name)) {
      throw new Unknown();
    }

    this.expect('(');
    const args = [this.sum()];

    while (this.peek() === ',') {
      this.pos++;
      args.push(this.sum());
    }

    this.expect(')');

    return FUNCTIONS[name](args);
  }

  private variable(name: string): number {
    const key = Object.hasOwn(ALIASES, name) ? ALIASES[name] : name;

    if (Object.hasOwn(this.vars, key)) {
      return this.vars[key];
    }

    if (Object.hasOwn(CONSTANTS, key)) {
      return CONSTANTS[key];
    }

    throw new Unknown();
  }
}

export function evaluateExpr(expr: unknown, vars: ExprVariables): number | null {
  if (typeof expr === 'number') {
    return Number.isFinite(expr) ? expr : null;
  }

  if (typeof expr !== 'string') {
    return null;
  }

  const source = expr.trim().replace(/^'(.*)'$/s, '$1');

  try {
    const value = new Parser(source, vars).parse();

    return Number.isFinite(value) ? value : null;
  } catch (error) {
    if (error instanceof Unknown) {
      return null;
    }

    throw error;
  }
}
