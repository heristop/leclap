import React from 'react';
import { Tabs } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import CustomTabBar from '../components/ui/CustomTabBar';
import { useCallback, useEffect } from 'react';
import Header from '../components/common/Header';
import { useOrientation } from '../hooks/useOrientation';

SplashScreen.preventAutoHideAsync();

export default function AppLayout() {
  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

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
