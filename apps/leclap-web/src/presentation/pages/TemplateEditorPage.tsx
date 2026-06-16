import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TemplateEditor } from '@/presentation/components/admin/TemplateEditor';
import { userTemplateService } from '@/services/userTemplateService';
import { Seo } from '@/presentation/components/Seo';

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

  return (
    <>
      <Seo
        title={initial ? t('seo.edit') : t('seo.create')}
        path={id ? `/templates/${id}/edit` : '/templates/new'}
        noindex
      />
      <TemplateEditor initial={initial} onSaved={backToList} onCancel={backToList} />
    </>
  );
};
