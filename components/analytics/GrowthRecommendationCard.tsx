import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/common/Primitives';
import { Text } from '@/components/common/Text';
import { InfoIcon, SparkIcon, TrendUpIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { upperCase, useLanguage, useT } from '@/i18n';
import type { Recommendation } from '@/types/recommendation';

export function GrowthRecommendationCard({ item }: { item: Recommendation }) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const tone = item.confidence === 'high' ? 'success' : item.confidence === 'medium' ? 'accent' : 'neutral';
  return (
    <View style={[styles.card, { borderColor: item.insufficientData ? colors.border : colors.borderStrong, backgroundColor: colors.background, opacity: item.insufficientData ? 0.85 : 1 }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: item.insufficientData ? colors.secondaryButton : 'rgba(0,149,246,0.12)' }]}>
          {item.insufficientData ? <InfoIcon size={18} color={colors.textSecondary} /> : item.type === 'timing' ? <TrendUpIcon size={18} color={colors.primary} /> : <SparkIcon size={18} color={colors.primary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{item.title}</Text>
          <View style={styles.chips}>
            {item.insufficientData ? (
              <Chip label={t('growth.insufficient')} tone="warning" small />
            ) : (
              <>
                <Chip label={`${t('growth.confidence')}: ${t(`growth.confidence.${item.confidence}`)}`} tone={tone} small />
                <Chip label={`${t('growth.priority')} ${item.priority}`} small />
              </>
            )}
          </View>
        </View>
      </View>
      <Text variant="body" color="secondary" style={styles.body}>
        {item.description}
      </Text>
      <View style={[styles.evidence, { backgroundColor: colors.surfaceElevated }]}>
        <Text variant="small" color="tertiary" style={{ letterSpacing: 0.4 }}>
          {upperCase(t('growth.evidence'), language)}
        </Text>
        <Text variant="caption" style={{ marginTop: 2 }}>
          {item.evidence}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  body: { marginTop: spacing.md },
  evidence: { marginTop: spacing.md, padding: spacing.sm + 2, borderRadius: radius.sm },
});
