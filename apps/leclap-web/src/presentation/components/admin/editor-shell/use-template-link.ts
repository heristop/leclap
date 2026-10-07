// Template links on the builder route (`/studio/builder#t=v1.…`): the fragment is decoded into a new,
// unsaved draft, then removed from the address bar so a reload or a shared URL does not reopen it. A link
// pasted while a draft is already open asks first, since opening it replaces that draft.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readTemplateLinkPayload } from 'ffmpeg-video-composer/src/core/template-link/index.ts';
import { importTemplateLink, type TemplateLinkImport } from '@/application/usecases/template-link/open-template-link';
import { browserMediaService } from '@/services/browserMediaService';
import type { Template } from '@/services/templateService';
import type { TemplateLinkOutcome } from './template-link-notice';

type OpenedLink = Extract<TemplateLinkImport, { kind: 'opened' }>;

interface Draft {
  // Bumped for every opened link so the editor shell remounts on the new template.
  key: number;
  initial: Template | null;
}

const deps = {
  hasUpload: async (key: string) => (await browserMediaService.getMeta(key)) !== null,
};

export function useTemplateLink() {
  const location = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>({ key: 0, initial: null });
  // True until a link present on arrival is decoded, so the shell mounts once, on the linked template.
  const [loading, setLoading] = useState(() => readTemplateLinkPayload(location.hash) !== null);
  const [outcome, setOutcome] = useState<TemplateLinkOutcome | null>(null);
  // A link opened while a draft was already open, waiting for the person to allow replacing that draft.
  const [pending, setPending] = useState<OpenedLink | null>(null);
  // The fragment last acted on: effects can run twice for one navigation (StrictMode), a link once.
  const handled = useRef<string | null>(null);

  const apply = (result: TemplateLinkOutcome & { template?: Template }): void => {
    const template = result.template;

    if (template) setDraft((prev) => ({ key: prev.key + 1, initial: template }));

    setOutcome(result);
  };

  // `arriving`: the link came with the page, so there is no draft to lose yet.
  const receive = async (hash: string, arriving: boolean): Promise<void> => {
    const result = await importTemplateLink(hash, deps);
    setLoading(false);

    if (result.kind === 'none') return;

    if (result.kind === 'opened' && !arriving) {
      setPending(result);

      return;
    }

    apply(result);
  };

  useEffect(() => {
    if (readTemplateLinkPayload(location.hash) === null) {
      handled.current = null;

      return;
    }

    if (handled.current === location.hash) return;

    handled.current = location.hash;
    // The fragment never stays in the address bar: a reload must not reopen it over the person's edits.
    Promise.resolve(navigate({ pathname: location.pathname, search: location.search }, { replace: true })).catch(
      () => {}
    );
    receive(location.hash, loading).catch(() => {});
  }, [location.hash, location.pathname, location.search, navigate, loading]);

  return {
    draft,
    loading,
    outcome,
    dismiss: () => {
      setOutcome(null);
    },
    pending: pending !== null,
    confirmReplace: () => {
      if (pending) apply(pending);

      setPending(null);
    },
    cancelReplace: () => {
      setPending(null);
    },
  };
}
