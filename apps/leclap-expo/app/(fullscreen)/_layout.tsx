import { Stack } from 'expo-router';
import React from 'react';

// This layout is for fullscreen routes and does not enforce a specific orientation.
// Orientation is controlled by the individual fullscreen screens based on template requirements.
export default function FullscreenLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
