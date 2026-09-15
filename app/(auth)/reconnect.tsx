import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { LockIcon } from '@/components/icons';
import { APP_MODE } from '@/constants/config';
import { spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { signInDemo, signInLive, signOut } from '@/services/auth/authService';

/** Shown when a live Instagram authorization has expired (OAuth expired state). */
export default function ReconnectScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const reconnect = async () => {
    setLoading(true);
    setFailed(false);
    try {
      await signInLive();
      triggerHaptic('success');
      router.replace('/(tabs)/home');
    } catch {
      setFailed(true);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={[styles.ring, { borderColor: colors.text }]}>
          <LockIcon size={34} color={colors.text} strokeWidth={1.5} />
        </View>
        <Text variant="heading" weight="700" align="center">
          {t('auth.reconnectTitle')}
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ marginTop: spacing.sm }}>
          {t('auth.reconnectBody')}
        </Text>
        {failed ? (
          <Text variant="caption" color="danger" align="center" style={{ marginTop: spacing.md }}>
            {t('auth.failed')}
          </Text>
        ) : null}
        <Button title={t('auth.reconnect')} size="lg" onPress={reconnect} loading={loading} style={{ marginTop: spacing.xxl, alignSelf: 'stretch' }} />
        {APP_MODE === 'demo' ? (
          <Button
            title={t('auth.switchToDemo')}
            variant="secondary"
            size="lg"
            onPress={() => {
              signInDemo();
              router.replace('/(tabs)/home');
            }}
            style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
          />
        ) : null}
        <Button
          title={t('auth.disconnect')}
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/connect');
          }}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  ring: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
});
