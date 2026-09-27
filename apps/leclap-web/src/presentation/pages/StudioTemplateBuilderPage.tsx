import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/presentation/components/Seo';
import { TemplateEditorShell } from '@/presentation/components/admin/editor-shell/TemplateEditorShell';

// Studio entry point for building a custom template from scratch.
// Uses the full template editor with studio-context navigation:
// on save → launches the Builder wizard with the new template.
// on cancel → returns to the Studio gallery.
export const StudioTemplateBuilderPage = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();

  return (
    <>
      <Seo title={t('seo.buildFromScratch')} path="/studio/builder" noindex />
      <TemplateEditorShell
        initial={null}
        backLabel={t('nav.studio', { ns: 'common' })}
        onSaved={(saved) => {
          Promise.resolve(navigate(`/studio/new?template=${saved.id}`)).catch(() => {});
        }}
        onCancel={() => {
          Promise.resolve(navigate('/studio')).catch(() => {});
        }}
      />
    </>
  );
};
