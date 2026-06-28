// Must load before any tsyringe-decorated class in the reused ffmpeg-video-composer core.
import 'reflect-metadata';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { TamaguiProvider } from '@tamagui/core';
import {
  useFonts,
  Oswald_300Light,
  Oswald_400Regular,
  Oswald_500Medium,
  Oswald_600SemiBold,
  Oswald_700Bold,
} from '@expo-google-fonts/oswald';
import { I18nextProvider } from 'react-i18next';
import { QueryProvider } from '@/src/providers/QueryProvider';
import { OfflineProvider } from '@/src/providers/OfflineProvider';
import { CompileProgressOverlay } from '@/src/components/compile/CompileProgressOverlay';
import AnimatedSplashScreen from '@/src/components/SplashScreen';
import i18n from '@/src/i18n';
import config from '../tamagui.config';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  const [fontsLoaded] = useFonts({
    Oswald_300Light,
    Oswald_400Regular,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Hide the native splash screen to show a custom one
      await SplashScreen.hideAsync();
      setIsReady(true);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView().catch(() => {});
  }, [onLayoutRootView]);

  const handleAnimationComplete = () => {
    setShowAnimatedSplash(false);
  };

  if (!isReady || !fontsLoaded || showAnimatedSplash) {
    return showAnimatedSplash ? <AnimatedSplashScreen onAnimationComplete={handleAnimationComplete} /> : null;
  }

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <I18nextProvider i18n={i18n}>
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
              <Stack.Screen name="template/[id]" />
              <Stack.Screen name="(fullscreen)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            {/* Global on-device compile experience — overlays any screen while a render is in flight. */}
            <CompileProgressOverlay />
          </OfflineProvider>
        </QueryProvider>
      </I18nextProvider>
    </TamaguiProvider>
  );
}
