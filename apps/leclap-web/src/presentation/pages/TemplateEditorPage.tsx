import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TemplateEditorShell } from '@/presentation/components/admin/editor-shell/TemplateEditorShell';
import { BuilderModeProvider } from '@/presentation/components/admin/editor/useBuilderMode';
import { userTemplateService } from '@/services/userTemplateService';
import { Seo } from '@/presentation/components/Seo';
import { NotFound } from '@/presentation/pages/NotFound';

// Full-page host for the template editor. `/templates/new` creates a fresh
// template; `/templates/:id/edit` hydrates an existing user template. Both return
// to the templates list (/templates) on save or cancel.
export const TemplateEditorPage = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const initial = id ? userTemplateService.get(id) : null;
  const backToList = () => {
    Promise.resolve(navigate('/templates')).catch(() => {});
  };

  // Templates live in this browser's storage, so an edit link can outlive its template (deleted here,
  // or saved in another browser). That's a dead link, not a blank new template: say so with the 404.
  if (id && !initial) return <NotFound />;

  return (
    <>
      <Seo
        title={initial ? t('seo.edit') : t('seo.create')}
        path={id ? `/templates/${id}/edit` : '/templates/new'}
        noindex
      />
      {/* The authoring editor opens every section's Advanced disclosures (effects, chroma key, audio, capture
          modes, the camera guide). They read this mode, and nothing had provided it since the legacy editor
          and its Simple/Advanced switch were retired, so they were out of reach. The studio's "Build from
          scratch" keeps the simple default. */}
      <BuilderModeProvider mode="advanced">
        <TemplateEditorShell
          initial={initial}
          onSaved={() => {
            backToList();
          }}
          onCancel={backToList}
          onSaveAndCompile={(saved) => {
            Promise.resolve(navigate(`/studio/new?template=${saved.id}`)).catch(() => {});
          }}
        />
      </BuilderModeProvider>
    </>
  );
};
