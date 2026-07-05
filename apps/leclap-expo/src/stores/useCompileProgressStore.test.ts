import { useCompileProgressStore } from './useCompileProgressStore';

// The app's type program is typed for vitest globals, so `jest` isn't a typed value here; a plain
// call counter keeps this pure-store test free of the jest runtime value (TS2708 otherwise).
const counter = () => {
  const state = { calls: 0 };
  const fn = () => {
    state.calls += 1;
  };

  return { fn, state };
};

const reset = () =>
  useCompileProgressStore.setState({ visible: false, ratio: 0, stage: '', cancelling: false, cancel: null });

describe('useCompileProgressStore', () => {
  beforeEach(reset);

  it('start() shows the overlay and registers the cancel handle', () => {
    const onCancel = () => undefined;
    useCompileProgressStore.getState().start(onCancel);

    const state = useCompileProgressStore.getState();
    expect(state.visible).toBe(true);
    expect(state.ratio).toBe(0);
    expect(state.stage).toBe('');
    expect(state.cancelling).toBe(false);
    expect(state.cancel).toBe(onCancel);
  });

  it('start() without a handle leaves cancel null and resets cancelling', () => {
    useCompileProgressStore.setState({ cancelling: true, cancel: () => undefined });
    useCompileProgressStore.getState().start();

    const state = useCompileProgressStore.getState();
    expect(state.cancel).toBeNull();
    expect(state.cancelling).toBe(false);
  });

  it('update() clamps ratio to 0..1 and sets the stage', () => {
    useCompileProgressStore.getState().update(1.5, 'Rendering');
    expect(useCompileProgressStore.getState().ratio).toBe(1);
    expect(useCompileProgressStore.getState().stage).toBe('Rendering');

    useCompileProgressStore.getState().update(-0.5, 'Prep');
    expect(useCompileProgressStore.getState().ratio).toBe(0);
  });

  it('update() is frozen once cancelling so the bar stops advancing', () => {
    useCompileProgressStore.getState().start(() => undefined);
    useCompileProgressStore.getState().update(0.4, 'Rendering');
    useCompileProgressStore.getState().requestCancel();
    useCompileProgressStore.getState().update(0.9, 'Almost there');

    const state = useCompileProgressStore.getState();
    expect(state.ratio).toBe(0.4);
    expect(state.stage).toBe('Rendering');
  });

  it('start() aborts an in-flight compile before adopting the new cancel handle', () => {
    const first = counter();
    useCompileProgressStore.getState().start(first.fn);
    // A second compile begins while the first is still visible.
    useCompileProgressStore.getState().start(() => undefined);

    expect(first.state.calls).toBe(1);
  });

  it('requestCancel() flips cancelling and invokes the registered handle', () => {
    const onCancel = counter();
    useCompileProgressStore.getState().start(onCancel.fn);
    useCompileProgressStore.getState().requestCancel();

    expect(useCompileProgressStore.getState().cancelling).toBe(true);
    expect(onCancel.state.calls).toBe(1);
  });

  it('requestCancel() is a no-op when nothing is compiling', () => {
    expect(() => useCompileProgressStore.getState().requestCancel()).not.toThrow();
    expect(useCompileProgressStore.getState().cancelling).toBe(true);
  });

  it('requestCancel() twice only invokes the handle once', () => {
    const onCancel = counter();
    useCompileProgressStore.getState().start(onCancel.fn);
    useCompileProgressStore.getState().requestCancel();
    useCompileProgressStore.getState().requestCancel();

    expect(onCancel.state.calls).toBe(1);
  });

  it('finish() hides the overlay and clears the cancel handle and cancelling flag', () => {
    useCompileProgressStore.getState().start(() => undefined);
    useCompileProgressStore.getState().requestCancel();
    useCompileProgressStore.getState().finish();

    const state = useCompileProgressStore.getState();
    expect(state.visible).toBe(false);
    expect(state.cancelling).toBe(false);
    expect(state.cancel).toBeNull();
  });
});
