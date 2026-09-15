import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="connect" options={{ animation: 'fade' }} />
      <Stack.Screen name="public" />
      <Stack.Screen name="manual" />
      <Stack.Screen name="reconnect" options={{ animation: 'fade' }} />
    </Stack>
  );
}
