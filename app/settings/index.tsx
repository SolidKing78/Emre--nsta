import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Divider, ListRow, SectionTitle, ToggleRow } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { SegmentControl } from '@/components/common/SegmentControl';
import { Text } from '@/components/common/Text';
import { CheckIcon, LockIcon } from '@/components/icons';
import { APP_MODE, APP_NAME } from '@/constants/config';
import { radius, spacing } from '@/constants/theme';
import { useSession } from '@/features/instagram/hooks';
import { useSimulationActions, useSimulationEnabled } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { signOut } from '@/services/auth/authService';
import { dropAllProviders } from '@/services/instagram/providerFactory';
import { useSettingsStore, type EngagementFormula, type Language, type ThemePreference } from '@/store/settingsStore';
import { GROWTH_PRESETS, type GrowthPreset } from '@/types/simulation';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const session = useSession();
  const client = useQueryClient();
  const settings = useSettingsStore();
  const simulationEnabled = useSimulationEnabled();
  const simulation = useSimulationActions();
  const [presetOpen, setPresetOpen] = useState(false);

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];
  const languageOptions: { value: Language; label: string }[] = [
    { value: 'tr', label: t('settings.language.tr') },
    { value: 'en', label: t('settings.language.en') },
  ];
  const formulaOptions: { value: EngagementFormula; label: string }[] = [
    { value: 'reach', label: t('analytics.byReach') },
    { value: 'followers', label: t('analytics.byFollowers') },
  ];

  const resetAll = () =>
    Alert.alert(t('settings.resetSimulations'), t('sim.resetAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: () => {
          simulation.resetAll();
          simulation.clearProfileOverrides();
          triggerHaptic('warning');
        },
      },
    ]);

  const clearCache = async () => {
    client.clear();
    dropAllProviders();
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('sociallens.public.')));
    } catch {
      // ignore
    }
    triggerHaptic('success');
  };

  const logout = () =>
    Alert.alert(t('settings.logout'), t('auth.disconnectConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          client.clear();
          router.replace('/(auth)/connect');
        },
      },
    ]);

  const boxStyle = [styles.box, { borderColor: colors.borderStrong }];

  return (
    <Screen>
      <AppHeader title={t('settings.title')} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <SectionTitle title={t('settings.account')} />
        <View style={boxStyle}>
          <ListRow title={`@${session?.username ?? ''}`} subtitle={`${t('account.source')}: ${t(`common.${session?.source ?? 'demo'}`)}`} onPress={() => router.push('/account')} />
          <Divider inset={spacing.lg} />
          <ListRow title={t('profile.switchAccount')} onPress={() => router.push('/(auth)/connect')} />
          <Divider inset={spacing.lg} />
          <ListRow title={t('settings.logout')} danger onPress={logout} chevron={false} />
        </View>

        <SectionTitle title={t('settings.appearance')} />
        <View style={styles.inlineGroup}>
          <Text variant="caption" color="secondary" style={styles.inlineLabel}>
            {t('settings.theme')}
          </Text>
          <SegmentControl options={themeOptions} value={settings.theme} onChange={settings.setTheme} />
          <Text variant="caption" color="secondary" style={[styles.inlineLabel, { marginTop: spacing.lg }]}>
            {t('settings.language')}
          </Text>
          <SegmentControl options={languageOptions} value={settings.language} onChange={settings.setLanguage} />
        </View>
        <View style={[boxStyle, { marginTop: spacing.md }]}>
          <ToggleRow title={t('settings.hapticFeedback')} value={settings.haptics} onValueChange={settings.setHaptics} />
        </View>

        <SectionTitle title={t('settings.analytics')} />
        <View style={styles.inlineGroup}>
          <Text variant="caption" color="secondary" style={styles.inlineLabel}>
            {t('settings.engagementFormula')}
          </Text>
          <SegmentControl options={formulaOptions} value={settings.engagementFormula} onChange={settings.setEngagementFormula} />
          <Text variant="small" color="tertiary" style={{ marginTop: spacing.sm }}>
            {settings.engagementFormula === 'reach' ? t('analytics.formulaReach') : t('analytics.formulaFollowers')}
          </Text>
        </View>

        <SectionTitle title={t('settings.simulation')} />
        <View style={boxStyle}>
          <ToggleRow title={t('settings.enableSimulation')} value={simulationEnabled} onValueChange={simulation.setEnabled} accent="simulation" />
          <Divider inset={spacing.lg} />
          <ListRow title={t('settings.defaultPreset')} right={<Text variant="body" color="secondary" style={{ marginRight: spacing.sm }}>{settings.defaultGrowthPreset}</Text>} onPress={() => setPresetOpen(true)} />
          <Divider inset={spacing.lg} />
          <ToggleRow title={t('settings.showBadge')} subtitle={t('settings.showBadgeHint')} value={settings.showSimulationBadge} onValueChange={settings.setShowSimulationBadge} accent="simulation" />
          <Divider inset={spacing.lg} />
          <ListRow title={t('settings.resetSimulations')} danger chevron={false} onPress={resetAll} />
        </View>

        <SectionTitle title={t('settings.security')} />
        <View style={[styles.securityBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <LockIcon size={18} color={colors.textSecondary} />
          <Text variant="caption" color="secondary" style={{ flex: 1, marginLeft: spacing.sm }}>
            {t('settings.securityNote')}
          </Text>
        </View>
        <View style={[boxStyle, { marginTop: spacing.md }]}>
          <ListRow title={t('settings.privacy')} subtitle={t('settings.privacyNote')} chevron={false} />
          <Divider inset={spacing.lg} />
          <ListRow title={t('settings.clearCache')} chevron={false} onPress={clearCache} />
        </View>

        <SectionTitle title={t('settings.about')} />
        <View style={boxStyle}>
          <ListRow title={APP_NAME} subtitle={t('brand.tagline')} chevron={false} />
          <Divider inset={spacing.lg} />
          <ListRow title={t('settings.version')} right={<Text variant="body" color="secondary">{Constants.expoConfig?.version ?? '1.0.0'}</Text>} chevron={false} />
          <Divider inset={spacing.lg} />
          <ListRow title={t('settings.mode')} right={<Text variant="body" color="secondary">{APP_MODE.toUpperCase()}</Text>} chevron={false} />
        </View>
      </ScrollView>

      <BottomSheet visible={presetOpen} onClose={() => setPresetOpen(false)} title={t('settings.defaultPreset')}>
        {GROWTH_PRESETS.map((p) => (
          <ListRow
            key={p.label}
            title={p.label}
            chevron={false}
            right={p.label === settings.defaultGrowthPreset ? <CheckIcon size={18} color={colors.primary} /> : null}
            onPress={() => {
              settings.setDefaultGrowthPreset(p.label as GrowthPreset);
              setPresetOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden' },
  inlineGroup: { paddingHorizontal: spacing.lg },
  inlineLabel: { marginBottom: spacing.xs },
  securityBox: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
