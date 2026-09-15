import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { LensLogo } from '@/components/common/LensLogo';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { LockIcon, SearchIcon, UserPlusIcon } from '@/components/icons';
import { APP_MODE, APP_NAME } from '@/constants/config';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { upperCase, useLanguage, useT } from '@/i18n';
import { isLiveConfigured, signInDemo, signInLive } from '@/services/auth/authService';
import { isAppError } from '@/types/errors';


/**
 * Connect Account screen. Deliberately NOT a copy of the Instagram login form:
 * there is no username / password field. Real login happens on Instagram's own page.
 */
export default function ConnectScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const liveDisabledReason = !isLiveConfigured() ? t('auth.liveMissingConfig') : null;

  const connectLive = async () => {
    setMessage(null);
    if (liveDisabledReason) {
      setMessage(liveDisabledReason);
      triggerHaptic('warning');
      return;
    }
    setLoading(true);
    try {
      await signInLive();
      triggerHaptic('success');
      router.replace('/(tabs)/home');
    } catch (err) {
      const reason = isAppError(err) ? err.message : '';
      setMessage(reason === 'cancelled' ? t('auth.cancelled') : t('auth.failed'));
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  const continueDemo = () => {
    signInDemo();
    triggerHaptic('success');
    router.replace('/(tabs)/home');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <LensLogo size={84} />
          <Text variant="display" weight="700" style={styles.title}>
            {t('auth.title')}
          </Text>
          <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
            {t('auth.subtitle')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150).duration(500)} style={styles.actions}>
          <Button title={t('auth.connect')} size="lg" onPress={connectLive} loading={loading} />
          <View style={styles.footnoteRow}>
            <LockIcon size={14} color={colors.textSecondary} strokeWidth={1.8} />
            <Text variant="caption" color="secondary" style={styles.footnote}>
              {t('auth.footnote')}
            </Text>
          </View>
          {message ? (
            <Text variant="caption" color="danger" align="center" style={{ marginTop: spacing.md }}>
              {message}
            </Text>
          ) : null}

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: colors.borderStrong }]} />
            <Text variant="captionStrong" color="secondary" style={{ marginHorizontal: spacing.lg }}>
              {upperCase(t('auth.or'), language)}
            </Text>
            <View style={[styles.orLine, { backgroundColor: colors.borderStrong }]} />
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/public')}
            accessibilityRole="button"
            accessibilityLabel={t('auth.public')}
            style={({ pressed }) => [styles.option, { borderColor: colors.borderStrong, backgroundColor: pressed ? colors.surfaceElevated : colors.background }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.secondaryButton }]}>
              <SearchIcon size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('auth.public')}</Text>
              <Text variant="caption" color="secondary" numberOfLines={2}>
                {t('public.subtitle')}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/manual')}
            accessibilityRole="button"
            accessibilityLabel={t('auth.manual')}
            style={({ pressed }) => [styles.option, { borderColor: colors.borderStrong, backgroundColor: pressed ? colors.surfaceElevated : colors.background }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.secondaryButton }]}>
              <UserPlusIcon size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('auth.manual')}</Text>
              <Text variant="caption" color="secondary" numberOfLines={2}>
                {t('manual.subtitle')}
              </Text>
            </View>
          </Pressable>

          {APP_MODE === 'demo' ? (
            <Button title={t('auth.demo')} variant="secondary" size="lg" onPress={continueDemo} style={{ marginTop: spacing.lg }} />
          ) : null}
        </Animated.View>
      </ScrollView>
      <Text variant="small" color="tertiary" align="center" style={styles.version}>
        {APP_NAME} · {APP_MODE.toUpperCase()}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingTop: 72, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center' },
  title: { marginTop: spacing.lg, letterSpacing: -0.5 },
  subtitle: { marginTop: spacing.sm, maxWidth: 300 },
  actions: { marginTop: 48 },
  footnoteRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md, paddingHorizontal: spacing.xs },
  footnote: { flex: 1, marginLeft: spacing.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xxl },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  version: { paddingBottom: spacing.md },
});
