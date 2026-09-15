import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { SegmentControl } from '@/components/common/SegmentControl';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { ImageIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useSession } from '@/features/instagram/hooks';
import { useSimulationActions } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useManualProfileStore } from '@/store/manualProfileStore';
import type { AppMedia } from '@/types/app';
import type { SimulatedMedia } from '@/types/simulation';
import { parseNumericInput } from '@/utils/format';
import { uid } from '@/utils/random';

type PostType = SimulatedMedia['type'];

/**
 * Adds a LOCAL post. For manual profiles it becomes part of the profile; for every
 * other source it lives only in the simulation overlay (and is marked as such).
 */
export default function NewSimulatedPostScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const session = useSession();
  const actions = useSimulationActions();
  const addManualMedia = useManualProfileStore((s) => s.addMedia);
  const [uri, setUri] = useState<string | null>(null);
  const [type, setType] = useState<PostType>('IMAGE');
  const [caption, setCaption] = useState('');
  const [likes, setLikes] = useState('0');
  const [comments, setComments] = useState('0');
  const [views, setViews] = useState('');

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: type === 'REEL' ? [9, 16] : [4, 5], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
      triggerHaptic('selection');
    }
  };

  const save = () => {
    if (!uri || !session) return;
    const id = uid('sim');
    const likeCount = parseNumericInput(likes) ?? 0;
    const commentCount = parseNumericInput(comments) ?? 0;
    const viewCount = views ? (parseNumericInput(views) ?? undefined) : undefined;
    const timestamp = new Date().toISOString();
    if (session.source === 'manual' && session.accountId) {
      const media: AppMedia = {
        id,
        type,
        permalink: '',
        mediaUrl: uri,
        thumbnailUrl: uri,
        caption,
        timestamp,
        likeCount,
        commentCount,
        viewCount,
        username: session.username,
        aspectRatio: type === 'REEL' || type === 'VIDEO' ? 9 / 16 : 4 / 5,
        source: 'manual',
      };
      addManualMedia(session.accountId, media);
    } else {
      actions.addSimulatedMedia({ id, type, localUri: uri, caption, timestamp, likeCount, commentCount, viewCount });
      actions.setEnabled(true);
    }
    triggerHaptic('success');
    router.back();
  };

  const inputStyle = [styles.input, { borderColor: colors.borderStrong, color: colors.text, backgroundColor: colors.surfaceElevated }];

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title={t('sim.addPost')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="caption" color="secondary" style={{ marginBottom: spacing.lg }}>
            {t('sim.addPostHint')}
          </Text>
          <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel={t('sim.pickImage')} style={[styles.picker, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated, aspectRatio: type === 'REEL' ? 9 / 16 : 4 / 5 }]}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <>
                <ImageIcon size={36} color={colors.textSecondary} strokeWidth={1.5} />
                <Text variant="captionStrong" color="accent" style={{ marginTop: spacing.sm }}>
                  {t('sim.pickImage')}
                </Text>
              </>
            )}
          </Pressable>

          <Text variant="caption" color="secondary" style={styles.label}>
            {t('sim.type')}
          </Text>
          <SegmentControl
            value={type}
            onChange={setType}
            options={[
              { value: 'IMAGE', label: t('type.IMAGE') },
              { value: 'CAROUSEL_ALBUM', label: t('type.CAROUSEL_ALBUM') },
              { value: 'REEL', label: t('type.REEL') },
            ]}
          />

          <Text variant="caption" color="secondary" style={styles.label}>
            {t('sim.caption')}
          </Text>
          <TextInput value={caption} onChangeText={setCaption} multiline style={[...inputStyle, { minHeight: 80, textAlignVertical: 'top' }]} placeholder={t('sim.caption')} placeholderTextColor={colors.textTertiary} />

          <View style={styles.numbers}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="secondary" style={styles.label}>
                {t('metric.likes')}
              </Text>
              <TextInput value={likes} onChangeText={setLikes} keyboardType="numbers-and-punctuation" style={inputStyle} placeholder="0" placeholderTextColor={colors.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="secondary" style={styles.label}>
                {t('metric.comments')}
              </Text>
              <TextInput value={comments} onChangeText={setComments} keyboardType="numbers-and-punctuation" style={inputStyle} placeholder="0" placeholderTextColor={colors.textTertiary} />
            </View>
            {type === 'REEL' ? (
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="secondary" style={styles.label}>
                  {t('metric.views')}
                </Text>
                <TextInput value={views} onChangeText={setViews} keyboardType="numbers-and-punctuation" style={inputStyle} placeholder="0" placeholderTextColor={colors.textTertiary} />
              </View>
            ) : null}
          </View>

          <Button title={t('common.save')} variant="simulation" size="lg" onPress={save} disabled={!uri} style={{ marginTop: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
  picker: { width: '60%', alignSelf: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15 },
  numbers: { flexDirection: 'row', gap: spacing.sm },
});
