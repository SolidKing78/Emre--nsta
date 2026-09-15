import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LensLogo } from '@/components/common/LensLogo';
import { Text } from '@/components/common/Text';
import { APP_NAME, APP_TAGLINE } from '@/constants/config';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useManualProfileStore } from '@/store/manualProfileStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSimulationStore } from '@/store/simulationStore';

/**
 * Splash: waits for persisted stores, then checks the session.
 *   session → tabs · no session → connect · expired live session → reconnect
 */
export default function SplashRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  const authHydrated = useAuthStore((s) => s.hydrated);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const simulationHydrated = useSimulationStore((s) => s.hydrated);
  const manualHydrated = useManualProfileStore((s) => s.hydrated);
  const hydrated = authHydrated && settingsHydrated && simulationHydrated && manualHydrated;
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      if (status === 'signedIn') router.replace('/(tabs)/home');
      else if (status === 'authExpired') router.replace('/(auth)/reconnect');
      else router.replace('/(auth)/connect');
    }, 650);
    return () => clearTimeout(timer);
  }, [hydrated, status, router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.center}>
        <LensLogo size={104} />
        <Text variant="display" weight="700" style={styles.title}>
          {APP_NAME}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.footer}>
        <Text variant="caption" color="secondary" style={{ letterSpacing: 0.6 }}>
          {APP_TAGLINE}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  title: { marginTop: spacing.xl, letterSpacing: -0.5 },
  footer: { position: 'absolute', bottom: 56 },
});
