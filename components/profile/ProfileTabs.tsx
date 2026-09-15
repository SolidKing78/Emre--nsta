import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GridIcon, ReelsIcon, TaggedIcon } from '@/components/icons';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

export type ProfileTab = 'grid' | 'reels' | 'tagged';

interface ProfileTabsProps {
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

const TABS: ProfileTab[] = ['grid', 'reels', 'tagged'];

/** Instagram profile tabs: icon-only with a sliding underline. */
export function ProfileTabs({ value, onChange }: ProfileTabsProps) {
  const { colors } = useTheme();
  const t = useT();
  const [width, setWidth] = useState(0);
  const index = TABS.indexOf(value);
  const segment = width / TABS.length;
  const x = useSharedValue(index * segment);
  useEffect(() => {
    x.value = withSpring(index * segment, { damping: 20, stiffness: 240 });
  }, [index, segment, x]);
  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const labels: Record<ProfileTab, string> = { grid: t('profile.grid'), reels: t('profile.reels'), tagged: t('profile.taggedTitle') };

  return (
    <View style={[styles.root, { borderTopColor: colors.border, borderBottomColor: colors.border }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {TABS.map((tab) => {
        const active = tab === value;
        const color = active ? colors.text : colors.textTertiary;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={labels[tab]}
            style={styles.tab}
            onPress={() => {
              if (!active) triggerHaptic('selection');
              onChange(tab);
            }}
          >
            {tab === 'grid' ? <GridIcon color={color} size={24} strokeWidth={active ? 2 : 1.6} /> : tab === 'reels' ? <ReelsIcon color={color} size={24} strokeWidth={active ? 2 : 1.6} /> : <TaggedIcon color={color} size={24} strokeWidth={active ? 2 : 1.6} />}
          </Pressable>
        );
      })}
      {segment > 0 ? <Animated.View style={[styles.underline, { width: segment, backgroundColor: colors.text }, underline]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, position: 'relative' },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  underline: { position: 'absolute', bottom: 0, left: 0, height: 1.5 },
});
