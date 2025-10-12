import React from 'react';
import { Tabs } from "expo-router";
import CustomTabBar from '../components/ui/CustomTabBar';
import { useEffect } from 'react';
import Header from '../components/common/Header';
import { useOrientation } from '../hooks/useOrientation';

export default function AppLayout() {
  const { lockOrientation, unlockOrientation } = useOrientation();

  useEffect(() => {
    lockOrientation('portrait'); // Lock to portrait on mount
    return () => {
      unlockOrientation(); // Unlock on unmount
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
            title: "Scenarios",
          }}
        />
        <Tabs.Screen
          name="videos/index"
          options={{
            title: "Videos",
          }}
        />
        <Tabs.Screen
          name="template/[id]"
          options={{
            title: "Template",
            tabBarButton: () => null,
          }}
        />
      </Tabs>
    </>
  );
}
