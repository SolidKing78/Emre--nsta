import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { Chip } from '@/components/common/Primitives';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { Sparkline } from '@/components/charts/Sparkline';
import { EditIcon, TrendDownIcon, TrendUpIcon } from '@/components/icons';
import { metricLabelKey, useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing, touch } from '@/constants/theme';
import type { DisplayMetric } from '@/features/simulation/useSimulation';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { SimulationScope } from '@/types/simulation';
import { formatPercent, percentChange } from '@/utils/format';

interface MetricCardProps {
  metric: DisplayMetric;
  scope: SimulationScope;
  periodLabel?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  onPress?: () => void;
  /** Hide the estimated/simulated chip (e.g. inside a share card). */
  hideChips?: boolean;
}

/**
 * KPI card: metric · value · change vs previous period · sparkline.
 * Long-press (or the edit icon in Simulation Mode) opens the metric editor.
 */
export function MetricCard({ metric, scope, periodLabel, style, compact = false, onPress, hideChips }: MetricCardProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const editor = useMetricEditor();
  const indicators = useSimulationIndicators();
  const change = percentChange(metric.value, metric.previousValue);
  const positive = change !== null && change > 0;
  const negative = change !== null && change < 0;
  const flagged = indicators && metric.isSimulated;
  const accent = flagged ? colors.simulation : colors.chart;

  const openEditor = () => editor.open({ scope, metric: metric.key, realValue: metric.realValue });

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={openEditor}
      delayLongPress={touch.longPressMs}
      scaleTo={0.98}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={`${t(metricLabelKey(metric.key))} ${metric.value}`}
      accessibilityHint={t('sim.longPressHint')}
      style={[
        styles.card,
        compact && styles.compact,
        { backgroundColor: colors.background, borderColor: flagged ? colors.simulation : colors.borderStrong },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <Text variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {t(metricLabelKey(metric.key))}
        </Text>
        {!hideChips && flagged ? <Chip label={t('sim.badge')} tone="simulation" small /> : null}
        {indicators && !metric.isSimulated ? <EditIcon size={14} color={colors.textTertiary} /> : null}
      </View>
      <StatCounter value={metric.value} variant={compact ? 'heading' : 'metric'} weight="700" style={{ marginTop: compact ? 2 : spacing.xs }} />
      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          {change !== null ? (
            <View style={styles.changeRow}>
              {positive ? <TrendUpIcon color={colors.success} /> : negative ? <TrendDownIcon color={colors.danger} /> : null}
              <Text variant="captionStrong" color={positive ? 'success' : negative ? 'danger' : 'secondary'} style={{ marginLeft: 3 }}>
                {formatPercent(change, language)}
              </Text>
            </View>
          ) : null}
          {periodLabel ? (
            <Text variant="small" color="tertiary" numberOfLines={1}>
              {periodLabel}
            </Text>
          ) : null}
        </View>
        {metric.series && metric.series.length > 1 ? <Sparkline data={metric.series} color={accent} id={`spark-${metric.key}`} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, minHeight: 128 },
  compact: { minHeight: 104, padding: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  changeRow: { flexDirection: 'row', alignItems: 'center' },
});
