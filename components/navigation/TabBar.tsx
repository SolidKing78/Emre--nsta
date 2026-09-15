import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/common/Avatar';
import { HomeIcon, ReelsIcon, SearchIcon, ShareIcon } from '@/components/icons';
import { touch } from '@/constants/theme';
import { useAccount } from '@/features/instagram/hooks';
import { useEffectiveAccount } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICON = 26;

function TabIcon({ name, focused, color, avatarUrl }: { name: string; focused: boolean; color: string; avatarUrl?: string }) {
  switch (name) {
    case 'home':
      return <HomeIcon size={ICON} color={color} filled={focused} />;
    case 'reels':
      return <ReelsIcon size={ICON} color={color} filled={focused} />;
    case 'activity':
      return <ShareIcon size={ICON} color={color} strokeWidth={focused ? 2.6 : 2} />;
    case 'search':
      return <SearchIcon size={ICON} color={color} filled={focused} />;
    case 'profile':
      return (
        <View style={[styles.avatarRing, { borderColor: focused ? color : 'transparent' }]}>
          <Avatar uri={avatarUrl} size={ICON - 2} />
        </View>
      );
    default:
      return null;
  }
}

function TabItem({ focused, onPress, onLongPress, label, children }: { focused: boolean; onPress: () => void; onLongPress: () => void; label: string; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={() => {
        scale.set(withSequence(withTiming(0.85, { duration: 70 }), withSpring(1, { damping: 10, stiffness: 300 })));
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <Animated.View style={style}>{children}</Animated.View>
    </Pressable>
  );
}

/** Instagram bottom bar: Home · Reels · Messages · Search · Profile — icons only, filled when active. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { data: account } = useAccount();
  const effective = useEffectiveAccount(account);

  const labels: Record<string, string> = {
    home: t('tabs.home'),
    reels: t('tabs.reels'),
    activity: t('tabs.messages'),
    search: t('tabs.search'),
    profile: t('tabs.profile'),
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.tabBar, borderTopColor: colors.border, paddingBottom: insets.bottom, height: touch.tabBarHeight + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options as { href?: string | null } | undefined;
        if (options?.href === null) return null;
        const onPress = () => {
          triggerHaptic('selection');
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
        return (
          <TabItem key={route.key} focused={focused} onPress={onPress} onLongPress={onLongPress} label={labels[route.name] ?? route.name}>
            <TabIcon name={route.name} focused={focused} color={colors.text} avatarUrl={effective?.profilePictureUrl} />
          </TabItem>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, height: touch.tabBarHeight, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderWidth: 1.5, borderRadius: 999, padding: 1 },
});
