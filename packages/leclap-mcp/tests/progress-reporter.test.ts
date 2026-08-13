import { describe, expect, it } from 'vitest';

import { createProgressReporter, PROGRESS_STEP, type ProgressMessage } from '../src/worker/progress-reporter.js';

function collect(): { sent: ProgressMessage[]; send: (m: ProgressMessage) => void } {
  const sent: ProgressMessage[] = [];

  return {
    sent,
    send: (m) => {
      sent.push(m);
    },
  };
}

describe('createProgressReporter', () => {
  it('emits the first fraction it sees', () => {
    const { sent, send } = collect();
    createProgressReporter(send)(0);

    expect(sent).toEqual([{ kind: 'progress', fraction: 0 }]);
  });

  it('suppresses an advance smaller than the step', () => {
    const { sent, send } = collect();
    const report = createProgressReporter(send);
    report(0.5);
    report(0.5 + PROGRESS_STEP / 2);

    expect(sent).toHaveLength(1);
  });

  it('emits once the advance reaches the step', () => {
    const { sent, send } = collect();
    const report = createProgressReporter(send);
    report(0.5);
    report(0.5 + PROGRESS_STEP);

    expect(sent).toHaveLength(2);
  });

  it('always emits the terminal 1, even right after another emit', () => {
    const { sent, send } = collect();
    const report = createProgressReporter(send);
    report(0.99);
    report(1);

    expect(sent.at(-1)).toEqual({ kind: 'progress', fraction: 1 });
  });

  it('emits the terminal 1 only once', () => {
    const { sent, send } = collect();
    const report = createProgressReporter(send);
    report(1);
    report(1);

    expect(sent).toHaveLength(1);
  });

  it('clamps out-of-range fractions', () => {
    const { sent, send } = collect();
    const report = createProgressReporter(send);
    report(-3);
    report(42);

    expect(sent.map((m) => m.fraction)).toEqual([0, 1]);
  });
});
