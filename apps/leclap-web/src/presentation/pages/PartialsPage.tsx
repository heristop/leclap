import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { Seo } from '@/presentation/components/Seo';
import { PartialEditorShell } from '@/presentation/components/admin/editor-shell/PartialEditorShell';

type PartialsLocationState = {
  partialDraft?: TemplatePartial;
};

// The partials authoring editor, re-housed in the same full-viewport studio shell as the template
// creator (its own portal below the global header — no StudioSurface wrapper; the shell's titlebar
// owns back/picker/save). Shares the dock·panel·monitor·timeline frame with /templates/new.
export const PartialsPage = () => {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const routeState = location.state as PartialsLocationState | null;

  return (
    <>
      <Seo title={t('partials.title')} path="/partials" noindex />
      <PartialEditorShell initialDraft={routeState?.partialDraft ?? null} />
    </>
  );
};
