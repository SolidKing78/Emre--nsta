import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppHeader } from '@/components/common/AppHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { CameraIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { createManualAccount, signInManual } from '@/services/auth/authService';
import { parseNumericInput } from '@/utils/format';
import { uid } from '@/utils/random';

const numeric = z
  .string()
  .transform((v) => parseNumericInput(v || '0'))
  .refine((v): v is number => v !== null && v >= 0, { message: 'invalid' });

const schema = z.object({
  username: z.string().trim().min(1).max(30).regex(/^[a-zA-Z0-9._]+$/),
  name: z.string().trim().min(1).max(60),
  biography: z.string().max(150),
  website: z.string().trim().max(120),
  category: z.string().trim().max(40),
  followers: numeric,
  following: numeric,
  posts: numeric,
  isVerified: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="caption" color={error ? 'danger' : 'secondary'} style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <View style={[styles.inputWrap, { borderColor: error ? colors.danger : colors.borderStrong, backgroundColor: colors.surfaceElevated }]}>{children}</View>
    </View>
  );
}

export default function ManualProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const [avatarUri, setAvatarUri] = useState<string | undefined>();

  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      name: '',
      biography: '',
      website: '',
      category: '',
      followers: '0',
      following: '0',
      posts: '0',
      isVerified: false,
    },
  });

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      triggerHaptic('selection');
    }
  };

  const onSubmit = (values: FormOutput) => {
    const id = uid('manual');
    const website = values.website ? (values.website.startsWith('http') ? values.website : `https://${values.website}`) : undefined;
    const account = createManualAccount({
      id,
      username: values.username.toLowerCase(),
      name: values.name,
      biography: values.biography,
      website,
      category: values.category || undefined,
      profilePictureUrl: avatarUri ?? '',
      followersCount: values.followers,
      followsCount: values.following,
      mediaCount: values.posts,
      isVerified: values.isVerified,
    });
    signInManual({ id, account, media: [], createdAt: new Date().toISOString() });
    triggerHaptic('success');
    router.replace('/(tabs)/profile');
  };

  const inputStyle = [styles.input, { color: colors.text }];

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title={t('manual.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="body" color="secondary" style={{ marginBottom: spacing.xl }}>
            {t('manual.subtitle')}
          </Text>

          <Pressable onPress={pickAvatar} style={styles.avatarPicker} accessibilityRole="button" accessibilityLabel={t('manual.pickAvatar')}>
            <Avatar uri={avatarUri} size={88} name="?" />
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <CameraIcon size={14} color="#fff" />
            </View>
            <Text variant="captionStrong" color="accent" style={{ marginTop: spacing.sm }}>
              {t('manual.pickAvatar')}
            </Text>
          </Pressable>

          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, value } }) => (
              <Field label={t('manual.username')} error={Boolean(formState.errors.username)}>
                <Text variant="body" color="secondary">
                  @
                </Text>
                <TextInput value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} style={inputStyle} placeholder="username" placeholderTextColor={colors.textTertiary} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <Field label={t('manual.name')} error={Boolean(formState.errors.name)}>
                <TextInput value={value} onChangeText={onChange} style={inputStyle} placeholder={t('manual.name')} placeholderTextColor={colors.textTertiary} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <Field label={`${t('manual.category')} · ${t('common.optional')}`}>
                <TextInput value={value} onChangeText={onChange} style={inputStyle} placeholder="İnşaat şirketi" placeholderTextColor={colors.textTertiary} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="biography"
            render={({ field: { onChange, value } }) => (
              <Field label={t('manual.bio')}>
                <TextInput value={value} onChangeText={onChange} multiline style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]} placeholder={t('manual.bio')} placeholderTextColor={colors.textTertiary} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="website"
            render={({ field: { onChange, value } }) => (
              <Field label={`${t('manual.website')} · ${t('common.optional')}`}>
                <TextInput value={value} onChangeText={onChange} autoCapitalize="none" keyboardType="url" style={inputStyle} placeholder="example.com" placeholderTextColor={colors.textTertiary} />
              </Field>
            )}
          />

          <View style={styles.numbers}>
            {(['posts', 'followers', 'following'] as const).map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field: { onChange, value } }) => (
                  <View style={{ flex: 1 }}>
                    <Field label={t(`manual.${name}`)} error={Boolean(formState.errors[name])}>
                      <TextInput value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" style={inputStyle} placeholder="0" placeholderTextColor={colors.textTertiary} />
                    </Field>
                  </View>
                )}
              />
            ))}
          </View>

          <Controller
            control={control}
            name="isVerified"
            render={({ field: { onChange, value } }) => (
              <View style={styles.switchRow}>
                <Text variant="body">{t('manual.verified')}</Text>
                <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.borderStrong, true: colors.primary }} thumbColor="#fff" />
              </View>
            )}
          />

          <Button title={t('manual.create')} size="lg" onPress={handleSubmit(onSubmit)} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
  avatarPicker: { alignItems: 'center', marginBottom: spacing.xl },
  avatarBadge: { position: 'absolute', top: 62, right: '50%', marginRight: -46, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 46 },
  input: { flex: 1, fontSize: 15, paddingVertical: spacing.sm },
  numbers: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
