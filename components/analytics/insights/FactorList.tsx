import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/common/Text';
import { BookmarkIcon, CommentIcon, HeartIcon, RepostIcon, ShareIcon, SkipRateIcon } from '@/components/icons';
import { spacing, touch } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT, type TranslationKey } from '@/i18n';
import type { FactorKey, ViewFactor } from '@/services/analytics/reelInsights';

const TREND_LABEL: Record<ViewFactor['trend'], TranslationKey> = {
  higher: 'postInsights.trendHigher',
  average: 'postInsights.trendAverage',
  lower: 'postInsights.trendLower',
};

function FactorIcon({ factor, color }: { factor: FactorKey; color: string }) {
  switch (factor) {
    case 'skip':
      return <SkipRateIcon size={22} color={color} strokeWidth={1.8} />;
    case 'shares':
      return <ShareIcon size={22} color={color} strokeWidth={1.7} />;
    case 'likes':
      return <HeartIcon size={22} color={color} strokeWidth={1.7} />;
    case 'saves':
      return <BookmarkIcon size={22} color={color} strokeWidth={1.7} />;
    case 'reposts':
      return <RepostIcon size={22} color={color} strokeWidth={1.7} />;
    default:
      return <CommentIcon size={22} color={color} strokeWidth={1.7} />;
  }
}

interface FactorListProps {
  factors: readonly ViewFactor[];
  /** Percent formatter shared with the rest of the screen. */
  format: (value: number) => string;
  /** Long-press a row to set its rate by hand. */
  onEdit?: (factor: ViewFactor) => void;
  /** Paints hand-set rows in the scenario colour. */
  indicators?: boolean;
}

/**
 * Instagram's "Görüntülemelerini etkileyen faktörler": a circled icon, the rate, and how
 * it compares with the account's usual numbers. Only good news is painted green — a
 * higher skip rate is still just grey.
 */
export function FactorList({ factors, format, onEdit, indicators = false }: FactorListProps) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View>
      {factors.map((factor) => (
        <Pressable
          key={factor.key}
          onLongPress={onEdit ? () => onEdit(factor) : undefined}
          delayLongPress={touch.longPressMs}
          accessibilityRole="button"
          accessibilityLabel={`${t(`postInsights.factor.${factor.key}`)} ${format(factor.percent)}`}
          style={styles.row}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
            <FactorIcon factor={factor.key} color={colors.text} />
          </View>
          <Text variant="bodyStrong" style={styles.label} numberOfLines={2}>
            {t(`postInsights.factor.${factor.key}`)}
          </Text>
          <View style={styles.values}>
            <Text variant="heading" weight="700" color={indicators && factor.isCustom ? 'simulation' : 'primary'}>
              {format(factor.percent)}
            </Text>
            <Text variant="caption" color={factor.positive ? 'success' : 'secondary'}>
              {t(TREND_LABEL[factor.trend])}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  label: { flex: 1, fontSize: 16 },
  values: { alignItems: 'flex-end', marginLeft: spacing.sm },
});
