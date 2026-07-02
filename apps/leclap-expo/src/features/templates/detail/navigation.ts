import type { useRouter } from 'expo-router';

// Template detail is a root-stack screen reached by push (from the lists) or replace (after recording
// the last section / finishing the preview). A replace-entry can have an empty back stack, so fall back
// to the tabs rather than letting router.back() throw "GO_BACK not handled".
export function makeGoBack(router: ReturnType<typeof useRouter>): () => void {
  return () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace('/(app)');
  };
}
