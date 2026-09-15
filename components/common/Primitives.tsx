import React from 'react';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { radius, spacing, touch } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }, style]} />;
}

interface ChipProps {
  label: string;
  tone?: 'neutral' | 'simulation' | 'success' | 'warning' | 'danger' | 'accent';
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, tone = 'neutral', small = false, style }: ChipProps) {
  const { colors } = useTheme();
  const palette = {
    neutral: { bg: colors.secondaryButton, fg: colors.textSecondary },
    simulation: { bg: colors.simulationSoft, fg: colors.simulation },
    success: { bg: 'rgba(31,168,85,0.14)', fg: colors.success },
    warning: { bg: 'rgba(242,169,59,0.16)', fg: colors.warning },
    danger: { bg: 'rgba(237,73,86,0.14)', fg: colors.danger },
    accent: { bg: 'rgba(0,149,246,0.14)', fg: colors.primary },
  }[tone];
  return (
    <View style={[styles.chip, small && styles.chipSmall, { backgroundColor: palette.bg }, style]}>
      <Text variant={small ? 'small' : 'captionStrong'} style={{ color: palette.fg, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
}

export function ListRow({ title, subtitle, icon, right, onPress, chevron = Boolean(onPress), danger, accessibilityLabel }: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowText}>
        <Text variant="body" color={danger ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="secondary" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRightIcon color={colors.textTertiary} size={16} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      {content}
    </PressableScale>
  );
}

interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accent?: 'default' | 'simulation';
}

export function ToggleRow({ title, subtitle, value, onValueChange, disabled, accent = 'default' }: ToggleRowProps) {
  const { colors } = useTheme();
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      chevron={false}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.borderStrong, true: accent === 'simulation' ? colors.simulation : colors.primary }}
          thumbColor="#FFFFFF"
          accessibilityLabel={title}
        />
      }
    />
  );
}

export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text variant="title">{title}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, tone = 'default' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'simulation' }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.background, borderColor: tone === 'simulation' ? colors.simulation : colors.borderStrong },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipSmall: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touch.minTarget + 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  rowIcon: { width: 28, marginRight: spacing.md, alignItems: 'center' },
  rowText: { flex: 1, marginRight: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg },
});
