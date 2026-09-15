import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import type { AppHighlight } from '@/types/app';

interface HighlightsRowProps {
  highlights: readonly AppHighlight[];
  showNew?: boolean;
}

export function HighlightsRow({ highlights, showNew = true }: HighlightsRowProps) {
  const { colors } = useTheme();
  const t = useT();
  if (highlights.length === 0 && !showNew) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
      {showNew ? (
        <View style={styles.item}>
          <View style={[styles.newCircle, { borderColor: colors.borderStrong }]}>
            <Text variant="heading" color="primary" style={{ fontWeight: '300', fontSize: 28 }}>
              +
            </Text>
          </View>
          <Text variant="small" numberOfLines={1} style={styles.label}>
            {t('profile.newHighlight')}
          </Text>
        </View>
      ) : null}
      {highlights.map((h) => (
        <PressableScale key={h.id} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={h.title} style={styles.item}>
          <View style={[styles.ring, { borderColor: colors.borderStrong }]}>
            <Image source={{ uri: h.coverUrl }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" transition={120} />
          </View>
          <Text variant="small" numberOfLines={1} style={styles.label}>
            {h.title}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const SIZE = 64;

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  item: { width: 76, alignItems: 'center' },
  ring: { width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  newCircle: { width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: spacing.xs, fontSize: 12 },
});
