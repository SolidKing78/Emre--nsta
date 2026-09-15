import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { PressableScale } from '@/components/common/PressableScale';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import type { AppStory } from '@/types/app';

interface StoriesRowProps {
  stories: readonly AppStory[];
  onPressStory?: (story: AppStory) => void;
}

/** Horizontal story avatars (Instagram feed top). Self story shows the "+" badge. */
export function StoriesRow({ stories, onPressStory }: StoriesRowProps) {
  const { colors } = useTheme();
  const t = useT();
  if (stories.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} style={[styles.root, { borderBottomColor: colors.border }]}>
      {stories.map((story) => (
        <PressableScale
          key={story.id}
          onPress={() => onPressStory?.(story)}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={story.isSelf ? t('feed.yourStory') : story.username}
          style={styles.item}
        >
          <View>
            <Avatar uri={story.avatarUrl} size={64} ring={story.isSelf ? 'none' : story.seen ? 'seen' : 'gradient'} name={story.username} />
            {story.isSelf ? (
              <View style={[styles.plus, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text variant="small" style={styles.plusText}>
                  +
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="small" numberOfLines={1} style={styles.label} color={story.isSelf ? 'primary' : 'primary'}>
            {story.isSelf ? t('feed.yourStory') : story.username}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  item: { width: 82, alignItems: 'center' },
  label: { marginTop: spacing.xs, maxWidth: 76, fontSize: 12 },
  plus: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 16 },
});
