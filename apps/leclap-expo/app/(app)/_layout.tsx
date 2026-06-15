import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import CustomTabBar from '@/src/components/ui/CustomTabBar';
import Header from '@/src/components/common/Header';
import { useOrientation } from '@/src/hooks/useOrientation';

export default function AppLayout() {
  const { t } = useTranslation('header');
  const { lockOrientation, unlockOrientation } = useOrientation();

  useEffect(() => {
    lockOrientation('portrait').catch(() => null); // Lock to portrait on mount

    return () => {
      unlockOrientation().catch(() => null); // Unlock on unmount
    };
  }, [lockOrientation, unlockOrientation]);

  return (
    <>
      <Header />

      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.scenarios'),
          }}
        />
        <Tabs.Screen
          name="videos/index"
          options={{
            title: t('tabs.videos'),
          }}
        />
      </Tabs>
    </>
  );
}
