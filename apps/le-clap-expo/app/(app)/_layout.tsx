import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import CustomTabBar from '@/src/components/ui/CustomTabBar';
import Header from '@/src/components/common/Header';
import { useOrientation } from '@/src/hooks/useOrientation';

export default function AppLayout() {
  const { lockOrientation, unlockOrientation } = useOrientation();

  useEffect(() => {
    lockOrientation('portrait').catch(() => null); // Lock to portrait on mount

    return () => {
      unlockOrientation().catch(() => null); // Unlock on unmount
    };
  }, [lockOrientation, unlockOrientation]);

  return (
    <>
      <Header showSettings />

      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Scenarios',
          }}
        />
        <Tabs.Screen
          name="videos/index"
          options={{
            title: 'Videos',
          }}
        />
      </Tabs>
    </>
  );
}
