// Best-effort screen protection for an active recording or render. Each operation owns its lease.
export function keepScreenAwake(): () => void {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const wakeLock = (navigator as { wakeLock?: WakeLock }).wakeLock;

  if (!wakeLock) return () => {};

  let disposed = false;
  let pending = false;
  let sentinel: WakeLockSentinel | undefined;

  const isActive = (): boolean => !disposed && document.visibilityState === 'visible';

  const release = (lock: WakeLockSentinel | undefined): void => {
    lock?.release().catch(() => {});
  };
  const acquire = async (): Promise<void> => {
    if (!isActive() || pending || (sentinel && !sentinel.released)) return;

    pending = true;

    try {
      const lock = await wakeLock.request('screen');

      if (!isActive()) {
        release(lock);

        return;
      }

      sentinel = lock;
    } catch {
      // Unsupported permissions or power-saving policies must never interrupt the user's work.
    } finally {
      pending = false;
    }
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      acquire().catch(() => {});

      return;
    }

    release(sentinel);
    sentinel = undefined;
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  acquire().catch(() => {});

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    release(sentinel);
    sentinel = undefined;
  };
}
