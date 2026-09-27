import { describe, it, expect } from 'vitest';
import { evaluateExpr } from '@/services/geometry/drawtext-expr';

const frame = { w: 1280, h: 720, text_w: 200, text_h: 40, t: 0 };

describe('evaluateExpr', () => {
  it('passes numbers through', () => {
    expect(evaluateExpr(80, frame)).toBe(80);
    expect(evaluateExpr('80', frame)).toBe(80);
  });

  it('evaluates the caption anchors the engine emits', () => {
    expect(evaluateExpr('(w-text_w)/2', frame)).toBe(540);
    expect(evaluateExpr('w-text_w-80', frame)).toBe(1000);
    expect(evaluateExpr('(h-text_h)-110', frame)).toBe(570);
  });

  it('strips the single quotes an expression is emitted with', () => {
    expect(evaluateExpr("'(h-text_h)/2'", frame)).toBe(340);
  });

  it('honours precedence, unary minus and ^', () => {
    expect(evaluateExpr('2+3*4', frame)).toBe(14);
    expect(evaluateExpr('-2^2', frame)).toBe(-4);
    expect(evaluateExpr('2*-3', frame)).toBe(-6);
  });

  it('knows the aliases drawtext accepts', () => {
    expect(evaluateExpr('W-tw', frame)).toBe(1080);
    expect(evaluateExpr('main_h-th', frame)).toBe(680);
  });

  // The reveal ramp, verbatim from text.ts: 0 before the delay, linear, then 1.
  it('evaluates the reveal ramp over time', () => {
    const ramp = 'if(lt(t,0.2),0,if(lt(t,0.8),(t-0.2)/0.6,1))';

    expect(evaluateExpr(ramp, { ...frame, t: 0 })).toBe(0);
    expect(evaluateExpr(ramp, { ...frame, t: 0.5 })).toBeCloseTo(0.5);
    expect(evaluateExpr(ramp, { ...frame, t: 2 })).toBe(1);
  });

  it('supports the functions the presets use', () => {
    expect(evaluateExpr('min(3,max(1,2))', frame)).toBe(2);
    expect(evaluateExpr('clip(5,0,3)', frame)).toBe(3);
    expect(evaluateExpr('between(t,0,1)', frame)).toBe(1);
    expect(evaluateExpr('gte(t,1)', frame)).toBe(0);
    expect(evaluateExpr('1-pow(1-0.5,3)', frame)).toBeCloseTo(0.875);
    expect(evaluateExpr('round(2.6)+floor(1.9)+ceil(0.1)+abs(-1)', frame)).toBe(6);
    expect(evaluateExpr('eq(1,1)*sin(0)+cos(0)', frame)).toBe(1);
  });

  // Anything outside the vocabulary is unknown, never a guess.
  it('returns null for what it cannot evaluate', () => {
    expect(evaluateExpr('rand(0,1)', frame)).toBeNull();
    expect(evaluateExpr('x+1', frame)).toBeNull();
    expect(evaluateExpr('(1+2', frame)).toBeNull();
    expect(evaluateExpr('{{ offset }}', frame)).toBeNull();
    expect(evaluateExpr(undefined, frame)).toBeNull();
    expect(evaluateExpr('1/0', frame)).toBeNull();
  });
});
