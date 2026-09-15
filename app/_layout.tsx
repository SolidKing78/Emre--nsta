import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MetricEditorProvider } from '@/components/simulation/SimulationMetricEditor';
import { useProviderRefinements } from '@/features/instagram/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useManualProfileStore } from '@/store/manualProfileStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSimulationStore } from '@/store/simulationStore';
import { isAppError } from '@/types/errors';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  initialRouteName: 'index',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAppError(error) && !error.retryable) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

function useHydrated(): boolean {
  const a = useAuthStore((s) => s.hydrated);
  const b = useSettingsStore((s) => s.hydrated);
  const c = useSimulationStore((s) => s.hydrated);
  const d = useManualProfileStore((s) => s.hydrated);
  return a && b && c && d;
}

/** Keeps queries in sync with background refinements from the active provider. */
function ProviderRefinements() {
  useProviderRefinements();
  return null;
}

/** Redirects to the reconnect screen whenever a live session expires. */
function AuthExpiryGuard() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authExpired' && segments[0] !== '(auth)') {
      router.replace('/(auth)/reconnect');
    }
  }, [status, segments, router]);
  return null;
}

function Navigation() {
  const { colors, isDark } = useTheme();
  const hydrated = useHydrated();

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        notification: colors.like,
      },
    };
  }, [colors, isDark]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hydrated]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthExpiryGuard />
      <ProviderRefinements />
      <MetricEditorProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="media/[id]" />
          <Stack.Screen name="dashboard/index" />
          <Stack.Screen name="simulation/index" />
          <Stack.Screen name="simulation/media/[id]" />
          <Stack.Screen name="simulation/compare" />
          <Stack.Screen name="simulation/new-post" options={{ presentation: 'modal' }} />
          <Stack.Screen name="simulation/profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="growth/index" />
          <Stack.Screen name="reels/index" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="account/index" />
          <Stack.Screen name="share/index" options={{ presentation: 'modal' }} />
          <Stack.Screen name="create/index" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        </Stack>
      </MetricEditorProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Navigation />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
