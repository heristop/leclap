import { useTranslation } from 'react-i18next';
import { Code2, FileCode, Info, Monitor } from '@/presentation/components/icons';
import { PolicyPage, type PolicySection } from '@/presentation/components/PolicyPage';

export const Legal = () => {
  const { t } = useTranslation('legal');

  const sections: PolicySection[] = [
    { Icon: Code2, heading: t('sections.publisher.heading'), body: t('sections.publisher.body') },
    { Icon: Monitor, heading: t('sections.hosting.heading'), body: t('sections.hosting.body') },
    { Icon: Info, heading: t('sections.contact.heading'), body: t('sections.contact.body') },
    { Icon: FileCode, heading: t('sections.ip.heading'), body: t('sections.ip.body') },
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
    />
  );
};
