import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { upperCase, useLanguage } from '@/i18n';

import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  /** 'pill' = iOS style sliding pill; 'underline' = Instagram profile tab indicator. */
  variant?: 'pill' | 'underline';
  accent?: 'default' | 'simulation';
}

export function SegmentControl<T extends string>({ options, value, onChange, style, variant = 'pill', accent = 'default' }: SegmentControlProps<T>) {
  const { colors } = useTheme();
  const language = useLanguage();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = options.length > 0 ? width / options.length : 0;
  const x = useSharedValue(index * segment);

  useEffect(() => {
    x.value = withSpring(index * segment, { damping: 20, stiffness: 240 });
  }, [index, segment, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const accentColor = accent === 'simulation' ? colors.simulation : colors.text;

  if (variant === 'underline') {
    return (
      <View style={[styles.underlineRoot, { borderBottomColor: colors.border }, style]} onLayout={onLayout}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              style={styles.underlineItem}
              onPress={() => {
                triggerHaptic('selection');
                onChange(option.value);
              }}
            >
              <Text variant="captionStrong" style={{ color: active ? colors.text : colors.textTertiary, letterSpacing: 0.4 }}>
                {upperCase(option.label, language)}
              </Text>
            </Pressable>
          );
        })}
        {segment > 0 ? (
          <Animated.View style={[styles.underline, { width: segment, backgroundColor: accentColor }, indicator]} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.pillRoot, { backgroundColor: colors.secondaryButton }, style]} onLayout={onLayout}>
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.pill,
            { width: segment - 4, backgroundColor: accent === 'simulation' ? colors.simulation : colors.background },
            indicator,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        const color = active ? (accent === 'simulation' ? colors.onPrimary : colors.text) : colors.textSecondary;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={styles.pillItem}
            onPress={() => {
              triggerHaptic('selection');
              onChange(option.value);
            }}
          >
            <Text variant="captionStrong" style={{ color }} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pillRoot: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 2, height: 36, position: 'relative' },
  pill: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: radius.sm, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  pillItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  underlineRoot: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, position: 'relative' },
  underlineItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 },
  underline: { position: 'absolute', bottom: -StyleSheet.hairlineWidth, left: 0, height: 1.5 },
});
