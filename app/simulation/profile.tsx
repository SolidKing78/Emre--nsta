import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { CameraIcon } from '@/components/icons';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { SimulationBanner } from '@/components/simulation/SimulationBadge';
import { radius, spacing } from '@/constants/theme';
import { useAccount, useSession } from '@/features/instagram/hooks';
import { ACCOUNT_SCOPE, useEffectiveAccount, useProfileOverrides, useSimulationActions, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { useManualProfileStore } from '@/store/manualProfileStore';
import { formatNumber } from '@/utils/format';

/**
 * Edit the profile as it appears in Simulation Mode (name, bio, avatar, verified…).
 * For manual profiles the edits are written to the profile itself.
 */
export default function SimulatedProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const session = useSession();
  const { data: account } = useAccount();
  const effective = useEffectiveAccount(account);
  const overrides = useProfileOverrides();
  const actions = useSimulationActions();
  const editor = useMetricEditor();
  const indicators = useSimulationIndicators();
  const updateManual = useManualProfileStore((s) => s.updateAccount);
  const isManual = session?.source === 'manual';

  const base = effective ?? account;
  const [name, setName] = useState(overrides.name ?? base?.name ?? '');
  const [category, setCategory] = useState(overrides.category ?? base?.category ?? '');
  const [bio, setBio] = useState(overrides.biography ?? base?.biography ?? '');
  const [website, setWebsite] = useState(overrides.website ?? base?.website ?? '');
  const [verified, setVerified] = useState(overrides.isVerified ?? base?.isVerified ?? false);
  const [avatar, setAvatar] = useState<string | undefined>(overrides.profilePictureUri ?? base?.profilePictureUrl);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
      triggerHaptic('selection');
    }
  };

  const save = () => {
    const site = website.trim() ? (website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`) : undefined;
    if (isManual && session?.accountId) {
      updateManual(session.accountId, { name, category: category || undefined, biography: bio, website: site, isVerified: verified, profilePictureUrl: avatar ?? '' });
    } else {
      actions.setProfileOverrides({ name, category: category || undefined, biography: bio, website: site, isVerified: verified, profilePictureUri: avatar });
      actions.setEnabled(true);
    }
    triggerHaptic('success');
    router.back();
  };

  const reset = () => {
    actions.clearProfileOverrides();
    triggerHaptic('warning');
    router.back();
  };

  const inputStyle = [styles.input, { borderColor: colors.borderStrong, color: colors.text, backgroundColor: colors.surfaceElevated }];

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title={t('sim.editProfile')} showBack />
      {!isManual && indicators ? <SimulationBanner /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={pickAvatar} style={styles.avatarPicker} accessibilityRole="button" accessibilityLabel={t('manual.pickAvatar')}>
            <Avatar uri={avatar} size={88} name={name} />
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <CameraIcon size={14} color="#fff" />
            </View>
            <Text variant="captionStrong" color="accent" style={{ marginTop: spacing.sm }}>
              {t('manual.pickAvatar')}
            </Text>
          </Pressable>

          {account ? (
            <View style={styles.statsRow}>
              {(
                [
                  { key: 'media_count', label: t('profile.posts'), value: effective?.mediaCount ?? 0, real: account.mediaCount },
                  { key: 'followers', label: t('profile.followers'), value: effective?.followersCount ?? 0, real: account.followersCount },
                  { key: 'following', label: t('profile.following'), value: effective?.followsCount ?? 0, real: account.followsCount },
                ] as const
              ).map((stat) => (
                <Pressable
                  key={stat.key}
                  onPress={() => editor.open({ scope: ACCOUNT_SCOPE, metric: stat.key, realValue: stat.real })}
                  style={[styles.stat, { borderColor: colors.borderStrong }]}
                  accessibilityRole="button"
                  accessibilityLabel={stat.label}
                >
                  <Text variant="title" weight="700" color={stat.value !== stat.real ? 'simulation' : 'primary'}>
                    {formatNumber(stat.value, language)}
                  </Text>
                  <Text variant="small" color="secondary">
                    {stat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text variant="caption" color="secondary" style={styles.label}>
            {t('manual.name')}
          </Text>
          <TextInput value={name} onChangeText={setName} style={inputStyle} placeholderTextColor={colors.textTertiary} />
          <Text variant="caption" color="secondary" style={styles.label}>
            {t('manual.category')}
          </Text>
          <TextInput value={category} onChangeText={setCategory} style={inputStyle} placeholder="—" placeholderTextColor={colors.textTertiary} />
          <Text variant="caption" color="secondary" style={styles.label}>
            {t('manual.bio')}
          </Text>
          <TextInput value={bio} onChangeText={setBio} multiline style={[...inputStyle, { minHeight: 90, textAlignVertical: 'top' }]} placeholderTextColor={colors.textTertiary} />
          <Text variant="caption" color="secondary" style={styles.label}>
            {t('manual.website')}
          </Text>
          <TextInput value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" style={inputStyle} placeholder="example.com" placeholderTextColor={colors.textTertiary} />
          <View style={styles.switchRow}>
            <Text variant="body">{t('manual.verified')}</Text>
            <Switch value={verified} onValueChange={setVerified} trackColor={{ false: colors.borderStrong, true: colors.simulation }} thumbColor="#fff" />
          </View>

          <Button title={t('common.save')} variant={isManual ? 'primary' : 'simulation'} size="lg" onPress={save} style={{ marginTop: spacing.xl }} />
          {!isManual ? <Button title={t('sim.resetToReal')} variant="secondary" size="lg" onPress={reset} style={{ marginTop: spacing.sm }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
  avatarPicker: { alignItems: 'center', marginBottom: spacing.lg },
  avatarBadge: { position: 'absolute', top: 62, right: '50%', marginRight: -46, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: spacing.sm },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, marginTop: spacing.sm },
});
