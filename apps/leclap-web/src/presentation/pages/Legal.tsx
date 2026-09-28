import { useTranslation } from 'react-i18next';
import { PolicyPage, type PolicySection } from '@/presentation/components/PolicyPage';

export const Legal = () => {
  const { t } = useTranslation('legal');

  const sections: PolicySection[] = [
    { id: 'publisher', heading: t('sections.publisher.heading'), body: t('sections.publisher.body') },
    { id: 'hosting', heading: t('sections.hosting.heading'), body: t('sections.hosting.body') },
    { id: 'contact', heading: t('sections.contact.heading'), body: t('sections.contact.body') },
    { id: 'ip', heading: t('sections.ip.heading'), body: t('sections.ip.body') },
  ];

  return (
    <PolicyPage
      path="/legal"
      seoTitle={t('legal.title', { ns: 'seo' })}
      seoDescription={t('legal.description', { ns: 'seo' })}
      badge={t('badge')}
      title={t('title')}
      intro={t('intro')}
      updated={t('updated')}
      sections={sections}
      sibling={{ to: '/privacy', label: t('title', { ns: 'privacy' }) }}
    />
  );
};
