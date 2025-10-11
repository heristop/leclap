import { Stack } from "expo-router";
import { useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { QueryProvider } from './providers/QueryProvider';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const onLayoutRootView = useCallback(async () => {
    // Hide the splash screen when ready
    await SplashScreen.hideAsync();
  }, []);

  return (
    <QueryProvider>
      <Stack
        onLayout={onLayoutRootView}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      />
    </QueryProvider>
  );
}