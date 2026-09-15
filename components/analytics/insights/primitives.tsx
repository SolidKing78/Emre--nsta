import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/common/Text';
import { ChevronDownIcon, InfoIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/i18n';
import { formatCompact } from '@/utils/format';

/* ---------------- Top tabs: Genel bakış | İçerik | Hedef kitle ---------------- */

export interface TopTab<T extends string> {
  value: T;
  label: string;
}

export function TopTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly TopTab<T>[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const segment = tabs.length ? width / tabs.length : 0;
  const x = useSharedValue(index * segment);
  useEffect(() => {
    x.value = withSpring(index * segment, { damping: 22, stiffness: 260 });
  }, [index, segment, x]);
  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[styles.tabs, { borderBottomColor: colors.border }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
            onPress={() => {
              if (!active) triggerHaptic('selection');
              onChange(tab.value);
            }}
          >
            <Text variant="body" weight={active ? '600' : '400'} color={active ? 'primary' : 'secondary'}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      {segment > 0 ? <Animated.View style={[styles.underline, { width: segment - spacing.lg * 2, marginLeft: spacing.lg, backgroundColor: colors.text }, underline]} /> : null}
    </View>
  );
}

/* ---------------- Section heading with ⓘ ---------------- */

export function SectionHeading({ title, onInfo, right, style }: { title: string; onInfo?: () => void; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.heading, style]}>
      <View style={styles.headingLeft}>
        <Text variant="heading" weight="600">
          {title}
        </Text>
        {onInfo ? (
          <Pressable onPress={onInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel="info" style={{ marginLeft: spacing.sm }}>
            <InfoIcon size={18} color={colors.text} strokeWidth={1.6} />
          </Pressable>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/* ---------------- Dropdown button: "30 gün ▾" ---------------- */

export function DropdownButton({ label, onPress, large = false }: { label: string; onPress: () => void; large?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.dropdown}>
      <Text variant={large ? 'heading' : 'body'} weight={large ? '600' : '400'} color={large ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <ChevronDownIcon size={large ? 18 : 16} color={large ? colors.text : colors.textSecondary} />
    </Pressable>
  );
}

/* ---------------- Pill chips ---------------- */

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function ChipRow<T extends string>({ options, value, onChange, style }: { options: readonly ChipOption<T>[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) triggerHaptic('selection');
              onChange(o.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[styles.chip, { backgroundColor: active ? colors.secondaryButton : 'transparent', borderColor: active ? colors.secondaryButton : colors.borderStrong }]}
          >
            {o.icon ? <View style={{ marginRight: 6 }}>{o.icon}</View> : null}
            <Text variant="bodyStrong">{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ---------------- Legend ---------------- */

export function LegendDots({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text variant="body" color="secondary">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------- Horizontal bars (content type / demographics) ---------------- */

export interface BarRow {
  label: string;
  value: number;
  /** Optional split 0..1 rendered as the lighter tail of the bar. */
  split?: number;
  /** Format override (e.g. percent). */
  display?: string;
}

export function InsightBars({ rows, max, colorA, colorB }: { rows: BarRow[]; max?: number; colorA?: string; colorB?: string }) {
  const { colors } = useTheme();
  const language = useLanguage();
  const top = Math.max(1, max ?? Math.max(...rows.map((r) => r.value), 0));
  const a = colorA ?? colors.chartLine;
  const b = colorB ?? colors.chartLineSoft;
  return (
    <View>
      {rows.map((row) => {
        const width = Math.min(100, (row.value / top) * 100);
        const splitWidth = row.split !== undefined ? width * Math.min(1, Math.max(0, row.split)) : width;
        return (
          <View key={row.label} style={styles.barRow}>
            <Text variant="body" style={{ marginBottom: 6 }}>
              {row.label}
            </Text>
            <View style={styles.barLine}>
              <View style={[styles.track, { backgroundColor: colors.secondaryButton }]}>
                <View style={[styles.fill, { width: `${width}%`, backgroundColor: b }]} />
                <View style={[styles.fill, { width: `${splitWidth}%`, backgroundColor: a }]} />
              </View>
              <Text variant="bodyStrong" style={styles.barValue}>
                {row.display ?? formatCompact(row.value, language)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Thick separator between Instagram insight sections. */
export function ThickDivider() {
  const { colors } = useTheme();
  return <View style={{ height: 6, backgroundColor: colors.surfaceElevated, marginVertical: spacing.md }} />;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, position: 'relative' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48 },
  underline: { position: 'absolute', bottom: -StyleSheet.hairlineWidth, left: 0, height: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  headingLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, borderWidth: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  barRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  barLine: { flexDirection: 'row', alignItems: 'center' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  barValue: { minWidth: 56, textAlign: 'right', marginLeft: spacing.md },
});
