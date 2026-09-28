import { useTranslation } from 'react-i18next';
import { PolicyPage, type PolicySection } from '@/presentation/components/PolicyPage';

export const Privacy = () => {
  const { t } = useTranslation('privacy');

  const sections: PolicySection[] = [
    { id: 'local', heading: t('sections.local.heading'), body: t('sections.local.body') },
    { id: 'data', heading: t('sections.data.heading'), body: t('sections.data.body') },
    { id: 'storage', heading: t('sections.storage.heading'), body: t('sections.storage.body') },
    { id: 'analytics', heading: t('sections.analytics.heading'), body: t('sections.analytics.body') },
    { id: 'third-party', heading: t('sections.thirdParty.heading'), body: t('sections.thirdParty.body') },
    { id: 'contact', heading: t('sections.contact.heading'), body: t('sections.contact.body') },
  ];

  return (
    <PolicyPage
      path="/privacy"
      seoTitle={t('privacy.title', { ns: 'seo' })}
      seoDescription={t('privacy.description', { ns: 'seo' })}
      badge={t('badge')}
      title={t('title')}
      intro={t('intro')}
      updated={t('updated')}
      sections={sections}
      sibling={{ to: '/legal', label: t('title', { ns: 'legal' }) }}
    />
  );
};
