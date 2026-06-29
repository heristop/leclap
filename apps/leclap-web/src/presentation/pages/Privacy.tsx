import { useTranslation } from 'react-i18next';
import { CheckCircle2, Globe, HardDrive, Lightbulb, WifiOff } from '@/presentation/components/icons';
import { PolicyPage, type PolicySection } from '@/presentation/components/PolicyPage';

export const Privacy = () => {
  const { t } = useTranslation('privacy');

  const sections: PolicySection[] = [
    { Icon: WifiOff, heading: t('sections.local.heading'), body: t('sections.local.body') },
    { Icon: CheckCircle2, heading: t('sections.data.heading'), body: t('sections.data.body') },
    { Icon: HardDrive, heading: t('sections.storage.heading'), body: t('sections.storage.body') },
    { Icon: Globe, heading: t('sections.thirdParty.heading'), body: t('sections.thirdParty.body') },
    { Icon: Lightbulb, heading: t('sections.contact.heading'), body: t('sections.contact.body') },
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
    />
  );
};
