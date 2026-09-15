import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/common/Text';
import { FlaskIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useLanguage, useT } from '@/i18n';
import { formatCompact, formatPercent } from '@/utils/format';

export interface CompareRow {
  label: string;
  real: number;
  simulated: number;
}

interface CompareTableProps {
  rows: readonly CompareRow[];
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  /** Screenshot-friendly variant with brand footer. */
  card?: boolean;
}

/**
 *          REAL       SIMULATION
 * Views    12.4K       50K
 * Designed to be screenshot-worthy; the SIMULATION column is always labelled.
 */
export function CompareTable({ rows, title, subtitle, style, card = true }: CompareTableProps) {
  const { colors } = useTheme();
  const language = useLanguage();
  const t = useT();
  const indicators = useSimulationIndicators();
  return (
    <View style={[card && styles.card, card && { backgroundColor: colors.background, borderColor: colors.borderStrong }, style]}>
      {title ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="title" weight="700">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" color="secondary">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {indicators ? (
            <View style={[styles.badge, { backgroundColor: colors.simulation }]}>
              <FlaskIcon size={11} color="#fff" strokeWidth={2.4} />
              <Text variant="small" style={styles.badgeText}>
                {t('sim.badge')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.row, styles.headRow, { borderBottomColor: colors.border }]}>
        <Text variant="small" color="tertiary" style={styles.labelCol} />
        <Text variant="small" color="secondary" style={styles.valueCol} align="right">
          {t('sim.real')}
        </Text>
        <Text variant="small" color={indicators ? 'simulation' : 'secondary'} style={[styles.valueCol, { fontWeight: '700' }]} align="right">
          {t('sim.simulated')}
        </Text>
        <Text variant="small" color="tertiary" style={styles.deltaCol} align="right">
          Δ
        </Text>
      </View>
      {rows.map((row, i) => {
        const delta = row.real > 0 ? ((row.simulated - row.real) / row.real) * 100 : null;
        const changed = row.simulated !== row.real;
        return (
          <View key={`${row.label}-${i}`} style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: i === rows.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
            <Text variant="body" style={styles.labelCol} numberOfLines={1}>
              {row.label}
            </Text>
            <Text variant="bodyStrong" color="secondary" style={styles.valueCol} align="right">
              {formatCompact(row.real, language)}
            </Text>
            <Text variant="bodyStrong" color={changed && indicators ? 'simulation' : 'primary'} style={styles.valueCol} align="right">
              {formatCompact(row.simulated, language)}
            </Text>
            <Text variant="small" color={delta === null || delta === 0 ? 'tertiary' : delta > 0 ? 'success' : 'danger'} style={styles.deltaCol} align="right">
              {delta === null ? '—' : delta === 0 ? '0%' : formatPercent(delta, language, 0)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontWeight: '700', marginLeft: 4, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headRow: { paddingVertical: spacing.sm },
  labelCol: { flex: 1.4 },
  valueCol: { flex: 1 },
  deltaCol: { width: 52 },
});
