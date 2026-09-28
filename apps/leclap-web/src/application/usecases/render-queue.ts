// One render at a time, and the newest one wins. Renders share one engine and one WASM filesystem, and a
// stopped render only halts at its next segment boundary, so each render waits for the one before it to
// wind down rather than clearing the filesystem under it. A Stop, or a newer render, voids the render in
// flight: its `isCurrent()` turns false, and the render gives up at its next checkpoint.
export interface RenderQueue {
  run: <T>(render: (isCurrent: () => boolean) => Promise<T>) => Promise<T>;
  stop: () => void;
}

export const createRenderQueue = (): RenderQueue => {
  let generation = 0;
  let last: Promise<unknown> = Promise.resolve();

  return {
    run: (render) => {
      generation += 1;
      const ticket = generation;
      const isCurrent = () => ticket === generation;
      const settled = last.then(() => render(isCurrent));

      // The next render only waits for this one to settle; its failure is its caller's to handle.
      last = settled.catch(() => {});

      return settled;
    },
    stop: () => {
      generation += 1;
    },
  };
};
