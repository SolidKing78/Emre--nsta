import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { Chip } from '@/components/common/Primitives';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { ChevronRightIcon, EditIcon } from '@/components/icons';
import { metricLabelKey, useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { spacing, touch } from '@/constants/theme';
import type { DisplayMetric } from '@/features/simulation/useSimulation';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { SimulationScope } from '@/types/simulation';
import { formatDuration, formatPercent, percentChange } from '@/utils/format';

interface MetricRowProps {
  metric: DisplayMetric;
  scope: SimulationScope;
  subtitle?: string;
  onPress?: () => void;
  last?: boolean;
  /** For the Instagram-style insights list (bold label, big value). */
  emphasized?: boolean;
  editable?: boolean;
  chevron?: boolean;
}

/** Instagram insights list row: label left, value right; long-press to simulate. */
export function MetricRow({ metric, scope, subtitle, onPress, last, emphasized, editable = true, chevron }: MetricRowProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const editor = useMetricEditor();
  const indicators = useSimulationIndicators();
  const flagged = indicators && metric.isSimulated;
  const change = percentChange(metric.value, metric.previousValue);
  const isDuration = metric.key === 'avg_watch_time';

  const openEditor = editable ? () => editor.open({ scope, metric: metric.key, realValue: metric.realValue, subtitle }) : undefined;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={openEditor}
      delayLongPress={touch.longPressMs}
      scaleTo={0.995}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={`${t(metricLabelKey(metric.key))} ${metric.value}`}
      style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    >
      <View style={styles.left}>
        <View style={styles.labelRow}>
          <Text variant={emphasized ? 'bodyStrong' : 'body'}>{t(metricLabelKey(metric.key))}</Text>
          {flagged ? <Chip label={t('sim.badge')} tone="simulation" small style={{ marginLeft: spacing.sm }} /> : null}
        </View>
        {subtitle ? (
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {isDuration ? (
          <Text variant={emphasized ? 'title' : 'bodyStrong'} weight="700" color={flagged ? 'simulation' : 'primary'}>
            {formatDuration(metric.value)}
          </Text>
        ) : (
          <StatCounter value={metric.value} format="full" variant={emphasized ? 'title' : 'bodyStrong'} weight="700" color={flagged ? 'simulation' : 'primary'} />
        )}
        {change !== null ? (
          <Text variant="small" color={change > 0 ? 'success' : change < 0 ? 'danger' : 'tertiary'}>
            {formatPercent(change, language)}
          </Text>
        ) : null}
      </View>
      {chevron ? <ChevronRightIcon size={16} color={colors.textTertiary} /> : indicators && editable ? <EditIcon size={16} color={colors.textTertiary} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touch.minTarget + 8, paddingVertical: spacing.md, gap: spacing.md },
  left: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  right: { alignItems: 'flex-end' },
});
