import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/common/Text';
import { FlaskIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

interface SimulationBadgeProps {
  /** 'floating' pins the badge to the top-right of its parent. */
  mode?: 'inline' | 'floating';
  long?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Mandatory visual marker whenever scenario data is on screen.
 * Uses icon + text (never colour alone) so it stays accessible.
 */
export function SimulationBadge({ mode = 'inline', long = false, style }: SimulationBadgeProps) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={[styles.root, { backgroundColor: colors.simulation }, mode === 'floating' && styles.floating, style]}
      accessibilityRole="text"
      accessibilityLabel={t('sim.badgeLong')}
    >
      <FlaskIcon size={12} color="#FFFFFF" strokeWidth={2.4} />
      <Text variant="small" style={styles.label}>
        {long ? t('sim.badgeLong') : t('sim.badge')}
      </Text>
    </Animated.View>
  );
}

/** Full-width banner used under headers when simulation is on. */
export function SimulationBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={[styles.banner, { backgroundColor: colors.simulationSoft }, style]}>
      <View style={[styles.bannerDot, { backgroundColor: colors.simulation }]}>
        <FlaskIcon size={12} color="#FFFFFF" strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="captionStrong" color="simulation">
          {t('sim.badgeLong')}
        </Text>
        <Text variant="small" color="secondary">
          {t('dashboard.simulationBadgeHint')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  floating: { position: 'absolute', top: spacing.sm, right: spacing.md, zIndex: 10, elevation: 3 },
  label: { color: '#FFFFFF', fontWeight: '700', marginLeft: 4, letterSpacing: 0.6 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  bannerDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
});
