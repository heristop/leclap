import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { TamaguiProvider } from '@tamagui/core';
import { QueryProvider } from '@/src/providers/QueryProvider';
import { OfflineProvider } from '@/src/providers/OfflineProvider';
import AnimatedSplashScreen from './components/SplashScreen';
import config from '../tamagui.config';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  const onLayoutRootView = useCallback(async () => {
    // Hide the native splash screen to show a custom one
    await SplashScreen.hideAsync();
    setIsReady(true);
  }, []);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  const handleAnimationComplete = () => {
    setShowAnimatedSplash(false);
  };

  if (!isReady || showAnimatedSplash) {
    return showAnimatedSplash ? (
      <AnimatedSplashScreen onAnimationComplete={handleAnimationComplete} />
    ) : null;
  }

  return (
    <TamaguiProvider config={config}>
      <QueryProvider>
        <OfflineProvider>
          <Stack
            initialRouteName="index"
            screenOptions={{
              headerShown: false,
              // Minimal configuration to avoid LinkPreviewContext issues
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="(fullscreen)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </OfflineProvider>
      </QueryProvider>
    </TamaguiProvider>
  );
}