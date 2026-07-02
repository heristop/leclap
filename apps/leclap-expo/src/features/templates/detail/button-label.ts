import type { TFunction } from 'i18next';

// The create button's morphing label. `willQueue` is the queue seam (the app is fully local today, so
// it's false — but the branch stays, ready for a future queue mode).
export function getButtonLabel(isPending: boolean, willQueue: boolean, t: TFunction<'detail'>): string {
  if (!isPending) return t('button.create');

  return willQueue ? t('button.addingToQueue') : t('button.creating');
}

export function isCompileDisabled(allDone: boolean, isPending: boolean): boolean {
  return !allDone || isPending;
}
